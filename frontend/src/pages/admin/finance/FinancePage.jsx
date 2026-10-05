import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Col,
  DatePicker,
  Drawer,
  Grid,
  Input,
  InputNumber,
  Popconfirm,
  Popover,
  Row,
  Select,
  Space,
  Statistic,
  Modal,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  DeleteOutlined,
  DollarOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  SaveOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { salaryApi, lookupApi, revenueApi } from '../../../api'

const { useBreakpoint } = Grid
const { Text, Title } = Typography

const fmtVND = (v) =>
  v != null ? new Intl.NumberFormat('vi-VN').format(Math.round(Number(v))) : '-'
const n = (v) => (v != null ? parseFloat(v) : 0)

function profitColor(v) {
  if (v == null) return undefined
  return Number(v) >= 0 ? '#07bc0c' : '#e74c3c'
}

function calcLuongVnd(r, daysInMonth) {
  if (r.working_days == null) return null
  const days = r.working_days
  if (r.salary_currency === 'VND') {
    const vndSalary = r.salary_gross ?? r.deployment_salary
    if (vndSalary == null) return null
    return (parseFloat(vndSalary) * days) / daysInMonth
  }
  const exRate = r.exchange_rate ?? r.salary_exchange_rate
  if (r.salary_gross == null || exRate == null) return null
  return (parseFloat(r.salary_gross) * parseFloat(exRate) * days) / daysInMonth
}

function calcGiaTriHdVnd(r) {
  const hd = parseFloat(r.contract_amount ?? r.job_amount ?? 0)
  if (r.job_currency === 'VND') return hd
  const rate = r.revenue_exchange_rate ?? r.exchange_rate ?? r.salary_exchange_rate
  if (rate == null) return null
  return hd * parseFloat(rate)
}

function calcHoaHongVnd(r) {
  if (r.commission_rate == null) return null
  const hd = parseFloat(r.contract_amount ?? r.job_amount ?? 0)
  const hh = (hd * parseFloat(r.commission_rate)) / 100
  if (r.job_currency === 'VND') return hh
  const exRateHH = r.exchange_rate ?? r.salary_exchange_rate
  if (exRateHH == null) return null
  return hh * parseFloat(exRateHH)
}

// Tổng thu từ chủ tàu = Dthu + visa_fee + owner_bonus
function calcTongThuChuTau(r) {
  const dthu = calcGiaTriHdVnd(r)
  if (dthu == null) return null
  return dthu + n(r.visa_fee) + n(r.owner_bonus)
}

// Tổng chi công ty = lương TV (= Thanh toán tab 1) + HH + các phí doanh thu
function calcTongChiCongTy(r, daysInMonth) {
  const luongTV =
    r.salary_net_vnd != null ? parseFloat(r.salary_net_vnd) : calcLuongVnd(r, daysInMonth)
  if (luongTV == null) return null
  const hh = calcHoaHongVnd(r) ?? 0
  const phiChi =
    n(r.export_labor_fee) +
    n(r.immigration_fee) +
    n(r.transport_fee) +
    n(r.penalty_amount) +
    n(r.other_cost)
  return luongTV + hh + phiChi
}

// Lợi nhuận = Tổng thu - Tổng chi
function calcLoiNhuan(r, daysInMonth) {
  const thu = calcTongThuChuTau(r)
  const chi = calcTongChiCongTy(r, daysInMonth)
  if (thu == null || chi == null) return null
  return thu - chi
}

