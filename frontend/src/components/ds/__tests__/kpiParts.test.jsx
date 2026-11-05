import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import KpiBars from '../KpiBars'
import ProgressMeter from '../ProgressMeter'
import DueTag from '../DueTag'
import StatusBadge from '../StatusBadge'
import { StatusTabs } from '../Controls'

describe('KpiBars', () => {
  const data = [{ label: 'T10', value: 2 }, { label: 'Tháng này', value: 1, projected: true }]
  it('một cột mỗi tháng, tháng này gạch chéo, số trên đầu cột', () => {
    const { container } = render(<KpiBars data={data} target={3} />)
    expect(container.querySelectorAll('.ds-kpibars__bar')).toHaveLength(2)
    expect(container.querySelectorAll('.ds-kpibars__bar--projected')).toHaveLength(1)
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'T10: 2, Tháng này: 1')
    expect(container.querySelector('.ds-kpibars__target')).not.toBeNull()
  })
  it('không có mục tiêu thì không vẽ đường; cột cao nhất chưa chạm đỉnh', () => {
    const { container } = render(<KpiBars data={data} />)
    expect(container.querySelector('.ds-kpibars__target')).toBeNull()
    expect(parseFloat(container.querySelector('.ds-kpibars__bar i').style.height)).toBeLessThan(100)
  })
  it('toàn số 0 không lỗi', () => {
    const { container } = render(<KpiBars data={[{ label: 'T1', value: 0 }]} />)
    expect(container.querySelector('.ds-kpibars__bar i').style.height).toBe('0%')
  })
})

describe('ProgressMeter', () => {
  it('đã ký dưới vạch tiến độ thì đỏ (behind)', () => {
    const { container } = render(<ProgressMeter done={1} target={3} pace={2} />)
    expect(container.querySelector('.ds-meter--behind')).not.toBeNull()
    expect(screen.getByRole('meter')).toHaveAttribute('aria-label', '1 / 3, chậm tiến độ')
  })
  it('đúng tiến độ thì không đỏ; vạch ở đúng vị trí; phần sắp vào không quá 100%', () => {
    const { container } = render(<ProgressMeter done={1} target={3} pace={0.6} pending={5} />)
    expect(container.querySelector('.ds-meter--behind')).toBeNull()
    expect(container.querySelector('.ds-meter__pace').style.left).toBe('20%')
    const pending = container.querySelector('.ds-meter__pending')
    expect(parseFloat(pending.style.left) + parseFloat(pending.style.width)).toBeCloseTo(100)
  })
  it('đạt mục tiêu thì không đỏ dù vạch cao; chưa đặt mục tiêu thì không vẽ', () => {
    expect(render(<ProgressMeter done={3} target={3} pace={3} />).container.querySelector('.ds-meter--behind')).toBeNull()
    expect(render(<ProgressMeter done={1} target={null} />).container.innerHTML).toBe('')
  })
})

describe('DueTag, nhãn KPI, chấm đỏ trên tab', () => {
  it('quá hạn đỏ, chưa tới chữ thường', () => {
    render(<><DueTag days={4} late /><DueTag days={0} /><DueTag days={5} /></>)
    expect(screen.getByText('Quá 4 ngày')).toHaveClass('ds-due--late')
    expect(screen.getByText('Hôm nay')).not.toHaveClass('ds-due--late')
    expect(screen.getByText('Còn 5 ngày')).toBeInTheDocument()
  })
  it('badge KPI cỡ lớn', () => {
    render(<StatusBadge group="kpi" value="BEHIND" size="lg" />)
    expect(screen.getByText('Chậm tiến độ').closest('.ds-badge')).toHaveClass('ds-badge--lg', 'ds-badge--error')
  })
  it('tab có dot thì có chấm đỏ', () => {
    const { container } = render(<StatusTabs value="a" tabs={[{ value: 'a', label: 'A', count: 2, dot: true }, { value: 'b', label: 'B', count: 1 }]} />)
    expect(container.querySelectorAll('.ds-tabs-boxed__dot')).toHaveLength(1)
  })
})
