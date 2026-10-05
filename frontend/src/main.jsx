import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

async function bootstrap() {
  if (import.meta.env.VITE_MOCK === 'true') {
    const { worker } = await import('./mocks/browser')
    await worker.start({ onUnhandledRequest: 'bypass' })
    localStorage.setItem('token', 'mock-jwt-token')
  }
  createRoot(document.getElementById('root')).render(<App />)
}

bootstrap()
