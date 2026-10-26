import './ds.css'

// Đối chiếu hồ sơ yêu cầu: chip "8/8 bắt buộc" (xanh khi đủ, cam khi thiếu hoặc hết hạn trước mốc) và "3/3 nên có" (xám).
// fit: { required: { ok, total }, preferred: { ok, total } } từ API. `onOpen` có thì chip bắt buộc là nút mở bảng đối chiếu.
export default function RequirementFit({ fit, onOpen, short = false }) {
  if (!fit) return null
  const { required, preferred } = fit
  const full = required.ok === required.total
  const req = required.total ? (
    onOpen ? (
      <button type="button" className={`ds-fit ds-fit--${full ? 'ok' : 'warn'} ds-fit--button`} onClick={onOpen}>
        {required.ok}/{required.total}{short ? '' : ' bắt buộc'}
      </button>
    ) : (
      <span className={`ds-fit ds-fit--${full ? 'ok' : 'warn'}`}>{required.ok}/{required.total}{short ? '' : ' bắt buộc'}</span>
    )
  ) : null
  return (
    <span className="ds-fits">
      {req}
      {preferred.total ? <span className="ds-fit">{preferred.ok}/{preferred.total}{short ? '' : ' nên có'}</span> : null}
      {!required.total && !preferred.total ? <span className="ds-fit">Chưa có yêu cầu</span> : null}
    </span>
  )
}
