import { Button } from 'antd'
import { CheckOutlined, CloseOutlined, FileTextOutlined, UploadOutlined } from '@ant-design/icons'
import './ds.css'

// Khung kéo thả + danh sách tệp (components/file-upload.md). Logic tải lên để handler rỗng.
// file.state: uploading | waiting | failed | done | duplicate
export default function FileDropzone({ files = [], onSelect, onRetry, onRemove, onOpenDuplicate }) {
  return (
    <div>
      <label className="ds-drop">
        <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="ds-sr-only" onChange={onSelect} />
        <span className="ds-drop__title">Kéo thả sổ thuyền viên vào đây</span>
        <span className="ds-drop__hint">PDF, JPG hoặc PNG. Tối đa 25 MB và 50 trang mỗi tệp</span>
        <span className="ds-drop__button">
          <UploadOutlined aria-hidden />
          Chọn tệp
        </span>
      </label>

      {files.length > 0 ? (
        <ul className="ds-files">
          {files.map((file) => (
            <li key={file.name} className="ds-files__row">
              <FileTextOutlined className="ds-files__icon" aria-hidden />
              <div className="ds-files__body">
                <div className="ds-files__line">
                  <p className="ds-files__name" title={file.name}>
                    <span className="ds-files__head">{file.name.slice(0, -12)}</span>
                    <span className="ds-files__tail">{file.name.slice(-12)}</span>
                  </p>
                  {file.state === 'uploading' ? <p className="ds-files__percent">{file.progress}%</p> : null}
                </div>
                <FileMeta file={file} onRetry={onRetry} onOpenDuplicate={onOpenDuplicate} />
              </div>
              {file.state === 'done' ? null : (
                <Button type="text" size="small" icon={<CloseOutlined />} aria-label={`Bỏ ${file.name}`} onClick={() => onRemove?.(file)} />
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function FileMeta({ file, onRetry, onOpenDuplicate }) {
  if (file.state === 'uploading') {
    return (
      <div className="ds-progress ds-progress--thin" role="progressbar" aria-valuenow={file.progress} aria-valuemin={0} aria-valuemax={100}>
        <div className="ds-progress__bar" style={{ width: `${file.progress}%` }} />
      </div>
    )
  }
  if (file.state === 'waiting') return <p className="ds-files__meta">Đang chờ · {file.size}</p>
  if (file.state === 'failed') {
    return (
      <p className="ds-files__meta ds-files__meta--error">
        {file.error} ·{' '}
        <button type="button" className="ds-link" onClick={() => onRetry?.(file)}>Thử lại</button>
      </p>
    )
  }
  if (file.state === 'duplicate') {
    return (
      <p className="ds-files__meta ds-files__meta--warning">
        Trùng với tài liệu đã tải lúc {file.duplicateOf} ·{' '}
        <button type="button" className="ds-link" onClick={() => onOpenDuplicate?.(file)}>Mở tài liệu đó</button>
      </p>
    )
  }
  return (
    <p className="ds-files__meta">
      <CheckOutlined aria-hidden /> Đã tải xong · {file.size}
    </p>
  )
}
