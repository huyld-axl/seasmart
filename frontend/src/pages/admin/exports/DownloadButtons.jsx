import { useMutation } from '@tanstack/react-query'
import { Button, Dropdown } from 'antd'
import { DownloadOutlined, DownOutlined, FileExcelOutlined, FilePdfOutlined, FolderOutlined } from '@ant-design/icons'
import { exportApi } from '../../../api/exportApi'
import useToast from '../../../components/ds/useToast'
import useExportPrefsStore from '../../../stores/exportPrefsStore'
import { downloadError, saveBlob } from './download'

// File tải về theo tuỳ chọn "Hiện đường lưới" ở khung xem trước.
function useDownload(request, fallbackName) {
  const toast = useToast()
  const gridlines = useExportPrefsStore((state) => state.gridlines)
  return useMutation({
    mutationFn: (format) => request(format, gridlines).then((res) => saveBlob(res, fallbackName(format))),
    onError: async (error) => toast.error(await downloadError(error)),
  })
}

// Tải cả bộ thành một thư mục (.zip): PDF, Excel, hoặc cả hai.
export function PackDownload({ pack, type = 'default', size, disabled, label = 'Tải cả bộ' }) {
  const download = useDownload((format, gridlines) => exportApi.download(pack.id, format, gridlines), () => `${pack.code}.zip`)
  const items = [
    { key: 'all', icon: <FolderOutlined />, label: 'PDF và Excel' },
    { key: 'pdf', icon: <FilePdfOutlined />, label: 'Chỉ PDF' },
    { key: 'xlsx', icon: <FileExcelOutlined />, label: 'Chỉ Excel' },
  ]
  return (
    <span onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()} role="presentation">
      <Dropdown trigger={['click']} placement="bottomRight" disabled={disabled || download.isPending} menu={{ items, onClick: ({ key }) => download.mutate(key) }}>
        <Button type={type} size={size} icon={<DownloadOutlined />} loading={download.isPending} aria-label={`${label} ${pack.code} của ${pack.seafarer_name}`}>
          {download.isPending ? 'Đang tạo file…' : label} {!download.isPending && <DownOutlined aria-hidden />}
        </Button>
      </Dropdown>
    </span>
  )
}

// Tải riêng một giấy: PDF hoặc Excel.
export function DocDownload({ pack, docKey, docName, disabled }) {
  const download = useDownload((format, gridlines) => exportApi.downloadDoc(pack.id, docKey, format, gridlines), (format) => `${docName}.${format}`)
  const busy = (format) => download.isPending && download.variables === format
  return (
    <>
      <Button icon={<FilePdfOutlined />} disabled={disabled || download.isPending} loading={busy('pdf')} aria-label={`Tải ${docName} dạng PDF`} onClick={() => download.mutate('pdf')}>PDF</Button>
      <Button icon={<FileExcelOutlined />} disabled={disabled || download.isPending} loading={busy('xlsx')} aria-label={`Tải ${docName} dạng Excel`} onClick={() => download.mutate('xlsx')}>Excel</Button>
    </>
  )
}
