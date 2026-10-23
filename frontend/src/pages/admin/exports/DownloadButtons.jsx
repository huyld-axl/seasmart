import { useMutation } from '@tanstack/react-query'
import { Button, Dropdown, Tooltip } from 'antd'
import { DownOutlined, FileExcelOutlined, FilePdfOutlined, FolderOutlined } from '@ant-design/icons'
import { DownloadIcon } from '../../../components/ds/TransferIcons'
import { exportApi } from '../../../api/exportApi'
import useToast from '../../../components/ds/useToast'
import useExportPrefsStore from '../../../stores/exportPrefsStore'
import { downloadError, saveBlob } from './download'
import { useCan } from '../../../hooks/usePermission'

// File tải về theo tuỳ chọn "Hiện đường lưới" ở khung xem trước.
function useDownload(request, fallbackName) {
  const toast = useToast()
  const gridlines = useExportPrefsStore((state) => state.gridlines)
  return useMutation({
    mutationFn: (format) => request(format, gridlines).then((res) => saveBlob(res, fallbackName(format))),
    onError: async (error) => toast.error('Không tải được file', { description: await downloadError(error, 'Thử lại sau ít phút.') }),
  })
}

// Tải cả bộ thành một thư mục (.zip): PDF, Excel, hoặc cả hai.
// `iconOnly`: nút vuông chỉ có biểu tượng, cùng kiểu với RowActions (dùng trong cột Thao tác).
export function PackDownload({ pack, type = 'default', size, disabled, label = 'Tải cả bộ', iconOnly }) {
  const canDownload = useCan()('export.download')
  const download = useDownload((format, gridlines) => exportApi.download(pack.id, format, gridlines), () => `${pack.code}.zip`)
  const items = [
    { key: 'all', icon: <FolderOutlined />, label: 'PDF và Excel' },
    { key: 'pdf', icon: <FilePdfOutlined />, label: 'Chỉ PDF' },
    { key: 'xlsx', icon: <FileExcelOutlined />, label: 'Chỉ Excel' },
  ]
  if (!canDownload) return null
  return (
    <span onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()} role="presentation">
      <Dropdown trigger={['click']} placement="bottomRight" disabled={disabled || download.isPending} menu={{ items, onClick: ({ key }) => download.mutate(key) }}>
        {iconOnly ? (
          <Tooltip title={download.isPending ? 'Đang tạo file…' : label}>
            <Button type="text" size="small" icon={<DownloadIcon />} loading={download.isPending} aria-label={`${label} ${pack.code} của ${pack.seafarer_name}`} />
          </Tooltip>
        ) : (
          <Button type={type} size={size} icon={<DownloadIcon />} loading={download.isPending} aria-label={`${label} ${pack.code} của ${pack.seafarer_name}`}>
            {download.isPending ? 'Đang tạo file…' : label} {!download.isPending && <DownOutlined aria-hidden />}
          </Button>
        )}
      </Dropdown>
    </span>
  )
}

// Tải riêng một giấy: PDF hoặc Excel.
export function DocDownload({ pack, docKey, docName, disabled }) {
  const canDownload = useCan()('export.download')
  const download = useDownload((format, gridlines) => exportApi.downloadDoc(pack.id, docKey, format, gridlines), (format) => `${docName}.${format}`)
  const busy = (format) => download.isPending && download.variables === format
  if (!canDownload) return null
  return (
    <>
      <Button icon={<FilePdfOutlined />} disabled={disabled || download.isPending} loading={busy('pdf')} aria-label={`Tải ${docName} dạng PDF`} onClick={() => download.mutate('pdf')}>PDF</Button>
      <Button icon={<FileExcelOutlined />} disabled={disabled || download.isPending} loading={busy('xlsx')} aria-label={`Tải ${docName} dạng Excel`} onClick={() => download.mutate('xlsx')}>Excel</Button>
    </>
  )
}
