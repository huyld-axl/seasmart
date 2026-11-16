import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import MoneyInput from '../MoneyInput'
import NumberInput from '../NumberInput'

afterEach(cleanup)

function typeValue(input, value) {
  fireEvent.keyDown(input, { key: value.slice(-1) || 'Backspace' })
  fireEvent.change(input, { target: { value } })
  fireEvent.keyUp(input, { key: value.slice(-1) || 'Backspace' })
}

function ControlledMoney({ onChange, allowNegative = false }) {
  const [value, setValue] = useState(null)
  return <MoneyInput value={value} allowNegative={allowNegative} onChange={(next) => { setValue(next); onChange(next) }} />
}

it('groups money while focused and preserves decimal typing, numeric values and clearing', () => {
  const onChange = vi.fn()
  render(<ControlledMoney onChange={onChange} />)
  const input = screen.getByRole('spinbutton')
  fireEvent.focus(input)
  typeValue(input, '1000000000')
  expect(input).toHaveValue('1.000.000.000')
  expect(onChange).toHaveBeenLastCalledWith(1000000000)
  typeValue(input, '1.234,')
  expect(input).toHaveValue('1.234,')
  typeValue(input, '1.234,50')
  expect(input).toHaveValue('1.234,50')
  expect(onChange).toHaveBeenLastCalledWith(1234.5)
  typeValue(input, '')
  expect(input).toHaveValue('')
  expect(onChange).toHaveBeenLastCalledWith(null)
})

it('keeps negative adjustment amounts and formats pasted values', () => {
  const onChange = vi.fn()
  render(<ControlledMoney allowNegative onChange={onChange} />)
  const input = screen.getByRole('spinbutton')
  fireEvent.focus(input)
  typeValue(input, '-1234567,80')
  expect(input).toHaveValue('-1.234.567,80')
  expect(onChange).toHaveBeenLastCalledWith(-1234567.8)
})

it('groups measurement values while retaining decimal precision', () => {
  const onChange = vi.fn()
  render(<NumberInput onChange={onChange} />)
  const input = screen.getByRole('spinbutton')
  fireEvent.focus(input)
  typeValue(input, '123456,789')
  expect(input).toHaveValue('123.456,789')
  expect(onChange).toHaveBeenLastCalledWith(123456.789)
})