import { useState } from 'react'
import { Button } from 'antd'
import { CloseOutlined, FileAddOutlined, FileTextOutlined, UploadOutlined } from '@ant-design/icons'

const ACCEPT = '.pdf,.jpg,.jpeg,.png'
const MAX_MB = 25

// Điểm "wow" của hồ sơ: thả giấy tờ vào, AI nhận loại giấy và đọc để người duyệt (A3).
// Phần gửi tệp lên và AI đọc chưa có backend: `onFiles` để trống cho bước sau nối vào.
export default function CrewDropzone({ firstName, big = false, onFiles }) {
  const [files, setFiles] = useState([])
  const [dragging, setDragging] = useState(false)

  function addFiles(list) {
    const picked = Array.from(list || []).map((file) => ({
      key: `${file.name}-${file.size}-${file.lastModified}`,
      name: file.name,
      tooBig: file.size > MAX_MB * 1024 * 1024,
      file,
    }))
    if (!picked.length) return
    setFiles((current) => [...current, ...picked.filter((item) => !current.some((old) => old.key === item.key))])
    onFiles?.(picked.filter((item) => !item.tooBig).map((item) => item.file))
  }

  return (
    <div className={big ? 'crew-wow crew-wow--big' : 'crew-wow'}>
      <label
        className={dragging ? 'ds-drop crew-wow__drop is-dragging' : 'ds-drop crew-wow__drop'}
        onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files) }}
      >
        <input type="file" multiple accept={ACCEPT} className="ds-sr-only" onChange={(event) => { addFiles(event.target.files); event.target.value = '' }} />
        <span className="crew-wow__spark" aria-hidden><FileAddOutlined /></span>
        <span className="ds-drop__title">Thả giấy tờ của {firstName} vào đây</span>
        <span className="ds-drop__hint">
          Sổ thuyền viên, hộ chiếu, chứng chỉ, giấy tiêm chủng. AI tự nhận ra loại giấy tờ, đọc và điền vào đúng mục để bạn duyệt.
        </span>
        <span className="ds-drop__button">
          <UploadOutlined aria-hidden />
          Chọn tệp
        </span>
      </label>

      {files.length > 0 && (
        <ul className="ds-files crew-wow__files">
          {files.map((item) => (
            <li key={item.key} className="ds-files__row">
              <FileTextOutlined className="ds-files__icon" aria-hidden />
              <div className="ds-files__body">
                <p className="ds-files__name" title={item.name}>
                  <span className="ds-files__head">{item.name}</span>
                </p>
                <p className={item.tooBig ? 'ds-files__meta crew-wow__error' : 'ds-files__meta'}>
                  {item.tooBig ? `Tệp lớn hơn ${MAX_MB} MB, chọn bản nhỏ hơn` : 'Chờ AI đọc'}
                </p>
              </div>
              <Button type="text" size="small" icon={<CloseOutlined />} aria-label={`Bỏ ${item.name}`} onClick={() => setFiles((current) => current.filter((old) => old.key !== item.key))} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

