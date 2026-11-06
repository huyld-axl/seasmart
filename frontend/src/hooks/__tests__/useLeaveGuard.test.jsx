import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App as AntApp } from 'antd'
import { Link, RouterProvider, createMemoryRouter, useNavigate } from 'react-router-dom'
import useLeaveGuard from '../useLeaveGuard'

afterEach(cleanup)

function FormPage({ dirty }) {
  const navigate = useNavigate()
  const leave = useLeaveGuard(dirty)
  return (
    <>
      <p>Trang form</p>
      <Link to="/other">Về danh sách</Link>
      <button type="button" onClick={() => { leave.allow(); navigate('/other') }}>Lưu xong</button>
    </>
  )
}

function show(dirty) {
  const router = createMemoryRouter(
    [
      { path: '/form', element: <FormPage dirty={dirty} /> },
      { path: '/other', element: <p>Trang khác</p> },
    ],
    { initialEntries: ['/form'] }
  )
  render(<AntApp><RouterProvider router={router} /></AntApp>)
  return router
}

it('chưa đổi gì thì rời trang ngay, không hỏi', async () => {
  const router = show(false)
  fireEvent.click(screen.getByText('Về danh sách'))
  await waitFor(() => expect(router.state.location.pathname).toBe('/other'))
  expect(screen.queryByText('Rời trang này?')).toBeNull()
})

it('còn thay đổi: hỏi lại; Ở lại thì giữ trang, Rời trang thì đi', async () => {
  const router = show(true)
  fireEvent.click(screen.getByText('Về danh sách'))
  // Một hộp hỏi duy nhất (antd có thể lặp tiêu đề trong vùng đọc màn hình nên không đếm theo chữ).
  await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1))
  fireEvent.click(screen.getByRole('button', { name: 'Ở lại' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/form'))

  fireEvent.click(screen.getByText('Về danh sách'))
  await waitFor(() => expect(screen.getAllByRole('button', { name: 'Rời trang' }).length).toBeGreaterThan(0))
  fireEvent.click(screen.getAllByRole('button', { name: 'Rời trang' }).at(-1))
  await waitFor(() => expect(router.state.location.pathname).toBe('/other'))
})

it('lưu xong gọi allow() rồi chuyển trang thì không hỏi', async () => {
  const router = show(true)
  fireEvent.click(screen.getByText('Lưu xong'))
  await waitFor(() => expect(router.state.location.pathname).toBe('/other'))
  expect(screen.queryByText('Rời trang này?')).toBeNull()
})