export default function FinancePage() {
  const qc = useQueryClient()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const location = useLocation()
  const [month, setMonth] = useState(location.state?.month || dayjs().format('YYYY-MM'))
  const [rateInput, setRateInput] = useState(null)
  const [revenueRateInput, setRevenueRateInput] = useState(null)
  const [nameFilter, setNameFilter] = useState('')
  const [partnerFilter, setPartnerFilter] = useState(null)
  const [exportRange, setExportRange] = useState(null)
  const [exporting, setExporting] = useState(false)

  const daysInMonth = dayjs(month, 'YYYY-MM').daysInMonth()

  const { data, isLoading } = useQuery({
    queryKey: ['finance', 'month-full', month],
    queryFn: () => salaryApi.monthFull(month).then((r) => r.data),
  })

  const { data: revData, isLoading: revLoading } = useQuery({
    queryKey: ['finance', 'revenue', month, partnerFilter],
    queryFn: () => revenueApi.list(month, partnerFilter).then((r) => r.data),
  })

  const { data: partners } = useQuery({
    queryKey: ['lookup', 'partners'],
    queryFn: () => lookupApi.partners().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const rows = data?.data || []
  const filteredRows = nameFilter
    ? rows.filter((r) => r.seafarer_name?.toLowerCase().includes(nameFilter.toLowerCase()))
    : rows
  const revRows = revData?.data || []

  const currentRate = data?.exchange_rate
  const currentRevenueRate =
    revRows.find((r) => r.revenue_exchange_rate != null)?.revenue_exchange_rate ?? null

  useEffect(() => {
    setRateInput(currentRate ? parseFloat(currentRate) : null)
  }, [currentRate])

  useEffect(() => {
    setRevenueRateInput(
      currentRevenueRate
        ? parseFloat(currentRevenueRate)
        : currentRate
          ? parseFloat(currentRate)
          : null
    )
  }, [currentRevenueRate, currentRate])

  const invalidate = () => qc.invalidateQueries({ queryKey: ['finance', 'month-full', month] })
  const invalidateRevenue = () =>
    qc.invalidateQueries({ queryKey: ['finance', 'revenue', month, partnerFilter] })

  const handleExport = async () => {
    if (!exportRange?.[0] || !exportRange?.[1]) return
    const from = exportRange[0].format('YYYY-MM')
    const to = exportRange[1].format('YYYY-MM')
    setExporting(true)
    try {
      const res = await salaryApi.exportRevenue(from, to)
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `doanh-thu-${from}-${to}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      message.error('Lỗi xuất Excel')
    } finally {
      setExporting(false)
    }
  }

  const upsertRateMut = useMutation({
    mutationFn: (values) => salaryApi.upsertExchangeRate({ ...values, month }),
    onSuccess: (res) => {
      message.success(
        `Đã cập nhật tỷ giá lương. Áp dụng cho ${res.data.updated_salary_count} bản ghi.`
      )
      invalidate()
    },
    onError: (e) => message.error(e.response?.data?.error || 'Lỗi cập nhật tỷ giá'),
  })

  const upsertRevenueRateMut = useMutation({
    mutationFn: (values) => revenueApi.upsertExchangeRate({ ...values, month }),
    onSuccess: (res) => {
      message.success(
        `Đã cập nhật tỷ giá doanh thu. Áp dụng cho ${res.data.updated_count} bản ghi.`
      )
      invalidateRevenue()
    },
    onError: (e) => message.error(e.response?.data?.error || 'Lỗi cập nhật tỷ giá doanh thu'),
  })

  const handleSalaryRateSave = () => {
    if (!rateInput) return
    const revSet = revenueRateInput != null && revenueRateInput !== rateInput
    if (revSet) {
      Modal.confirm({
        title: 'Cập nhật tỷ giá doanh thu?',
        content: `Tỷ giá doanh thu đang là ${fmtVND(revenueRateInput)}. Có muốn cập nhật theo tỷ giá tiền lương (${fmtVND(rateInput)})?`,
        okText: 'Cập nhật cả hai',
        cancelText: 'Chỉ tiền lương',
        onOk: () => {
          setRevenueRateInput(rateInput)
          upsertRateMut.mutate({ rate: rateInput })
          upsertRevenueRateMut.mutate({ rate: rateInput })
        },
        onCancel: () => {
          upsertRateMut.mutate({ rate: rateInput })
        },
      })
    } else {
      if (revenueRateInput === null) setRevenueRateInput(rateInput)
      upsertRateMut.mutate({ rate: rateInput })
    }
  }

  const deleteMut = useMutation({
    mutationFn: (id) => salaryApi.remove(id),
    onSuccess: () => {
      message.success('Đã xóa')
      invalidate()
      invalidateRevenue()
    },
  })

  const inlineUpdateMut = useMutation({
    mutationFn: ({ id, field, value }) => salaryApi.update(id, { [field]: value }),
    onSuccess: () => {
      invalidate()
      invalidateRevenue()
    },
    onError: (e) => message.error(e.response?.data?.error || 'Lỗi cập nhật'),
  })

  const revenueUpdateMut = useMutation({
    mutationFn: ({ id, field, value }) => revenueApi.update(id, { [field]: value }),
    onSuccess: () => invalidateRevenue(),
    onError: (e) => message.error(e.response?.data?.error || 'Lỗi cập nhật'),
  })

  const bulkGenMut = useMutation({
    mutationFn: () => salaryApi.bulkGenerate(month),
    onSuccess: (res) => {
      const { created, skipped } = res.data
      const parts = []
      if (created > 0) parts.push(`Đã tạo ${created} bản ghi`)
      if (skipped > 0) parts.push(`bỏ qua ${skipped} đã có`)
      message.success(parts.join(', ') || 'Không có bản ghi mới')
      invalidate()
      invalidateRevenue()
    },
    onError: (e) => message.error(e.response?.data?.error || 'Lỗi tạo bảng lương'),
  })

  function inlineInput(field, value, record, opts = {}) {
    const { width = 90, precision = 0, max, noFormat } = opts
    if (record.is_paid) {
      const display =
        value != null ? (noFormat ? value : new Intl.NumberFormat('vi-VN').format(value)) : '-'
      return <Text style={{ fontSize: 12 }}>{display}</Text>
    }
    return (
      <InputNumber
        key={`${record.salary_id}-${field}-${value}`}
        size="small"
        min={0}
        max={max}
        precision={precision}
        defaultValue={value != null ? parseFloat(value) : undefined}
        placeholder="-"
        style={{ width }}
        formatter={
          noFormat ? undefined : (v) => (v ? new Intl.NumberFormat('vi-VN').format(v) : '')
        }
        parser={noFormat ? undefined : (v) => v?.replace(/\./g, '')}
        onBlur={(e) => {
          const raw = e.target.value?.replace(/\./g, '').replace(/,/g, '')
          const val = raw === '' ? null : parseFloat(raw)
          if (val !== (value != null ? parseFloat(value) : null)) {
            inlineUpdateMut.mutate({ id: record.salary_id, field, value: val })
          }
        }}
        onPressEnter={(e) => e.target.blur()}
      />
    )
  }

  function inlineText(field, value, record) {
    if (record.is_paid) {
      return value ? <Text style={{ fontSize: 12, color: '#888' }}>{value}</Text> : null
    }
    return (
      <Input
        key={`${record.salary_id}-${field}-${value}`}
        size="small"
        defaultValue={value || ''}
        placeholder="Ghi chú..."
        style={{ width: '100%', minWidth: 120 }}
        onBlur={(e) => {
          const val = e.target.value.trim() || null
          if (val !== (value || null)) {
            inlineUpdateMut.mutate({ id: record.salary_id, field, value: val })
          }
        }}
        onPressEnter={(e) => e.target.blur()}
      />
    )
  }

  function inlineRevenueInput(field, value, record, opts = {}) {
    const { width = 90, precision = 0, max, noFormat } = opts
    if (record.is_paid) {
      const display =
        value != null ? (noFormat ? value : new Intl.NumberFormat('vi-VN').format(value)) : '-'
      return <Text style={{ fontSize: 12 }}>{display}</Text>
    }
    return (
      <InputNumber
        key={`rev-${record.revenue_id}-${field}-${value}`}
        size="small"
        min={0}
        max={max}
        precision={precision}
        defaultValue={value != null ? parseFloat(value) : undefined}
        placeholder="-"
        style={{ width }}
        formatter={
          noFormat ? undefined : (v) => (v ? new Intl.NumberFormat('vi-VN').format(v) : '')
        }
        parser={noFormat ? undefined : (v) => v?.replace(/\./g, '')}
        onBlur={(e) => {
          const raw = e.target.value?.replace(/\./g, '').replace(/,/g, '')
          const val = raw === '' ? null : parseFloat(raw)
          if (val !== (value != null ? parseFloat(value) : null)) {
            revenueUpdateMut.mutate({ id: record.revenue_id, field, value: val })
          }
        }}
        onPressEnter={(e) => e.target.blur()}
      />
    )
  }

  function inlineRevenueText(field, value, record) {
    if (record.is_paid) {
      return value ? <Text style={{ fontSize: 12, color: '#888' }}>{value}</Text> : null
    }
    return (
      <Input
        key={`rev-${record.revenue_id}-${field}-${value}`}
        size="small"
        defaultValue={value || ''}
        placeholder="Ghi chú..."
        style={{ width: '100%', minWidth: 120 }}
        onBlur={(e) => {
          const val = e.target.value.trim() || null
          if (val !== (value || null)) {
            revenueUpdateMut.mutate({ id: record.revenue_id, field, value: val })
          }
        }}
        onPressEnter={(e) => e.target.blur()}
      />
    )
  }

  const monthLabel = dayjs(month, 'YYYY-MM').format('MM/YYYY')

  // ── Stats ────────────────────────────────────────────────────
  // totalThu = tổng cột "Tổng thu" Tab 2 (= contract_amount_vnd + visa_fee + owner_bonus)
  let totalThu = 0
  for (const r of revRows) {
    const thu = calcTongThuChuTau(r)
    if (thu != null) totalThu += thu
  }
  const totalChiPhi = revRows.reduce((s, r) => {
    const luongTV =
      r.salary_net_vnd != null ? parseFloat(r.salary_net_vnd) : (calcLuongVnd(r, daysInMonth) ?? 0)
    return (
      s +
      luongTV +
      n(r.export_labor_fee) +
      n(r.immigration_fee) +
      n(r.transport_fee) +
      n(r.penalty_amount) +
      n(r.other_cost)
    )
  }, 0)
  // totalProfit = tổng cột Lợi nhuận Tab 2
  let totalProfit = 0
  for (const r of revRows) {
    const ln = calcLoiNhuan(r, daysInMonth)
    if (ln != null) totalProfit += ln
  }

  // ── Tab 1: Bảng lương TV ──────────────────────────────────────
  const salaryColumns = [
    {
      title: 'STT',
      width: 50,
      align: 'center',
      fixed: 'left',
      render: (_, __, idx) => <Text type="secondary">{idx + 1}</Text>,
    },
    {
      title: 'Thuyền viên',
      width: 155,
      fixed: 'left',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.seafarer_name}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {r.rank_code || r.rank_name} · {r.vessel_name || '-'}
          </Text>
          <div style={{ fontSize: 11, color: '#888' }}>{r.partner_name || '-'}</div>
        </div>
      ),
    },
    {
      title: <span style={{ color: '#389e0d' }}>Các khoản thu</span>,
      onHeaderCell: () => ({ style: { background: '#f6ffed' } }),
      children: [
        {
          title: 'Lương theo HĐ (USD)',
          dataIndex: 'salary_gross',
          align: 'right',
          width: 100,
          onHeaderCell: () => ({ style: { background: '#f6ffed' } }),
          render: (v, r) => inlineInput('salary_gross', v, r, { width: 85 }),
        },
        {
          title: 'Ngày công',
          dataIndex: 'working_days',
          align: 'center',
          width: 80,
          onHeaderCell: () => ({ style: { background: '#f6ffed' } }),
          render: (v, r) =>
            inlineInput('working_days', v, r, { width: 55, max: daysInMonth, noFormat: true }),
        },
        {
          title: 'Tỷ giá',
          dataIndex: 'exchange_rate',
          align: 'right',
          width: 95,
          onHeaderCell: () => ({ style: { background: '#f6ffed' } }),
          render: (v, r) => inlineInput('exchange_rate', v, r, { width: 85 }),
        },
        {
          title: 'Quy đổi VNĐ',
          align: 'right',
          width: 120,
          onHeaderCell: () => ({ style: { background: '#f6ffed' } }),
          render: (_, r) => {
            const val = calcLuongVnd(r, daysInMonth)
            return val != null ? (
              <Text style={{ color: '#003366' }}>{fmtVND(Math.round(val))}</Text>
            ) : (
              '-'
            )
          },
        },
        {
          title: 'Thưởng Rejoin',
          dataIndex: 'bonus_rejoin',
          align: 'right',
          width: 110,
          onHeaderCell: () => ({ style: { background: '#f6ffed' } }),
          render: (v, r) => inlineInput('bonus_rejoin', v, r, { width: 90 }),
        },
        {
          title: 'Thưởng khác',
          dataIndex: 'bonus_other',
          align: 'right',
          width: 105,
          onHeaderCell: () => ({ style: { background: '#f6ffed' } }),
          render: (v, r) => inlineInput('bonus_other', v, r, { width: 90 }),
        },
        {
          title: 'Tổng thu',
          align: 'right',
          width: 120,
          onHeaderCell: () => ({ style: { background: '#f6ffed' } }),
          render: (_, r) => {
            const luong = calcLuongVnd(r, daysInMonth)
            if (luong == null) return '-'
            const tong = luong + n(r.bonus_rejoin) + n(r.bonus_other)
            return (
              <Text strong style={{ color: '#389e0d' }}>
                {fmtVND(Math.round(tong))}
              </Text>
            )
          },
        },
      ],
    },
    {
      title: <span style={{ color: '#cf1322' }}>Các khoản giảm trừ</span>,
      onHeaderCell: () => ({ style: { background: '#fff2f0' } }),
      children: [
        {
          title: 'Ứng lương',
          dataIndex: 'advance_payment',
          align: 'right',
          width: 95,
          onHeaderCell: () => ({ style: { background: '#fff2f0' } }),
          render: (v, r) => inlineInput('advance_payment', v, r, { width: 85 }),
        },
        {
          title: 'Phí đổi CC',
          dataIndex: 'doc_fee',
          align: 'right',
          width: 90,
          onHeaderCell: () => ({ style: { background: '#fff2f0' } }),
          render: (v, r) => inlineInput('doc_fee', v, r, { width: 80 }),
        },
        {
          title: (
            <span>
              Phí bằng
              <br />
              cờ tàu
            </span>
          ),
          dataIndex: 'flag_cert_fee',
          align: 'right',
          width: 115,
          onHeaderCell: () => ({ style: { background: '#fff2f0' } }),
          render: (v, r) => inlineInput('flag_cert_fee', v, r, { width: 90 }),
        },
        {
          title: 'Phạt HĐ',
          dataIndex: 'penalty_amount',
          align: 'right',
          width: 90,
          onHeaderCell: () => ({ style: { background: '#fff2f0' } }),
          render: (v, r) => inlineInput('penalty_amount', v, r, { width: 80 }),
        },
      ],
    },
    {
      title: 'Thanh toán',
      align: 'right',
      width: 130,
      onHeaderCell: () => ({ style: { background: '#fff' } }),
      render: (_, r) => {
        const luong = calcLuongVnd(r, daysInMonth)
        if (luong == null) return '-'
        const tongThu = luong + n(r.bonus_rejoin) + n(r.bonus_other)
        const giamTru =
          n(r.advance_payment) +
          n(r.doc_fee) +
          n(r.flag_cert_fee) +
          n(r.penalty_amount) +
          n(r.total_deductions) +
          n(r.other_costs_total)
        const thanhToan = tongThu - giamTru
        return (
          <div>
            <Text strong style={{ color: thanhToan >= 0 ? '#389e0d' : '#cf1322' }}>
              {fmtVND(Math.round(thanhToan))}
            </Text>
            {!!r.is_paid && (
              <div style={{ marginTop: 2 }}>
                <Tag color="success" style={{ margin: 0 }}>
                  Đã trả
                </Tag>
              </div>
            )}
          </div>
        )
      },
    },
    {
      title: 'Ghi chú',
      dataIndex: 'salary_notes',
      width: 150,
      align: 'right',
      onHeaderCell: () => ({ style: { background: '#fff' } }),
      render: (v, r) => inlineText('notes', v, r),
    },
    {
      title: '',
      width: 70,
      fixed: 'right',
      render: (_, r) => (
        <Space size={2}>
          <Popconfirm title="Xóa bản ghi lương?" onConfirm={() => deleteMut.mutate(r.salary_id)}>
            <Button size="small" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // ── Tab 2: Doanh thu từ chủ tàu ──────────────────────────────
  const revenueColumns = [
    {
      title: 'STT',
      width: 50,
      align: 'center',
      fixed: 'left',
      render: (_, __, idx) => <Text type="secondary">{idx + 1}</Text>,
    },
    {
      title: 'Thuyền viên',
      width: 145,
      fixed: 'left',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.seafarer_name}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {r.rank_code || r.rank_name}
          </Text>
        </div>
      ),
    },
    {
      title: 'Tên tàu',
      width: 120,
      render: (_, r) => {
        if (!r.vessel_name)
          return (
            <Text type="secondary" style={{ fontSize: 12 }}>
              -
            </Text>
          )
        const truncated =
          r.vessel_name.length > 14 ? r.vessel_name.slice(0, 14) + '…' : r.vessel_name
        return (
          <Text
            strong
            style={{
              fontSize: 13,
              color: '#595959',
              cursor: r.vessel_name.length > 14 ? 'help' : 'default',
            }}
            title={r.vessel_name}
          >
            {truncated}
          </Text>
        )
      },
    },
    {
      title: 'Chủ tàu',
      width: 140,
      render: (_, r) => {
        if (!r.partner_name)
          return (
            <Text type="secondary" style={{ fontSize: 12 }}>
              -
            </Text>
          )
        const truncated =
          r.partner_name.length > 15 ? r.partner_name.slice(0, 15) + '…' : r.partner_name
        return (
          <Text
            strong
            style={{
              fontSize: 13,
              color: '#003366',
              cursor: r.partner_name.length > 15 ? 'help' : 'default',
            }}
            title={r.partner_name}
          >
            {truncated}
          </Text>
        )
      },
    },
    {
      title: <span style={{ color: '#389e0d' }}>Các khoản thu từ chủ tàu</span>,
      onHeaderCell: () => ({ style: { background: '#f6ffed' } }),
      children: [
        {
          title: 'Doanh thu (USD)',
          dataIndex: 'contract_amount',
          align: 'right',
          width: 115,
          onHeaderCell: () => ({ style: { background: '#f6ffed' } }),
          render: (v, r) =>
            inlineRevenueInput('contract_amount', v ?? r.job_amount, r, { width: 100 }),
        },
        {
          title: 'Tỷ giá',
          dataIndex: 'revenue_exchange_rate',
          align: 'right',
          width: 100,
          onHeaderCell: () => ({ style: { background: '#f6ffed' } }),
          render: (v, r) =>
            inlineRevenueInput('revenue_exchange_rate', v ?? r.salary_exchange_rate, r, {
              width: 88,
            }),
        },
        {
          title: 'Quy đổi',
          align: 'right',
          width: 125,
          onHeaderCell: () => ({ style: { background: '#f6ffed' } }),
          render: (_, r) => {
            const val = calcGiaTriHdVnd(r)
            return val != null ? (
              <Text style={{ color: '#003366' }}>{fmtVND(Math.round(val))}</Text>
            ) : (
              '-'
            )
          },
        },
        {
          title: 'Phí làm visa',
          dataIndex: 'visa_fee',
          align: 'right',
          width: 100,
          onHeaderCell: () => ({ style: { background: '#f6ffed' } }),
          render: (v, r) => inlineRevenueInput('visa_fee', v, r, { width: 88 }),
        },
        {
          title: 'Thưởng',
          dataIndex: 'owner_bonus',
          align: 'right',
          width: 95,
          onHeaderCell: () => ({ style: { background: '#f6ffed' } }),
          render: (v, r) => inlineRevenueInput('owner_bonus', v, r, { width: 83 }),
        },
      ],
    },
    {
      title: <span style={{ color: '#cf1322' }}>Các khoản giảm trừ</span>,
      onHeaderCell: () => ({ style: { background: '#fff2f0' } }),
      children: [
        {
          title: 'Lương TV',
          align: 'right',
          width: 120,
          onHeaderCell: () => ({ style: { background: '#fff2f0' } }),
          render: (_, r) => {
            const val =
              r.salary_net_vnd != null ? parseFloat(r.salary_net_vnd) : calcLuongVnd(r, daysInMonth)
            return val != null ? (
              <Text style={{ color: '#003366' }}>{fmtVND(Math.round(val))}</Text>
            ) : (
              '-'
            )
          },
        },
        {
          title: 'Phí XK',
          dataIndex: 'export_labor_fee',
          align: 'right',
          width: 90,
          onHeaderCell: () => ({ style: { background: '#fff2f0' } }),
          render: (v, r) => inlineRevenueInput('export_labor_fee', v, r, { width: 78 }),
        },
        {
          title: 'Phí cục XNC',
          dataIndex: 'immigration_fee',
          align: 'right',
          width: 100,
          onHeaderCell: () => ({ style: { background: '#fff2f0' } }),
          render: (v, r) => inlineRevenueInput('immigration_fee', v, r, { width: 88 }),
        },
        {
          title: (
            <span>
              Phí xe
              <br />
              đưa đón
            </span>
          ),
          dataIndex: 'transport_fee',
          align: 'right',
          width: 115,
          onHeaderCell: () => ({ style: { background: '#fff2f0' } }),
          render: (v, r) => inlineRevenueInput('transport_fee', v, r, { width: 90 }),
        },
        {
          title: 'Phí phạt HĐ',
          dataIndex: 'penalty_amount',
          align: 'right',
          width: 105,
          onHeaderCell: () => ({ style: { background: '#fff2f0' } }),
          render: (v, r) => inlineRevenueInput('penalty_amount', v, r, { width: 90 }),
        },
        {
          title: 'Chi phí khác',
          dataIndex: 'other_cost',
          align: 'right',
          width: 105,
          onHeaderCell: () => ({ style: { background: '#fff2f0' } }),
          render: (v, r) => inlineRevenueInput('other_cost', v, r, { width: 90 }),
        },
        {
          title: 'Thanh toán',
          align: 'right',
          width: 140,
          onHeaderCell: () => ({ style: { background: '#fff2f0' } }),
          render: (_, r) => {
            const luongTV =
              r.salary_net_vnd != null
                ? parseFloat(r.salary_net_vnd)
                : (calcLuongVnd(r, daysInMonth) ?? 0)
            const tongGiamTru =
              luongTV +
              n(r.export_labor_fee) +
              n(r.immigration_fee) +
              n(r.transport_fee) +
              n(r.penalty_amount) +
              n(r.other_cost)
            return (
              <div>
                <Text strong style={{ color: '#cf1322' }}>
                  {fmtVND(Math.round(tongGiamTru))}
                </Text>
                {!!r.is_paid && (
                  <div style={{ marginTop: 4 }}>
                    <Tag color="success" style={{ margin: 0 }}>
                      Đã trả
                    </Tag>
                  </div>
                )}
              </div>
            )
          },
        },
      ],
    },
    {
      title: 'Ghi chú',
      dataIndex: 'revenue_notes',
      width: 150,
      align: 'right',
      onHeaderCell: () => ({ style: { background: '#fff' } }),
      render: (v, r) => inlineRevenueText('notes', v, r),
    },
    {
      title: 'Tổng thu',
      align: 'right',
      width: 125,
      onHeaderCell: () => ({ style: { background: '#fff', fontWeight: 700 } }),
      render: (_, r) => {
        const tong = calcTongThuChuTau(r)
        return tong != null ? (
          <Text strong style={{ color: '#0958d9' }}>
            {fmtVND(Math.round(tong))}
          </Text>
        ) : (
          '-'
        )
      },
    },
    {
      title: 'Lợi nhuận',
      align: 'right',
      width: 125,
      onHeaderCell: () => ({ style: { background: '#fff', fontWeight: 700 } }),
      render: (_, r) => {
        const ln = calcLoiNhuan(r, daysInMonth)
        if (ln == null) return '-'
        return (
          <Text strong style={{ color: profitColor(ln) }}>
            {fmtVND(Math.round(ln))}
          </Text>
        )
      },
    },
  ]

  return (
    <div style={{ padding: 0 }}>
      <Title level={isMobile ? 5 : 4} style={{ margin: '0 0 12px 0' }}>
        Tài chính
      </Title>

      {/* Stats */}
      <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
        <Col xs={12} md={6}>
          <Card size="small" styles={{ body: { padding: isMobile ? '8px 12px' : undefined } }}>
            <Statistic
              title={
                <span style={{ fontSize: isMobile ? 11 : 14 }}>
                  Thu từ HĐ{' '}
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    ({filteredRows.length})
                  </Text>
                </span>
              }
              value={fmtVND(Math.round(totalThu))}
              suffix={isMobile ? '' : 'VND'}
              styles={{ content: { color: '#003366', fontSize: isMobile ? 14 : 17 } }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" styles={{ body: { padding: isMobile ? '8px 12px' : undefined } }}>
            <Statistic
              title={<span style={{ fontSize: isMobile ? 11 : 14 }}>Chi phí</span>}
              value={fmtVND(Math.round(totalChiPhi))}
              suffix={isMobile ? '' : 'VND'}
              styles={{ content: { color: '#e74c3c', fontSize: isMobile ? 14 : 17 } }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card
            size="small"
            style={{
              background: totalProfit >= 0 ? '#f6ffed' : '#fff2f0',
              border: `1px solid ${totalProfit >= 0 ? '#b7eb8f' : '#ffccc7'}`,
            }}
            styles={{ body: { padding: isMobile ? '8px 12px' : undefined } }}
          >
            <Statistic
              title={<span style={{ fontSize: isMobile ? 11 : 14 }}>Lãi / Lỗ</span>}
              value={fmtVND(Math.round(totalProfit))}
              suffix={isMobile ? '' : 'VND'}
              styles={{
                content: {
                  color: profitColor(totalProfit),
                  fontSize: isMobile ? 14 : 17,
                  fontWeight: 700,
                },
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* Export */}
      <div
        style={{
          background: '#f6f8fa',
          border: '1px solid #e8eaed',
          borderRadius: 6,
          padding: '10px 14px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <DownloadOutlined style={{ color: '#1677ff', fontSize: 15 }} />
        <Text strong style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
          Xuất Excel doanh thu:
        </Text>
        <DatePicker.RangePicker
          picker="month"
          format="MM/YYYY"
          value={exportRange}
          onChange={setExportRange}
          placeholder={['Từ tháng', 'Đến tháng']}
          style={{ width: isMobile ? '100%' : 230 }}
          allowClear
        />
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          loading={exporting}
          disabled={!exportRange?.[0] || !exportRange?.[1]}
          onClick={handleExport}
        >
          Xuất Excel
        </Button>
      </div>

      {/* Controls */}
      {isMobile ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <DatePicker
            picker="month"
            value={dayjs(month, 'YYYY-MM')}
            format="MM/YYYY"
            onChange={(d) => {
              if (d) {
                setMonth(d.format('YYYY-MM'))
                setRateInput(null)
              }
            }}
            allowClear={false}
            style={{ width: 100 }}
          />
          <Popconfirm
            title={`Tạo bảng lương tháng ${monthLabel}?`}
            okText="Tạo"
            cancelText="Hủy"
            onConfirm={() => bulkGenMut.mutate()}
          >
            <Button type="primary" loading={bulkGenMut.isPending}>
              Tạo
            </Button>
          </Popconfirm>
        </div>
      ) : (
        <Row gutter={[12, 8]} align="middle" style={{ marginBottom: 12 }}>
          <Col>
            <DatePicker
              picker="month"
              value={dayjs(month, 'YYYY-MM')}
              format="MM/YYYY"
              onChange={(d) => {
                if (d) {
                  setMonth(d.format('YYYY-MM'))
                  setRateInput(null)
                }
              }}
              allowClear={false}
              style={{ width: 120 }}
            />
          </Col>
          <Col>
            <Popconfirm
              title={`Tạo bảng lương tháng ${monthLabel}?`}
              okText="Tạo"
              cancelText="Hủy"
              onConfirm={() => bulkGenMut.mutate()}
            >
              <Button type="primary" loading={bulkGenMut.isPending}>
                Tạo bảng lương
              </Button>
            </Popconfirm>
          </Col>
        </Row>
      )}

      <Tabs
        defaultActiveKey="salary"
        size="large"
        style={{ fontWeight: 600 }}
        items={[
          {
            key: 'salary',
            label: (
              <span>
                <DollarOutlined style={{ marginRight: 6 }} />
                Tiền lương
              </span>
            ),
            children: (
              <>
                {/* Tiền lương controls */}
                {isMobile ? (
                  <div
                    style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}
                  >
                    <Input.Search
                      placeholder="Tên thuyền viên..."
                      allowClear
                      value={nameFilter}
                      onChange={(e) => setNameFilter(e.target.value)}
                      style={{ width: '100%' }}
                    />
                    <Space.Compact style={{ width: '100%' }}>
                      <InputNumber
                        placeholder="Tỷ giá..."
                        value={rateInput}
                        onChange={setRateInput}
                        min={1000}
                        max={999999}
                        step={100}
                        formatter={(v) => (v ? new Intl.NumberFormat('vi-VN').format(v) : '')}
                        parser={(v) => v?.replace(/\D/g, '')}
                        style={{ width: '100%' }}
                        onPressEnter={handleSalaryRateSave}
                      />
                      <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        loading={upsertRateMut.isPending}
                        disabled={!rateInput}
                        onClick={handleSalaryRateSave}
                      />
                    </Space.Compact>
                    {!currentRate && !isLoading && (
                      <Alert
                        type="warning"
                        showIcon
                        icon={<ExclamationCircleOutlined />}
                        message={`Chưa có tỷ giá cho tháng ${monthLabel}.`}
                      />
                    )}
                  </div>
                ) : (
                  <Row gutter={[12, 8]} align="middle" style={{ marginBottom: 10 }}>
                    <Col>
                      <Input.Search
                        placeholder="Tên thuyền viên..."
                        allowClear
                        value={nameFilter}
                        onChange={(e) => setNameFilter(e.target.value)}
                        style={{ width: 200 }}
                      />
                    </Col>
                    <Col>
                      <Space.Compact>
                        <InputNumber
                          placeholder="Tỷ giá VND/USD"
                          value={rateInput}
                          onChange={setRateInput}
                          min={1000}
                          max={999999}
                          step={100}
                          formatter={(v) => (v ? new Intl.NumberFormat('vi-VN').format(v) : '')}
                          parser={(v) => v?.replace(/\D/g, '')}
                          style={{ width: 150 }}
                          onPressEnter={handleSalaryRateSave}
                        />
                        <Button
                          type="primary"
                          icon={<SaveOutlined />}
                          loading={upsertRateMut.isPending}
                          disabled={!rateInput}
                          onClick={handleSalaryRateSave}
                        />
                      </Space.Compact>
                    </Col>
                    {!currentRate && !isLoading && (
                      <Col>
                        <Alert
                          type="warning"
                          showIcon
                          icon={<ExclamationCircleOutlined />}
                          message={`Chưa có tỷ giá cho tháng ${monthLabel}.`}
                        />
                      </Col>
                    )}
                  </Row>
                )}
                {isMobile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {isLoading && (
                      <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>
                        Đang tải...
                      </div>
                    )}
                    {!isLoading && filteredRows.length === 0 && (
                      <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>
                        Không có dữ liệu
                      </div>
                    )}
                    {filteredRows.map((r) => {
                      const luongVnd = calcLuongVnd(r, daysInMonth)
                      const tongThu =
                        luongVnd != null ? luongVnd + n(r.bonus_rejoin) + n(r.bonus_other) : null
                      return (
                        <Card
                          key={r.salary_id}
                          size="small"
                          style={{
                            borderRadius: 8,
                            border: r.is_paid ? '1px solid #b7eb8f' : undefined,
                          }}
                          styles={{ body: { padding: '10px 12px' } }}
                        >
                          {/* Header */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: 8,
                            }}
                          >
                            <Text strong style={{ fontSize: 14 }}>
                              {r.seafarer_name}
                            </Text>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                flexShrink: 0,
                                marginLeft: 8,
                              }}
                            >
                              {!!r.is_paid && (
                                <Tag color="success" style={{ margin: 0 }}>
                                  Đã trả
                                </Tag>
                              )}
                              <Popconfirm
                                title="Xóa bản ghi lương?"
                                onConfirm={() => deleteMut.mutate(r.salary_id)}
                              >
                                <Button size="small" icon={<DeleteOutlined />} danger />
                              </Popconfirm>
                            </div>
                          </div>

                          {/* Info: Chức danh + Tên tàu + Chủ tàu */}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: '4px 12px',
                              marginBottom: 10,
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                Chức danh
                              </Text>
                              <div
                                style={{
                                  fontSize: 13,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={r.rank_code || r.rank_name}
                              >
                                {r.rank_code || r.rank_name || '-'}
                              </div>
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                Tên tàu
                              </Text>
                              <div
                                style={{
                                  fontSize: 13,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={r.vessel_name}
                              >
                                {r.vessel_name || '-'}
                              </div>
                            </div>
                            <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                Chủ tàu
                              </Text>
                              <div
                                style={{
                                  fontSize: 13,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={r.partner_name}
                              >
                                {r.partner_name || '-'}
                              </div>
                            </div>
                          </div>

                          {/* Các khoản thu */}
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: '#389e0d',
                              marginBottom: 4,
                            }}
                          >
                            CÁC KHOẢN THU
                          </div>
                          <Row gutter={[8, 6]} style={{ marginBottom: 8 }}>
                            <Col span={12}>
                              <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
                                Lương theo HĐ (USD)
                              </div>
                              {inlineInput('salary_gross', r.salary_gross, r, { width: '100%' })}
                            </Col>
                            <Col span={12}>
                              <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
                                Ngày công / {daysInMonth}
                              </div>
                              {inlineInput('working_days', r.working_days, r, {
                                width: '100%',
                                max: daysInMonth,
                                noFormat: true,
                              })}
                            </Col>
                            <Col span={12}>
                              <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
                                Tỷ giá
                              </div>
                              {inlineInput('exchange_rate', r.exchange_rate, r, { width: '100%' })}
                            </Col>
                            <Col span={12}>
                              <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
                                Quy đổi VNĐ
                              </div>
                              <Text style={{ color: '#003366', fontWeight: 500 }}>
                                {luongVnd != null ? fmtVND(Math.round(luongVnd)) : '-'}
                              </Text>
                            </Col>
                            <Col span={12}>
                              <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
                                Thưởng Rejoin
                              </div>
                              {inlineInput('bonus_rejoin', r.bonus_rejoin, r, { width: '100%' })}
                            </Col>
                            <Col span={12}>
                              <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
                                Thưởng khác
                              </div>
                              {inlineInput('bonus_other', r.bonus_other, r, { width: '100%' })}
                            </Col>
                            {tongThu != null && (
                              <Col span={24}>
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    paddingTop: 4,
                                    borderTop: '1px dashed #d9f7be',
                                  }}
                                >
                                  <Text style={{ fontSize: 12, color: '#389e0d' }}>Tổng thu</Text>
                                  <Text strong style={{ color: '#389e0d' }}>
                                    {fmtVND(Math.round(tongThu))}
                                  </Text>
                                </div>
                              </Col>
                            )}
                          </Row>

                          {/* Các khoản giảm trừ */}
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: '#cf1322',
                              marginBottom: 4,
                            }}
                          >
                            CÁC KHOẢN GIẢM TRỪ
                          </div>
                          <Row gutter={[8, 6]}>
                            <Col span={12}>
                              <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
                                Ứng lương
                              </div>
                              {inlineInput('advance_payment', r.advance_payment, r, {
                                width: '100%',
                              })}
                            </Col>
                            <Col span={12}>
                              <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
                                Phí đổi CC
                              </div>
                              {inlineInput('doc_fee', r.doc_fee, r, { width: '100%' })}
                            </Col>
                            <Col span={12}>
                              <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
                                Phí bằng cờ tàu
                              </div>
                              {inlineInput('flag_cert_fee', r.flag_cert_fee, r, { width: '100%' })}
                            </Col>
                            <Col span={12}>
                              <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
                                Phạt HĐ
                              </div>
                              {inlineInput('penalty_amount', r.penalty_amount, r, {
                                width: '100%',
                              })}
                            </Col>
                          </Row>

                          {/* Ghi chú */}
                          <div style={{ marginTop: 8 }}>
                            {inlineText('notes', r.salary_notes, r)}
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                ) : (
                  <Table
                    dataSource={filteredRows}
                    columns={salaryColumns}
                    rowKey={(r) => r.salary_id}
                    loading={isLoading}
                    size="small"
                    scroll={{ x: 1450, y: 600 }}
                    pagination={false}
                    summary={() => {
                      if (!filteredRows.length) return null
                      let sumThanhToan = 0,
                        hasAny = false
                      for (const r of filteredRows) {
                        const luong = calcLuongVnd(r, daysInMonth)
                        if (luong == null) continue
                        const tongThu = luong + n(r.bonus_rejoin) + n(r.bonus_other)
                        const giamTru =
                          n(r.advance_payment) +
                          n(r.doc_fee) +
                          n(r.flag_cert_fee) +
                          n(r.penalty_amount) +
                          n(r.total_deductions) +
                          n(r.other_costs_total)
                        sumThanhToan += tongThu - giamTru
                        hasAny = true
                      }
                      if (!hasAny) return null
                      return (
                        <Table.Summary>
                          <Table.Summary.Row style={{ background: '#fafafa' }}>
                            <Table.Summary.Cell index={0} colSpan={13}>
                              <Text strong>Tổng ({filteredRows.length})</Text>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={13} align="right">
                              <Text
                                strong
                                style={{ color: sumThanhToan >= 0 ? '#389e0d' : '#cf1322' }}
                              >
                                {fmtVND(Math.round(sumThanhToan))}
                              </Text>
                            </Table.Summary.Cell>
                          </Table.Summary.Row>
                        </Table.Summary>
                      )
                    }}
                  />
                )}
              </>
            ),
          },
          {
            key: 'revenue',
            label: (
              <span>
                <SwapOutlined style={{ marginRight: 6 }} />
                Doanh thu chủ tàu
              </span>
            ),
            children: (
              <>
                {/* Doanh thu controls */}
                {isMobile ? (
                  <div
                    style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}
                  >
                    <Select
                      allowClear
                      placeholder="Lọc theo chủ tàu..."
                      value={partnerFilter}
                      onChange={setPartnerFilter}
                      style={{ width: '100%' }}
                      options={(partners || []).map((p) => ({
                        value: p.id,
                        label: p.company_name,
                      }))}
                      showSearch
                      filterOption={(input, opt) =>
                        opt.label.toLowerCase().includes(input.toLowerCase())
                      }
                    />
                    <Space.Compact style={{ width: '100%' }}>
                      <InputNumber
                        placeholder="Tỷ giá VND/USD..."
                        value={revenueRateInput}
                        onChange={setRevenueRateInput}
                        min={1000}
                        max={999999}
                        step={100}
                        formatter={(v) => (v ? new Intl.NumberFormat('vi-VN').format(v) : '')}
                        parser={(v) => v?.replace(/\D/g, '')}
                        style={{ width: '100%' }}
                        onPressEnter={() =>
                          revenueRateInput &&
                          upsertRevenueRateMut.mutate({ rate: revenueRateInput })
                        }
                      />
                      <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        loading={upsertRevenueRateMut.isPending}
                        disabled={!revenueRateInput}
                        onClick={() => upsertRevenueRateMut.mutate({ rate: revenueRateInput })}
                      />
                    </Space.Compact>
                  </div>
                ) : (
                  <Row gutter={[12, 8]} align="middle" style={{ marginBottom: 10 }}>
                    <Col>
                      <Select
                        allowClear
                        placeholder="Lọc theo chủ tàu..."
                        value={partnerFilter}
                        onChange={setPartnerFilter}
                        style={{ width: 220 }}
                        options={(partners || []).map((p) => ({
                          value: p.id,
                          label: p.company_name,
                        }))}
                        showSearch
                        filterOption={(input, opt) =>
                          opt.label.toLowerCase().includes(input.toLowerCase())
                        }
                      />
                    </Col>
                    <Col>
                      <Space.Compact>
                        <InputNumber
                          placeholder="Tỷ giá VND/USD"
                          value={revenueRateInput}
                          onChange={setRevenueRateInput}
                          min={1000}
                          max={999999}
                          step={100}
                          formatter={(v) => (v ? new Intl.NumberFormat('vi-VN').format(v) : '')}
                          parser={(v) => v?.replace(/\D/g, '')}
                          style={{ width: 150 }}
                          onPressEnter={() =>
                            revenueRateInput &&
                            upsertRevenueRateMut.mutate({ rate: revenueRateInput })
                          }
                        />
                        <Button
                          type="primary"
                          icon={<SaveOutlined />}
                          loading={upsertRevenueRateMut.isPending}
                          disabled={!revenueRateInput}
                          onClick={() => upsertRevenueRateMut.mutate({ rate: revenueRateInput })}
                        />
                      </Space.Compact>
                    </Col>
                  </Row>
                )}
                {isMobile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {revLoading && (
                      <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>
                        Đang tải...
                      </div>
                    )}
                    {!revLoading && revRows.length === 0 && (
                      <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>
                        Không có dữ liệu
                      </div>
                    )}
                    {revRows.map((r, idx) => {
                      const dthu = calcGiaTriHdVnd(r)
                      const tongThu = calcTongThuChuTau(r)
                      const ln = calcLoiNhuan(r, daysInMonth)
                      return (
                        <Card
                          key={r.revenue_id}
                          size="small"
                          style={{
                            borderRadius: 8,
                            border: ln != null && ln < 0 ? '1px solid #ffccc7' : undefined,
                          }}
                          styles={{ body: { padding: '10px 12px' } }}
                        >
                          {/* Header */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              marginBottom: 8,
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  {idx + 1}.
                                </Text>
                                <Text strong style={{ fontSize: 14 }}>
                                  {r.seafarer_name}
                                </Text>
                              </div>
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                flexShrink: 0,
                                marginLeft: 8,
                              }}
                            >
                              {!!r.is_paid && (
                                <Tag color="success" style={{ margin: 0 }}>
                                  Đã trả
                                </Tag>
                              )}
                            </div>
                          </div>

                          {/* Chức danh + Tên tàu + Chủ tàu */}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: '4px 12px',
                              marginBottom: 10,
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                Chức danh
                              </Text>
                              <div
                                style={{
                                  fontSize: 13,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={r.rank_code || r.rank_name}
                              >
                                {r.rank_code || r.rank_name || '-'}
                              </div>
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                Tên tàu
                              </Text>
                              <div
                                style={{
                                  fontSize: 13,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={r.vessel_name}
                              >
                                {r.vessel_name || '-'}
                              </div>
                            </div>
                            <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                Chủ tàu
                              </Text>
                              <div
                                style={{
                                  fontSize: 13,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={r.partner_name}
                              >
                                {r.partner_name || '-'}
                              </div>
                            </div>
                          </div>

                          {/* Thu */}
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: '#389e0d',
                              marginBottom: 4,
                            }}
                          >
                            THU TỪ CHỦ TÀU
                          </div>
                          <Row gutter={[8, 6]} style={{ marginBottom: 8 }}>
                            <Col span={12}>
                              <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
                                Doanh thu (VNĐ)
                              </div>
                              <Text style={{ fontSize: 13, color: '#003366', fontWeight: 500 }}>
                                {dthu != null ? fmtVND(Math.round(dthu)) : '-'}
                              </Text>
                            </Col>
                            <Col span={12}>
                              <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
                                Phí làm visa
                              </div>
                              {inlineRevenueInput('visa_fee', r.visa_fee, r, { width: '100%' })}
                            </Col>
                            <Col span={12}>
                              <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
                                Thưởng từ chủ tàu
                              </div>
                              {inlineRevenueInput('owner_bonus', r.owner_bonus, r, {
                                width: '100%',
                              })}
                            </Col>
                            <Col span={12}>
                              <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
                                Tổng thu
                              </div>
                              <Text strong style={{ fontSize: 13, color: '#389e0d' }}>
                                {tongThu != null ? fmtVND(Math.round(tongThu)) : '-'}
                              </Text>
                            </Col>
                          </Row>

                          {/* Chi */}
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: '#cf1322',
                              marginBottom: 4,
                            }}
                          >
                            CÁC KHOẢN CHI
                          </div>
                          <Row gutter={[8, 6]} style={{ marginBottom: 8 }}>
                            <Col span={12}>
                              <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
                                Phí XK
                              </div>
                              {inlineRevenueInput('export_labor_fee', r.export_labor_fee, r, {
                                width: '100%',
                              })}
                            </Col>
                            <Col span={12}>
                              <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
                                Phí cục XNC
                              </div>
                              {inlineRevenueInput('immigration_fee', r.immigration_fee, r, {
                                width: '100%',
                              })}
                            </Col>
                            <Col span={12}>
                              <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
                                Phí xe đưa đón
                              </div>
                              {inlineRevenueInput('transport_fee', r.transport_fee, r, {
                                width: '100%',
                              })}
                            </Col>
                            <Col span={12}>
                              <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
                                Phí phạt HĐ
                              </div>
                              {inlineRevenueInput('penalty_amount', r.penalty_amount, r, {
                                width: '100%',
                              })}
                            </Col>
                            <Col span={12}>
                              <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
                                Chi phí khác
                              </div>
                              {inlineRevenueInput('other_cost', r.other_cost, r, {
                                width: '100%',
                              })}
                            </Col>
                          </Row>

                          {/* Lợi nhuận */}
                          {ln != null && (
                            <div
                              style={{
                                marginTop: 4,
                                paddingTop: 8,
                                borderTop: '1px solid #f0f0f0',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                Lợi nhuận
                              </Text>
                              <Text strong style={{ fontSize: 15, color: profitColor(ln) }}>
                                {fmtVND(Math.round(ln))}
                              </Text>
                            </div>
                          )}

                          {/* Ghi chú */}
                          <div style={{ marginTop: 8 }}>
                            {inlineRevenueText('notes', r.revenue_notes, r)}
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                ) : (
                  <Table
                    dataSource={revRows}
                    rowKey={(r) => r.revenue_id}
                    loading={revLoading}
                    size="small"
                    pagination={false}
                    scroll={{ x: 2200, y: 600 }}
                    columns={revenueColumns}
                    summary={() => {
                      if (!revRows.length) return null
                      let sumThu = 0,
                        sumLN = 0,
                        sumThanhtoan = 0,
                        validLN = 0
                      for (const r of revRows) {
                        const thu = calcTongThuChuTau(r)
                        if (thu != null) sumThu += thu
                        const ln = calcLoiNhuan(r, daysInMonth)
                        if (ln != null) {
                          sumLN += ln
                          validLN++
                        }
                        const luongTV =
                          r.salary_net_vnd != null
                            ? parseFloat(r.salary_net_vnd)
                            : (calcLuongVnd(r, daysInMonth) ?? 0)
                        sumThanhtoan +=
                          luongTV +
                          n(r.export_labor_fee) +
                          n(r.immigration_fee) +
                          n(r.transport_fee) +
                          n(r.penalty_amount) +
                          n(r.other_cost)
                      }
                      return (
                        <Table.Summary>
                          <Table.Summary.Row style={{ background: '#fafafa' }}>
                            <Table.Summary.Cell index={0} colSpan={15}>
                              <Text strong>Tổng ({revRows.length})</Text>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={15} align="right">
                              <Text strong style={{ color: '#cf1322' }}>
                                {fmtVND(Math.round(sumThanhtoan))}
                              </Text>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={16} />
                            <Table.Summary.Cell index={17} align="right">
                              <Text strong style={{ color: '#0958d9' }}>
                                {fmtVND(Math.round(sumThu))}
                              </Text>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={18} align="right">
                              {validLN > 0 && (
                                <Text strong style={{ color: profitColor(sumLN) }}>
                                  {fmtVND(Math.round(sumLN))}
                                </Text>
                              )}
                            </Table.Summary.Cell>
                          </Table.Summary.Row>
                        </Table.Summary>
                      )
                    }}
                  />
                )}
              </>
            ),
          },
        ]}
      />
    </div>
  )
}
