import { useState, useMemo, useEffect, useRef } from 'react'
import dayjs from 'dayjs'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  App,
  Table,
  Input,
  Select,
  Button,
  Form,
  Tag,
  Space,
  Grid,
  Spin,
  Pagination,
  Modal,
  Typography,
  Tooltip,
  DatePicker,
  Tree,
  AutoComplete,
} from 'antd'
import {
  SearchOutlined,
  PlusOutlined,
  UploadOutlined,
  DownloadOutlined,
  PhoneOutlined,
  RightOutlined,
  DeleteOutlined,
  ClearOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { seafarerApi, seafarerCallApi, lookupApi, deploymentApi, vesselApi } from '../../api'
import api from '../../api/client'
import ZaloButton from '../../components/common/ZaloButton'
import useAuthStore from '../../stores/authStore'
import useTranslation from '../../hooks/useTranslation'

const { useBreakpoint } = Grid
const { Text } = Typography
const { RangePicker } = DatePicker

const STATUS_COLOR = {
  STANDBY: 'green',
  ONBOARD: 'gold',
  OFFSHIFT: 'orange',
  RESERVE: 'blue',
  SIGNOFF: 'red',
}

const STATUS_CODES = ['STANDBY', 'ONBOARD', 'OFFSHIFT', 'RESERVE', 'SIGNOFF']

function formatDate(value) {
  return value ? dayjs(value).format('DD/MM/YYYY') : '-'
}

function renderCertificateSummary(items, mode = 'expiring') {
  if (!items?.length) {
    return <span style={{ color: '#bfbfbf' }}>-</span>
  }

  const color = mode === 'expired' ? '#cf1322' : '#d48806'
  const bg = mode === 'expired' ? '#fff1f0' : '#fff7e6'
  const border = mode === 'expired' ? '#ffa39e' : '#ffd591'
  const preview = items.slice(0, 3)
  const remain = items.length - preview.length

  return (
    <Tooltip
      title={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {preview.map((item) => (
            <div key={`${item.seafarer_id}-${item.cert_type_name}-${item.expiry_date || 'na'}`}>
              <strong>{item.cert_type_name || 'Chứng chỉ'}</strong>
              {' - '}
              {item.expiry_date ? dayjs(item.expiry_date).format('DD/MM/YYYY') : '-'}
            </div>
          ))}
          {remain > 0 && <div>+{remain} chứng chỉ khác</div>}
        </div>
      }
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 10px',
          borderRadius: 999,
          border: `1px solid ${border}`,
          background: bg,
          color,
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontSize: 14 }}>{items.length}</span>
        <span>chứng chỉ</span>
      </div>
    </Tooltip>
  )
}

function normalizeQuickDeploymentRow(row) {
  if (!row) return null
  return {
    vessel_name: typeof row.vessel_name === 'string' ? row.vessel_name.trim() : '',
    rank_id: row.rank_id ?? null,
    join_date: row.join_date || null,
    sign_off_date: row.sign_off_date || null,
  }
}

function hasQuickDeploymentData(row) {
  const normalizedRow = normalizeQuickDeploymentRow(row)
  if (!normalizedRow) return false
  return Boolean(
    normalizedRow.join_date ||
    normalizedRow.sign_off_date ||
    normalizedRow.vessel_name ||
    normalizedRow.rank_id != null
  )
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function getFilenameFromContentDisposition(header, fallback) {
  if (!header) return fallback
  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match) return decodeURIComponent(utf8Match[1])
  const asciiMatch = header.match(/filename="?([^";]+)"?/i)
  if (asciiMatch) return asciiMatch[1]
  return fallback
}

