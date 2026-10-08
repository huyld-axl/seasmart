import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Input, Select, Skeleton } from 'antd'
import { CloseOutlined, CopyOutlined, ExclamationCircleOutlined, HistoryOutlined, PlusOutlined, RightOutlined, SendOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { seafarerApi } from '../../../api'
import { exportApi } from '../../../api/exportApi'
import StatusBadge from '../../../components/ds/StatusBadge'
import { EmptyState } from '../../../components/ds/Controls'
import useToast from '../../../components/ds/useToast'
import { nameInitials } from '../seafarers/crewView'
import A4Preview from './A4Preview'
import { STAGES, TEMPLATES, packInputs, packMissing, stagePick, template, toggleTemplate } from './packModel'
import '../seafarers/SeafarerListPage.css'
import '../seafarers/SeafarerProfile.css'
import './exports.css'

// Thêm người vào đợt: tìm thuyền viên theo tên, CCCD, số sổ.
function AddPerson({ exclude, onAdd }) {
  const [search, setSearch] = useState('')
  const { data, isFetching } = useQuery({
    queryKey: ['seafarer-pick', search],
    queryFn: () => seafarerApi.list({ search, limit: 10 }).then((r) => r.data.data),
  })
  return (
    <Select
      showSearch
      filterOption={false}
      value={null}
      placeholder="Thêm người"
      aria-label="Thêm thuyền viên vào đợt"
      style={{ minWidth: 220 }}
      loading={isFetching}
      onSearch={setSearch}
      onChange={(id) => onAdd(String(id))}
      notFoundContent={isFetching ? 'Đang tìm…' : 'Không có thuyền viên khớp'}
      options={(data || []).filter((s) => !exclude.includes(String(s.id))).map((s) => ({ value: s.id, label: `${s.full_name}${s.rank_name ? ` · ${s.rank_name}` : ''}` }))}
    />
  )
}

// B3 Tạo bộ giấy (phương án A): danh sách 12 mẫu theo giai đoạn bên trái, xem trước A4 bên phải.
// Một người, hoặc cả đợt: mỗi người một bộ, cùng các giấy và ô điền.
export default function PackCreatePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const qc = useQueryClient()
  const [people, setPeople] = useState(() => (params.get('seafarer') ? [params.get('seafarer')] : []))
  const [selected, setSelected] = useState(stagePick('di-tau'))
  const [picked, setPicked] = useState('qddd')
  const [inputs, setInputs] = useState({})
  const [submitting, setSubmitting] = useState(false)

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

  if (!people.length) {
    return (
      <div className="ds-page">
        <EmptyState title="Chọn thuyền viên trước" description="Bộ giấy được tạo từ hồ sơ một thuyền viên, hoặc cả đợt nhiều người." action={<AddPerson exclude={[]} onAdd={(id) => setPeople([id])} />} />
      </div>
    )
  }

  const loading = profiles.some((q) => q.isLoading)
  const failed = profiles.find((q) => q.isError)
  if (failed) {
    return <EmptyState isError title="Không tải được hồ sơ" description="Mất kết nối tới máy chủ." action={<Button onClick={() => failed.refetch()}>Thử lại</Button>} />
  }
  const seafarers = profiles.map((q) => q.data).filter(Boolean)
  const contactsOf = (i) => (Array.isArray(contactLists[i]?.data) ? contactLists[i].data : contactLists[i]?.data?.data || [])
  const missing = seafarers.flatMap((s, i) => packMissing(selected, s, contactsOf(i)).map((m) => ({ ...m, who: s.full_name, id: s.id })))
  const fields = packInputs(selected)
  const preview = selected.includes(picked) ? picked : selected[0]
  const pastPacks = history?.data || []
  const lastPack = pastPacks[0]

  function toggle(key) {
    const next = toggleTemplate(selected, key)
    setSelected(next)
    if (next.includes(key)) setPicked(key)
  }
  function reuse(pack) {
    setSelected(pack.docs)
    setPicked(pack.docs[0])
    toast.success(`Đã chọn lại ${pack.docs.length} giấy của bộ #${pack.code}`)
  }

  async function submit() {
    setSubmitting(true)
    const created = []
    try {
      for (const s of seafarers) {
        created.push(await exportApi.create({ seafarer_id: s.id, docs: selected, inputs }))
      }
      qc.invalidateQueries({ queryKey: ['exports'] })
      if (created.length === 1) navigate(`/exports/${created[0].id}`)
      else { toast.success(`Đã tạo ${created.length} bộ giấy, đang chờ duyệt`); navigate('/exports') }
    } catch (e) {
      toast.error(`${e.response?.data?.error || 'Không tạo được bộ giấy'}${created.length ? `. Đã tạo ${created.length}/${seafarers.length} bộ trước khi lỗi.` : ''}`)
    } finally {
      setSubmitting(false)
    }
  }

  const single = seafarers.length === 1 ? seafarers[0] : null
  return (
    <div className="ds-page">
      <nav className="crew-crumb" aria-label="Đường dẫn">
        <Link to="/exports">Bản xuất</Link>
        <RightOutlined aria-hidden />
        {single && <><Link to={`/seafarers/${single.id}`}>{single.full_name}</Link><RightOutlined aria-hidden /></>}
        <span aria-current="page">Tạo bộ giấy</span>
      </nav>

      <div className="ds-page__head">
        <div>
          <h1 className="ds-page__title">Tạo bộ giấy tờ</h1>
          <p className="ds-page__desc">Tick giấy cần cho lần xuất này. Mỗi lần một bộ khác nhau cũng được. Nhiều người thì mỗi người một bộ.</p>
        </div>
      </div>

      <div className="pk-who">
        <span className="rv-muted">Thuyền viên</span>
        {loading && <Skeleton.Input active size="small" />}
        {seafarers.map((s) => (
          <span key={s.id} className="pk-chip">
            <span className="crew-avatar" aria-hidden>{nameInitials(s.full_name)}</span>
            {s.full_name}
            {people.length > 1 && (
              <Button type="text" size="small" icon={<CloseOutlined />} aria-label={`Bỏ ${s.full_name}`} onClick={() => setPeople(people.filter((id) => id !== String(s.id)))} />
            )}
          </span>
        ))}
        <AddPerson exclude={people} onAdd={(id) => setPeople([...people, id])} />
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
                    <StatusBadge group="export" value={p.status} />
                    <Button size="small" type="text" icon={<CopyOutlined />} onClick={() => reuse(p)}>Dùng lại</Button>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="pk-quick">
            <span className="rv-muted">Chọn nhanh:</span>
            {STAGES.map((stage) => (
              <Button key={stage.key} size="small" onClick={() => { const keys = stagePick(stage.key); setSelected(keys); setPicked(keys[0]) }}>
                {stage.label}
              </Button>
            ))}
            {lastPack && <Button size="small" type="text" icon={<HistoryOutlined />} onClick={() => reuse(lastPack)}>Như lần trước</Button>}
            <Button size="small" type="text" onClick={() => setSelected([])}>Bỏ hết</Button>
          </div>

          <div>
            <p className="pk-count">Đã chọn <b>{selected.length}</b> / {TEMPLATES.length} giấy</p>
            {STAGES.map((stage) => (
              <div key={stage.key}>
                <p className="pk-group">{stage.label}</p>
                <ul className="pk-docs">
                  {TEMPLATES.filter((t) => t.stage === stage.key).map((t) => {
                    const on = selected.includes(t.key)
                    const lack = seafarers.flatMap((s, i) => packMissing([t.key], s, contactsOf(i)))
                    return (
                      <li key={t.key}>
                        <label className={preview === t.key && on ? 'pk-doc pk-doc--on' : 'pk-doc'} onMouseEnter={() => on && setPicked(t.key)}>
                          <input type="checkbox" checked={on} onChange={() => toggle(t.key)} />
                          <span className="ds-cell2">
                            <span className="ds-cell2__main">{t.name}</span>
                            <span className="ds-cell2__sub">
                              {t.signers.length ? `Ký: ${t.signers.join(', ')}` : 'Không cần ký'}
                              {t.group ? ' · chỉ chọn một trong hai đơn BHXH' : ''}
                            </span>
                          </span>
                          {lack.length > 0 && (
                            <span className="pk-doc__miss" title={`Hồ sơ thiếu ${[...new Set(lack.map((m) => m.field))].join(', ')}`}>
                              <ExclamationCircleOutlined aria-hidden />
                              Thiếu {new Set(lack.map((m) => m.field)).size}
                            </span>
                          )}
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
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

          {fields.length > 0 && (
            <section className="crew-panel">
              <div className="crew-panel__head">
                <h2 className="crew-panel__title">Điền lúc xuất</h2>
                <span className="rv-muted">Dùng chung cho mọi giấy{seafarers.length > 1 ? ' và mọi người' : ''}</span>
              </div>
              <div className="crew-panel__body ds-form-row">
                {fields.map((label) => (
                  <label key={label} className="ds-field">
                    <span className="ds-field__label">{label}</span>
                    <Input placeholder="Để trống thì in ra điền tay" value={inputs[label] || ''} onChange={(event) => setInputs((current) => ({ ...current, [label]: event.target.value }))} />
                  </label>
                ))}
              </div>
            </section>
          )}

          <div className="pk-foot">
            <p>{seafarers.length > 1 ? `${seafarers.length} người × ${selected.length} giấy. ` : ''}Một người khác duyệt bộ giấy trước khi gửi ký.</p>
            <Button type="primary" icon={<SendOutlined />} disabled={!selected.length || loading} loading={submitting} onClick={submit}>
              {seafarers.length > 1 ? `Gửi duyệt ${seafarers.length} bộ` : `Gửi duyệt ${selected.length} giấy`}
            </Button>
          </div>
        </div>

        <section className="pk-preview" aria-label="Xem trước">
          {preview && seafarers[0] ? (
            <>
              <p className="pk-preview__label">Xem trước · {template(preview).name}{seafarers.length > 1 ? ` · ${seafarers[0].full_name}` : ''}</p>
              <A4Preview docKey={preview} seafarer={seafarers[0]} contacts={contactsOf(0)} inputs={inputs} />
            </>
          ) : (
            <EmptyState title="Chưa chọn giấy nào" description="Tick ít nhất một giấy để xem trước." action={<Button icon={<PlusOutlined />} onClick={() => setSelected(stagePick('di-tau'))}>Chọn bộ Lên tàu</Button>} />
          )}
        </section>
      </div>
    </div>
  )
}
