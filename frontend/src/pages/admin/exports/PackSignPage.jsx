import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, Input, Modal } from 'antd'
import { EditOutlined, ExclamationCircleOutlined, LockOutlined, RightOutlined, SendOutlined, SyncOutlined } from '@ant-design/icons'
import useAuthStore from '../../../stores/authStore'
import StatusBadge from '../../../components/ds/StatusBadge'
import { EmptyState, ProgressBar } from '../../../components/ds/Controls'
import useToast from '../../../components/ds/useToast'
import A4Preview from './A4Preview'
import { template } from './packModel'
import { SELF_SIGN, packStore, signProgress, signState, usePack } from './packStore'
import '../seafarers/SeafarerProfile.css'
import './exports.css'

// B4 Duyệt và ký (phương án A): danh sách giấy trái, xem trước giữa, chữ ký phải.
export default function PackSignPage() {
  const { packId } = useParams()
  const pack = usePack(packId)
  const user = useAuthStore((state) => state.user)
  const toast = useToast()
  const [picked, setPicked] = useState(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  if (!pack) {
    return <EmptyState title="Không tìm thấy bộ giấy" description="Bộ giấy tạm chỉ giữ tới khi tải lại trang (chưa có backend)." action={<Link to="/exports">Về Bản xuất</Link>} />
  }

  const doc = template(picked && pack.docs.includes(picked) ? picked : pack.docs[0])
  const progress = signProgress(pack)
  const selfCreated = pack.createdBy === user?.email
  const signsOf = (t) => Object.fromEntries(t.signers.map((who) => [who, signState(pack, t.key, who)]))
  const inAppSigners = [...new Set(pack.docs.flatMap((key) => template(key).signers))].filter((who) => who !== SELF_SIGN)
  const crewNeeded = pack.docs.some((key) => template(key).signers.includes(SELF_SIGN))

  let actions
  if (pack.status === 'PENDING_APPROVAL') {
    actions = selfCreated ? (
      <p className="lock-note"><LockOutlined aria-hidden />Bạn tạo bộ này nên không tự duyệt được. Nhờ người khác duyệt.</p>
    ) : (
      <>
        <Button onClick={() => setRejecting(true)}>Trả lại</Button>
        <Button type="primary" icon={<SendOutlined />} onClick={() => { packStore.approve(pack.id); toast.success(`Đã duyệt #${pack.id}, đang chờ ký`) }}>Duyệt và gửi ký</Button>
      </>
    )
  } else if (pack.status === 'SIGNING') {
    actions = <Button icon={<SyncOutlined />} onClick={() => toast.success('Đã nhắc người chưa ký')}>Nhắc ký</Button>
  }

  return (
    <div className="ds-page">
      <nav className="crew-crumb" aria-label="Đường dẫn">
        <Link to="/exports">Bản xuất</Link>
        <RightOutlined aria-hidden />
        <span aria-current="page">#{pack.id}</span>
      </nav>

      <div role="status" className="ds-banner ds-banner--warning">
        <ExclamationCircleOutlined className="ds-banner__icon" aria-hidden />
        <div className="ds-banner__body">
          <p className="ds-banner__title">Bộ giấy tạm, chưa lưu</p>
          <p className="ds-banner__text">Xuất bộ giấy và ký chưa có backend. Bộ này chỉ nằm trong trình duyệt, tải lại trang là mất.</p>
        </div>
      </div>

      <div className="crew-head">
        <div className="crew-head__text">
          <h1 className="crew-head__title">{pack.title} · {pack.seafarerName}</h1>
          <p className="crew-head__desc">
            <StatusBadge group="export" value={pack.status} /> #{pack.id} · {pack.docs.length} giấy · tạo bởi {pack.createdBy}
          </p>
          {pack.status === 'REJECTED' && pack.rejectReason && <p className="crew-head__desc">Lý do trả lại: {pack.rejectReason}</p>}
        </div>
        {actions && <div className="crew-head__actions">{actions}</div>}
      </div>

      {progress.total > 0 && (
        <div className="ps-progress">
          <ProgressBar label="Chữ ký đã có" done={progress.done} total={progress.total} />
        </div>
      )}

      <div className="ps-layout">
        <ul className="ps-docs" aria-label="Giấy trong bộ">
          {pack.docs.map((key) => {
            const t = template(key)
            const signs = Object.values(signsOf(t))
            return (
              <li key={key}>
                <button type="button" aria-current={doc.key === key} onClick={() => setPicked(key)}>
                  <span className="ds-cell2__main" style={{ fontWeight: 400, whiteSpace: 'normal' }}>{t.name}</span>
                  <span className="ds-cell2__sub">{t.signers.length ? `Đã ký ${signs.filter((s) => s === 'done').length}/${t.signers.length}` : 'Không cần ký'}</span>
                </button>
              </li>
            )
          })}
        </ul>

        <section className="crew-panel ps-preview" aria-label="Xem trước">
          <div className="crew-panel__head">
            <h2 className="crew-panel__title">{doc.name}</h2>
          </div>
          <div className="crew-panel__body">
            <A4Preview docKey={doc.key} seafarer={pack.snapshot} inputs={pack.inputs} signs={signsOf(doc)} />
          </div>
        </section>

        <section className="crew-panel">
          <div className="crew-panel__head">
            <h2 className="crew-panel__title">Chữ ký</h2>
          </div>
          <div className="crew-panel__body">
            <ul className="signers">
              {doc.signers.map((who) => (
                <li key={who}>
                  <span className="ds-cell2">
                    <span className="ds-cell2__main" style={{ fontWeight: 400 }}>{who}</span>
                    <span className="ds-cell2__sub">{who === SELF_SIGN ? 'Ký online qua link gửi SMS' : 'Ký trong app'}</span>
                  </span>
                  <StatusBadge group="signature" value={signState(pack, doc.key, who) === 'done' ? 'SIGNED' : 'WAITING'} />
                </li>
              ))}
              <li>
                <span className="ds-cell2">
                  <span className="ds-cell2__main" style={{ fontWeight: 400 }}>Ô ngày tháng, điểm</span>
                  <span className="ds-cell2__sub">Để trống, điền tay khi in</span>
                </span>
                <StatusBadge group="signature" value="BY_HAND" />
              </li>
            </ul>
            {pack.status === 'SIGNING' && (
              <div className="ps-sign-actions" style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                {inAppSigners.filter((who) => pack.docs.some((key) => template(key).signers.includes(who) && signState(pack, key, who) !== 'done')).map((who) => (
                  <Button key={who} type="primary" icon={<EditOutlined />} onClick={() => { packStore.signAs(pack.id, who); toast.success(`Đã ký với tư cách ${who}`) }}>
                    Ký với tư cách {who}
                  </Button>
                ))}
                {crewNeeded && pack.docs.some((key) => template(key).signers.includes(SELF_SIGN) && signState(pack, key, SELF_SIGN) !== 'done') && (
                  <div className="ps-link">
                    <p className="rv-muted" style={{ margin: 0, fontSize: 12 }}>Thuyền viên ký qua link SMS. Chưa có dịch vụ SMS: mở link dưới đây để thử ký như thuyền viên.</p>
                    <Link to={`/sign/${pack.id}`}>Mở trang ký của thuyền viên</Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      <Modal
        open={rejecting}
        title={`Trả lại #${pack.id}?`}
        okText="Trả lại"
        cancelText="Huỷ"
        okButtonProps={{ disabled: !reason.trim() }}
        onCancel={() => setRejecting(false)}
        onOk={() => { packStore.reject(pack.id, reason.trim()); setRejecting(false); toast.success(`Đã trả lại #${pack.id}`) }}
      >
        <label className="ds-field">
          <span className="ds-field__label">Lý do trả lại</span>
          <Input.TextArea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: thiếu Thư bảo lãnh của chủ tàu" />
        </label>
      </Modal>
    </div>
  )
}
