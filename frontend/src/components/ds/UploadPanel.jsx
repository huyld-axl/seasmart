import { Button } from 'antd'
import { ClockCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined, FileAddOutlined, FileExclamationOutlined, FileImageOutlined, FilePdfOutlined, LoadingOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons'
import { UploadIcon } from './TransferIcons'
import StatusBadge from './StatusBadge'
import './ds.css'

// Màn "Tải giấy tờ lên" (T1): một khung duy nhất gồm dòng tóm tắt, mỗi tệp một dòng, khung thả ở chân.
// Người dùng chỉ cần biết đang xử lý, xong, hay tệp nào cần làm gì; không hiện các bước tải, tách, đọc.
// file.state: running | done | other | error | stuck | unsupported | tooBig | duplicate | saved | unsent
// Logic tải lên và đếm để handler và props rỗng; `summary` là { title, note, action } do màn tính.
const FILE_ICONS = { pdf: FilePdfOutlined, image: FileImageOutlined, other: FileExclamationOutlined }

export default function UploadPanel({
  files = [],
  summary,
  seafarerName,
  onSelect,
  onReview,
  onRetry,
  onRemove,
  onOpenDuplicate,
}) {
  const drop = (slim) => (
    <label className={`ds-updrop${slim ? ' ds-updrop--slim' : ' ds-updrop--big'}`}>
      <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="ds-sr-only" onChange={onSelect} />
      <span className="ds-updrop__icon" aria-hidden><FileAddOutlined /></span>
      <span className="ds-updrop__text">
        <span className="ds-updrop__title">
          {slim ? 'Thả thêm giấy tờ vào đây' : `Thả giấy tờ${seafarerName ? ` của ${seafarerName}` : ''} vào đây`}
        </span>
        <span className="ds-updrop__hint">
          {slim
            ? 'PDF, JPG hoặc PNG, tối đa 25 MB mỗi tệp.'
            : 'PDF, JPG hoặc PNG, tối đa 25 MB mỗi tệp, thả một lần nhiều tệp cũng được. AI tự nhận loại giấy và đọc, bạn duyệt sau.'}
        </span>
      </span>
      <span className="ds-drop__button"><UploadIcon aria-hidden />Chọn tệp</span>
    </label>
  )

  if (files.length === 0) return drop(false)

  return (
    <section className="ds-uploads">
      {summary ? (
        <div className="ds-uploads__head" aria-live="polite">
          <p className="ds-uploads__title">
            {summary.title}
            {summary.note ? <span className="ds-uploads__note">{summary.note}</span> : null}
          </p>
          {summary.action ? (
            <Button type="primary" icon={<RightOutlined />} iconPlacement="end" onClick={onReview}>{summary.action}</Button>
          ) : null}
        </div>
      ) : null}
      <ul className="ds-uploads__list">
        {files.map((file) => (
          <UploadRow key={file.id || file.name} file={file} onReview={onReview} onRetry={onRetry} onRemove={onRemove} onOpenDuplicate={onOpenDuplicate} />
        ))}
      </ul>
      {drop(true)}
    </section>
  )
}

function UploadRow({ file, onReview, onRetry, onRemove, onOpenDuplicate }) {
  const Icon = FILE_ICONS[file.kind] || FilePdfOutlined
  const small = (props) => ({ size: 'small', ...props })
  let status = null
  let actions = null

  switch (file.state) {
    case 'running':
      status = <span className="ds-uprow__state"><LoadingOutlined spin aria-hidden />Đang xử lý</span>
      break
    case 'done':
      status = <span className="ds-uprow__state"><StatusBadge group="upload" value="DONE" /><span className="ds-uprow__note">{file.summary}</span></span>
      actions = file.canReview === false ? null : <Button {...small({ icon: <RightOutlined />, onClick: () => onReview?.(file) })}>Duyệt</Button>
      break
    case 'other':
      status = <span className="ds-uprow__state"><StatusBadge group="upload" value="OTHER" /><span className="ds-uprow__note">{file.summary} · lưu kèm hồ sơ</span></span>
      break
    case 'error':
      status = <span className="ds-uprow__state ds-uprow__state--error"><CloseCircleOutlined aria-hidden />{file.error || 'Không đọc được tệp này.'}</span>
      actions = (
        <>
          <Button {...small({ icon: <ReloadOutlined />, onClick: () => onRetry?.(file) })}>Thử lại</Button>
          <Button {...small({ type: 'text', onClick: () => onRemove?.(file) })}>Bỏ tệp</Button>
        </>
      )
      break
    case 'stuck':
      status = <span className="ds-uprow__state ds-uprow__state--warning"><ClockCircleOutlined aria-hidden />Quá 5 phút chưa xong, có thể bị kẹt</span>
      actions = (
        <>
          <Button {...small({ icon: <ReloadOutlined />, onClick: () => onRetry?.(file) })}>Thử lại</Button>
          <Button {...small({ type: 'text', onClick: () => onRemove?.(file) })}>Bỏ tệp</Button>
        </>
      )
      break
    case 'unsupported':
      status = <span className="ds-uprow__state ds-uprow__state--error">Chỉ nhận PDF, JPG, PNG</span>
      actions = <Button {...small({ type: 'text', onClick: () => onRemove?.(file) })}>Bỏ khỏi danh sách</Button>
      break
    case 'tooBig':
      status = <span className="ds-uprow__state ds-uprow__state--error">Tệp {file.size}, quá 25 MB. Chọn bản nhỏ hơn</span>
      actions = <Button {...small({ type: 'text', onClick: () => onRemove?.(file) })}>Bỏ khỏi danh sách</Button>
      break
    case 'duplicate':
      status = <span className="ds-uprow__state ds-uprow__state--warning"><ExclamationCircleOutlined aria-hidden />Đã có trong hồ sơ (tải ngày {file.duplicateOf})</span>
      actions = (
        <>
          <Button {...small({ onClick: () => onOpenDuplicate?.(file) })}>Xem tệp đã có</Button>
          <Button {...small({ type: 'text', onClick: () => onRemove?.(file) })}>Bỏ</Button>
        </>
      )
      break
    case 'saved':
      status = <span className="ds-uprow__state"><span className="ds-uprow__note">Đã lưu kèm hồ sơ, chưa đọc</span></span>
      actions = <Button {...small({ icon: <ReloadOutlined />, disabled: true })}>Đọc lại</Button>
      break
    case 'unsent':
      status = <span className="ds-uprow__state ds-uprow__state--error">Chưa gửi được</span>
      actions = <Button {...small({ icon: <ReloadOutlined />, onClick: () => onRetry?.(file) })}>Gửi lại</Button>
      break
    default:
      break
  }

  return (
    <li className="ds-uprow">
      <Icon className="ds-uprow__icon" aria-hidden />
      <span className="ds-uprow__name" title={file.name}>{file.name}</span>
      {status}
      {actions ? <span className="ds-uprow__actions">{actions}</span> : null}
    </li>
  )
}

