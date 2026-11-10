import { QuestionCircleOutlined } from '@ant-design/icons'
import './ds.css'

// Trang hướng dẫn duy nhất (frontend/public/huong-dan/index.html); mở thẳng tới một mục bằng id của mục.
export const GUIDE_HOME_URL = '/huong-dan/index.html'

// Link "Hướng dẫn" mở trang hướng dẫn tĩnh trong app ở tab mới.
export default function HelpLink({ href = GUIDE_HOME_URL, children = 'Hướng dẫn' }) {
  return (
    <a className="ds-help-link" href={href} target="_blank" rel="noopener noreferrer">
      <QuestionCircleOutlined aria-hidden />
      <span>{children}</span>
    </a>
  )
}
