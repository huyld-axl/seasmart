import { QuestionCircleOutlined } from '@ant-design/icons'
import './ds.css'

export const GUIDE_CONTRACT_URL = '/huong-dan/hop-dong-va-chuyen.html'

// Link "Hướng dẫn" mở trang hướng dẫn tĩnh trong app (frontend/public/huong-dan/) ở tab mới.
export default function HelpLink({ href = GUIDE_CONTRACT_URL, children = 'Hướng dẫn' }) {
  return (
    <a className="ds-help-link" href={href} target="_blank" rel="noopener noreferrer">
      <QuestionCircleOutlined aria-hidden />
      <span>{children}</span>
    </a>
  )
}
