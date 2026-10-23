import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Modal, Pagination, Radio, Select, Skeleton } from 'antd'
import { DownOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { shipOwnerApi, vesselApi } from '../../../api/fleetApi'
import { useCan } from '../../../hooks/usePermission'
import StatusBadge from '../../../components/ds/StatusBadge'
import useToast from '../../../components/ds/useToast'
import { withFlag } from '../../../utils/flag'

const date = (value) => value ? dayjs(value).format('DD/MM/YYYY') : 'Chưa rõ'

function VesselCrew({ ownerId, vesselId }) {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['fleet', 'owner-vessel-crew', ownerId, vesselId],
    queryFn: () => shipOwnerApi.vesselCrew(ownerId, vesselId),
  })
  if (isPending) return <Skeleton active paragraph={{ rows: 2 }} />
  if (isError) return <Alert type="error" message="Không tải được thuyền viên" action={<Button onClick={() => refetch()}>Thử lại</Button>} />
  return <div className="pv-crew">
    <h4>Thuyền viên hiện tại trên tàu <span className="crew-muted">({data.data.length})</span></h4>
    {data.data.length ? <ul>{data.data.map((person) => <li key={person.id}>
      <Link to={`/seafarers/${person.id}`}>{person.full_name}</Link>
      <span>{person.seafarer_code || '—'}</span><span>{person.rank_name || 'Chưa có chức danh'}</span>
      <span className="crew-muted">Lên tàu {date(person.sign_on_date)}</span>
    </li>)}</ul> : <p className="crew-muted">Chưa có thuyền viên đang trên tàu được ghi nhận.</p>}
  </div>
}

function LinkVesselModal({ owner, onClose }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const cache = useQueryClient()
  const toast = useToast()
  const list = useQuery({ queryKey: ['fleet', 'vessel-picker', search, page], queryFn: () => vesselApi.list({ search, page, limit: 20 }) })
  const mutation = useMutation({
    mutationFn: () => shipOwnerApi.linkVessel(owner.id, { vessel_id: selected.id, expected_owner_id: selected.ship_owner_id ?? null }),
    onSuccess: () => { cache.invalidateQueries({ queryKey: ['fleet'] }); cache.invalidateQueries({ queryKey: ['lookup'] }); toast.success(`Đã liên kết ${selected.vessel_name}`); onClose() },
    onError: (error) => toast.error('Không liên kết được tàu', { description: error.response?.data?.message || error.response?.data?.error || 'Vui lòng thử lại.' }),
  })
  return <Modal title="Thêm tàu liên kết" open onCancel={onClose} onOk={() => mutation.mutate()} confirmLoading={mutation.isPending} okText={selected?.ship_owner_id ? 'Chuyển chủ và liên kết' : 'Liên kết tàu'} cancelText="Huỷ" okButtonProps={{ disabled: !selected }}>
    <p>Chọn tàu trong danh mục để gán chủ tàu hiện tại là <b>{owner.company_name}</b>.</p>
    <Select aria-label="Chọn tàu liên kết" style={{ width: '100%' }} showSearch filterOption={false} loading={list.isFetching} placeholder="Tìm theo tên tàu hoặc IMO" value={selected?.id}
      onSearch={(value) => { setSearch(value); setPage(1) }}
      onChange={(id) => setSelected(list.data?.data.find((vessel) => vessel.id === id))}
      options={(list.data?.data || []).map((vessel) => ({ value: vessel.id, label: `${vessel.vessel_name} · ${vessel.imo_number || 'Chưa có IMO'} · ${vessel.ship_owner_name || 'Chưa có chủ'}`, disabled: vessel.ship_owner_id === owner.id }))} />
    {list.isError && <Alert type="error" message="Không tải được danh mục tàu" action={<Button onClick={() => list.refetch()}>Thử lại</Button>} />}
    {(list.data?.total || 0) > 20 && <Pagination simple size="small" current={page} pageSize={20} total={list.data.total} onChange={setPage} showSizeChanger={false} />}
    {selected?.ship_owner_id && <Alert style={{ marginTop: 12 }} type="warning" showIcon message={`Tàu hiện thuộc ${selected.ship_owner_name}. Khi lưu, tàu sẽ chuyển sang ${owner.company_name}; chủ cũ được giữ trong lịch sử.`} />}
  </Modal>
}

