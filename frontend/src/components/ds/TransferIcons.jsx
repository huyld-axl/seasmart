import Icon from '@ant-design/icons'

// Tải lên / tải xuống: mũi tên dài, nét đậm, đầu mũi tên lớn để nhìn là biết hướng. Dùng thay UploadOutlined / DownloadOutlined của antd.
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }

const UploadSvg = () => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" {...stroke}>
    <path d="M12 16V3M6.5 8.5 12 3l5.5 5.5" />
    <path d="M4 15v4a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-4" />
  </svg>
)

const DownloadSvg = () => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" {...stroke}>
    <path d="M12 3v13M6.5 10.5 12 16l5.5-5.5" />
    <path d="M4 15v4a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-4" />
  </svg>
)

export const UploadIcon = (props) => <Icon component={UploadSvg} {...props} />
export const DownloadIcon = (props) => <Icon component={DownloadSvg} {...props} />
