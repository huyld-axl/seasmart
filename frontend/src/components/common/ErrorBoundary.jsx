import { Component } from 'react'
import ErrorPage from '../../pages/errors/ErrorPage'

// Bắt lỗi khi vẽ một trang: hiện trang 500 có mã lỗi, khung app vẫn chạy.
// Ngoại lệ duy nhất cho luật "chỉ component hàm": React chưa có hook bắt lỗi render.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { errorId: null }
  }

  static getDerivedStateFromError() {
    return { errorId: Math.random().toString(16).slice(2, 6) + '-' + Date.now().toString(16).slice(-4) }
  }

  componentDidCatch(error) {
    console.error(`[${this.state.errorId}]`, error)
  }

  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.errorId) this.setState({ errorId: null })
  }

  render() {
    return this.state.errorId ? <ErrorPage code={500} errorId={this.state.errorId} /> : this.props.children
  }
}
