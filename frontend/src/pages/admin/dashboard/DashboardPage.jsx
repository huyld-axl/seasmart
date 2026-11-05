import { ReloadOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import useAuthStore from '../../../stores/authStore'
import { useCan } from '../../../hooks/usePermission'
import { useAttention, useKpi } from '../../../hooks/useDashboard'
import { EmptyState } from '../../../components/ds/Controls'
import { ContractCard, RevenueCard } from './KpiCards'
import AttentionCard from './AttentionCard'
import './dashboard.css'

const ATTENTION_PERMS = ['opportunity.view', 'seafarer.view', 'voyage.view', 'contract.view', 'bill.view']

const firstName = (user) => {
  const name = (user?.full_name || '').trim()
  return name ? name.split(/\s+/).at(-1) : (user?.email || '').split('@')[0]
}

// Tổng quan (docs/mcah-ke-hoach-tong-quan.md): vừa một màn hình trên desktop.
// Có kpi.view_all → số cả công ty (Doanh thu trước); không có → số của mình (Hợp đồng trước).
export default function DashboardPage() {
  const user = useAuthStore((state) => state.user)
  const can = useCan()
  const queryClient = useQueryClient()
  const own = !can('kpi.view_all')
  const showKpi = can('contract.view')
  const showAttention = ATTENTION_PERMS.some((p) => can(p))
  const kpi = useKpi(null, { enabled: showKpi })
  const attention = useAttention({ enabled: showAttention })
  const today = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
  const head = (
    <div className="dash-head">
      <h1 className="dash-head__title">Chào {firstName(user)}<small>{today.charAt(0).toUpperCase() + today.slice(1)} · {own ? 'số của bạn' : 'số của cả công ty'}</small></h1>
      <Button type="text" size="small" icon={<ReloadOutlined />} aria-label="Tải lại" onClick={() => queryClient.invalidateQueries({ queryKey: ['dashboard'] })} />
    </div>
  )

  if (!showKpi && !showAttention) {
    return <div className="dash">{head}<section className="ds-card dash-att"><EmptyState title="Bạn chưa có quyền xem số liệu nào trên Tổng quan." description="Nhờ quản trị viên cấp quyền xem thuyền viên, cơ hội, chuyến tàu hoặc hợp đồng." /></section></div>
  }

  const cards = own
    ? [<ContractCard key="c" query={kpi} own />, <RevenueCard key="r" query={kpi} own />]
    : [<RevenueCard key="r" query={kpi} />, <ContractCard key="c" query={kpi} />]
  return (
    <div className={`dash${showKpi ? '' : ' dash--no-kpi'}${showAttention ? '' : ' dash--no-att'}`}>
      {head}
      {showKpi ? cards : null}
      {showAttention ? <AttentionCard query={attention} own={own} /> : null}
    </div>
  )
}
