import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Skeleton } from 'antd'
import { DownOutlined, FileTextOutlined, PictureOutlined, RightOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { seafarerApi } from '../../../api'
import { exportApi } from '../../../api/exportApi'
import { EmptyState } from '../../../components/ds/Controls'
import { DownloadIcon } from '../../../components/ds/TransferIcons'
import useToast from '../../../components/ds/useToast'
import { useCan } from '../../../hooks/usePermission'
import { saveBlob, downloadError } from '../exports/download'

const fmtTime = (v) => dayjs(v).format('DD/MM/YYYY HH:mm')

// Tab Đã xuất: nhật ký các lần nộp hồ sơ của thuyền viên cho các cơ hội (chỉ xem; ráp và gửi làm ở Cơ hội).
// Mở dòng xem từng tệp đã gửi; Tải lại cho ra đúng bản đã gửi lúc đó. Giấy đã sửa / thay sau lần gửi được đánh dấu.
// Bộ giấy cũ (tạo trước khi gắn cơ hội) gom vào khối cuối, chỉ còn tải về.
export default function ProfileExports({ seafarerId }) {
  const navigate = useNavigate()
  const toast = useToast()
  const can = useCan()
  const [open, setOpen] = useState(null)
  const [busy, setBusy] = useState(null)
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['seafarer-sends', seafarerId],
    queryFn: () => seafarerApi.sends(seafarerId),
  })
  const canDownload = can('export.view') || can('export.download')

  async function download(key, fetcher, fallback) {
    setBusy(key)
    try {
      saveBlob(await fetcher(), fallback)
    } catch (e) {
      toast.error('Không tải được hồ sơ', { description: await downloadError(e) })
    } finally {
      setBusy(null)
    }
  }

  let body
  if (isLoading) body = <div className="crew-panel__body"><Skeleton active /></div>
  else if (isError) body = <EmptyState isError title="Không tải được lịch sử nộp hồ sơ" action={<Button onClick={() => refetch()}>Thử lại</Button>} />
  else if (!data.data.length && !data.legacy.length) {
    body = (
      <EmptyState
        title="Chưa nộp hồ sơ nào"
        description="Hồ sơ được ráp và gửi cho chủ tàu trong từng Cơ hội. Mỗi lần gửi sẽ hiện ở đây, kèm đúng các bản giấy tờ và biểu mẫu đã gửi."
        action={can('opportunity.view') ? <Button icon={<RightOutlined />} iconPosition="end" onClick={() => navigate('/opportunities')}>Xem các cơ hội</Button> : null}
      />
    )
  } else {
    body = (
      <>
        {data.data.length ? (
          <ul className="crew-sends">
            {data.data.map((s) => {
              const isOpen = open === s.id
              const docs = (s.files || []).filter((f) => f.kind === 'doc')
              const forms = (s.files || []).filter((f) => f.kind === 'form')
              return (
                <li key={s.id} data-open={isOpen ? '' : undefined}>
                  <div className="crew-sends__row">
                    <Button type="text" size="small" icon={isOpen ? <DownOutlined /> : <RightOutlined />} aria-expanded={isOpen} aria-label={isOpen ? 'Thu gọn' : 'Xem các tệp đã gửi'} onClick={() => setOpen(isOpen ? null : s.id)} />
                    <span className="ds-cell2 crew-sends__what">
                      <span className="ds-cell2__main"><span className="ds-ctable__mono">{s.opportunity_code}</span>{s.vessel_name ? ` · ${s.vessel_name}` : ''}</span>
                      <span className="ds-cell2__sub">{[s.ship_owner_name, s.rank_name].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="ds-cell2 crew-sends__files">
                      <span className="ds-cell2__main">{s.files ? `${docs.length} giấy tờ · ${forms.length} biểu mẫu` : 'Bộ giấy đã gửi'}</span>
                      {s.stale.length ? <span className="ds-cell2__sub crew-sends__stale">{s.stale.length} giấy đã có bản mới</span> : null}
                    </span>
                    <span className="ds-cell2 crew-sends__when">
                      <span className="ds-cell2__main">{fmtTime(s.sent_at)}</span>
                      <span className="ds-cell2__sub" title={s.to_email}>{s.to_email}</span>
                    </span>
                    <span className="crew-sends__acts">
                      {canDownload ? <Button type="text" size="small" icon={<DownloadIcon />} loading={busy === `s${s.id}`} aria-label="Tải lại hồ sơ đã gửi" title="Tải lại hồ sơ đã gửi" onClick={() => download(`s${s.id}`, () => seafarerApi.sendDownload(seafarerId, s.id), `${s.opportunity_code}.zip`)} /> : null}
                      {can('opportunity.view') ? <Button size="small" onClick={() => navigate(`/opportunities/${s.opportunity_id}`)}>Mở cơ hội</Button> : null}
                    </span>
                  </div>
                  {isOpen ? (
                    <div className="crew-sends__detail">
                      {s.files ? (
                        <div className="crew-sends__cols">
                          <FileList title="Giấy tờ" icon={<PictureOutlined />} files={docs} stale={s.stale} />
                          <FileList title="Biểu mẫu" icon={<FileTextOutlined />} files={forms} />
                        </div>
                      ) : null}
                      <p className="crew-sends__note">
                        Gửi tới <b>{s.to_email}</b> · bởi {s.sent_by_name || s.sent_by_email}.{' '}
                        {s.has_copy ? 'Tải lại cho ra đúng các bản đã gửi lúc đó, không phải bản mới nhất.' : 'Lần gửi này chưa giữ bản gốc: tải lại sẽ dựng từ dữ liệu hiện tại.'}
                      </p>
                      {s.stale.length ? <p className="crew-sends__note crew-sends__stale">Đã sửa hoặc thay sau lần gửi: {s.stale.join(', ')}.</p> : null}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : null}
        {data.legacy.length ? (
          <details className="crew-sends__old">
            <summary>Bộ giấy cũ (trước khi gắn cơ hội) · {data.legacy.length}</summary>
            <p className="crew-sends__note">Bộ giấy tạo từ hồ sơ thuyền viên trước đây. Chỉ còn tải về, không tạo thêm.</p>
            <ul className="crew-sends__oldlist">
              {data.legacy.map((p) => (
                <li key={p.id}>
                  <span className="ds-cell2">
                    <span className="ds-cell2__main">{p.title}</span>
                    <span className="ds-cell2__sub">{fmtTime(p.created_at)} · {p.created_by_email}</span>
                  </span>
                  {canDownload ? <Button type="text" size="small" icon={<DownloadIcon />} loading={busy === `p${p.id}`} aria-label={`Tải ${p.title}`} title="Tải về" onClick={() => download(`p${p.id}`, () => exportApi.download(p.id, 'pdf'), `${p.title}.zip`)} /> : null}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </>
    )
  }

  return (
    <section className="crew-panel">
      <div className="crew-panel__head">
        <div>
          <h2 className="crew-panel__title">Hồ sơ đã nộp</h2>
          <p className="crew-sends__desc">Mỗi lần nộp hồ sơ cho một cơ hội. Ráp và gửi hồ sơ làm trong Cơ hội; ở đây chỉ xem lại và tải lại.</p>
        </div>
      </div>
      <div className="crew-panel__body">{body}</div>
    </section>
  )
}

function FileList({ title, icon, files, stale = [] }) {
  return (
    <div>
      <p className="crew-sends__label">{title} · {files.length}</p>
      {files.length ? (
        <ul className="crew-sends__list">
          {files.map((f) => (
            <li key={f.path}>
              {icon}
              <span>{f.name}</span>
              {stale.some((name) => f.name.startsWith(name)) ? <span className="ds-badge ds-badge--warning crew-sends__tag">Đã có bản mới</span> : null}
            </li>
          ))}
        </ul>
      ) : <p className="crew-sends__note">Không có.</p>}
    </div>
  )
}
