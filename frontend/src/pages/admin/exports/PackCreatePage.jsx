import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Input, Skeleton } from 'antd'
import { ExclamationCircleOutlined, RightOutlined, SendOutlined } from '@ant-design/icons'
import { seafarerApi } from '../../../api'
import useAuthStore from '../../../stores/authStore'
import { EmptyState } from '../../../components/ds/Controls'
import { nameInitials } from '../seafarers/crewView'
import A4Preview from './A4Preview'
import { STAGES, TEMPLATES, packInputs, packMissing, stagePick, template, toggleTemplate } from './packModel'
import { packStore } from './packStore'
import '../seafarers/SeafarerListPage.css'
import '../seafarers/SeafarerProfile.css'
import './exports.css'

// B3 Tạo bộ giấy (phương án A): danh sách 12 mẫu theo giai đoạn bên trái, xem trước A4 bên phải.
export default function PackCreatePage() {
  const [params] = useSearchParams()
  const seafarerId = params.get('seafarer')
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const [selected, setSelected] = useState(stagePick('di-tau'))
  const [picked, setPicked] = useState('qddd')
  const [inputs, setInputs] = useState({})

  const { data: seafarer, isLoading, isError, refetch } = useQuery({
    queryKey: ['seafarer', seafarerId],
    queryFn: () => seafarerApi.getById(seafarerId).then((r) => r.data),
    enabled: !!seafarerId,
  })

  if (!seafarerId) {
    return <EmptyState title="Chọn thuyền viên trước" description="Bộ giấy được tạo từ hồ sơ một thuyền viên." action={<Button onClick={() => navigate('/seafarers')}>Mở danh sách thuyền viên</Button>} />
  }
  if (isError) {
    return <EmptyState isError title="Không tải được hồ sơ" description="Mất kết nối tới máy chủ." action={<Button onClick={() => refetch()}>Thử lại</Button>} />
  }

  const fields = packInputs(selected)
  const missing = packMissing(selected)
  const preview = selected.includes(picked) ? picked : selected[0]

  function toggle(key) {
    const next = toggleTemplate(selected, key)
    setSelected(next)
    if (next.includes(key)) setPicked(key)
  }

  function submit() {
    const pack = packStore.create({
      seafarerId,
      seafarerName: seafarer.full_name,
      snapshot: { full_name: seafarer.full_name, date_of_birth: seafarer.date_of_birth, rank_name: seafarer.rank_name },
      docs: selected,
      inputs,
      createdBy: user?.email || 'Bạn',
    })
    navigate(`/exports/${pack.id}`)
  }

  return (
    <div className="ds-page">
      <nav className="crew-crumb" aria-label="Đường dẫn">
        <Link to="/seafarers">Thuyền viên</Link>
        <RightOutlined aria-hidden />
        {seafarer ? <Link to={`/seafarers/${seafarerId}`}>{seafarer.full_name}</Link> : <span>…</span>}
        <RightOutlined aria-hidden />
        <span aria-current="page">Tạo bộ giấy</span>
      </nav>

      <div className="ds-page__head">
        <div>
          <h1 className="ds-page__title">Tạo bộ giấy tờ</h1>
          <p className="ds-page__desc">Tick giấy cần cho lần xuất này. Mỗi lần một bộ khác nhau cũng được.</p>
        </div>
      </div>

      <div className="pk-who">
        <span className="rv-muted">Thuyền viên</span>
        {isLoading ? (
          <Skeleton.Input active size="small" />
        ) : (
          <span className="pk-chip">
            <span className="crew-avatar" aria-hidden>{nameInitials(seafarer.full_name)}</span>
            {seafarer.full_name}
          </span>
        )}
      </div>

      <div className="pk-layout">
        <div className="pk-left">
          <div className="pk-quick">
            <span className="rv-muted">Chọn nhanh:</span>
            {STAGES.map((stage) => (
              <Button key={stage.key} size="small" onClick={() => { const keys = stagePick(stage.key); setSelected(keys); setPicked(keys[0]) }}>
                {stage.label}
              </Button>
            ))}
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
                          {t.missing.length > 0 && (
                            <span className="pk-doc__miss" title={`Thiếu ${t.missing.join(', ')}`}>
                              <ExclamationCircleOutlined aria-hidden />
                              Thiếu {t.missing.length}
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
                <p className="ds-banner__text">{missing.map((m) => `${m.field} (${m.doc})`).join(' · ')}</p>
              </div>
              <div className="ds-banner__action">
                <Button onClick={() => navigate(`/seafarers/${seafarerId}/edit`)}>Điền vào hồ sơ</Button>
              </div>
            </div>
          )}

          {fields.length > 0 && (
            <section className="crew-panel">
              <div className="crew-panel__head">
                <h2 className="crew-panel__title">Điền lúc xuất</h2>
                <span className="rv-muted">Dùng chung cho mọi giấy trong bộ</span>
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
            <p>Một người khác duyệt bộ giấy trước khi gửi ký.</p>
            <Button type="primary" icon={<SendOutlined />} disabled={!selected.length || !seafarer} onClick={submit}>
              Gửi duyệt {selected.length} giấy
            </Button>
          </div>
        </div>

        <section className="pk-preview" aria-label="Xem trước">
          {preview && seafarer ? (
            <>
              <p className="pk-preview__label">Xem trước · {template(preview).name}</p>
              <A4Preview docKey={preview} seafarer={seafarer} inputs={inputs} />
            </>
          ) : (
            <EmptyState title="Chưa chọn giấy nào" description="Tick ít nhất một giấy để xem trước." />
          )}
        </section>
      </div>
    </div>
  )
}
