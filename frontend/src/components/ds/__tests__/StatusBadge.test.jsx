import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import StatusBadge from '../StatusBadge'

afterEach(cleanup)

it('shows stopped partners with a neutral minus badge and active partners with a green check', () => {
  const { container } = render(
    <>
      <StatusBadge group="partner" value="INACTIVE" />
      <StatusBadge group="partner" value="ACTIVE" />
    </>,
  )
  expect(screen.getByText('Ngừng hợp tác')).toHaveClass('ds-badge--neutral')
  expect(screen.getByText('Đang hợp tác')).toHaveClass('ds-badge--success')
  expect(container.querySelector('.ds-badge--neutral [data-icon="minus-circle"]')).toBeTruthy()
  expect(container.querySelector('.ds-badge--success [data-icon="check-circle"]')).toBeTruthy()
})