import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Input, Popconfirm, Select, Tooltip } from 'antd'
import { CloseOutlined, CopyOutlined, EditOutlined, ExclamationCircleOutlined, InfoCircleOutlined, HistoryOutlined, RightOutlined, SendOutlined, UndoOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { seafarerApi } from '../../../api'
import { exportApi } from '../../../api/exportApi'
import { shipOwnerApi, vesselApi } from '../../../api/fleetApi'
import { opportunityApi } from '../../../api/opportunityApi'
import { EmptyState } from '../../../components/ds/Controls'
import useToast from '../../../components/ds/useToast'
import useAuthStore from '../../../stores/authStore'
import useExportDraft from './useExportDraft'
import { hasDraft } from './exportDraft'
import DocFields from './DocFields'
import FormPreview from './FormPreview'
import PreviewNav from './PreviewNav'
import { STAGES, TEMPLATES, VESSEL_FIELD, docFields, editCount, packMissing, setEdit, stagePick, template, toggleTemplate } from './packModel'
import '../seafarers/SeafarerListPage.css'
import '../seafarers/SeafarerProfile.css'
import './exports.css'

const personLabel = (s) => `${s.full_name}${s.rank_name ? ` · ${s.rank_name}` : ''}`

// Chọn ứng viên cho đợt: tìm theo tên, CCCD, số sổ; tick nhiều người một lượt.
function PeoplePicker({ people, labels, onChange }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const { data, isFetching } = useQuery({
    queryKey: ['seafarer-pick', search],
    queryFn: () => seafarerApi.list({ search, limit: 20 }).then((r) => r.data.data),
  })
  return (
    <Select
      mode="multiple"
      open={open}
      onOpenChange={setOpen}
      onSelect={() => setOpen(false)}
      labelInValue
      showSearch
      filterOption={false}
      placeholder="Gõ tên, CCCD hoặc số sổ rồi tick từng người"
      loading={isFetching}
      value={people.map((id) => ({ value: id, label: labels[id] || 'Đang tải…' }))}
      onSearch={setSearch}
      onChange={(items) => onChange(items.map((item) => ({ id: item.value, label: item.label })))}
      notFoundContent={isFetching ? 'Đang tìm…' : 'Không có ứng viên khớp'}
      options={(data || []).map((s) => ({ value: String(s.id), label: personLabel(s) }))}
    />
  )
}

// Tên tàu của cả bộ: chọn trong danh mục Tàu. Giá trị lưu là tên tàu (cùng chỗ lưu cũ), để trống thì lấy theo hồ sơ.
function VesselPicker({ value, onChange }) {
  const [search, setSearch] = useState('')
  const { data, isFetching } = useQuery({
    queryKey: ['vessel-pick', search],
    queryFn: () => vesselApi.list({ search: search || undefined, limit: 50 }),
  })
  return (
    <Select
      showSearch
      allowClear
      filterOption={false}
      placeholder="Để trống thì lấy theo hồ sơ"
      loading={isFetching}
      value={value || undefined}
      optionLabelProp="value"
      onSearch={setSearch}
      onChange={(name) => onChange(name || '')}
      notFoundContent={isFetching ? 'Đang tìm…' : <span>Chưa có tàu khớp. Thêm ở <Link to="/vessels/new">mục Tàu</Link>.</span>}
      options={(data?.data || []).map((v) => ({ value: v.vessel_name, label: v.imo_number ? `${v.vessel_name} · IMO ${v.imo_number}` : v.vessel_name }))}
    />
  )
}

// Nộp cho: chủ tàu nhận bộ giấy.
function OwnerPicker({ value, label, onChange }) {
  const [search, setSearch] = useState('')
  const { data, isFetching } = useQuery({
    queryKey: ['ship-owner-pick', search],
    queryFn: () => shipOwnerApi.list({ search: search || undefined, limit: 50 }),
  })
  return (
    <Select
      showSearch
      allowClear
      labelInValue
      filterOption={false}
      placeholder="Chọn chủ tàu"
      loading={isFetching}
      value={value ? { value, label: label || data?.data?.find((owner) => owner.id === value)?.company_name } : undefined}
      onSearch={setSearch}
      onChange={(item) => onChange(item?.value ?? null, item?.label ?? null)}
      notFoundContent={isFetching ? 'Đang tìm…' : <span>Chưa có chủ tàu khớp. Thêm ở <Link to="/partners">mục Đối tác</Link>.</span>}
      options={(data?.data || []).map((o) => ({ value: o.id, label: o.company_name }))}
    />
  )
}

// B3 Tạo bộ giấy: chọn ứng viên và giấy bên trái, xem trước đúng file mẫu bên phải.
// Một người, hoặc cả đợt: mỗi người một bộ, cùng các giấy và thông tin điền thêm.
// Ô sửa tay trên giấy thì riêng từng người: edits = { người: { giấy: { ô: nội dung } } }.
export default function PackCreatePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const qc = useQueryClient()
  const userId = useAuthStore((state) => state.user?.id)
  const { data: draft, savedAt, storageError, setField, clearDraft } = useExportDraft(userId, params.get('seafarer'))
  const { people, picked, pickedLabels, ownerId, ownerLabel, selected, inputs, edits, viewId, editing, opportunityId } = draft
  const setPeople = (value) => setField('people', value)
  const setPicked = (value) => setField('picked', value)
  const setPickedLabels = (value) => setField('pickedLabels', value)
  const setOwnerId = (value) => setField('ownerId', value)
  const setSelected = (value) => setField('selected', value)
  const setInputs = (value) => setField('inputs', value)
  const setEdits = (value) => setField('edits', value)
  const setViewId = (value) => setField('viewId', value)
  const setEditing = (value) => setField('editing', value)
  const [submitting, setSubmitting] = useState(false)

  // Mở từ màn chi tiết đối tác (?owner=): chọn sẵn đối tác ở mục "Nộp cho".
  const ownerParam = params.get('owner')
  useEffect(() => {
    if (!ownerParam || ownerId) return undefined
    let cancelled = false
    shipOwnerApi
      .get(ownerParam)
      .then((owner) => {
        if (cancelled) return
        setField('ownerId', owner.id)
        setField('ownerLabel', owner.company_name)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerParam])

  // Mở từ cơ hội (?opportunity=&seafarers=1,2): chọn sẵn người, chủ tàu, tàu và các mẫu giấy trong hồ sơ yêu cầu.
  // Bộ giấy tạo ra gắn vào ứng viên của cơ hội; giấy tờ yêu cầu (hộ chiếu, chứng chỉ) đính kèm khi tải về.
  const oppParam = params.get('opportunity')
  const seafarersParam = params.get('seafarers')
  const { data: oppData } = useQuery({
    queryKey: ['opportunities', 'item', String(oppParam || opportunityId)],
    queryFn: () => opportunityApi.get(oppParam || opportunityId),
    enabled: !!(oppParam || opportunityId),
  })
  const opportunity = oppData?.requirements ? oppData : null
  useEffect(() => {
    if (!seafarersParam || !opportunity || String(opportunity.id) !== oppParam) return
    const ids = (seafarersParam || '').split(',').filter(Boolean)
    const chosen = opportunity.candidates.filter((c) => ids.includes(String(c.seafarer_id)))
    setField('opportunityId', opportunity.id)
    setField('people', chosen.map((c) => String(c.seafarer_id)))
    setField('pickedLabels', Object.fromEntries(chosen.map((c) => [String(c.seafarer_id), c.full_name])))
    setField('ownerId', opportunity.ship_owner_id)
    setField('ownerLabel', opportunity.ship_owner_name)
    setField('inputs', opportunity.vessel_name ? { [VESSEL_FIELD]: opportunity.vessel_name } : {})
    const keys = opportunity.requirements.filter((r) => r.kind === 'TEMPLATE' && r.template_key).map((r) => r.template_key)
    setField('selected', keys.filter((key, i) => keys.indexOf(key) === i && TEMPLATES.some((t) => t.key === key)))
    setField('picked', null)
    setField('edits', {})
    navigate('/exports/new?opportunity=' + oppParam, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oppParam, opportunity])
  const attachCount = opportunity ? opportunity.requirements.filter((r) => r.kind === 'CERTIFICATE').length : 0

  const profiles = useQueries({
    queries: people.map((id) => ({ queryKey: ['seafarer', id], queryFn: () => seafarerApi.getById(id).then((r) => r.data) })),
  })
  const contactLists = useQueries({
    queries: people.map((id) => ({ queryKey: ['contacts', id], queryFn: () => seafarerApi.getContacts(id).then((r) => r.data) })),
  })
  const firstId = people[0]
  const { data: history } = useQuery({
    queryKey: ['exports', { seafarer_id: firstId }],
    queryFn: () => exportApi.list({ seafarer_id: firstId, limit: 10 }),
    enabled: people.length === 1,
  })

  const loading = profiles.some((q) => q.isLoading)
  const failed = profiles.find((q) => q.isError)
  if (failed) {
    return <EmptyState isError title="Không tải được hồ sơ" description="Mất kết nối tới máy chủ." action={<Button onClick={() => failed.refetch()}>Thử lại</Button>} />
  }
  const seafarers = profiles.map((q) => q.data).filter(Boolean)
  const labels = { ...pickedLabels, ...Object.fromEntries(seafarers.map((s) => [String(s.id), personLabel(s)])) }
  const contactsOf = (i) => (Array.isArray(contactLists[i]?.data) ? contactLists[i].data : contactLists[i]?.data?.data || [])
  const missing = seafarers.flatMap((s, i) => packMissing(selected, s, contactsOf(i)).map((m) => ({ ...m, who: s.full_name, id: s.id })))
  const preview = selected.includes(picked) ? picked : selected[0]
  const viewing = seafarers.find((s) => String(s.id) === viewId) || seafarers[0]
  const viewEdits = (viewing && edits[viewing.id]) || {}
  const hasFields = selected.some((key) => docFields(key).length)
  const setInput = (label, value) => setInputs((current) => ({ ...current, [label]: value }))
  const pastPacks = history?.data || []
  const lastPack = pastPacks[0]
  const available = TEMPLATES.filter((t) => !selected.includes(t.key))

  function choosePeople(items) {
    setPickedLabels((current) => ({ ...current, ...Object.fromEntries(items.map((item) => [item.id, item.label])) }))
    setPeople(items.map((item) => item.id))
  }
  function addDoc(key) {
    setSelected(toggleTemplate(selected, key))
    setPicked(key)
  }
  function addStage(stageKey) {
    const next = stagePick(stageKey).reduce((keys, key) => {
      const group = template(key).group
      const taken = keys.includes(key) || (group && keys.some((k) => template(k).group === group))
      return taken ? keys : toggleTemplate(keys, key)
    }, selected)
    setSelected(next)
    setPicked(next.find((key) => !selected.includes(key)) || preview)
  }
  function reuse(pack) {
    setSelected(pack.docs)
    setPicked(pack.docs[0])
    if (pack.ship_owner_id) setOwnerId(pack.ship_owner_id)
    toast.success(`Đã chọn lại ${pack.docs.length} giấy của bộ #${pack.code}`)
  }

  async function submit() {
    setSubmitting(true)
    const created = []
    try {
      for (const s of seafarers) {
        created.push(await exportApi.create({ seafarer_id: s.id, ship_owner_id: ownerId, docs: selected, inputs, edits: edits[s.id] || {}, opportunity_id: opportunity?.id }))
      }
      qc.invalidateQueries({ queryKey: ['exports'] })
      if (opportunity) qc.invalidateQueries({ queryKey: ['opportunities'] })
      clearDraft()
      if (created.length === 1) navigate(`/exports/${created[0].id}`)
      else if (opportunity) { toast.success(`Đã tạo ${created.length} bộ giấy cho ${opportunity.code}`); navigate(`/opportunities/${opportunity.id}`) }
      else { toast.success(`Đã tạo ${created.length} bộ giấy`); navigate('/exports') }
    } catch (e) {
      if (created.length) {
        // Retain unfinished people in the draft without creating duplicate
        // packs for the people whose requests already succeeded.
        const done = new Set(seafarers.slice(0, created.length).map((person) => String(person.id)))
        setPeople(people.filter((id) => !done.has(String(id))))
        qc.invalidateQueries({ queryKey: ['exports'] })
      }
      toast.error(created.length ? `Mới tạo được ${created.length}/${seafarers.length} bộ giấy` : 'Không tạo được bộ giấy', { description: e.response?.data?.error || 'Thử lại sau ít phút.' })
    } finally {
      setSubmitting(false)
    }
  }

  const single = seafarers.length === 1 ? seafarers[0] : null
  return (
    <div className="ds-page">
      <nav className="crew-crumb" aria-label="Đường dẫn">
        {opportunity ? <><Link to="/opportunities">Cơ hội</Link><RightOutlined aria-hidden /><Link to={`/opportunities/${opportunity.id}`}>{opportunity.code}</Link></> : <Link to="/exports">Bản xuất</Link>}
        <RightOutlined aria-hidden />
        {single && <><Link to={`/seafarers/${single.id}`}>{single.full_name}</Link><RightOutlined aria-hidden /></>}
        <span aria-current="page">Tạo bộ giấy</span>
      </nav>

      <div className="ds-page__head">
        <div>
          <h1 className="ds-page__title">Tạo bộ giấy tờ</h1>
          <p className="ds-page__desc">Chọn ứng viên, rồi thêm dần giấy cần cho lần xuất này. Nhiều người thì mỗi người một bộ.</p>
        </div>
      </div>

      {(hasDraft(draft) || storageError) && (
        <div className="pk-draft" role="status">
          <span>{storageError
            ? 'Không lưu được nháp trên trình duyệt. Dữ liệu được giữ khi chuyển màn, nhưng có thể mất nếu tải lại hoặc đóng trang.'
            : savedAt
              ? `Đã lưu nháp lúc ${dayjs(savedAt).format('HH:mm:ss')} trên trình duyệt này. Bạn có thể rời màn và quay lại làm tiếp.`
              : 'Các thay đổi sẽ được tự động lưu nháp trên trình duyệt này.'}</span>
          <Popconfirm title="Xóa bản nháp và bắt đầu lại?" description="Các lựa chọn và ô đã sửa sẽ bị xóa." okText="Xóa bản nháp" cancelText="Giữ lại" onConfirm={clearDraft}>
            <Button size="small" danger disabled={submitting}>Xóa bản nháp</Button>
          </Popconfirm>
        </div>
      )}

      {opportunity && (
        <div role="status" className="ds-banner ds-banner--neutral">
          <InfoCircleOutlined className="ds-banner__icon" aria-hidden />
          <div className="ds-banner__body">
            <p className="ds-banner__title">Bộ giấy cho {opportunity.code} · {opportunity.rank_name}{opportunity.vessel_name ? ` · ${opportunity.vessel_name}` : ''}</p>
            <p className="ds-banner__text">
              {opportunity.requirements.some((r) => r.kind === 'TEMPLATE') ? 'Đã chọn sẵn mẫu giấy trong hồ sơ yêu cầu.' : 'Hồ sơ yêu cầu chưa có mẫu giấy nào, thêm giấy bên dưới.'}{attachCount ? ` ${attachCount} giấy tờ, chứng chỉ yêu cầu được đính kèm vào thư mục GIAY-TO khi tải về; thiếu bản scan thì ghi vào THIEU-GIAY.txt.` : ''}
            </p>
          </div>
          <div className="ds-banner__action">
            <Button onClick={() => { setField('opportunityId', null); navigate('/exports/new', { replace: true }) }}>Bỏ gắn cơ hội</Button>
          </div>
        </div>
      )}

      <div className="pk-who">
        <label className="ds-field">
          <span className="ds-field__label">Ứng viên{people.length > 1 ? ` · ${people.length} người` : ''}</span>
          <PeoplePicker people={people} labels={labels} onChange={choosePeople} />
        </label>
        <label className="ds-field">
          <span className="ds-field__label">Nộp cho</span>
          <OwnerPicker value={ownerId} label={ownerLabel} onChange={(id, label) => { setOwnerId(id); setField('ownerLabel', label) }} />
        </label>
        <label className="ds-field">
          <span className="ds-field__label">{VESSEL_FIELD}</span>
          <VesselPicker value={inputs[VESSEL_FIELD]} onChange={(name) => setInput(VESSEL_FIELD, name)} />
        </label>
      </div>

      <div className="pk-layout">
        <div className="pk-left">
          {single && pastPacks.length > 0 && (
            <details className="vp-manual">
              <summary>
                <span><b>Đã xuất cho {single.full_name} · {history.total} bộ</b> <span className="rv-muted">· dùng lại một bộ cũ</span></span>
                <HistoryOutlined aria-hidden />
              </summary>
              <ul className="signers" style={{ padding: '0 16px 8px' }}>
                {pastPacks.map((p) => (
                  <li key={p.id}>
                    <span className="ds-cell2" style={{ flex: '1 1 240px' }}>
                      <span className="ds-cell2__main" style={{ fontWeight: 400, whiteSpace: 'normal' }}>{p.docs.map((key) => template(key).name).join(', ')}</span>
                      <span className="ds-cell2__sub">#{p.code} · {dayjs(p.created_at).format('DD/MM/YYYY')}</span>
                    </span>
                    <Button size="small" type="text" icon={<CopyOutlined />} onClick={() => reuse(p)}>Dùng lại</Button>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div>
            <Select
              className="pk-add"
              showSearch
              value={null}
              optionFilterProp="label"
              placeholder="Tìm và thêm giấy vào bộ"
              aria-label="Thêm giấy vào bộ"
              notFoundContent="Không có mẫu giấy khớp"
              onChange={addDoc}
              options={STAGES.map((stage) => ({
                label: stage.label,
                options: available.filter((t) => t.stage === stage.key).map((t) => ({ value: t.key, label: t.name })),
              })).filter((group) => group.options.length)}
            />
          </div>

          <div className="pk-quick">
            <span className="rv-muted">Thêm cả nhóm:</span>
            {STAGES.map((stage) => (
              <Button key={stage.key} size="small" onClick={() => addStage(stage.key)}>{stage.label}</Button>
            ))}
            {lastPack && <Button size="small" type="text" icon={<HistoryOutlined />} onClick={() => reuse(lastPack)}>Như lần trước</Button>}
            {selected.length > 0 && <Button size="small" type="text" onClick={() => setSelected([])}>Bỏ hết</Button>}
          </div>

          <div>
            <p className="pk-count">
              Đã chọn <b>{selected.length}</b> giấy
              {hasFields && <span> · Mỗi giấy có ô điền thêm riêng cho thông tin hồ sơ không có{seafarers.length > 1 ? `, dùng chung cho cả ${seafarers.length} người` : ''}. Để trống thì in ra điền tay.</span>}
            </p>
            {selected.length === 0 ? (
              <div className="pk-docs">
                <EmptyState title="Chưa có giấy nào trong bộ" description="Tìm mẫu ở ô phía trên, hoặc thêm cả nhóm theo giai đoạn." />
              </div>
            ) : (
              <ul className="pk-docs">
                {selected.map((key) => {
                  const t = template(key)
                  const lack = seafarers.flatMap((s, i) => packMissing([key], s, contactsOf(i)))
                  const edited = seafarers.reduce((sum, person) => sum + editCount(edits[person.id], key), 0)
                  return (
                    <li key={key} className={preview === key ? 'pk-doc pk-doc--on' : 'pk-doc'}>
                      <div className="pk-doc__row">
                        <button type="button" className="pk-doc__main" aria-current={preview === key} onClick={() => setPicked(key)}>
                          <span className="ds-cell2">
                            <span className="ds-cell2__main">{t.name}</span>
                            <span className="ds-cell2__sub">
                              {STAGES.find((stage) => stage.key === t.stage).label} · {t.signers.length ? `Ký tay: ${t.signers.join(', ')}` : 'Không cần ký'}{edited ? ` · Đã sửa tay ${edited} ô` : ''}
                            </span>
                          </span>
                        </button>
                        {lack.length > 0 && (
                          <span className="pk-doc__miss" title={`Hồ sơ thiếu ${[...new Set(lack.map((m) => m.field))].join(', ')}`}>
                            <ExclamationCircleOutlined aria-hidden />
                            Thiếu {new Set(lack.map((m) => m.field)).size}
                          </span>
                        )}
                        <Button type="text" size="small" icon={<CloseOutlined />} aria-label={`Bỏ ${t.name}`} onClick={() => setSelected(selected.filter((k) => k !== key))} />
                      </div>
                      <DocFields docKey={key} inputs={inputs} onChange={setInput} onFocus={() => setPicked(key)} />
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {missing.length > 0 && (
            <div role="status" className="ds-banner ds-banner--warning">
              <ExclamationCircleOutlined className="ds-banner__icon" aria-hidden />
              <div className="ds-banner__body">
                <p className="ds-banner__title">Hồ sơ còn thiếu {missing.length} trường mà mẫu cần</p>
                <p className="ds-banner__text">
                  {missing.map((m) => `${m.field} (${m.doc}${seafarers.length > 1 ? `, ${m.who}` : ''})`).join(' · ')}. Giấy vẫn tạo được, ô thiếu in ra để trống.
                </p>
              </div>
              {single && (
                <div className="ds-banner__action">
                  <Button onClick={() => navigate(`/seafarers/${single.id}/edit`)}>Điền vào hồ sơ</Button>
                </div>
              )}
            </div>
          )}

          <div className="pk-foot">
            <p>{!people.length ? 'Chọn ứng viên để tạo bộ giấy. ' : seafarers.length > 1 ? `${seafarers.length} người × ${selected.length} giấy. ` : ''}Tạo xong là tải về được ngay, PDF hoặc Excel.</p>
            <Button type="primary" icon={<SendOutlined />} disabled={!selected.length || !people.length || loading} loading={submitting} onClick={submit}>
              {seafarers.length > 1 ? `Tạo ${seafarers.length} bộ giấy` : 'Tạo bộ giấy'}
            </Button>
          </div>
        </div>

        <section className="pk-preview" aria-label="Xem trước">
          {preview ? (
            <>
              <div className="pk-preview__bar">
                <PreviewNav name="giấy" value={preview} onChange={setPicked} options={selected.map((key) => ({ value: key, label: template(key).name }))} />
                {seafarers.length > 1 && (
                  <PreviewNav name="người" value={String(viewing.id)} onChange={setViewId} options={seafarers.map((person) => ({ value: String(person.id), label: person.full_name }))} />
                )}
                <span className="pk-preview__end">
                  {editing && editCount(viewEdits, preview) > 0 && (
                    <Button type="text" icon={<UndoOutlined />} onClick={() => setEdits((current) => ({ ...current, [viewing.id]: { ...viewEdits, [preview]: {} } }))}>
                      Bỏ {editCount(viewEdits, preview)} ô đã sửa
                    </Button>
                  )}
                  <Tooltip title={viewing ? '' : 'Chọn ứng viên trước rồi mới sửa được trên giấy'}>
                    <Button icon={<EditOutlined />} type={editing ? 'primary' : 'default'} disabled={!viewing} aria-pressed={editing} onClick={() => setEditing(!editing)}>
                      {editing ? 'Xong sửa' : 'Sửa trên giấy'}
                    </Button>
                  </Tooltip>
                </span>
              </div>
              <p className="pk-preview__label">
                {!viewing
                  ? 'Mẫu trống, chưa chọn ứng viên'
                  : editing
                    ? `Bấm vào ô bất kỳ trên giấy để sửa${seafarers.length > 1 ? `, chỉ áp dụng cho giấy của ${viewing.full_name}` : ''}.`
                    : `Giấy của ${viewing.full_name}, đúng như file sẽ xuất`}
              </p>
              <FormPreview
                highlightFields
                persistWhileEditing
                docKey={preview}
                seafarerId={viewing?.id}
                shipOwnerId={ownerId}
                inputs={inputs}
                edits={viewEdits[preview]}
                editable={editing && !!viewing}
                onEdit={(address, text) => setEdits((current) => ({ ...current, [viewing.id]: setEdit(current[viewing.id], preview, address, text) }))}
                label={`Xem trước ${template(preview).name}`}
              />
            </>
          ) : (
            <EmptyState title="Chưa chọn giấy nào" description="Thêm ít nhất một giấy để xem trước đúng mẫu sẽ xuất." />
          )}
        </section>
      </div>
    </div>
  )
}
