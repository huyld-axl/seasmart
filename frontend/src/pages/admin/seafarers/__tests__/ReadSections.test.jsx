import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReadLayout } from '../ReadSections'

let phone = true
vi.mock('../../../../hooks/useViewport', () => ({ default: () => ({ isPhone: phone }) }))
const sections = ['identity', 'registration', 'specs', 'engine', 'management', 'usage'].map((key, i) => ({ key, title: `Mục ${i + 1}`, fields: [['Tên', 'Dữ liệu', 12]] }))
let tops, scrollTo
beforeEach(() => {
  phone = true
  tops = { identity: 100, registration: 400, specs: 700, engine: 1000, management: 1300, usage: 1600 }
  scrollTo = vi.fn()
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    return { top: tops[this.id?.slice(3)] ?? 0, left: 0, width: 320, height: 200 }
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: scrollTo })
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(320)
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(900)
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(140)
  vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function () {
    return sections.findIndex((s) => this.getAttribute('href') === `#sf-${s.key}`) * 150
  })
  vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(2400)
  vi.stubGlobal('innerHeight', 800)
  vi.stubGlobal('scrollY', 400)
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); delete HTMLElement.prototype.scrollTo })

it('cuộn tới mục ngoài màn hình thì tự cuộn thanh mục ngang, không kéo trang dọc', async () => {
  render(<ReadLayout sections={sections} label="tàu" />)
  const nav = screen.getByRole('navigation', { name: 'Các mục của tàu' })
  expect(nav.querySelector('.ds-scrollrow__track')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Mục 1/ })).toHaveAttribute('aria-current', 'true')
  tops = { identity: -1200, registration: -900, specs: -600, engine: -300, management: 100, usage: 400 }
  scrollTo.mockClear()
  fireEvent.scroll(window)
  await waitFor(() => expect(screen.getByRole('link', { name: /Mục 5/ })).toHaveAttribute('aria-current', 'true'))
  expect(scrollTo).toHaveBeenLastCalledWith({ left: 510, behavior: 'smooth' })
  // Cuộn ngược cũng đưa mục đầu trở lại trong vùng nhìn thấy.
  tops = { identity: 100, registration: 400, specs: 700, engine: 1000, management: 1300, usage: 1600 }
  fireEvent.scroll(window)
  await waitFor(() => expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'smooth' }))
})
it('desktop giữ mục lục dọc', () => {
  phone = false
  render(<ReadLayout sections={sections} />)
  expect(screen.getByRole('navigation').querySelector('.ds-scrollrow__track')).toBeNull()
  expect(screen.getAllByRole('link')).toHaveLength(6)
})
