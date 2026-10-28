import { skipToken, useQuery } from '@tanstack/react-query'
import { FilePdfOutlined, PictureOutlined, PlusOutlined } from '@ant-design/icons'
import useObjectUrl from '../../hooks/useObjectUrl'
import './ds.css'

// Ảnh thu nhỏ của một giấy tờ (tab Giấy tờ). `load` trả Blob ảnh hoặc PDF: ảnh thì hiện ảnh, PDF thì hiện biểu tượng.
// Không có `load` (giấy chưa có ảnh): khung nét đứt; có `onUpload` thì bấm để nạp, không thì chỉ báo "Chưa có ảnh".
// size: 'sm' (ô vuông 40px trong bảng, cắt ảnh) | 'md' (khung 4:3, ảnh vừa khung).
export default function DocThumb({ cacheKey, load, name, size = 'sm', onOpen, onUpload }) {
  const { data: blob, isError, isLoading } = useQuery({
    queryKey: ['doc-thumb', ...[].concat(cacheKey ?? [])],
    queryFn: load ?? skipToken,
    staleTime: 10 * 60 * 1000,
  })
  const url = useObjectUrl(blob, (b) => b.type?.startsWith('image/'))

  const cls = `ds-thumb ds-thumb--${size}`
  if (!load) {
    return onUpload ? (
      <button type="button" className={`${cls} ds-thumb--empty`} onClick={onUpload} aria-label={`Nạp ảnh ${name}`} title="Nạp ảnh">
        <PlusOutlined aria-hidden />
        {size === 'md' ? <span>Nạp ảnh</span> : null}
      </button>
    ) : (
      <span className={`${cls} ds-thumb--empty`} title="Chưa có ảnh"><PictureOutlined aria-hidden /></span>
    )
  }
  const body = url ? <img src={url} alt="" />
    : isLoading ? <span className="ds-thumb__wait" aria-hidden />
      : isError ? <PictureOutlined aria-hidden />
        : <span className="ds-thumb__pdf"><FilePdfOutlined aria-hidden />{size === 'md' ? 'PDF' : null}</span>
  return (
    <button type="button" className={cls} onClick={() => onOpen?.()} aria-label={`Xem ${name}`} title={`Xem ${name}`}>
      {body}
    </button>
  )
}
