import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, Table, Button, Tag, Typography, Row, Col, Tooltip } from 'antd'
import { ArrowRightOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { jobApi, salaryApi, seafarerApi } from '../../../api'
import dayjs from 'dayjs'
import 'dayjs/locale/vi'
import useTranslation from '../../../hooks/useTranslation'
import useAuthStore from '../../../stores/authStore'

const { Title, Text } = Typography

const STATUS_COLOR = { OPEN: 'green', FILLED: 'blue', CANCELLED: 'default' }
const PAYMENT_COLOR = { UNPAID: 'red', PAID: 'green', PARTIAL: 'orange' }

function fmtCurrency(v, currency = 'USD') {
  if (v == null) return '-'
  return `${Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`
}

function fmtVND(v) {
  if (v == null || Number(v) === 0) return '0 ₫'
  return `${Number(v).toLocaleString('vi-VN')} ₫`
}

function getDisplayName(user) {
  if (!user?.email) return ''
  return user.email.split('@')[0]
}

export default function PartnerDashboardPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)

  const currentMonth = dayjs().format('YYYY-MM')

  const { data: salaryStats } = useQuery({
    queryKey: ['salary-stats', currentMonth],
    queryFn: () => salaryApi.stats(currentMonth).then((r) => r.data),
  })

  const { data: openContracts } = useQuery({
    queryKey: ['contracts-open-5'],
    queryFn: () => jobApi.list({ status: 'OPEN', limit: 5, page: 1 }).then((r) => r.data),
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

  const financeCards = useMemo(
    () => [
      {
        title: t('dashboard.statPayrollCount'),
        display: (salaryStats?.paid || 0) + (salaryStats?.unpaid || 0),
        color: '#722ed1',
        bg: '#f9f0ff',
      },
      {
        title: t('dashboard.statGross'),
        display: fmtVND(salaryStats?.total_gross_vnd),
        color: '#1677ff',
        bg: '#e6f4ff',
      },
      {
        title: t('dashboard.statExpense'),
        display: fmtVND(salaryStats?.total_net_vnd),
        color: '#f5222d',
        bg: '#fff1f0',
      },
      {
        title: t('dashboard.statProfit'),
        display: fmtVND(salaryStats?.total_profit_vnd),
        color: '#52c41a',
        bg: '#f6ffed',
      },
    ],
    [t, salaryStats]
  )

  function renderCertExpiryList(data, options = {}) {
    const { showExpiredDateLabel = false } = options
    if (!data?.length)
      return (
        <div style={{ color: '#999', fontSize: 13, padding: '8px 0' }}>
          {showExpiredDateLabel
            ? t('dashboard.certExpiredEmpty')
            : t('dashboard.certExpiryEmpty')}
        </div>
      )
    return (
      <div>
        {data.map((r, i) => {
          const n = Number(r.days_left)
          const color = n < 0 ? '#f5222d' : n <= 30 ? '#fa8c16' : '#faad14'
          const daysLabel =
            n < 0
              ? t('dashboard.expiryDateLabel')
              : `${n} ${t('dashboard.daysLeft')}`
          return (
            <div
              key={`${r.seafarer_id}-${r.cert_type_name}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: i < data.length - 1 ? '1px solid #f0f0f0' : 'none',
                gap: 8,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <Button
                  type="link"
                  size="small"
                  style={{
                    padding: 0,
                    fontWeight: 600,
                    height: 'auto',
                    display: 'block',
                    textAlign: 'left',
                  }}
                  onClick={() => navigate(`/seafarers/${r.seafarer_id}`)}
                >
                  {r.seafarer_name}
                </Button>
                <div
                  style={{
                    fontSize: 12,
                    color: '#8c8c8c',
                    marginTop: 1,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {r.cert_type_name}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 12, color: '#8c8c8c', whiteSpace: 'nowrap' }}>
                  {showExpiredDateLabel
                    ? t('dashboard.expiryDateLabel')
                    : r.expiry_date
                      ? dayjs(r.expiry_date).format('DD/MM/YYYY')
                      : '-'}
                </div>
                <div style={{ fontWeight: 700, color, whiteSpace: 'nowrap', fontSize: 13 }}>
                  {showExpiredDateLabel && r.expiry_date
                    ? dayjs(r.expiry_date).format('DD/MM/YYYY')
                    : daysLabel}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const openContractColumns = useMemo(
    () => [
      {
        title: t('dashboard.colShipOwner'),
        dataIndex: 'ship_owner_name',
        render: (v) => {
          if (!v) return '-'
          if (v.length <= 20) return v
          return <Tooltip title={v}>{v.slice(0, 20)}...</Tooltip>
        },
      },
      {
        title: t('dashboard.colVessel'),
        dataIndex: 'vessel_name',
        render: (v) => v || '-',
        ellipsis: true,
      },
      { title: t('dashboard.colRank'), dataIndex: 'rank_name_vi', render: (v) => v || '-' },
      {
        title: t('dashboard.colStatus'),
        dataIndex: 'status',
        width: 110,
        render: (v) => (
          <Tag color={STATUS_COLOR[v] || 'default'}>{t(`job.statusMap.${v}`) || v}</Tag>
        ),
      },
      {
        title: t('dashboard.colPayment'),
        dataIndex: 'payment_status',
        width: 130,
        render: (v) => (
          <Tag color={PAYMENT_COLOR[v] || 'default'}>
            {t(`job.paymentMap.${v}`) || v || t('dashboard.payUnpaidShort')}
          </Tag>
        ),
      },
      {
        title: t('dashboard.colAmount'),
        dataIndex: 'amount',
        render: (v, r) => (v != null ? fmtCurrency(v, r.currency) : '-'),
      },
    ],
    [t]
  )

  // --- PLACEHOLDER_RETURN ---

  return (
    <div>
      {/* Header: Date + Greeting */}
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ marginBottom: 4 }}>
          {t('dashboard.greeting')}, {getDisplayName(user)}
        </Title>
        <Text type="secondary" style={{ fontSize: 15 }}>
          {t('dashboard.today')}: {dayjs().locale('vi').format('dddd, DD/MM/YYYY')}
        </Text>
      </div>

      {/* Finance stat cards */}
      <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>
        {t('dashboard.financeTitle')} ({currentMonth})
      </Text>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {financeCards.map((c) => (
          <Col key={c.title} xs={12} sm={6}>
            <div
              style={{
                background: c.bg,
                border: `1px solid ${c.color}33`,
                borderRadius: 8,
                padding: '14px 16px',
              }}
            >
              <div style={{ fontSize: 12, color: '#595959' }}>{c.title}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: c.color }}>{c.display}</div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Tables */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            size="small"
            title={t('dashboard.openContracts')}
            extra={
              <Button
                size="small"
                type="link"
                icon={<ArrowRightOutlined />}
                onClick={() => navigate('/jobs')}
              >
                {t('dashboard.viewAll')}
              </Button>
            }
          >
            <Table
              rowKey="id"
              size="small"
              columns={openContractColumns}
              dataSource={openContracts?.data || []}
              pagination={false}
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: t('dashboard.emptyOpenJobs') }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card size="small" title={t('dashboard.certExpiryTitle')}>
              {renderCertExpiryList(expiringCertificates)}
            </Card>
            <Card size="small" title={t('dashboard.certExpiredTitle')}>
              {renderCertExpiryList(expiredCertificates, { showExpiredDateLabel: true })}
            </Card>
          </div>
        </Col>
      </Row>
    </div>
  )
}
