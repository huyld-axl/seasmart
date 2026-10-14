import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Checkbox, Skeleton, Tooltip } from 'antd'
import { exportApi } from '../../../api/exportApi'
import { EmptyState } from '../../../components/ds/Controls'
import useExportPrefsStore from '../../../stores/exportPrefsStore'
import { pxToPt, readCell, toHex, writeCell } from './cellEdit'
import EditToolbar from './EditToolbar'
import './exports.css'

// Kiểu chèn vào trang giấy trong iframe: đường lưới và chế độ sửa (không ảnh hưởng file xuất).
const SHEET_CSS = `
html.grid td{box-shadow:inset 0 0 0 .5px #c4c4cc}
html.edit td[data-cell]{cursor:text}
html.edit td[data-cell]:hover{outline:1px dashed #71717a;outline-offset:-1px}
html.edit td[data-cell]:focus{outline:2px solid #003366;outline-offset:-1px;background:#fff}
html.edit td.ed{background:#fff4d6 !important;box-shadow:inset 0 -2px 0 #b45309}
`
const key = (value) => JSON.stringify(value)
const NATIVE = { bold: 'bold', italic: 'italic', underline: 'underline', strike: 'strikeThrough' }
// Dấu trạng thái ô lúc bắt đầu sửa: nội dung và căn lề (đổi căn lề không đổi nội dung).
const snapshot = (td) => `${td.innerHTML}\u0000${td.style.textAlign}`

