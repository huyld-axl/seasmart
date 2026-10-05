import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

// Simple smoke test to verify test setup works
describe('Test Setup', () => {
  it('should render a basic element', () => {
    render(<div data-testid="hello">Xin chào</div>)
    expect(screen.getByTestId('hello')).toBeInTheDocument()
    expect(screen.getByTestId('hello')).toHaveTextContent('Xin chào')
  })

  it('should support Vietnamese text', () => {
    render(<span>Quản lý thuyền viên</span>)
    expect(screen.getByText('Quản lý thuyền viên')).toBeInTheDocument()
  })
})
