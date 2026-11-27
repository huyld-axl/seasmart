// Trang design system ở khu nội bộ (/internal/design-system/, docs/catoro-ke-hoach-khu-noi-bo.md 5.5): trang Vite riêng, không
// nằm trong app (web lẫn máy tính).
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { applyCssVariables } from './theme/tokens'
import './index.css'
import DesignSystemApp from './DesignSystemApp'

applyCssVariables()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DesignSystemApp />
  </StrictMode>
)
