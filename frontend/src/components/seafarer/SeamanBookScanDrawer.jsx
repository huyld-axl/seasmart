import { useState, useRef, useMemo } from 'react'
import {
  Modal,
  Button,
  Progress,
  Table,
  Select,
  Input,
  InputNumber,
  DatePicker,
  Space,
  Alert,
  Typography,
  Tag,
  Tooltip,
  Checkbox,
} from 'antd'
import {
  UploadOutlined,
  DeleteOutlined,
  CameraOutlined,
  GlobalOutlined,
  CheckCircleOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { deploymentApi, vesselApi, lookupApi, seamanBookApi } from '../../api'
import api from '../../api/client'
import dayjs from 'dayjs'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'
const isDesktopDevice = !('ontouchstart' in window) && navigator.maxTouchPoints === 0

export default function SeamanBookScanDrawer({ seafarerId, open, onClose }) {
  const queryClient = useQueryClient()

  const [phase, setPhase] = useState('upload')
  const [progress, setProgress] = useState({ page: 0, total: 0 })
  const [records, setRecords] = useState([])
  const [pageErrors, setPageErrors] = useState([])
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [vesselMatches, setVesselMatches] = useState({}) // key: record.id → { vessel_id, imo_no, ship_name, source }
  const [fetchingImo, setFetchingImo] = useState(null) // imo đang fetch từ internet
  const [vesselSearchRowId, setVesselSearchRowId] = useState(null) // row.id đang mở popup tìm tàu
  const [bookInfo, setBookInfo] = useState(null) // { seaman_book_number, seaman_book_issued_date, seaman_book_expiry }
  const [saveBookInfo, setSaveBookInfo] = useState(true)
  const [vesselSearchInput, setVesselSearchInput] = useState('')
  const esRef = useRef(null)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const rematchTimers = useRef({}) // key: record.id → timer

  const { data: ranks = [] } = useQuery({
    queryKey: ['ranks'],
    queryFn: () => api.get('/lookup/ranks').then((r) => r.data),
  })
  const ranksRef = useRef(ranks)
  ranksRef.current = ranks

  const rankOptions = ranks.map((r) => ({
    value: r.id,
    label: r.name_en || r.code,
    name_vi: r.name_vi || '',
  }))

  const { data: vesselSearchResults = [] } = useQuery({
    queryKey: ['vessel-search-popup', vesselSearchInput],
    queryFn: () => lookupApi.vessels(vesselSearchInput).then((r) => r.data?.data || r.data || []),
    enabled: !!vesselSearchRowId,
  })
  const vesselSearchOptions = useMemo(
    () =>
      vesselSearchResults.map((v) => ({
        value: v.id,
        label: `${v.vessel_name || '—'} (IMO: ${v.imo_number || '—'})${v.flag_country_name ? ` · ${v.flag_country_name}` : ''}`,
        searchText: `${v.vessel_name || ''} ${v.imo_number || ''}`.toLowerCase(),
        vessel_id: v.id,
        imo_no: v.imo_number,
        ship_name: v.vessel_name,
        source: v.id ? 'system' : 'catalog',
      })),
    [vesselSearchResults]
  )

  function matchRank(rankName) {
    if (!rankName) return null
    const name = rankName.toLowerCase()
    const list = ranksRef.current
    for (const r of list) {
      const vi = (r.name_vi || '').toLowerCase()
      const en = (r.name_en || '').toLowerCase()
      if (vi === name || en === name) return r.id
    }
    let bestId = null,
      bestScore = 0
    for (const r of list) {
      const vi = (r.name_vi || '').toLowerCase()
      const en = (r.name_en || '').toLowerCase()
      let score = 0
      if (vi && name.includes(vi)) score = Math.max(score, vi.length)
      if (vi && vi.includes(name)) score = Math.max(score, name.length)
      if (en && name.includes(en)) score = Math.max(score, en.length)
      if (score > bestScore) {
        bestScore = score
        bestId = r.id
      }
    }
    return bestScore >= 4 ? bestId : null
  }

  // auto-match tất cả vessel_name sau khi scan xong (chỉ search local DB + catalog)
  async function autoMatchVessels(recs) {
    const results = await Promise.all(
      recs.map(async (r) => {
        if (!r.vessel_name || r.vessel_name.length < 2) return [r.id, null]
        try {
          const res = await vesselApi.nameSearch(r.vessel_name)
          const top = res.data?.[0] || null
          if (!top) return [r.id, null]
          return [
            r.id,
            {
              vessel_id: top.vessel_id || null,
              imo_no: top.imo_no || null,
              ship_name: top.ship_name || top.vessel_name,
              source: top.vessel_id ? 'system' : 'catalog',
            },
          ]
        } catch {
          return [r.id, null]
        }
      })
    )
    return Object.fromEntries(results)
  }

  function reset() {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
    setPhase('upload')
    setProgress({ page: 0, total: 0 })
    setRecords([])
    setPageErrors([])
    setSaving(false)
    setScanning(false)
    setErrMsg('')
    setVesselMatches({})
    setFetchingImo(null)
    setBookInfo(null)
    setSaveBookInfo(true)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleFile(file) {
    if (!file) return
    setScanning(true)
    setErrMsg('')
    const form = new FormData()
    form.append('file', file)
    let jobId
    try {
      const res = await api.post(`/seafarers/${seafarerId}/scan-seaman-book`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      jobId = res.data.jobId
    } catch (e) {
      setErrMsg(e?.response?.data?.error || 'Upload thất bại. Hãy thử lại.')
      setScanning(false)
      return
    }

    setScanning(false)
    setPhase('scanning')
    const url = `${API_BASE}/seafarers/${seafarerId}/scan-seaman-book/${jobId}/stream`
    const es = new EventSource(url)
    esRef.current = es
    let allRecords = []

    es.onmessage = async (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'start') {
        setProgress({ page: 0, total: data.totalPages })
      } else if (data.type === 'progress') {
        setProgress({ page: data.page, total: data.totalPages })
      } else if (data.type === 'records') {
        const newRecs = data.records.map((r, i) => ({
          id: `${data.page}-${i}`,
          vessel_name: r.vessel_name || '',
          vessel_type: r.vessel_type || '',
          vessel_flag: r.vessel_flag || '',
          vessel_grt: r.vessel_grt || null,
          vessel_dwt: r.vessel_dwt || null,
          main_engine_kw: r.main_engine_kw || null,
          rank_name: r.rank_name || '',
          rank_id: matchRank(r.rank_name),
          join_date: r.join_date || null,
          sign_off_date: r.sign_off_date || null,
          employer: r.employer || '',
        }))
        allRecords = [...allRecords, ...newRecs]
        setRecords(allRecords)
      } else if (data.type === 'book_info') {
        setBookInfo({
          seaman_book_number: data.seaman_book_number || null,
          seaman_book_issued_date: data.seaman_book_issued_date || null,
          seaman_book_expiry: data.seaman_book_expiry || null,
        })
      } else if (data.type === 'page_error') {
        setPageErrors((prev) => [...prev, { page: data.page, error: data.error }])
      } else if (data.type === 'done') {
        es.close()
        esRef.current = null
        setPhase('review')
        // auto-match sau khi scan xong
        const matches = await autoMatchVessels(allRecords)
        setVesselMatches(matches)
      } else if (data.type === 'error') {
        setErrMsg(`Lỗi scan: ${data.error}`)
        es.close()
        esRef.current = null
        setPhase('review')
      }
    }

    es.onerror = () => {
      es.close()
      esRef.current = null
      setPhase('review')
    }
  }

  function onInputChange(e) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  function openPicker(ref, e) {
    e.preventDefault()
    e.stopPropagation()
    ref.current?.click()
  }

  function updateRecord(id, field, value) {
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  function handleVesselNameChange(id, value) {
    updateRecord(id, 'vessel_name', value)
    // reset match ngay khi user bắt đầu sửa
    setVesselMatches((prev) => ({ ...prev, [id]: undefined }))
    clearTimeout(rematchTimers.current[id])
    if (!value || value.length < 2) {
      setVesselMatches((prev) => ({ ...prev, [id]: null }))
      return
    }
    rematchTimers.current[id] = setTimeout(async () => {
      try {
        const res = await vesselApi.nameSearch(value)
        const top = res.data?.[0] || null
        setVesselMatches((prev) => ({
          ...prev,
          [id]: top
            ? {
                vessel_id: top.vessel_id || null,
                imo_no: top.imo_no || null,
                ship_name: top.ship_name || top.vessel_name,
                source: top.vessel_id ? 'system' : 'catalog',
              }
            : null,
        }))
      } catch {
        setVesselMatches((prev) => ({ ...prev, [id]: null }))
      }
    }, 600)
  }

  function removeRecord(id) {
    setRecords((prev) => prev.filter((r) => r.id !== id))
    setVesselMatches((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  function addBlankRecord() {
    const id = `manual-${Date.now()}`
    setRecords((prev) => [
      ...prev,
      {
        id,
        vessel_name: '',
        vessel_type: '',
        vessel_flag: '',
        vessel_grt: null,
        vessel_dwt: null,
        main_engine_kw: null,
        rank_name: '',
        rank_id: null,
        join_date: null,
        sign_off_date: null,
        employer: '',
      },
    ])
    setVesselMatches((prev) => ({ ...prev, [id]: null }))
  }

  async function handleFetchFromInternet(recordId, imo) {
    Modal.confirm({
      title: 'Lấy thông tin tàu từ internet?',
      content: `Sẽ gọi API để lấy đầy đủ thông tin cho IMO ${imo}.`,
      okText: 'Lấy',
      cancelText: 'Hủy',
      onOk: async () => {
        setFetchingImo(imo)
        try {
          const res = await vesselApi.fetchExternalByImo(imo, false)
          const vessel = res.data?.vessel
          if (vessel) {
            setVesselMatches((prev) => ({
              ...prev,
              [recordId]: {
                vessel_id: vessel.id,
                imo_no: imo,
                ship_name: vessel.vessel_name,
                source: 'system',
              },
            }))
          }
        } catch (e) {
          const retryAfter = e?.response?.data?.retry_after
          if (retryAfter) {
            Modal.warning({
              title: 'Chờ trước khi cập nhật lại',
              content: `Vui lòng chờ ${retryAfter} giây trước khi lấy lại thông tin tàu này.`,
            })
          } else {
            Modal.error({
              title: 'Lỗi',
              content: e?.response?.data?.error || 'Không thể lấy thông tin tàu từ internet',
            })
          }
        } finally {
          setFetchingImo(null)
        }
      },
    })
  }

  function handleVesselSearchSelect(_, option) {
    if (!option || !vesselSearchRowId) return
    setVesselMatches((prev) => ({
      ...prev,
      [vesselSearchRowId]: {
        vessel_id: option.vessel_id || null,
        imo_no: option.imo_no || null,
        ship_name: option.ship_name,
        source: option.source,
      },
    }))
    setVesselSearchRowId(null)
    setVesselSearchInput('')
  }

  async function handleSave() {
    const toSave = records.filter((r) => r.vessel_name)
    if (toSave.length === 0) {
      setErrMsg('Không có record nào để lưu')
      return
    }
    setSaving(true)
    let saved = 0,
      _failed = 0

    for (const r of toSave) {
      try {
        let vessel_id = vesselMatches[r.id]?.vessel_id || null

        // catalog match chưa có vessel_id → tạo minimal vessel record
        if (
          !vessel_id &&
          vesselMatches[r.id]?.source === 'catalog' &&
          vesselMatches[r.id]?.imo_no
        ) {
          try {
            const created = await vesselApi.create({
              vessel_name: r.vessel_name,
              imo_number: String(vesselMatches[r.id].imo_no),
            })
            vessel_id = created.data?.id || null
          } catch {
            /* nếu đã tồn tại thì bỏ qua, vessel_id vẫn null */
          }
        }

        await deploymentApi.create(seafarerId, {
          vessel_id: vessel_id || undefined,
          vessel_name: r.vessel_name,
          vessel_type: r.vessel_type || null,
          vessel_flag: r.vessel_flag || null,
          vessel_grt: r.vessel_grt || null,
          vessel_dwt: r.vessel_dwt || null,
          main_engine_kw: r.main_engine_kw || null,
          rank_id: r.rank_id || null,
          join_date: r.join_date || null,
          sign_off_date: r.sign_off_date || null,
          notes: r.employer ? `Tổ chức quản lý: ${r.employer}` : null,
          status: 'signed_off',
        })
        saved++
      } catch {
        _failed++
      }
    }

    // Lưu thông tin sổ thuyền viên nếu đã chọn
    if (saveBookInfo && bookInfo && bookInfo.seaman_book_number) {
      try {
        await seamanBookApi.create(seafarerId, {
          book_number: bookInfo.seaman_book_number,
          issued_date: bookInfo.seaman_book_issued_date || null,
          expiry_date: bookInfo.seaman_book_expiry || null,
        })
        queryClient.invalidateQueries({ queryKey: ['seaman-books', seafarerId] })
      } catch {
        /* bỏ qua lỗi */
      }
    }

    setSaving(false)
    if (saved > 0) {
      queryClient.invalidateQueries({ queryKey: ['deployments', String(seafarerId)] })
      handleClose()
    } else {
      setErrMsg('Lưu thất bại')
    }
  }

  const percent = progress.total > 0 ? Math.round((progress.page / progress.total) * 100) : 0

  // cột vessel match — hiện ở review phase
  const vesselMatchColumn = {
    title: 'Khớp tàu',
    key: 'vessel_match',
    width: 180,
    render: (_, row) => {
      const m = vesselMatches[row.id]
      if (m === undefined) return <span style={{ color: '#ccc', fontSize: 12 }}>Đang tìm...</span>
      if (!m)
        return (
          <Space size={4} direction="vertical">
            <span style={{ color: '#999', fontSize: 12 }}>Không có thông tin tàu</span>
            <Button
              size="small"
              icon={<SearchOutlined />}
              onClick={() => {
                setVesselSearchInput(row.vessel_name || '')
                setVesselSearchRowId(row.id)
              }}
              style={{ fontSize: 11 }}
            >
              Tìm tàu
            </Button>
          </Space>
        )
      const clearBtn = (
        <Tooltip title="Xóa mapping này">
          <Button
            size="small"
            type="text"
            danger
            style={{ fontSize: 11, padding: '0 4px', height: 20, lineHeight: '20px' }}
            onClick={() => setVesselMatches((prev) => ({ ...prev, [row.id]: null }))}
          >
            ✕
          </Button>
        </Tooltip>
      )

      if (m.source === 'system') {
        return (
          <Space size={4}>
            <Tooltip title={`IMO: ${m.imo_no || '-'}`}>
              <Tag
                icon={<CheckCircleOutlined />}
                color="success"
                style={{
                  fontSize: 11,
                  maxWidth: 150,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {m.ship_name}
              </Tag>
            </Tooltip>
            {clearBtn}
          </Space>
        )
      }
      // catalog
      return (
        <Space size={4} direction="vertical" style={{ width: '100%' }}>
          <Space size={4}>
            <Tooltip title={`IMO: ${m.imo_no || '-'} · Chỉ có trong catalog`}>
              <Tag
                color="warning"
                style={{
                  fontSize: 11,
                  maxWidth: 140,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {m.ship_name}
              </Tag>
            </Tooltip>
            {clearBtn}
          </Space>
          {m.imo_no && /^\d{7}$/.test(String(m.imo_no)) && (
            <Button
              size="small"
              icon={<GlobalOutlined />}
              loading={fetchingImo === m.imo_no}
              onClick={() => handleFetchFromInternet(row.id, m.imo_no)}
              style={{ fontSize: 11 }}
            >
              Lưu lại thông tin tàu này
            </Button>
          )}
        </Space>
      )
    },
  }

  const columns = [
    {
      title: 'Tên tàu',
      dataIndex: 'vessel_name',
      width: 150,
      render: (v, row) => (
        <Input
          size="small"
          value={v}
          onChange={(e) => handleVesselNameChange(row.id, e.target.value)}
        />
      ),
    },
    {
      title: 'Loại tàu',
      dataIndex: 'vessel_type',
      width: 110,
      render: (v, row) => (
        <Input
          size="small"
          value={v}
          placeholder="Bulk, Tanker..."
          onChange={(e) => updateRecord(row.id, 'vessel_type', e.target.value)}
        />
      ),
    },
    {
      title: 'Cờ hiệu',
      dataIndex: 'vessel_flag',
      width: 90,
      render: (v, row) => (
        <Input
          size="small"
          value={v}
          placeholder="Panama..."
          onChange={(e) => updateRecord(row.id, 'vessel_flag', e.target.value)}
        />
      ),
    },
    {
      title: 'GRT',
      dataIndex: 'vessel_grt',
      width: 80,
      render: (v, row) => (
        <InputNumber
          size="small"
          style={{ width: '100%' }}
          value={v}
          min={0}
          onChange={(val) => updateRecord(row.id, 'vessel_grt', val)}
        />
      ),
    },
    {
      title: 'kW',
      dataIndex: 'main_engine_kw',
      width: 80,
      render: (v, row) => (
        <InputNumber
          size="small"
          style={{ width: '100%' }}
          value={v}
          min={0}
          onChange={(val) => updateRecord(row.id, 'main_engine_kw', val)}
        />
      ),
    },
    {
      title: 'Chức danh',
      dataIndex: 'rank_id',
      width: 190,
      render: (v, row) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          placeholder={
            row.rank_name ? (
              <strong style={{ color: '#faad14' }}>{row.rank_name}</strong>
            ) : (
              'Chọn chức danh'
            )
          }
          value={v || undefined}
          options={rankOptions}
          onChange={(val) => updateRecord(row.id, 'rank_id', val)}
          showSearch
          filterOption={(input, opt) => {
            const q = input.toLowerCase()
            return (
              (opt.label || '').toLowerCase().includes(q) ||
              (opt.name_vi || '').toLowerCase().includes(q)
            )
          }}
          allowClear
        />
      ),
    },
    {
      title: 'Lên tàu',
      dataIndex: 'join_date',
      width: 125,
      render: (v, row) => (
        <DatePicker
          size="small"
          style={{ width: '100%' }}
          value={v ? dayjs(v) : null}
          format="DD/MM/YYYY"
          onChange={(d) => updateRecord(row.id, 'join_date', d ? d.format('YYYY-MM-DD') : null)}
          placeholder="Chọn ngày"
        />
      ),
    },
    {
      title: 'Rời tàu',
      dataIndex: 'sign_off_date',
      width: 125,
      render: (v, row) => (
        <DatePicker
          size="small"
          style={{ width: '100%' }}
          value={v ? dayjs(v) : null}
          format="DD/MM/YYYY"
          onChange={(d) => updateRecord(row.id, 'sign_off_date', d ? d.format('YYYY-MM-DD') : null)}
          placeholder="Chọn ngày"
        />
      ),
    },
    {
      title: 'Tổ chức quản lý',
      dataIndex: 'employer',
      width: 150,
      render: (v, row) => (
        <Input
          size="small"
          value={v}
          onChange={(e) => updateRecord(row.id, 'employer', e.target.value)}
        />
      ),
    },
    vesselMatchColumn,
    {
      title: '',
      width: 36,
      render: (_, row) => (
        <Button
          size="small"
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeRecord(row.id)}
        />
      ),
    },
  ]

  const scanningColumns = [columns[0], columns[6], columns[7]]

  return (
    <>
      <Modal
        title="Scan sổ thuyền viên"
        open={open}
        onCancel={handleClose}
        maskClosable={false}
        width="min(1400px, 98vw)"
        styles={{ body: { overflowX: 'auto' } }}
        destroyOnHidden
        footer={
          phase === 'review' ? (
            <Space>
              <Button icon={<PlusOutlined />} onClick={addBlankRecord}>
                Thêm dòng
              </Button>
              <Button onClick={reset}>Quét lại</Button>
              <Button onClick={handleClose}>Hủy</Button>
              <Button
                type="primary"
                loading={saving}
                disabled={records.length === 0}
                onClick={handleSave}
              >
                Lưu {records.length} record
              </Button>
            </Space>
          ) : (
            <Button onClick={handleClose}>Đóng</Button>
          )
        }
      >
        {errMsg && (
          <Alert
            type="error"
            message={errMsg}
            style={{ marginBottom: 16 }}
            closable
            onClose={() => setErrMsg('')}
          />
        )}

        {phase === 'upload' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <Typography.Text
              type="secondary"
              style={{ display: 'block', marginBottom: 16, fontSize: 13 }}
            >
              Tải lên file PDF sổ thuyền viên để đọc lịch sử đi tàu
            </Typography.Text>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={onInputChange}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept=".pdf,image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={onInputChange}
            />
            {isDesktopDevice ? (
              <Button
                htmlType="button"
                icon={<UploadOutlined />}
                size="large"
                type="primary"
                loading={scanning}
                onClick={(e) => openPicker(fileInputRef, e)}
              >
                {scanning ? 'Đang tải lên...' : 'Chọn file PDF'}
              </Button>
            ) : (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Button
                  htmlType="button"
                  icon={<CameraOutlined />}
                  size="large"
                  type="primary"
                  loading={scanning}
                  onClick={(e) => openPicker(cameraInputRef, e)}
                  style={{ width: '100%' }}
                >
                  {scanning ? 'Đang tải lên...' : 'Chụp / quét trang'}
                </Button>
                <Button
                  htmlType="button"
                  icon={<UploadOutlined />}
                  size="middle"
                  loading={scanning}
                  onClick={(e) => openPicker(fileInputRef, e)}
                  style={{ width: '100%' }}
                >
                  Chọn file PDF từ thiết bị
                </Button>
              </Space>
            )}
            <Typography.Text
              type="secondary"
              style={{ display: 'block', marginTop: 12, fontSize: 12 }}
            >
              Chỉ nhận file .pdf — tối đa 50MB
            </Typography.Text>
          </div>
        )}

        {phase === 'scanning' && (
          <div>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Đang đọc trang <strong>{progress.page}</strong> / {progress.total}...
            </Typography.Text>
            <Progress percent={percent} status="active" style={{ marginBottom: 24 }} />
            {records.length > 0 && (
              <>
                <Typography.Text
                  type="success"
                  style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}
                >
                  Đã tìm thấy {records.length} record
                </Typography.Text>
                <Table
                  rowKey="id"
                  size="small"
                  columns={scanningColumns}
                  dataSource={records}
                  pagination={false}
                  scroll={{ x: 400 }}
                />
              </>
            )}
          </div>
        )}

        {phase === 'review' &&
          bookInfo &&
          (bookInfo.seaman_book_number ||
            bookInfo.seaman_book_issued_date ||
            bookInfo.seaman_book_expiry) && (
            <Alert
              type="success"
              style={{ marginBottom: 12 }}
              message={
                <Space size={4} wrap>
                  <strong>Thông tin sổ thuyền viên đã quét:</strong>
                  {bookInfo.seaman_book_number && (
                    <span>
                      Số sổ: <strong>{bookInfo.seaman_book_number}</strong>
                    </span>
                  )}
                  {bookInfo.seaman_book_issued_date && (
                    <span>
                      Ngày cấp:{' '}
                      <strong>
                        {dayjs(bookInfo.seaman_book_issued_date).format('DD/MM/YYYY')}
                      </strong>
                    </span>
                  )}
                  {bookInfo.seaman_book_expiry && (
                    <span>
                      Hết hạn:{' '}
                      <strong>{dayjs(bookInfo.seaman_book_expiry).format('DD/MM/YYYY')}</strong>
                    </span>
                  )}
                  <Checkbox
                    checked={saveBookInfo}
                    onChange={(e) => setSaveBookInfo(e.target.checked)}
                  >
                    Lưu vào hồ sơ
                  </Checkbox>
                </Space>
              }
            />
          )}

        {phase === 'review' && (
          <>
            {pageErrors.length > 0 && (
              <Alert
                type="warning"
                style={{ marginBottom: 12 }}
                message={`${pageErrors.length} trang bị lỗi khi đọc (trang ${pageErrors.map((e) => e.page).join(', ')}). Kết quả có thể không đầy đủ.`}
                description={pageErrors[0]?.error}
              />
            )}
            {records.length === 0 ? (
              <Alert
                type="warning"
                message="Không tìm thấy bảng lịch sử đi tàu nào. Kiểm tra lại file PDF."
              />
            ) : (
              <>
                <Alert
                  type="info"
                  style={{ marginBottom: 12 }}
                  message={`Tìm thấy ${records.length} record. Cột "Khớp tàu" hiện kết quả tìm kiếm tự động — tàu đã có (xanh), từ catalog (vàng, có thể lấy từ internet), hoặc không tìm thấy.`}
                />
                <Table
                  rowKey="id"
                  size="small"
                  columns={columns}
                  dataSource={records}
                  pagination={false}
                  scroll={{ x: 1380 }}
                />
              </>
            )}
          </>
        )}
      </Modal>

      <Modal
        title="Tìm tàu"
        open={!!vesselSearchRowId}
        onCancel={() => {
          setVesselSearchRowId(null)
          setVesselSearchInput('')
        }}
        footer={null}
        width={480}
        destroyOnClose
      >
        <Select
          showSearch
          autoFocus
          style={{ width: '100%' }}
          placeholder="Nhập tên tàu hoặc IMO..."
          filterOption={(input, option) =>
            (option?.searchText || '').includes((input || '').toLowerCase())
          }
          defaultValue={vesselSearchInput || undefined}
          onSearch={setVesselSearchInput}
          options={vesselSearchOptions}
          onChange={handleVesselSearchSelect}
          notFoundContent="Không tìm thấy tàu"
          allowClear
        />
      </Modal>
    </>
  )
}
