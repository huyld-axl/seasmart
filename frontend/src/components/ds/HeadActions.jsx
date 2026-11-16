import { Children, isValidElement } from 'react'
import { Button, Dropdown, Tooltip } from 'antd'
import { MoreOutlined } from '@ant-design/icons'
import useViewport from '../../hooks/useViewport'
import './ds.css'

// Hàng nút ở đầu trang chi tiết (kế hoạch responsive mục 4.4). Desktop: render y như các nút truyền vào.
// Điện thoại (< 640px): luôn một hàng — nút ⋯ + nút chính (type primary, hoặc nút có data-main, không có thì nút cuối) + tối đa một nút nữa khi
// cả hai chữ đủ ngắn; các nút còn lại vào menu ⋯ (gộp với menu ⋯ sẵn có). Không bao giờ rớt hàng 2 + 1.
const SHORT_LABEL = 12 // số ký tự tối đa để hai nút cùng hàng không bị cắt chữ ở 375px

const textOf = (node) => {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  return isValidElement(node) ? textOf(node.props.children) : ''
}
// Nút có thể được bọc Tooltip (nút khoá kèm lý do): lấy nút bên trong để đọc nhãn, icon, onClick.
const buttonOf = (element) => (element.type === Tooltip ? element.props.children : element)

const containsKey = (items, key) => items?.some((item) => item && (item.key === key || containsKey(item.children, key)))
// Menu con mở ngang dễ tràn màn hình điện thoại; giữ các lựa chọn trong cùng menu cuộn dọc.
const mobileItems = (items) => items.map((item) => item?.children
  ? { ...item, type: 'group', children: mobileItems(item.children) }
  : item)

export default function HeadActions({ children }) {
  const { isPhone } = useViewport()
  const elements = Children.toArray(children).filter(isValidElement)
  if (!isPhone) return <div className="crew-head__actions">{elements}</div>

  const menus = elements.filter((element) => element.type === Dropdown)
  const buttons = elements.filter((element) => element.type !== Dropdown)
  const isMain = (element) => buttonOf(element).props.type === 'primary' || buttonOf(element).props['data-main']
  const found = buttons.findIndex(isMain)
  const primaryIndex = found >= 0 ? found : buttons.length - 1
  const primary = buttons[primaryIndex]
  const neighbor = primary ? buttons[primaryIndex - 1] || buttons[primaryIndex + 1] : null
  const labelLength = (element) => textOf(buttonOf(element).props.children).length
  const fitsTwo = Boolean(neighbor) && labelLength(primary) <= SHORT_LABEL && labelLength(neighbor) <= SHORT_LABEL
  const shown = buttons.filter((element) => element === primary || (fitsTwo && element === neighbor))
  const moved = buttons.filter((element) => !shown.includes(element))

  const movedItems = moved.map((element, index) => {
    const { icon, danger, disabled, onClick, children: label } = buttonOf(element).props
    return { key: `head-${index}`, icon, danger, disabled, label: textOf(label), onClick }
  })
  const existing = menus.flatMap((element) => element.props.menu?.items || [])
  const items = [...movedItems.map((item) => ({ key: item.key, icon: item.icon, danger: item.danger, disabled: item.disabled, label: item.label })), ...mobileItems(existing)]
  const onMenu = (info) => {
    const hit = movedItems.find((item) => item.key === info.key)
    if (hit) return hit.onClick?.()
    return menus.find((element) => containsKey(element.props.menu?.items, info.key))?.props.menu.onClick?.(info)
  }

  return (
    <div className="crew-head__actions">
      {items.length ? (
        <Dropdown menu={{ items, onClick: onMenu, style: { maxHeight: '60dvh', overflowY: 'auto' } }} trigger={['click']} placement="bottomLeft">
          <Button icon={<MoreOutlined />} aria-label="Thao tác khác" />
        </Dropdown>
      ) : null}
      {shown}
    </div>
  )
}