export default function SeafarerListPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { user } = useAuthStore()
  const isReadOnly = !['admin', 'operator', 'accountant'].includes(user?.role)
  const canEditStatus = ['admin', 'operator'].includes(user?.role)
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    vessel_name: '',
    rank_ids: [],
    sort_by: 'updated_at',
    sort_order: 'desc',
    page: 1,
    limit: 20,
  })
  const [searchInput, setSearchInput] = useState('')
  const [vesselNameInput, setVesselNameInput] = useState('')
  const [vesselFilterOptions, setVesselFilterOptions] = useState([])
  const [exporting, setExporting] = useState(false)
  const [exportingDispatchDecision, setExportingDispatchDecision] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [dispatchDecisionModalOpen, setDispatchDecisionModalOpen] = useState(false)
  const [dispatchVesselOptions, setDispatchVesselOptions] = useState([])
  const [dispatchSelectedVesselInfo, setDispatchSelectedVesselInfo] = useState(null)
  const [callModal, setCallModal] = useState({ open: false, seafarer: null })
  const [callNote, setCallNote] = useState('')
  const [callDateTime, setCallDateTime] = useState(null)
  const [quickDeploymentSeafarerId, setQuickDeploymentSeafarerId] = useState(null)
  const quickDeploymentModal = { open: false, seafarer: null }
  const [quickDeploymentRow, setQuickDeploymentRow] = useState(null)
  const [quickVesselSearchOpen, setQuickVesselSearchOpen] = useState(false)
  const [quickVesselSearchQ, setQuickVesselSearchQ] = useState('')
  const [quickVesselSearchResults, setQuickVesselSearchResults] = useState([])
  const [quickVesselSearchLoading, setQuickVesselSearchLoading] = useState(false)
  const [quickVesselOptions, setQuickVesselOptions] = useState([])
  const [quickVesselId, setQuickVesselId] = useState(null)
  const [quickSelectedVesselInfo, setQuickSelectedVesselInfo] = useState(null)
  const [quickVesselDetail, setQuickVesselDetail] = useState(null)
  const [fetchingQuickVesselDetail, setFetchingQuickVesselDetail] = useState(false)
  const queryClient = useQueryClient()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [dispatchDecisionForm] = Form.useForm()
  const quickVesselSearchTimer = useRef(null)
  const quickInlineSearchTimer = useRef(null)
  const dispatchVesselSearchTimer = useRef(null)
  const vesselFilterSearchTimer = useRef(null)
  const quickInlineHasData = hasQuickDeploymentData(quickDeploymentRow, null)
  const selectedDispatchDecisionIds = useMemo(
    () => selectedRowKeys.map((id) => Number(id)).filter(Boolean),
    [selectedRowKeys]
  )

  const deleteMutation = useMutation({
    mutationFn: (seafarerId) => api.delete(`/seafarers/${seafarerId}`),
    onSuccess: () => {
      message.success(t('seafarer.deleted'))
      queryClient.invalidateQueries({ queryKey: ['seafarers'] })
    },
    onError: (e) => message.error(e.response?.data?.error || t('seafarer.deleteFailed')),
  })

  const logCallMutation = useMutation({
    mutationFn: ({ seafarerId, note, called_at }) =>
      seafarerCallApi.create(seafarerId, { note, called_at }),
    onSuccess: () => {
      message.success(t('seafarer.callLogged'))
      setCallModal({ open: false, seafarer: null })
      setCallNote('')
      setCallDateTime(null)
      queryClient.invalidateQueries({ queryKey: ['seafarers'] })
    },
    onError: () => message.error(t('seafarer.callLogFailed')),
  })

  const statusMutation = useMutation({
    mutationFn: ({ seafarerId, status }) => seafarerApi.update(seafarerId, { status }),
    onSuccess: async (_, variables) => {
      message.success('Cập nhật trạng thái thành công')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['seafarers'] }),
        queryClient.invalidateQueries({ queryKey: ['seafarers-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['seafarer', variables.seafarerId] }),
      ])
    },
    onError: (e) => message.error(e.response?.data?.error || 'Cập nhật thất bại'),
  })

  const quickDeploymentMutation = useMutation({
    mutationFn: async ({ seafarerId, row, currentRankId }) => {
      const normalizedRow = normalizeQuickDeploymentRow(row)
      let vessel_id = quickVesselId
      if (!vessel_id) {
        const matched = quickVesselOptions.find(
          (option) => option.value === normalizedRow.vessel_name
        )
        if (matched?.imo_no && /^\d{7}$/.test(String(matched.imo_no))) {
          try {
            const res = await vesselApi.create({
              vessel_name: normalizedRow.vessel_name,
              imo_number: String(matched.imo_no),
            })
            vessel_id = res.data?.id || null
          } catch {
            /* bo qua neu tau da ton tai */
          }
        }
      }

      const createdDeployment = await deploymentApi.create(seafarerId, {
        vessel_id: vessel_id || undefined,
        vessel_name: normalizedRow.vessel_name || null,
        rank_id: normalizedRow.rank_id,
        join_date: normalizedRow.join_date,
        sign_off_date: normalizedRow.sign_off_date,
      })

      const shouldUpdateCurrentRank =
        normalizedRow.rank_id && normalizedRow.rank_id !== (currentRankId ?? null)
      let currentRankUpdated = true
      let currentRankUpdateError = null
      if (shouldUpdateCurrentRank) {
        try {
          await seafarerApi.update(seafarerId, { current_rank_id: normalizedRow.rank_id })
        } catch (error) {
          currentRankUpdated = false
          currentRankUpdateError = error
        }
      }

      return { createdDeployment, currentRankUpdated, currentRankUpdateError }
    },
    onSuccess: (result) => {
      if (result.currentRankUpdated === false) {
        message.warning(
          result.currentRankUpdateError?.response?.data?.error ||
            'Đã thêm quá trình đi biển nhưng chưa cập nhật rank hiện tại của thuyền viên'
        )
      } else {
        message.success('Thêm quá trình đi biển thành công')
      }
      queryClient.invalidateQueries({ queryKey: ['seafarers'] })
      queryClient.invalidateQueries({ queryKey: ['seafarers-stats'] })
      queryClient.invalidateQueries({ queryKey: ['seafarer'] })
      queryClient.invalidateQueries({ queryKey: ['deployments'] })
      resetQuickDeploymentState()
    },
    onError: (e) => message.error(e.response?.data?.error || 'Them qua trinh di bien that bai'),
  })

  function openCallModal(seafarer) {
    setCallModal({ open: true, seafarer })
    setCallDateTime(dayjs())
    setCallNote('')
  }

  function closeCallModal() {
    setCallModal({ open: false, seafarer: null })
    setCallNote('')
    setCallDateTime(null)
  }

  function resetQuickDeploymentState() {
    setQuickDeploymentSeafarerId(null)
    setQuickDeploymentRow(null)
    setQuickVesselSearchOpen(false)
    setQuickVesselSearchQ('')
    setQuickVesselSearchResults([])
    setQuickVesselSearchLoading(false)
    setQuickVesselOptions([])
    setQuickVesselId(null)
    setQuickSelectedVesselInfo(null)
    setQuickVesselDetail(null)
    setFetchingQuickVesselDetail(false)
    clearTimeout(quickVesselSearchTimer.current)
    clearTimeout(quickInlineSearchTimer.current)
  }

  function openQuickDeploymentInline(seafarer) {
    setQuickDeploymentSeafarerId(seafarer.id)
    setQuickDeploymentRow({
      vessel_name: '',
      rank_id: seafarer.current_rank_id || null,
      join_date: null,
      sign_off_date: null,
    })
    setQuickVesselSearchLoading(false)
    setQuickVesselOptions([])
    setQuickVesselId(null)
    setQuickSelectedVesselInfo(null)
    setQuickVesselDetail(null)
    setFetchingQuickVesselDetail(false)
    setQuickVesselSearchQ('')
    setQuickVesselSearchResults([])
  }

  function handleQuickVesselSearchQ(value) {
    setQuickVesselSearchQ(value)
    clearTimeout(quickVesselSearchTimer.current)
    if (value.length < 2) {
      setQuickVesselSearchResults([])
      setQuickVesselSearchLoading(false)
      return
    }
    setQuickVesselSearchLoading(true)
    quickVesselSearchTimer.current = setTimeout(async () => {
      try {
        const res = await vesselApi.nameSearch(value)
        setQuickVesselSearchResults(res.data || [])
      } catch {
        setQuickVesselSearchResults([])
      } finally {
        setQuickVesselSearchLoading(false)
      }
    }, 350)
  }

  async function applyQuickVesselSelection(vesselInfo) {
    setQuickDeploymentRow((prev) => ({
      ...prev,
      vessel_name: vesselInfo.ship_name || vesselInfo.vessel_name || '',
    }))
    setQuickVesselId(vesselInfo.vessel_id || null)
    setQuickSelectedVesselInfo(vesselInfo)
    setQuickVesselDetail(null)
    if (vesselInfo.vessel_id) {
      setFetchingQuickVesselDetail(true)
      try {
        const res = await vesselApi.getById(vesselInfo.vessel_id)
        setQuickVesselDetail(res.data)
      } catch {
        /* bo qua */
      } finally {
        setFetchingQuickVesselDetail(false)
      }
    }
  }

  function handleQuickVesselSearchSelect(vessel) {
    applyQuickVesselSelection(vessel)
    setQuickVesselSearchOpen(false)
    setQuickVesselSearchQ('')
    setQuickVesselSearchResults([])
  }

  function handleQuickInlineVesselSearch(value) {
    setQuickDeploymentRow((prev) => ({ ...prev, vessel_name: value }))
    setQuickVesselId(null)
    setQuickSelectedVesselInfo(null)
    setQuickVesselDetail(null)
    clearTimeout(quickInlineSearchTimer.current)
    if (value.length < 2) {
      setQuickVesselOptions([])
      return
    }
    quickInlineSearchTimer.current = setTimeout(async () => {
      try {
        const res = await vesselApi.nameSearch(value)
        setQuickVesselOptions(
          (res.data || []).map((v, index) => ({
            value: v.ship_name || '',
            key: `${v.ship_name || 'vessel'}-${v.vessel_id || v.imo_no || index}`,
            vessel_id: v.vessel_id || null,
            imo_no: v.imo_no,
            ship_type: v.ship_type || null,
            country_name: v.country_name || null,
            label: (
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong>{v.ship_name}</strong>
                <span style={{ color: '#999', fontSize: 11 }}>
                  {v.vessel_id ? '✅' : '🔍'}
                  {v.imo_no ? ` IMO ${v.imo_no}` : ''}
                </span>
              </span>
            ),
          }))
        )
      } catch {
        setQuickVesselOptions([])
      }
    }, 350)
  }

  async function handleExport() {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (filters.search) params.set('search', filters.search)
      if (filters.status) params.set('status', filters.status)
      if (filters.vessel_name) params.set('vessel_name', filters.vessel_name)
      if (filters.rank_ids?.length) params.set('rank_ids', filters.rank_ids.join(','))

      const res = await api.get(`/seafarers/export?${params}`, { responseType: 'blob' })
      downloadBlob(res.data, `thuyen-vien-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch {
      message.error(t('seafarer.exportFailed'))
    } finally {
      setExporting(false)
    }
  }

  function openDispatchDecisionModal() {
    if (!selectedRowKeys.length) return
    const rows = data?.data || []
    const orderedSelected = selectedDispatchDecisionIds
      .map((id) => rows.find((r) => Number(r.id) === id))
      .filter(Boolean)
    const vesselName = orderedSelected.find((r) => r.latest_vessel_name)?.latest_vessel_name || ''
    const joinDateRaw = orderedSelected.find((r) => r.latest_join_date)?.latest_join_date || null
    const firstJoinDate = joinDateRaw ? dayjs(joinDateRaw) : null
    dispatchDecisionForm.resetFields()
    dispatchDecisionForm.setFieldsValue({
      vessel_name: vesselName,
      embark_location: '',
      embark_dates: firstJoinDate ? [firstJoinDate, null] : null,
      actual_embark_date: firstJoinDate,
      decision_seq: '',
      decision_year: String(dayjs().year()),
      decision_suffix: 'QĐ-TV-SPT',
      notes: selectedDispatchDecisionIds.map((id) => ({ seafarer_id: id, note: '' })),
    })
    setDispatchVesselOptions([])
    setDispatchSelectedVesselInfo(null)
    setDispatchDecisionModalOpen(true)
  }

  function closeDispatchDecisionModal() {
    setDispatchDecisionModalOpen(false)
    dispatchDecisionForm.resetFields()
    setDispatchVesselOptions([])
    setDispatchSelectedVesselInfo(null)
    clearTimeout(dispatchVesselSearchTimer.current)
  }

  function handleDispatchVesselSearch(value) {
    dispatchDecisionForm.setFieldValue('vessel_name', value)
    setDispatchSelectedVesselInfo(null)
    clearTimeout(dispatchVesselSearchTimer.current)
    if (!value || value.length < 2) {
      setDispatchVesselOptions([])
      return
    }

    dispatchVesselSearchTimer.current = setTimeout(async () => {
      try {
        const res = await vesselApi.nameSearch(value)
        setDispatchVesselOptions(
          (res.data || []).map((vessel, index) => ({
            value: vessel.ship_name || '',
            key: `${vessel.ship_name || 'vessel'}-${vessel.vessel_id || vessel.imo_no || index}`,
            vessel_id: vessel.vessel_id || null,
            imo_no: vessel.imo_no || null,
            ship_type: vessel.ship_type || null,
            country_name: vessel.country_name || null,
            label: (
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong>{vessel.ship_name}</strong>
                <span style={{ color: '#999', fontSize: 11 }}>
                  {vessel.vessel_id ? 'Đã có' : 'Catalog'}
                  {vessel.imo_no ? ` · IMO ${vessel.imo_no}` : ''}
                </span>
              </span>
            ),
          }))
        )
      } catch {
        setDispatchVesselOptions([])
      }
    }, 350)
  }

  function handleVesselFilterSearch(value) {
    setVesselNameInput(value)
    clearTimeout(vesselFilterSearchTimer.current)
    if (!value || value.length < 2) {
      setVesselFilterOptions([])
      return
    }

    vesselFilterSearchTimer.current = setTimeout(async () => {
      try {
        const res = await vesselApi.nameSearch(value)
        setVesselFilterOptions(
          (res.data || []).map((vessel, index) => ({
            value: vessel.ship_name || '',
            key: `${vessel.ship_name || 'vessel'}-${vessel.vessel_id || vessel.imo_no || index}`,
          }))
        )
      } catch {
        setVesselFilterOptions([])
      }
    }, 350)
  }

  async function handleExportDispatchDecision() {
    const values = await dispatchDecisionForm.validateFields()
    setExportingDispatchDecision(true)
    try {
      const decisionSeq = values.decision_seq?.trim() || ''
      const decisionYear = values.decision_year?.trim() || ''
      const decisionSuffix = values.decision_suffix?.trim() || ''
      const decisionNumber =
        decisionSeq || decisionYear || decisionSuffix
          ? `${decisionSeq}/${decisionYear}/${decisionSuffix}`
          : ''
      const res = await seafarerApi.exportDispatchDecision({
        ids: selectedDispatchDecisionIds,
        vessel_name: values.vessel_name?.trim(),
        embark_date_from: values.embark_dates?.[0]?.format('YYYY-MM-DD'),
        embark_date_to: values.embark_dates?.[1]?.format('YYYY-MM-DD'),
        embark_location: values.embark_location?.trim(),
        actual_embark_date: values.actual_embark_date?.format('YYYY-MM-DD'),
        decision_number: decisionNumber,
        notes: (values.notes || []).map((item) => ({
          seafarer_id: Number(item.seafarer_id),
          note: item.note?.trim() || '',
        })),
      })
      const filename = getFilenameFromContentDisposition(
        res.headers?.['content-disposition'],
        `quyet-dinh-dieu-dong-${new Date().toISOString().slice(0, 10)}.docx`
      )
      downloadBlob(res.data, filename)
      closeDispatchDecisionModal()
      setSelectedRowKeys([])
      message.success(
        `Đã xuất quyết định điều động cho ${selectedDispatchDecisionIds.length} thuyền viên`
      )
    } catch (error) {
      message.error(error.response?.data?.error || 'Xuất quyết định điều động thất bại')
    } finally {
      setExportingDispatchDecision(false)
    }
  }

  const { data, isFetching } = useQuery({
    queryKey: ['seafarers', filters],
    queryFn: () => {
      const params = {
        ...filters,
        rank_ids: filters.rank_ids?.length ? filters.rank_ids.join(',') : '',
      }
      return seafarerApi.list(params).then((r) => r.data)
    },
  })

  const { data: dispatchDecisionSeafarers = [], isFetching: isFetchingDispatchDecisionSeafarers } =
    useQuery({
      queryKey: ['dispatch-decision-selection', selectedDispatchDecisionIds],
      queryFn: () =>
        seafarerApi
          .getDispatchDecisionSelection(selectedDispatchDecisionIds)
          .then((response) => response.data || []),
      enabled: dispatchDecisionModalOpen && selectedDispatchDecisionIds.length > 0,
    })

  const { data: ranks } = useQuery({
    queryKey: ['ranks'],
    queryFn: () => lookupApi.ranks().then((r) => r.data),
  })

  const { data: stats } = useQuery({
    queryKey: ['seafarers-stats'],
    queryFn: () => seafarerApi.stats().then((r) => r.data),
  })

  const { data: certsExpiring } = useQuery({
    queryKey: ['certs-expiring-90'],
    queryFn: () => seafarerApi.certsExpiring(90).then((r) => r.data),
  })

  const expiringCertificates = useMemo(
    () =>
      (certsExpiring || []).filter(
        (item) => item.expiry_status === 'EXPIRING' || Number(item.days_left) >= 0
      ),
    [certsExpiring]
  )

  const expiredCertificates = useMemo(
    () =>
      (certsExpiring || []).filter(
        (item) => item.expiry_status === 'EXPIRED' || Number(item.days_left) < 0
      ),
    [certsExpiring]
  )

  useEffect(() => {
    if (!dispatchDecisionModalOpen) return
    const currentValues = dispatchDecisionForm.getFieldsValue()
    const currentNotes = Array.isArray(currentValues.notes) ? currentValues.notes : []
    const firstJoinDate =
      dispatchDecisionSeafarers.find((s) => s?.latest_join_date)?.latest_join_date || null
    const firstVesselName =
      dispatchDecisionSeafarers.find((s) => s?.latest_vessel_name)?.latest_vessel_name || ''
    const noteMap = new Map(
      currentNotes
        .map((item) => [Number(item?.seafarer_id), item?.note || ''])
        .filter(([id]) => Number.isFinite(id))
    )

    dispatchDecisionForm.setFieldsValue({
      vessel_name: currentValues.vessel_name || firstVesselName,
      embark_location: currentValues.embark_location || '',
      embark_dates:
        currentValues.embark_dates || (firstJoinDate ? [dayjs(firstJoinDate), null] : null),
      actual_embark_date:
        currentValues.actual_embark_date || (firstJoinDate ? dayjs(firstJoinDate) : null),
      decision_seq: currentValues.decision_seq || '',
      decision_year: currentValues.decision_year || String(dayjs().year()),
      decision_suffix: currentValues.decision_suffix || 'QĐ-TV-SPT',
      notes: dispatchDecisionSeafarers.map((seafarer) => ({
        seafarer_id: seafarer.id,
        note: noteMap.get(seafarer.id) || '',
      })),
    })
  }, [dispatchDecisionForm, dispatchDecisionModalOpen, dispatchDecisionSeafarers])

  const certificateSummaryBySeafarer = useMemo(() => {
    const map = new Map()

    function ensureEntry(seafarerId) {
      if (!map.has(seafarerId)) {
        map.set(seafarerId, { expiring: [], expired: [] })
      }
      return map.get(seafarerId)
    }

    expiringCertificates.forEach((item) => {
      ensureEntry(item.seafarer_id).expiring.push(item)
    })

    expiredCertificates.forEach((item) => {
      ensureEntry(item.seafarer_id).expired.push(item)
    })

    return map
  }, [expiringCertificates, expiredCertificates])

  const statusOptions = useMemo(
    () =>
      STATUS_CODES.map((v) => ({
        value: v,
        label: t(`seafarer.statusMap.${v}`),
      })),
    [t]
  )

  const dispatchDecisionColumns = useMemo(
    () => [
      {
        title: 'Stt',
        key: 'index',
        width: 70,
        align: 'center',
        render: (_, __, index) => index + 1,
      },
      {
        title: 'Họ và tên',
        dataIndex: 'full_name',
        key: 'full_name',
        width: 260,
        render: (value) => value || '-',
      },
      {
        title: 'Chức danh',
        key: 'rank',
        width: 140,
        render: (_, record) => record.rank_code || record.rank_name_vi || '-',
      },
      {
        title: 'Ngày sinh',
        dataIndex: 'date_of_birth',
        key: 'date_of_birth',
        width: 140,
        render: (value) => formatDate(value),
      },
      {
        title: 'Ghi chú',
        key: 'note',
        width: 320,
        render: (_, record) => (
          <Form.Item
            key={`dispatch-note-${record.noteFieldKey ?? record.id}`}
            name={[record.noteFieldName, 'note']}
            style={{ marginBottom: 0 }}
          >
            <Input.TextArea
              rows={2}
              placeholder="Nhập note cho thuyền viên này..."
              maxLength={300}
              showCount
            />
          </Form.Item>
        ),
      },
    ],
    []
  )

  const rankTreeData = useMemo(() => {
    const DEPT_LABEL = { DECK: 'Boong', ENGINE: 'Máy', CATERING: 'Phục vụ' }
    const DEPT_ORDER = ['DECK', 'ENGINE']
    const RANK_ORDER = {
      DECK: ['CAPT', 'CO', '2O', '3O', 'BSN', 'CARP', 'AB', 'OSD', 'DCADET', 'COOK', 'MESS'],
      ENGINE: ['CE', '2E', '3E', '4E', 'ETO', 'ELECT', 'FTR', 'ABE', 'OSE', 'ENGINE CADET'],
    }
    const DEPT_REMAP = { CATERING: 'DECK' }
    const groups = {}
    for (const r of ranks || []) {
      const dept = DEPT_REMAP[r.department] || r.department || 'OTHER'
      if (!groups[dept]) groups[dept] = { children: [] }
      groups[dept].children.push({ key: `rank-${r.id}`, title: r.code, rankId: r.id })
    }
    return DEPT_ORDER.filter((dept) => groups[dept]).map((dept) => {
      const order = RANK_ORDER[dept] || []
      const children = [...groups[dept].children].sort((a, b) => {
        const ia = order.indexOf(a.title)
        const ib = order.indexOf(b.title)
        if (ia === -1 && ib === -1) return 0
        if (ia === -1) return 1
        if (ib === -1) return -1
        return ia - ib
      })
      return { key: `dept-${dept}`, title: DEPT_LABEL[dept] || dept, children }
    })
  }, [ranks])

  const [rankFilterOpen, setRankFilterOpen] = useState(false)
  const [rankExpandedKeys, setRankExpandedKeys] = useState([])
  const rankExpandedInited = useRef(false)
  useEffect(() => {
    if (!rankExpandedInited.current && rankTreeData.length > 0) {
      rankExpandedInited.current = true
      setRankExpandedKeys(rankTreeData.map((g) => g.key))
    }
  }, [rankTreeData])

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((f) => (f.search === searchInput ? f : { ...f, search: searchInput, page: 1 }))
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((f) =>
        f.vessel_name === vesselNameInput ? f : { ...f, vessel_name: vesselNameInput, page: 1 }
      )
    }, 400)
    return () => clearTimeout(timer)
  }, [vesselNameInput])

  const columns = useMemo(
    () => [
      {
        title: t('seafarer.rankCol'),
        dataIndex: 'rank_code',
        width: 90,
        render: (v, r) =>
          quickDeploymentSeafarerId === r.id ? (
            <div data-no-row-nav="true" onClick={(e) => e.stopPropagation()}>
              <Select
                size="small"
                style={{ width: '100%' }}
                placeholder="Chức danh"
                value={quickDeploymentRow?.rank_id}
                onChange={(val) =>
                  setQuickDeploymentRow((prev) => ({ ...prev, rank_id: val ?? null }))
                }
                options={(ranks || []).map((rk) => ({ value: rk.id, label: rk.code }))}
                showSearch
                optionFilterProp="label"
                allowClear
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              />
            </div>
          ) : (
            v || '-'
          ),
      },
      {
        title: t('seafarer.fullName'),
        dataIndex: 'full_name',
        width: 220,
        render: (v, r) => (
          <a
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/seafarers/${r.id}`)
            }}
            style={{ color: '#1677ff' }}
          >
            {v}
          </a>
        ),
      },
      {
        title: t('seafarer.status'),
        dataIndex: 'status',
        width: 120,
        render: (v, r) =>
          canEditStatus ? (
            <div
              data-no-row-nav="true"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Select
                size="small"
                value={r.status}
                loading={statusMutation.isPending && statusMutation.variables?.seafarerId === r.id}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(value) => statusMutation.mutate({ seafarerId: r.id, status: value })}
                style={{ width: '100%' }}
                options={STATUS_CODES.map((value) => ({
                  value,
                  label: (
                    <Tag color={STATUS_COLOR[value] || 'default'} style={{ margin: 0 }}>
                      {t(`seafarer.statusMap.${value}`) || value}
                    </Tag>
                  ),
                }))}
              />
            </div>
          ) : (
            <Tag color={STATUS_COLOR[v] || 'default'}>{t(`seafarer.statusMap.${v}`) || v}</Tag>
          ),
      },
      {
        title: 'Tên tàu',
        dataIndex: 'latest_vessel_name',
        width: 160,
        render: (v, r) =>
          quickDeploymentSeafarerId === r.id ? (
            <div
              data-no-row-nav="true"
              onClick={(e) => e.stopPropagation()}
              style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
            >
              {quickSelectedVesselInfo?.imo_no && (
                <div style={{ fontSize: 11, color: '#888', lineHeight: 1.2 }}>
                  IMO {quickSelectedVesselInfo.imo_no}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                <AutoComplete
                  options={quickVesselOptions}
                  value={quickDeploymentRow?.vessel_name}
                  onChange={handleQuickInlineVesselSearch}
                  onSelect={(_, opt) => {
                    applyQuickVesselSelection({
                      ship_name: opt.value,
                      vessel_id: opt.vessel_id || null,
                      imo_no: opt.imo_no,
                      ship_type: opt.ship_type,
                      country_name: opt.country_name,
                    })
                  }}
                  dropdownStyle={{ minWidth: 300 }}
                  style={{ flex: 1 }}
                >
                  <Input
                    size="small"
                    placeholder="Tên tàu..."
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                </AutoComplete>
                <Tooltip title="Tìm tàu">
                  <Button
                    size="small"
                    icon={<SearchOutlined />}
                    style={{ flex: '0 0 auto' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setQuickVesselSearchOpen(true)
                      setQuickVesselSearchQ(quickDeploymentRow?.vessel_name || '')
                      if (quickDeploymentRow?.vessel_name?.length >= 2) {
                        handleQuickVesselSearchQ(quickDeploymentRow.vessel_name)
                      }
                    }}
                  />
                </Tooltip>
              </div>
            </div>
          ) : (
            v || '-'
          ),
      },
      {
        title: 'Ngày nhập tàu',
        dataIndex: 'latest_join_date',
        width: 105,
        render: (v, r) =>
          quickDeploymentSeafarerId === r.id ? (
            <div data-no-row-nav="true" onClick={(e) => e.stopPropagation()}>
              <DatePicker
                size="small"
                format="DD/MM/YYYY"
                placeholder="Nhập tàu"
                value={quickDeploymentRow?.join_date ? dayjs(quickDeploymentRow.join_date) : null}
                onChange={(d) =>
                  setQuickDeploymentRow((prev) => ({
                    ...prev,
                    join_date: d ? d.format('YYYY-MM-DD') : null,
                  }))
                }
                onClick={(e) => e.stopPropagation()}
                style={{ width: '100%' }}
              />
            </div>
          ) : (
            formatDate(v)
          ),
      },
      {
        title: 'Ngày rời tàu',
        dataIndex: 'latest_sign_off_date',
        width: 105,
        render: (v, r) =>
          quickDeploymentSeafarerId === r.id ? (
            <div data-no-row-nav="true" onClick={(e) => e.stopPropagation()}>
              <DatePicker
                size="small"
                format="DD/MM/YYYY"
                placeholder="Rời tàu"
                value={
                  quickDeploymentRow?.sign_off_date ? dayjs(quickDeploymentRow.sign_off_date) : null
                }
                onChange={(d) =>
                  setQuickDeploymentRow((prev) => ({
                    ...prev,
                    sign_off_date: d ? d.format('YYYY-MM-DD') : null,
                  }))
                }
                onClick={(e) => e.stopPropagation()}
                style={{ width: '100%' }}
              />
            </div>
          ) : (
            formatDate(v)
          ),
      },
      {
        title: t('seafarer.dob'),
        dataIndex: 'date_of_birth',
        width: 100,
        render: (v) => formatDate(v),
      },
      {
        title: t('seafarer.province'),
        dataIndex: 'permanent_province',
        width: 110,
        render: (v) => v || '-',
      },
      {
        title: t('seafarer.phone'),
        dataIndex: 'phone_primary',
        width: 130,
        render: (v) =>
          v ? (
            <span>
              {v}
              <ZaloButton phone={v} />
            </span>
          ) : (
            '-'
          ),
      },
      {
        title: t('seafarer.callCount'),
        dataIndex: 'call_count',
        width: 130,
        render: (_, r) => {
          if (!r.call_count) return '-'
          return (
            <Tooltip title={r.last_call_note || ''}>
              <span>
                <Tag color="blue">{t('seafarer.callTimes', { count: r.call_count })}</Tag>
                {r.first_call_at && (
                  <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
                    {t('seafarer.callSince')}: {dayjs(r.first_call_at).format('DD/MM/YYYY')}
                  </div>
                )}
              </span>
            </Tooltip>
          )
        },
      },
      {
        title: (
          <span>
            Chứng chỉ sắp
            <br />
            hết hạn
          </span>
        ),
        key: 'expiring_certificates',
        width: 130,
        render: (_, r) =>
          renderCertificateSummary(certificateSummaryBySeafarer.get(r.id)?.expiring, 'expiring'),
      },
      {
        title: (
          <span>
            Chứng chỉ
            <br />
            hết hạn
          </span>
        ),
        key: 'expired_certificates',
        width: 120,
        render: (_, r) =>
          renderCertificateSummary(certificateSummaryBySeafarer.get(r.id)?.expired, 'expired'),
      },
      {
        title: '',
        width: 110,
        render: (_, r) =>
          quickDeploymentSeafarerId === r.id ? (
            <Space size="small" data-no-row-nav="true">
              <Button
                size="small"
                type="primary"
                disabled={!hasQuickDeploymentData(quickDeploymentRow, r.current_rank_id ?? null)}
                loading={quickDeploymentMutation.isPending}
                onClick={(e) => {
                  e.stopPropagation()
                  if (!hasQuickDeploymentData(quickDeploymentRow, r.current_rank_id ?? null)) return
                  quickDeploymentMutation.mutate({
                    seafarerId: r.id,
                    row: quickDeploymentRow,
                    currentRankId: r.current_rank_id ?? null,
                  })
                }}
              >
                Lưu
              </Button>
              <Button
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  resetQuickDeploymentState()
                }}
              >
                Hủy
              </Button>
            </Space>
          ) : (
            <Space size="small">
              {!isReadOnly && (
                <Tooltip title="Thêm nhanh quá trình đi biển">
                  <Button
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={(e) => {
                      e.stopPropagation()
                      openQuickDeploymentInline(r)
                    }}
                  />
                </Tooltip>
              )}
              {!isReadOnly && (
                <Button
                  size="small"
                  icon={<PhoneOutlined />}
                  onClick={(e) => {
                    e.stopPropagation()
                    openCallModal(r)
                  }}
                />
              )}
              {!isReadOnly && (
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={(e) => {
                    e.stopPropagation()
                    Modal.confirm({
                      title: t('common.confirmDelete'),
                      content: t('seafarer.confirmDeleteBody', { name: r.full_name }),
                      okText: t('common.delete'),
                      okType: 'danger',
                      cancelText: t('common.cancel'),
                      onOk: () => deleteMutation.mutate(r.id),
                    })
                  }}
                />
              )}
            </Space>
          ),
      },
    ],
    [
      t,
      navigate,
      isReadOnly,
      canEditStatus,
      deleteMutation,
      statusMutation,
      ranks,
      quickDeploymentSeafarerId,
      quickDeploymentRow,
      quickVesselOptions,
      quickSelectedVesselInfo,
      quickDeploymentMutation,
      certificateSummaryBySeafarer,
    ]
  )

  const statusCards = useMemo(
    () => [
      {
        key: 'ONBOARD',
        label: t('seafarer.statusMap.ONBOARD'),
        color: '#d48806',
        bg: '#fffbe6',
        border: '#ffe58f',
      },
      {
        key: 'STANDBY',
        label: t('seafarer.statusMap.STANDBY'),
        color: '#52c41a',
        bg: '#f6ffed',
        border: '#b7eb8f',
      },
      {
        key: 'OFFSHIFT',
        label: t('seafarer.statusMap.OFFSHIFT'),
        color: '#fa8c16',
        bg: '#fff7e6',
        border: '#ffd591',
      },
      {
        key: 'RESERVE',
        label: t('seafarer.statusMap.RESERVE'),
        color: '#1890ff',
        bg: '#e6f7ff',
        border: '#91d5ff',
      },
      {
        key: 'SIGNOFF',
        label: t('seafarer.statusMap.SIGNOFF'),
        color: '#cf1322',
        bg: '#fff1f0',
        border: '#ffa39e',
      },
    ],
    [t]
  )

  const totalSeafarers = stats
    ? STATUS_CODES.reduce((sum, statusCode) => sum + Number(stats?.[statusCode] || 0), 0)
    : 0
  const rowSelection = {
    selectedRowKeys,
    preserveSelectedRowKeys: true,
    onChange: (keys) => setSelectedRowKeys(keys),
  }

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 20, fontWeight: 600, color: '#262626' }}>
          {t('seafarer.title')}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            background: '#f0f5ff',
            border: '1px solid #adc6ff',
            borderRadius: 8,
            padding: '8px 14px',
            cursor: 'pointer',
          }}
          onClick={() => setFilters((f) => ({ ...f, status: '', page: 1 }))}
        >
          <div style={{ fontSize: 22, fontWeight: 700, color: '#003366' }}>{totalSeafarers}</div>
          <div style={{ fontSize: 12, color: '#595959', marginTop: 2 }}>
            {t('seafarer.totalCount')}
          </div>
        </div>
        {statusCards.map(({ key, label, color, bg, border }) => (
          <div
            key={key}
            style={{
              background: bg,
              border: `1px solid ${border}`,
              borderRadius: 8,
              padding: '8px 14px',
              cursor: 'pointer',
              opacity: filters.status && filters.status !== key ? 0.6 : 1,
            }}
            onClick={() =>
              setFilters((f) => ({ ...f, status: f.status === key ? '' : key, page: 1 }))
            }
          >
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{stats?.[key] || 0}</div>
            <div style={{ fontSize: 12, color: '#595959', marginTop: 2 }}>{label}</div>
          </div>
        ))}
        <div
          style={{
            background: '#fff7e6',
            border: '1px solid #ffd591',
            borderRadius: 8,
            padding: '8px 14px',
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 700, color: '#d48806' }}>
            {expiringCertificates.length}
          </div>
          <div style={{ fontSize: 12, color: '#595959', marginTop: 2 }}>Chứng chỉ sắp hết hạn</div>
        </div>
        <div
          style={{
            background: '#fff1f0',
            border: '1px solid #ffa39e',
            borderRadius: 8,
            padding: '8px 14px',
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 700, color: '#cf1322' }}>
            {expiredCertificates.length}
          </div>
          <div style={{ fontSize: 12, color: '#595959', marginTop: 2 }}>Chứng chỉ đã hết hạn</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Space wrap>
          <Button
            icon={<DownloadOutlined />}
            onClick={openDispatchDecisionModal}
            loading={exportingDispatchDecision}
            disabled={!selectedRowKeys.length}
          >
            Xuất QUYẾT ĐỊNH ĐIỀU ĐỘNG{selectedRowKeys.length ? ` (${selectedRowKeys.length})` : ''}
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport} loading={exporting}>
            {t('seafarer.export')}
          </Button>
          {!isReadOnly && (
            <>
              <Button icon={<UploadOutlined />} onClick={() => navigate('/seafarers/import')}>
                {t('seafarer.import')}
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate('/seafarers/new')}
              >
                {t('seafarer.addNew')}
              </Button>
            </>
          )}
        </Space>
      </div>

      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: 12,
          marginBottom: 8,
          border: '1px solid #f0f0f0',
        }}
      >
        <div style={{ marginBottom: 6 }}>
          <Text strong style={{ fontSize: 14 }}>
            {t('common.filters')}
          </Text>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Space wrap align="flex-end" size={[12, 12]} style={{ width: '100%' }}>
            <Input
              placeholder={t('seafarer.searchPlaceholder')}
              prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
              style={{ flex: 1, minWidth: 200, maxWidth: 420, height: 32, borderRadius: 6 }}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              allowClear
            />
            <Select
              placeholder={t('seafarer.statusPlaceholder')}
              style={{ minWidth: 180, height: 32 }}
              value={filters.status || undefined}
              onChange={(v) => setFilters((f) => ({ ...f, status: v || '', page: 1 }))}
              allowClear
              options={statusOptions}
            />
            <AutoComplete
              options={vesselFilterOptions}
              onChange={handleVesselFilterSearch}
              filterOption={false}
              value={vesselNameInput}
              allowClear
              style={{ minWidth: 200 }}
            >
              <Input
                placeholder="Lọc theo tên tàu"
                prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
                style={{ height: 32, borderRadius: 6 }}
              />
            </AutoComplete>
            <Button
              icon={<ClearOutlined />}
              disabled={
                !filters.search &&
                !filters.status &&
                !filters.vessel_name &&
                !filters.rank_ids.length
              }
              onClick={() => {
                setSearchInput('')
                setVesselNameInput('')
                setVesselFilterOptions([])
                setFilters((f) => ({
                  ...f,
                  search: '',
                  status: '',
                  vessel_name: '',
                  rank_ids: [],
                  page: 1,
                }))
              }}
            >
              {t('common.clearFilters')}
            </Button>
          </Space>
          <div>
            <div
              onClick={() => setRankFilterOpen((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                marginBottom: 6,
                userSelect: 'none',
              }}
            >
              <RightOutlined
                style={{
                  fontSize: 10,
                  color: '#8c8c8c',
                  transition: 'transform .2s',
                  transform: rankFilterOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                }}
              />
              <span style={{ fontSize: 13, color: '#262626', fontWeight: 600 }}>
                {t('seafarer.filterByRank')}
              </span>
              {filters.rank_ids.length > 0 && (
                <span style={{ fontSize: 11, color: '#1677ff', fontWeight: 500 }}>
                  ({filters.rank_ids.length})
                </span>
              )}
            </div>
            {rankFilterOpen && (
              <div style={{ display: 'flex', gap: 0 }}>
                {rankTreeData.map((group) => (
                  <Tree
                    key={group.key}
                    checkable
                    selectable={false}
                    expandedKeys={rankExpandedKeys}
                    onExpand={setRankExpandedKeys}
                    switcherIcon={<span />}
                    treeData={[group]}
                    checkedKeys={rankTreeData
                      .flatMap((g) => g.children)
                      .filter((c) => filters.rank_ids.includes(c.rankId))
                      .map((c) => c.key)}
                    onCheck={(checked) => {
                      const keys = Array.isArray(checked) ? checked : checked.checked
                      const rankIds = rankTreeData
                        .flatMap((g) => g.children)
                        .filter((c) => keys.includes(c.key))
                        .map((c) => c.rankId)
                      setFilters((f) => ({ ...f, rank_ids: rankIds, page: 1 }))
                    }}
                    style={{ fontSize: 13, flex: 1 }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isMobile ? (
        <div>
          {isFetching && (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin />
            </div>
          )}
          {(data?.data || []).map((r) => (
            <div
              key={r.id}
              onClick={() => navigate(`/seafarers/${r.id}`)}
              style={{
                background: '#fff',
                borderRadius: 8,
                border: '1px solid #f0f0f0',
                padding: '12px 16px',
                marginBottom: 8,
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: '#1677ff' }}>
                    {r.full_name}
                  </div>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                    {r.seafarer_code} · {r.rank_code || '-'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tag color={STATUS_COLOR[r.status] || 'default'} style={{ margin: 0 }}>
                    {t(`seafarer.statusMap.${r.status}`) || r.status}
                  </Tag>
                  <RightOutlined style={{ color: '#bfbfbf', fontSize: 12 }} />
                </div>
              </div>
              {r.phone_primary && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    color: '#595959',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <PhoneOutlined />
                  <span>{r.phone_primary}</span>
                  <ZaloButton phone={r.phone_primary} />
                </div>
              )}
              <div style={{ marginTop: 8, fontSize: 13, color: '#595959', lineHeight: 1.6 }}>
                <div>Tên tàu: {r.latest_vessel_name || '-'}</div>
                <div>Ngày nhập tàu: {formatDate(r.latest_join_date)}</div>
                <div>Ngày rời tàu: {formatDate(r.latest_sign_off_date)}</div>
                <div>
                  Chứng chỉ sắp hết hạn:{' '}
                  {certificateSummaryBySeafarer.get(r.id)?.expiring?.length || 0}
                </div>
                <div>
                  Chứng chỉ hết hạn: {certificateSummaryBySeafarer.get(r.id)?.expired?.length || 0}
                </div>
              </div>
              {!isReadOnly && (
                <div
                  style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => openQuickDeploymentInline(r)}
                  >
                    Thêm nhanh
                  </Button>
                  <Button size="small" icon={<PhoneOutlined />} onClick={() => openCallModal(r)}>
                    {t('seafarer.logCall')}
                  </Button>
                  {r.call_count > 0 && (
                    <Tooltip title={r.last_call_note || ''}>
                      <Tag color="blue" style={{ margin: 0 }}>
                        {t('seafarer.callTimes', { count: r.call_count })}
                      </Tag>
                    </Tooltip>
                  )}
                </div>
              )}
            </div>
          ))}
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Pagination
              current={filters.page}
              pageSize={filters.limit}
              total={data?.total || 0}
              simple
              onChange={(page, limit) => setFilters((f) => ({ ...f, page, limit }))}
            />
          </div>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #f0f0f0' }}>
          <Table
            rowKey="id"
            rowSelection={rowSelection}
            columns={columns}
            dataSource={data?.data || []}
            loading={isFetching}
            onRow={(row) => ({
              onClick: (e) => {
                if (quickDeploymentSeafarerId === row.id) return
                if (e.target.closest('button,a,[role="button"],[data-no-row-nav="true"]')) return
                // navigate(`/seafarers/${row.id}`)
              },
              style: { cursor: quickDeploymentSeafarerId === row.id ? 'default' : 'pointer' },
            })}
            scroll={{ x: 'max-content' }}
            onChange={(pagination, _tableFilters, sorter) => {
              const nextSorter = Array.isArray(sorter) ? sorter[0] : sorter
              const sortOrder =
                nextSorter?.order === 'ascend'
                  ? 'asc'
                  : nextSorter?.order === 'descend'
                    ? 'desc'
                    : 'desc'
              setFilters((f) => ({
                ...f,
                page: pagination?.current || 1,
                limit: pagination?.pageSize || f.limit,
                // Tạm khóa sort theo rank ở FE để ưu tiên sort theo updated_at.
                sort_by: 'updated_at',
                sort_order: sortOrder,
              }))
            }}
            pagination={{
              current: filters.page,
              pageSize: filters.limit,
              total: data?.total || 0,
              showSizeChanger: true,
              showTotal: (tot) => t('seafarer.paginationTotal', { count: tot }),
            }}
            size="middle"
          />
        </div>
      )}

      <Modal
        title={
          quickDeploymentModal.seafarer
            ? `Thêm nhanh quá trình đi biển - ${quickDeploymentModal.seafarer.full_name}`
            : 'Thêm nhanh quá trình đi biển'
        }
        open={quickDeploymentModal.open}
        onCancel={resetQuickDeploymentState}
        onOk={() => {
          if (!quickDeploymentModal.seafarer || !quickDeploymentRow) return
          if (
            !hasQuickDeploymentData(
              quickDeploymentRow,
              quickDeploymentModal.seafarer.current_rank_id ?? null
            )
          )
            return
          quickDeploymentMutation.mutate({
            seafarerId: quickDeploymentModal.seafarer.id,
            row: quickDeploymentRow,
            currentRankId: quickDeploymentModal.seafarer.current_rank_id ?? null,
          })
        }}
        okText="Lưu"
        cancelText={t('common.cancel')}
        confirmLoading={quickDeploymentMutation.isPending}
        okButtonProps={{
          disabled:
            !quickDeploymentModal.seafarer ||
            !quickInlineHasData ||
            !hasQuickDeploymentData(
              quickDeploymentRow,
              quickDeploymentModal.seafarer?.current_rank_id ?? null
            ),
        }}
        centered
        width={isMobile ? '96vw' : 1180}
        destroyOnHidden
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              flexWrap: isMobile ? 'wrap' : 'nowrap',
            }}
          >
            <Select
              size="small"
              style={{ width: 140 }}
              placeholder="Chức danh"
              value={quickDeploymentRow?.rank_id}
              onChange={(val) =>
                setQuickDeploymentRow((prev) => ({ ...prev, rank_id: val ?? null }))
              }
              options={(ranks || []).map((rk) => ({ value: rk.id, label: rk.code }))}
              showSearch
              optionFilterProp="label"
              allowClear
            />
            <div style={{ minWidth: 240, flex: 1 }}>
              <Space size={4} style={{ width: '100%' }}>
                <AutoComplete
                  options={quickVesselOptions}
                  value={quickDeploymentRow?.vessel_name}
                  onChange={handleQuickInlineVesselSearch}
                  onSelect={(_, opt) => {
                    applyQuickVesselSelection({
                      ship_name: opt.value,
                      vessel_id: opt.vessel_id || null,
                      imo_no: opt.imo_no,
                      ship_type: opt.ship_type,
                      country_name: opt.country_name,
                    })
                  }}
                  dropdownStyle={{ minWidth: 300 }}
                  style={{ width: isMobile ? '100%' : 220 }}
                >
                  <Input size="small" placeholder="Tên tàu..." />
                </AutoComplete>
                <Tooltip title="Tìm tàu">
                  <Button
                    size="small"
                    icon={<SearchOutlined />}
                    onClick={() => {
                      setQuickVesselSearchOpen(true)
                      setQuickVesselSearchQ(quickDeploymentRow?.vessel_name || '')
                      if (quickDeploymentRow?.vessel_name?.length >= 2) {
                        handleQuickVesselSearchQ(quickDeploymentRow.vessel_name)
                      }
                    }}
                  />
                </Tooltip>
              </Space>
              {quickSelectedVesselInfo?.imo_no && (
                <div style={{ fontSize: 11, color: '#888', marginTop: 2, lineHeight: 1.3 }}>
                  IMO {quickSelectedVesselInfo.imo_no}
                  {quickSelectedVesselInfo.vessel_id ? ' ✅' : ' 🔍'}
                </div>
              )}
            </div>
            <DatePicker
              size="small"
              format="DD/MM/YYYY"
              placeholder="Nhập tàu"
              value={quickDeploymentRow?.join_date ? dayjs(quickDeploymentRow.join_date) : null}
              onChange={(d) =>
                setQuickDeploymentRow((prev) => ({
                  ...prev,
                  join_date: d ? d.format('YYYY-MM-DD') : null,
                }))
              }
              style={{ width: 130 }}
            />
            <DatePicker
              size="small"
              format="DD/MM/YYYY"
              placeholder="Rời tàu"
              value={
                quickDeploymentRow?.sign_off_date ? dayjs(quickDeploymentRow.sign_off_date) : null
              }
              onChange={(d) =>
                setQuickDeploymentRow((prev) => ({
                  ...prev,
                  sign_off_date: d ? d.format('YYYY-MM-DD') : null,
                }))
              }
              style={{ width: 130 }}
            />
            <Input
              size="small"
              value={quickVesselDetail?.vessel_type || quickSelectedVesselInfo?.ship_type || ''}
              placeholder="Loại tàu"
              readOnly
              style={{ width: 120 }}
            />
            <Input
              size="small"
              value={
                quickVesselDetail
                  ? `${quickVesselDetail.gross_tonnage ?? '-'} / ${quickVesselDetail.deadweight ?? '-'}`
                  : ''
              }
              placeholder={fetchingQuickVesselDetail ? 'Đang tải GRT/DWT...' : 'GRT / DWT'}
              readOnly
              style={{ width: 120 }}
            />
            <Input
              size="small"
              value={quickVesselDetail?.engine_type || ''}
              placeholder="Loại máy"
              readOnly
              style={{ width: 120 }}
            />
            <Input
              size="small"
              value={quickVesselDetail?.flag_country || quickSelectedVesselInfo?.country_name || ''}
              placeholder="Cờ tàu"
              readOnly
              style={{ width: 120 }}
            />
          </div>
        </div>
      </Modal>

      <Modal
        title={`Xuất quyết định điều động (${selectedDispatchDecisionIds.length})`}
        open={dispatchDecisionModalOpen}
        onCancel={closeDispatchDecisionModal}
        onOk={() => {
          handleExportDispatchDecision().catch(() => {})
        }}
        okText="Xuất file"
        cancelText={t('common.cancel')}
        confirmLoading={exportingDispatchDecision}
        okButtonProps={{
          disabled:
            isFetchingDispatchDecisionSeafarers ||
            dispatchDecisionSeafarers.length !== selectedDispatchDecisionIds.length,
        }}
        centered
        width={isMobile ? '96vw' : 1100}
        styles={{
          body: {
            maxHeight: isMobile ? '78vh' : '82vh',
            overflow: 'hidden',
          },
        }}
      >
        <Form form={dispatchDecisionForm} layout="vertical">
          <Space
            orientation={isMobile ? 'vertical' : 'horizontal'}
            size={12}
            style={{ width: '100%', marginBottom: 8 }}
          >
            <Form.Item
              name="vessel_name"
              label="Tên tàu"
              style={{ flex: 1.4, minWidth: isMobile ? '100%' : 320, marginBottom: 0 }}
            >
              <AutoComplete
                options={dispatchVesselOptions}
                onChange={handleDispatchVesselSearch}
                onSelect={(_, option) => {
                  setDispatchSelectedVesselInfo({
                    vessel_id: option.vessel_id || null,
                    imo_no: option.imo_no || null,
                    ship_type: option.ship_type || null,
                    country_name: option.country_name || null,
                  })
                }}
                filterOption={false}
                allowClear
              >
                <Input placeholder="Nhập tên tàu..." />
              </AutoComplete>
            </Form.Item>
            <Form.Item
              name="embark_dates"
              label="Ngày dự kiến lên tàu"
              style={{ flex: 1, minWidth: isMobile ? '100%' : 280, marginBottom: 0 }}
            >
              <RangePicker
                format="DD/MM/YYYY"
                style={{ width: '100%' }}
                allowEmpty={[true, true]}
              />
            </Form.Item>
            <Form.Item
              name="embark_location"
              label="Địa điểm lên tàu"
              style={{ flex: 1, minWidth: isMobile ? '100%' : 350, marginBottom: 0 }}
            >
              <Input placeholder="Nhập địa điểm lên tàu..." />
            </Form.Item>
          </Space>
          <Space
            orientation={isMobile ? 'vertical' : 'horizontal'}
            size={12}
            style={{ width: '100%', marginBottom: 8 }}
          >
            <Form.Item
              label="Số quyết định thay thế"
              style={{ flex: 1, minWidth: isMobile ? '100%' : 320, marginBottom: 0 }}
            >
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="decision_seq" noStyle>
                  <Input placeholder="Số" style={{ width: '20%' }} />
                </Form.Item>
                <span
                  className="dispatch-decision-number-sep"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 20,
                    flex: 'none',
                    color: '#8c8c8c',
                    border: '1px solid #d9d9d9',
                    borderLeft: 'none',
                    borderRight: 'none',
                  }}
                >
                  /
                </span>
                <Form.Item name="decision_year" noStyle>
                  <Input placeholder="Năm" style={{ width: '18%' }} />
                </Form.Item>
                <span
                  className="dispatch-decision-number-sep"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 20,
                    flex: 'none',
                    color: '#8c8c8c',
                    border: '1px solid #d9d9d9',
                    borderLeft: 'none',
                    borderRight: 'none',
                  }}
                >
                  /
                </span>
                <Form.Item name="decision_suffix" noStyle>
                  <Input placeholder="QĐ-TV-SPT" style={{ width: '42%' }} />
                </Form.Item>
              </Space.Compact>
            </Form.Item>
            <Form.Item
              name="actual_embark_date"
              label="Ngày nhập tàu thực tế"
              style={{ flex: 1, minWidth: isMobile ? '100%' : 280, marginBottom: 0 }}
            >
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          {dispatchSelectedVesselInfo?.imo_no && (
            <div style={{ marginTop: -4, marginBottom: 12, fontSize: 12, color: '#8c8c8c' }}>
              IMO {dispatchSelectedVesselInfo.imo_no}
            </div>
          )}

          <div style={{ marginTop: 16, marginBottom: 10, fontWeight: 600 }}>
            Thông tin thuyền viên
          </div>

          {isFetchingDispatchDecisionSeafarers ? (
            <div style={{ padding: '24px 0', textAlign: 'center' }}>
              <Spin />
            </div>
          ) : dispatchDecisionSeafarers.length === 0 ? (
            <div style={{ color: '#8c8c8c' }}>Không có thuyền viên nào để xuất.</div>
          ) : (
            <Form.List name="notes">
              {(fields) => (
                <>
                  {fields.map((field) => (
                    <Form.Item key={field.key} name={[field.name, 'seafarer_id']} hidden>
                      <Input />
                    </Form.Item>
                  ))}
                  <Table
                    rowKey={(record) => record.id}
                    dataSource={dispatchDecisionSeafarers.map((record, index) => ({
                      ...record,
                      noteFieldName: fields[index]?.name ?? index,
                      noteFieldKey: fields[index]?.key ?? record.id,
                    }))}
                    columns={dispatchDecisionColumns}
                    pagination={false}
                    size="small"
                    scroll={{
                      x: 'max-content',
                      y: isMobile ? undefined : 'calc(82vh - 260px)',
                    }}
                  />
                </>
              )}
            </Form.List>
          )}
        </Form>
      </Modal>

      <Modal
        title={t('seafarer.logCallTitle')}
        open={callModal.open}
        onCancel={closeCallModal}
        onOk={() => {
          logCallMutation.mutate({
            seafarerId: callModal.seafarer?.id,
            note: callNote.trim() || null,
            called_at: (callDateTime || dayjs()).toISOString(),
          })
        }}
        okText={t('seafarer.logCall')}
        cancelText={t('common.cancel')}
        confirmLoading={logCallMutation.isPending}
        centered
        width={isMobile ? '95vw' : 440}
      >
        {callModal.seafarer && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{callModal.seafarer.full_name}</div>
            {callModal.seafarer.phone_primary && (
              <div style={{ color: '#595959', fontSize: 13, marginTop: 2 }}>
                <PhoneOutlined style={{ marginRight: 4 }} />
                {callModal.seafarer.phone_primary}
              </div>
            )}
          </div>
        )}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: '#595959', marginBottom: 4 }}>
            {t('seafarer.callDateTime')}
          </div>
          <DatePicker
            showTime={{ format: 'HH:mm' }}
            format="DD/MM/YYYY HH:mm"
            value={callDateTime}
            onChange={setCallDateTime}
            style={{ width: '100%' }}
            allowClear={false}
          />
        </div>
        <div>
          <div style={{ fontSize: 13, color: '#595959', marginBottom: 4 }}>
            {t('seafarer.callNotePlaceholder')}
          </div>
          <Input.TextArea
            rows={3}
            placeholder={t('seafarer.callNotePlaceholder')}
            value={callNote}
            onChange={(e) => setCallNote(e.target.value)}
            maxLength={500}
            showCount
          />
        </div>
      </Modal>

      <Modal
        title="Tìm tàu"
        open={quickVesselSearchOpen}
        onCancel={() => {
          setQuickVesselSearchOpen(false)
          setQuickVesselSearchQ('')
          setQuickVesselSearchResults([])
          setQuickVesselSearchLoading(false)
        }}
        footer={null}
        width={560}
        destroyOnHidden
      >
        <Input
          autoFocus
          placeholder="Nhập tên tàu..."
          prefix={<SearchOutlined />}
          value={quickVesselSearchQ}
          onChange={(e) => handleQuickVesselSearchQ(e.target.value)}
          allowClear
          style={{ marginBottom: 12 }}
        />
        <Table
          rowKey={(r) => r.imo_no || r.vessel_id || r.ship_name}
          size="small"
          loading={quickVesselSearchLoading}
          dataSource={quickVesselSearchResults}
          pagination={false}
          scroll={{ y: 320 }}
          onRow={(r) => ({
            onClick: () => handleQuickVesselSearchSelect(r),
            style: { cursor: 'pointer' },
          })}
          columns={[
            {
              title: 'Tên tàu',
              dataIndex: 'ship_name',
              render: (v, r) => (
                <span>
                  {v}
                  {r.vessel_id && (
                    <Tag color="success" style={{ marginLeft: 6, fontSize: 11 }}>
                      Đã có
                    </Tag>
                  )}
                </span>
              ),
            },
            { title: 'IMO', dataIndex: 'imo_no', width: 90, render: (v) => v || '-' },
            { title: 'Loại', dataIndex: 'ship_type', width: 120, render: (v) => v || '-' },
            { title: 'Quốc gia', dataIndex: 'country_name', width: 100, render: (v) => v || '-' },
          ]}
          locale={{
            emptyText: quickVesselSearchQ.length < 2 ? 'Nhập ít nhất 2 ký tự' : 'Không tìm thấy',
          }}
        />
      </Modal>
    </div>
  )
}
