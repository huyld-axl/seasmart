import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from 'antd'
import { documentApi } from '../../../api/documentApi'
import { CloseOutlined, FileAddOutlined, FileTextOutlined, UploadOutlined } from '@ant-design/icons'

const ACCEPT = '.pdf,.jpg,.jpeg,.png'
const MAX_MB = 25

// Điểm "wow" của hồ sơ: thả giấy tờ vào, AI nhận loại giấy và đọc để người duyệt (A3).
// Tệp gửi lên /api/v1/documents; AI đọc ở máy chủ, kết quả duyệt ở màn A3.
const META = {
  uploading: 'Đang tải lên…',
  sent: 'Đã gửi, AI đang đọc',
}

export default function CrewDropzone({ seafarerId, firstName, big = false }) {
  const [files, setFiles] = useState([])
  const [dragging, setDragging] = useState(false)
  const qc = useQueryClient()

  const setState = (key, patch) => setFiles((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)))

  async function send(item) {
    setState(item.key, { state: 'uploading', error: null })
    try {
      await documentApi.upload(seafarerId, item.file)
      setState(item.key, { state: 'sent' })
      qc.invalidateQueries({ queryKey: ['documents', String(seafarerId)] })
    } catch (e) {
      setState(item.key, { state: 'error', error: e.response?.data?.error || 'Chưa gửi được tệp. Thử lại.' })
    }
  }

  function addFiles(list) {
    const picked = Array.from(list || []).map((file) => ({
      key: `${file.name}-${file.size}-${file.lastModified}`,
      name: file.name,
      tooBig: file.size > MAX_MB * 1024 * 1024,
      state: 'uploading',
      file,
    }))
    const fresh = picked.filter((item) => !files.some((old) => old.key === item.key))
    if (!fresh.length) return
    setFiles((current) => [...current, ...fresh])
    fresh.filter((item) => !item.tooBig).forEach(send)
  }
  const sent = files.some((item) => item.state === 'sent')

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
                <p className={item.tooBig || item.error ? 'ds-files__meta crew-wow__error' : 'ds-files__meta'}>
                  {item.tooBig ? `Tệp lớn hơn ${MAX_MB} MB, chọn bản nhỏ hơn` : item.error || META[item.state]}
                </p>
              </div>
              {item.error && <Button type="text" size="small" onClick={() => send(item)}>Gửi lại</Button>}
              <Button type="text" size="small" icon={<CloseOutlined />} aria-label={`Bỏ ${item.name}`} onClick={() => setFiles((current) => current.filter((old) => old.key !== item.key))} />
            </li>
          ))}
        </ul>
      )}
      {sent && <p className="ds-files__meta"><Link to={`/seafarers/${seafarerId}/review`}>Mở màn duyệt giấy tờ</Link></p>}
    </div>
  )
}