// Xem trước một giấy đúng như file sẽ xuất: máy chủ điền file mẫu thật rồi trả về HTML.
// Chưa chọn thuyền viên thì ra mẫu trống.
// editable: bấm vào ô bất kỳ để sửa tay, có thanh định dạng kiểu WordPress (EditToolbar).
// edits = { 'B7': giá trị } của giấy này (giá trị: xem cellEdit.js); onEdit(ô, giá trị | null).
export default function FormPreview({ docKey, seafarerId, shipOwnerId, inputs = {}, edits = {}, editable = false, onEdit, label }) {
  const box = useRef(null)
  const frame = useRef(null)
  const original = useRef(new Map()) // ô → { html, value, align } máy chủ trả về, để bỏ sửa
  const latest = useRef({})
  const selection = useRef(null) // { td, range }: chỗ bôi đen gần nhất trong ô, để thanh định dạng dùng lại khi tiêu điểm đã rời trang giấy
  const [active, setActive] = useState(null)
  const [boxWidth, setBoxWidth] = useState(0)
  const [sheetHeight, setSheetHeight] = useState(0)
  const [typed, setTyped] = useState(inputs)
  const gridlines = useExportPrefsStore((state) => state.gridlines)
  const setGridlines = useExportPrefsStore((state) => state.setGridlines)
  const inputsKey = JSON.stringify(inputs)
  const editsKey = JSON.stringify(edits)
  useEffect(() => { latest.current = { edits, editable, onEdit, gridlines } })

  // Chờ người dùng ngừng gõ thông tin điền thêm rồi mới dựng lại.
  useEffect(() => {
    const timer = setTimeout(() => setTyped(JSON.parse(inputsKey)), 400)
    return () => clearTimeout(timer)
  }, [inputsKey])

  useLayoutEffect(() => {
    if (!box.current) return undefined
    const observer = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width))
    observer.observe(box.current)
    return () => observer.disconnect()
  }, [])

  // Đang sửa thì ô sửa tay vẽ ngay trên trang (không tải lại, không mất chỗ đang gõ); chỉ xem thì máy chủ điền như lúc xuất.
  const body = {
    template_key: docKey, seafarer_id: seafarerId ? Number(seafarerId) : null, ship_owner_id: shipOwnerId ? Number(shipOwnerId) : null,
    inputs: typed, edits: editable ? undefined : JSON.parse(editsKey),
  }
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['export-preview', body],
    queryFn: () => exportApi.preview(body),
    placeholderData: (previous) => previous,
    staleTime: 30000,
    retry: false,
  })

  // Vẽ đường lưới, ô sửa tay lên trang giấy và bật/tắt cho gõ vào ô.
  function paint() {
    const doc = frame.current?.contentDocument
    if (!doc?.body) return
    const { edits: current = {}, editable: on, gridlines: grid } = latest.current
    doc.documentElement.classList.toggle('grid', !!grid)
    doc.documentElement.classList.toggle('edit', !!on)
    if (!on) return
    doc.querySelectorAll('td[data-cell]').forEach((td) => {
      const address = td.dataset.cell
      if (!original.current.has(address)) {
        const align = td.style.textAlign
        original.current.set(address, { html: td.innerHTML, value: readCell(td, align), align })
      }
      const base = original.current.get(address)
      if (!td.isContentEditable) td.contentEditable = 'true'
      if (current[address] !== undefined) {
        if (doc.activeElement !== td && td.dataset.shown !== key(current[address])) {
          writeCell(td, current[address], base.align)
          td.dataset.shown = key(current[address])
        }
        td.classList.add('ed')
      } else if (td.classList.contains('ed')) {
        td.innerHTML = base.html
        td.style.textAlign = base.align
        td.classList.remove('ed')
        delete td.dataset.shown
      }
    })
  }
  const measure = () => setSheetHeight(frame.current?.contentDocument?.body?.scrollHeight || 0)

  function commit(td) {
    const { edits: current = {}, editable: on, onEdit: report } = latest.current
    const address = td.dataset.cell
    const base = original.current.get(address)
    if (!on || !base) return
    const original = () => { td.innerHTML = base.html; td.style.textAlign = base.align }
    const restore = () => {
      if (current[address] === undefined) original()
      else writeCell(td, current[address], base.align)
    }
    const untouched = snapshot(td) === td.dataset.before
    delete td.dataset.before
    if (td.dataset.cancel) { delete td.dataset.cancel; restore(); return }
    if (untouched) return
    const value = readCell(td, base.align)
    if (key(value) === key(current[address] ?? base.value)) return
    td.dataset.shown = key(value)
    if (key(value) === key(base.value)) original()
    report?.(address, key(value) === key(base.value) ? null : value)
    measure()
  }

  function onLoad(event) {
    const doc = event.target.contentDocument
    original.current = new Map()
    if (!doc?.body) return
    const style = doc.createElement('style')
    style.textContent = SHEET_CSS
    doc.head.appendChild(style)
    if (editable) {
      const cellOf = (e) => e.target.closest?.('td[data-cell]')
      doc.addEventListener('focusin', (e) => { const td = cellOf(e); if (td) td.dataset.before = snapshot(td) })
      doc.addEventListener('selectionchange', () => track(doc))
      doc.addEventListener('focusout', (e) => { if (cellOf(e)) commit(cellOf(e)) })
      // Dán từ nơi khác: chỉ lấy chữ, bỏ định dạng lạ.
      doc.addEventListener('paste', (e) => {
        if (!cellOf(e)) return
        e.preventDefault()
        doc.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
      })
      doc.addEventListener('keydown', (e) => {
        const td = cellOf(e)
        if (!td) return
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); td.blur() }
        if (e.key === 'Escape') { td.dataset.cancel = '1'; td.blur() }
      })
    }
    paint()
    measure()
  }

  useEffect(() => {
    paint()
    const raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  }, [editsKey, gridlines])

  // Nhớ chỗ bôi đen trong ô và đọc định dạng tại đó để thanh công cụ sáng đúng nút.
  function track(doc) {
    const sel = doc.getSelection()
    const node = sel?.rangeCount ? sel.anchorNode : null
    const el = node?.nodeType === 3 ? node.parentElement : node
    const td = el?.closest?.('td[data-cell]')
    if (!td) {
      // Tiêu điểm rời trang giấy (bấm lên thanh công cụ) thì giữ ô cũ; bấm ra chỗ khác trên giấy thì thôi.
      if (doc.hasFocus()) { selection.current = null; setActive(null) }
      return
    }
    selection.current = { td, range: sel.getRangeAt(0).cloneRange() }
    const style = doc.defaultView.getComputedStyle(el)
    setActive({
      cell: td.dataset.cell,
      bold: doc.queryCommandState('bold'),
      italic: doc.queryCommandState('italic'),
      underline: doc.queryCommandState('underline'),
      strike: doc.queryCommandState('strikeThrough'),
      align: td.style.textAlign || doc.defaultView.getComputedStyle(td).textAlign,
      size: pxToPt(style.fontSize),
      color: toHex(style.color),
    })
  }

  // Lệnh của thanh định dạng trên ô đang sửa. Chưa bôi đen chữ thì áp cho cả ô.
  function command(name, value) {
    const doc = frame.current?.contentDocument
    const td = selection.current?.td
    if (!doc || !td?.isConnected) return
    const sel = doc.getSelection()
    if (doc.activeElement !== td) {
      td.focus()
      const range = selection.current.range
      sel.removeAllRanges()
      if (td.contains(range.startContainer) && td.contains(range.endContainer)) sel.addRange(range)
      else { const all = doc.createRange(); all.selectNodeContents(td); sel.addRange(all) }
    }
    if (['undo', 'redo'].includes(name)) { doc.execCommand(name); track(doc); return }
    if (name === 'align') { td.style.textAlign = value; track(doc); return }
    if (sel.isCollapsed) { const all = doc.createRange(); all.selectNodeContents(td); sel.removeAllRanges(); sel.addRange(all) }
    if (NATIVE[name]) doc.execCommand(NATIVE[name])
    else if (name === 'color') {
      doc.execCommand('styleWithCSS', false, true)
      doc.execCommand('foreColor', false, value)
    } else if (name === 'size') {
      // Trình duyệt chỉ có 7 cỡ chữ: đánh dấu bằng cỡ 7 rồi đổi sang đúng số pt.
      doc.execCommand('styleWithCSS', false, false)
      doc.execCommand('fontSize', false, '7')
      td.querySelectorAll('font[size="7"]').forEach((font) => {
        const span = doc.createElement('span')
        span.style.fontSize = `${value}pt`
        span.append(...font.childNodes)
        font.replaceWith(span)
      })
    } else if (name === 'clear') {
      doc.execCommand('removeFormat')
      td.querySelectorAll('[style]').forEach((el) => el.removeAttribute('style'))
      td.style.textAlign = original.current.get(td.dataset.cell)?.align || ''
    }
    track(doc)
  }

  let content
  if (isError) {
    const missing = error.response?.status === 404
    content = (
      <EmptyState
        isError={!missing}
        title={missing ? error.response.data?.error || 'Giấy này chưa có file mẫu' : 'Không dựng được bản xem trước'}
        description={missing ? 'Giấy vẫn nằm trong bộ; khi tải về sẽ ghi vào danh sách chưa xuất được.' : 'Mất kết nối tới máy chủ.'}
        action={missing ? null : <Button onClick={() => refetch()}>Thử lại</Button>}
      />
    )
  } else if (isLoading || !data) {
    content = <Skeleton active title={false} paragraph={{ rows: 12 }} />
  } else {
    const scale = boxWidth ? Math.min(1, boxWidth / data.width) : 1
    content = (
      <div className="fp__page" style={{ width: data.width * scale, height: sheetHeight * scale }}>
        {/* Nội dung do máy chủ dựng và đã escape. Chế độ sửa cần allow-scripts để trình duyệt chạy sự kiện gõ trong iframe. */}
        <iframe
          key={editable ? 'edit' : 'view'}
          ref={frame}
          title={label || 'Xem trước giấy'}
          sandbox={editable ? 'allow-same-origin allow-scripts' : 'allow-same-origin'}
          srcDoc={data.html}
          className="fp__sheet"
          style={{ width: data.width, height: sheetHeight || 400, transform: `scale(${scale})` }}
          onLoad={onLoad}
        />
      </div>
    )
  }

  return (
    <div className="fp-wrap">
      <div className="fp__tools">
        <Tooltip title="Như trong Excel. Áp dụng cho cả bản xem trước và file PDF, Excel tải về.">
          <Checkbox className="fp__grid" checked={gridlines} onChange={(event) => setGridlines(event.target.checked)}>Hiện đường lưới</Checkbox>
        </Tooltip>
      </div>
      {editable && <EditToolbar active={active} onCommand={command} />}
      <div className={editable ? 'fp fp--edit' : 'fp'}>
        <div ref={box}>{content}</div>
      </div>
    </div>
  )
}
