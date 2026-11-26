import { QuestionCircleOutlined } from '@ant-design/icons'
import './ds.css'

// Bộ hướng dẫn (frontend/public/guide/): trang chủ index.html, mỗi bài một trang <slug>.html.
export const GUIDE_HOME_URL = '/guide/index.html'

// Link "Hướng dẫn" mở trang hướng dẫn tĩnh trong app ở tab mới.
export default function HelpLink({ href = GUIDE_HOME_URL, children = 'Hướng dẫn' }) {
  return (
    <a className="ds-help-link" href={href} target="_blank" rel="noopener noreferrer">
      <QuestionCircleOutlined aria-hidden />
      <span>{children}</span>
    </a>
  )
}
