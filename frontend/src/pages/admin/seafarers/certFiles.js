import { certificateApi } from '../../../api'
import { documentApi } from '../../../api/documentApi'

// Ảnh / tệp của một chứng chỉ cho tab Giấy tờ. Giấy AI đọc từ bộ tải lên: ảnh trang đầu của giấy đó;
// giấy nạp tay: tệp đính kèm (document_url). Không có tệp thì null (khung trống, bấm để nạp).
// Trả { key, load } cho DocThumb / DocPreview; size: 'thumb' | 'full'.
export function certImage(seafarerId, row, size = 'thumb') {
  if (row.source_upload_id) {
    const page = row.source_page_from || 1
    return { key: ['upload', row.source_upload_id, page, size], load: () => documentApi.pageImage(row.source_upload_id, page, size) }
  }
  if (row.document_url) return { key: ['cert', row.id, row.document_url], load: () => certificateApi.file(seafarerId, row.id) }
  return null
}
