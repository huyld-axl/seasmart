import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HelpLink from '../HelpLink'

describe('HelpLink', () => {
  it('mở trang hướng dẫn ở tab mới, không lộ opener', () => {
    render(<HelpLink />)
    const link = screen.getByRole('link', { name: 'Hướng dẫn' })
    expect(link).toHaveAttribute('href', '/huong-dan/index.html')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
