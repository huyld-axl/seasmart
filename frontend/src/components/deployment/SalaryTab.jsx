import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Empty, Table, Tag, Typography } from 'antd'
import { DollarOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { salaryApi } from '../../api'

const { Text } = Typography

const fmtUSD = (v) =>
  v != null ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(v) : '-'
const fmtVND = (v) => (v != null ? new Intl.NumberFormat('vi-VN').format(Math.round(v)) : '-')
const n = (v) => (v != null ? parseFloat(v) : 0)

function calcLuongVnd(r) {
  const daysInMonth = dayjs(r.salary_month).daysInMonth()
  const days = r.working_days != null ? parseInt(r.working_days) : null
  if (days == null) return null
  if (r.salary_currency === 'VND') {
    const vndSalary = r.salary_gross ?? r.deployment_salary
    if (vndSalary == null) return null
    return (parseFloat(vndSalary) * days) / daysInMonth
  }
  const gross = r.salary_gross != null ? parseFloat(r.salary_gross) : null
  const rate = r.exchange_rate != null ? parseFloat(r.exchange_rate) : null
  if (gross == null || rate == null) return null
  return (gross * rate * days) / daysInMonth
}

function calcThanhToan(r) {
  const luongVnd = calcLuongVnd(r)
  if (luongVnd == null) return null
  const tongThu = luongVnd + n(r.bonus_rejoin) + n(r.bonus_other)
  const giamTru =
    n(r.advance_payment) +
    n(r.doc_fee) +
    n(r.flag_cert_fee) +
    n(r.penalty_amount) +
    n(r.total_deductions)
  return tongThu - giamTru
}

export default function SalaryTab({ deployment }) {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['salary', 'deployment', deployment.id],
    queryFn: () => salaryApi.listByDeployment(deployment.id).then((r) => r.data.data),
  })

  const rows = data || []

  const totals = useMemo(() => {
    let totalTongThu = 0,
      totalThanhToan = 0
    for (const r of rows) {
      const luongVnd = calcLuongVnd(r)
      if (luongVnd != null) totalTongThu += luongVnd + n(r.bonus_rejoin) + n(r.bonus_other)
      const tt = calcThanhToan(r)
      if (tt != null) totalThanhToan += tt
    }
    return { totalTongThu, totalThanhToan }
  }, [rows])

  const columns = [
    {
      title: 'Tháng',
      dataIndex: 'salary_month',
      width: 80,
      render: (v) => dayjs(v).format('MM/YYYY'),
    },
    {
      title: <span style={{ color: '#389e0d' }}>Các khoản thu</span>,
      onHeaderCell: () => ({ style: { background: '#f6ffed' } }),
      children: [
        {
          title: 'Lương theo HĐ (USD)',
          dataIndex: 'salary_gross',
          align: 'right',
          width: 130,
          onHeaderCell: () => ({ style: { background: '#f6ffed' } }),
          render: (v) => (v != null ? fmtUSD(v) : '-'),
        },
        {
          title: 'Ngày công',
          dataIndex: 'working_days',
          align: 'center',
          width: 85,
          onHeaderCell: () => ({ style: { background: '#f6ffed' } }),
          render: (v, r) =>
            v == null ? (
              '-'
            ) : (
              <Text type="secondary">
                {v}/{dayjs(r.salary_month).daysInMonth()}
              </Text>
            ),
        },
        {
          title: 'Tỷ giá',
          dataIndex: 'exchange_rate',
          align: 'right',
          width: 100,
          onHeaderCell: () => ({ style: { background: '#f6ffed' } }),
          render: (v) => (v != null ? new Intl.NumberFormat('vi-VN').format(v) : '-'),
        },
        {
          title: 'Quy đổi VNĐ',
          align: 'right',
          width: 130,
          onHeaderCell: () => ({ style: { background: '#f6ffed' } }),
          render: (_, r) => {
            const val = calcLuongVnd(r)
            return val != null ? <Text style={{ color: '#003366' }}>{fmtVND(val)}</Text> : '-'
          },
        },
        {
          title: 'Thưởng Rejoin',
          dataIndex: 'bonus_rejoin',
          align: 'right',
          width: 110,
          onHeaderCell: () => ({ style: { background: '#f6ffed' } }),
          render: (v) => (v != null && parseFloat(v) > 0 ? fmtVND(v) : '-'),
        },
        {
          title: 'Thưởng khác',
          dataIndex: 'bonus_other',
          align: 'right',
          width: 105,
          onHeaderCell: () => ({ style: { background: '#f6ffed' } }),
          render: (v) => (v != null && parseFloat(v) > 0 ? fmtVND(v) : '-'),
        },
        {
          title: 'Tổng thu',
          align: 'right',
          width: 130,
          onHeaderCell: () => ({ style: { background: '#f6ffed' } }),
          render: (_, r) => {
            const luongVnd = calcLuongVnd(r)
            if (luongVnd == null) return '-'
            const tong = luongVnd + n(r.bonus_rejoin) + n(r.bonus_other)
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
          width: 100,
          onHeaderCell: () => ({ style: { background: '#fff2f0' } }),
          render: (v) =>
            v != null && parseFloat(v) > 0 ? (
              <Text style={{ color: '#1677ff' }}>{fmtVND(v)}</Text>
            ) : (
              '-'
            ),
        },
        {
          title: 'Phí đổi CC',
          dataIndex: 'doc_fee',
          align: 'right',
          width: 95,
          onHeaderCell: () => ({ style: { background: '#fff2f0' } }),
          render: (v) => (v != null && parseFloat(v) > 0 ? fmtVND(v) : '-'),
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
          render: (v) => (v != null && parseFloat(v) > 0 ? fmtVND(v) : '-'),
        },
        {
          title: 'Phạt HĐ',
          dataIndex: 'penalty_amount',
          align: 'right',
          width: 90,
          onHeaderCell: () => ({ style: { background: '#fff2f0' } }),
          render: (v) =>
            v != null && parseFloat(v) > 0 ? (
              <Text style={{ color: '#cf1322' }}>{fmtVND(v)}</Text>
            ) : (
              '-'
            ),
        },
      ],
    },
    {
      title: 'Thanh toán',
      align: 'right',
      width: 130,
      render: (_, r) => {
        const tt = calcThanhToan(r)
        if (tt == null) return '-'
        return (
          <div>
            <Text strong style={{ color: tt >= 0 ? '#389e0d' : '#cf1322' }}>
              {fmtVND(Math.round(tt))}
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
  ]

  // Flat leaf column indices (sau khi bỏ cột TT):
  // 0: Tháng
  // 1: Lương HĐ (USD)  2: Ngày công  3: Tỷ giá  4: Quy đổi VNĐ  5: Rejoin  6: khác  7: Tổng thu
  // 8: Ứng lương  9: Phí đổi CC  10: Phí bằng cờ tàu  11: Phạt HĐ
  // 12: Thanh toán
  const summaryRow =
    rows.length > 0 ? (
      <Table.Summary.Row>
        <Table.Summary.Cell index={0}>
          <Text strong>Tổng</Text>
        </Table.Summary.Cell>
        <Table.Summary.Cell index={1} colSpan={6} />
        <Table.Summary.Cell index={7} align="right">
          <Text strong style={{ color: '#389e0d' }}>
            {fmtVND(totals.totalTongThu)}
          </Text>
        </Table.Summary.Cell>
        <Table.Summary.Cell index={8} colSpan={4} />
        <Table.Summary.Cell index={12} align="right">
          <Text strong style={{ color: totals.totalThanhToan >= 0 ? '#389e0d' : '#cf1322' }}>
            {fmtVND(totals.totalThanhToan)}
          </Text>
        </Table.Summary.Cell>
      </Table.Summary.Row>
    ) : null

  const note = (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 12 }}
      message="Bảng lương được tạo theo từng tháng trong khoảng thời gian từ tháng nhập tàu đến tháng rời tàu của thuyền viên."
    />
  )

  if (!isLoading && rows.length === 0) {
    return (
      <div style={{ padding: '8px 0' }}>
        {note}
        <Empty
          image={<DollarOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
          imageStyle={{ height: 60 }}
          description={
            <span style={{ color: '#888' }}>
              Chưa có thông tin lương. Hãy tạo bảng lương cho thuyền viên ở màn Tài chính.
            </span>
          }
        >
          <Button type="primary" onClick={() => navigate('/finance')}>
            Đi đến Tài chính
          </Button>
        </Empty>
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 0' }}>
      {note}
      <Table
        size="small"
        loading={isLoading}
        dataSource={rows}
        rowKey="id"
        columns={columns}
        pagination={false}
        scroll={{ x: 'max-content' }}
        summary={() => summaryRow}
      />
    </div>
  )
}
