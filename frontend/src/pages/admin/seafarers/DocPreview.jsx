import { useEffect } from 'react'
import useObjectUrl from '../../../hooks/useObjectUrl'
import { skipToken, useQuery } from '@tanstack/react-query'
import { Button, Modal, Skeleton, Tooltip } from 'antd'
import { EditOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons'
import { DownloadIcon, UploadIcon } from '../../../components/ds/TransferIcons'
import StatusBadge from '../../../components/ds/StatusBadge'
import { EmptyState } from '../../../components/ds/Controls'

// Xem lớn giấy tờ ở tab Giấy tờ: ảnh / PDF bên trái, thông tin và nút bên phải. ← → (hoặc nút hai bên) chuyển giấy.
// items: [{ key, name, status, number, issuedOn, expiresOn, noExpiry, source, image: { key, load } | null, onDownload, onReplace, onEdit }]
export default function DocPreview({ items, index, onIndex, onClose }) {
  const open = index !== null && index >= 0 && index < items.length
  const item = open ? items[index] : null
  const { data: blob, isLoading, isError } = useQuery({
    queryKey: ['doc-preview', ...[].concat(item?.image?.key ?? [])],
    queryFn: item?.image?.load ?? skipToken,
    staleTime: 10 * 60 * 1000,
  })
  const url = useObjectUrl(blob)

  const go = (step) => onIndex((index + step + items.length) % items.length)
  useEffect(() => {
    if (!open || items.length < 2) return undefined
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea')) return
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  let stage
  if (!item?.image) stage = <EmptyState title="Chưa có ảnh" description="Bấm Nạp ảnh để thêm bản chụp hoặc bản scan." />
  else if (url) stage = blob.type === 'application/pdf' ? <iframe title={item.name} src={url} /> : <img src={url} alt={item.name} />
  else if (isLoading) stage = <Skeleton.Image active style={{ width: 280, height: 360 }} />
  else stage = <EmptyState isError={isError} title="Không mở được tệp" description="Thử lại sau ít phút." />

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={960} zIndex={1100} destroyOnHidden title={item ? `${item.name}${items.length > 1 ? ` · ${index + 1}/${items.length}` : ''}` : ''}>
      {item ? (
        <div className="crew-preview">
          <div className="crew-preview__stage">
            {items.length > 1 ? <Tooltip title="Giấy trước (←)"><Button shape="circle" icon={<LeftOutlined />} aria-label="Giấy trước" onClick={() => go(-1)} /></Tooltip> : null}
            <div className="crew-preview__doc">{stage}</div>
            {items.length > 1 ? <Tooltip title="Giấy sau (→)"><Button shape="circle" icon={<RightOutlined />} aria-label="Giấy sau" onClick={() => go(1)} /></Tooltip> : null}
          </div>
          <aside className="crew-preview__side">
            <div className="crew-preview__name"><b>{item.name}</b>{item.status ? <StatusBadge group="cert" value={item.status} /> : null}</div>
            <dl>
              {item.number ? <><dt>Số</dt><dd className="ds-ctable__mono">{item.number}</dd></> : null}
              {item.issuedOn ? <><dt>{item.issuedLabel || 'Cấp ngày'}</dt><dd>{item.issuedOn}</dd></> : null}
              {item.noExpiry === undefined ? null : <><dt>Hết hạn</dt><dd>{item.noExpiry ? 'Không thời hạn' : item.expiresOn}</dd></>}
              {item.source ? <><dt>Nguồn</dt><dd>{item.source}</dd></> : null}
            </dl>
            <div className="crew-preview__acts">
              {item.image && item.onDownload ? <Button icon={<DownloadIcon />} onClick={item.onDownload}>Tải về</Button> : null}
              {item.onReplace ? <Button icon={<UploadIcon />} onClick={item.onReplace}>{item.image ? 'Thay ảnh' : 'Nạp ảnh'}</Button> : null}
              {item.onEdit ? <Button type="text" icon={<EditOutlined />} onClick={item.onEdit}>Sửa thông tin</Button> : null}
            </div>
          </aside>
        </div>
      ) : null}
    </Modal>
  )
}