export default function PartnerVessels({ owner }) {
  const can = useCan()
  const [history, setHistory] = useState(false)
  const [expanded, setExpanded] = useState([])
  const [adding, setAdding] = useState(false)
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ['fleet', 'owner-vessels', owner.id], queryFn: () => shipOwnerApi.vessels(owner.id), enabled: can('vessel.view') })
  if (!can('vessel.view')) return <p className="crew-muted">Bạn chưa có quyền xem tàu.</p>
  const rows = (data?.data || []).filter((vessel) => history ? !vessel.is_current : vessel.is_current)
  const toggle = (id) => setExpanded((before) => before.includes(id) ? before.filter((item) => item !== id) : [...before, id])
  const expandButton = (vessel) => can('seafarer.view') && <Button type="text" size="small" aria-label={`Thuyền viên trên ${vessel.vessel_name}`} aria-expanded={expanded.includes(vessel.id)} onClick={() => toggle(vessel.id)} icon={expanded.includes(vessel.id) ? <DownOutlined /> : <RightOutlined />} />
  return <section className="pv-section">
    <div className="crew-certs__head">
      <h3 className="crew-certs__title">Danh sách tàu sở hữu</h3>
      {can('partner.update', 'vessel.update') && Number(owner.is_active) === 1 && <Button type="primary" icon={<PlusOutlined aria-hidden="true" />} onClick={() => setAdding(true)}>Thêm tàu liên kết</Button>}
    </div>
    <div className="pv-toolbar">
      <Radio.Group value={history} onChange={(event) => setHistory(event.target.value)} optionType="button" buttonStyle="solid" options={[{ value: false, label: 'Hiện tại' }, { value: true, label: 'Đã đổi chủ' }]} />
    </div>
    {isPending ? <Skeleton active /> : isError ? <Alert type="error" message="Không tải được danh sách tàu" action={<Button onClick={() => refetch()}>Thử lại</Button>} /> : !rows.length ? <div className="ds-ctable pv-empty">{history ? 'Chưa ghi nhận tàu đã đổi chủ.' : 'Chưa có tàu liên kết với đối tác này.'}</div> : <div className="ds-ctable">
      <table className="ds-ctable__table">
        <thead><tr><th className="pv-expand-cell"><span className="ds-sr-only">Mở rộng</span></th><th>Tên tàu</th><th>Loại</th><th>IMO</th><th>Cờ tàu</th><th>{history ? 'Ngày đổi chủ' : 'Từ ngày'}</th><th>{history ? 'Chủ hiện tại' : 'Trạng thái'}</th></tr></thead>
        <tbody>{rows.map((vessel) => <Fragment key={vessel.id}>
          <tr><td className="pv-expand-cell">{expandButton(vessel)}</td><td><Link to={`/vessels/${vessel.id}`}><b>{vessel.vessel_name}</b></Link></td><td>{vessel.vessel_type_name || '—'}</td><td className="ds-ctable__mono">{vessel.imo_number || '—'}</td><td>{vessel.flag_name ? withFlag(vessel.flag_code, vessel.flag_name, vessel.flag_emoji) : '—'}</td><td className="ds-ctable__mono">{date(history ? vessel.ended_at : vessel.started_at)}</td><td>{history ? vessel.current_owner_name || 'Chưa có chủ' : <StatusBadge group="vessel" value={vessel.status} />}</td></tr>
          {expanded.includes(vessel.id) && can('seafarer.view') && <tr className="pv-expanded"><td colSpan={7}><VesselCrew ownerId={owner.id} vesselId={vessel.id} /></td></tr>}
        </Fragment>)}</tbody>
      </table>
      <ul className="ds-ccards">{rows.map((vessel) => <li key={vessel.id}>
        <div className="ds-ccards__top"><span className="pv-card-name">{expandButton(vessel)}<Link to={`/vessels/${vessel.id}`}><b>{vessel.vessel_name}</b></Link></span><StatusBadge group="vessel" value={vessel.status} /></div>
        <span className="ds-ctable__note">{[vessel.vessel_type_name || 'Chưa có loại', `IMO ${vessel.imo_number || '—'}`, vessel.flag_name && withFlag(vessel.flag_code, vessel.flag_name, vessel.flag_emoji)].filter(Boolean).join(' · ')}</span>
        <span className="ds-ctable__note">{history ? `Đổi chủ ${date(vessel.ended_at)} · ${vessel.current_owner_name || 'Chưa có chủ'}` : `Từ ngày ${date(vessel.started_at)}`}</span>
        {expanded.includes(vessel.id) && can('seafarer.view') && <VesselCrew ownerId={owner.id} vesselId={vessel.id} />}
      </li>)}</ul>
    </div>}
    {history && <p className="ds-ctable__note">Lịch sử được ghi nhận từ khi bật tính năng theo dõi đổi chủ. Ngày bắt đầu chưa có dữ liệu hiển thị “Chưa rõ”.</p>}
    {adding && <LinkVesselModal owner={owner} onClose={() => setAdding(false)} />}
  </section>
}
