// File Excel của Báo cáo tháng (docs/catoro-ke-hoach-bao-cao.md mục 4.4). Cùng cột, cùng số với bảng trên màn hình.
const ExcelJS = require('exceljs')

const WIDTH = { text: 22, date: 12, money: 14, int: 9, percent: 11 }
const HEAD_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDE5EF' } }
const GROUP_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2F7' } }
const thin = { style: 'thin', color: { argb: 'FFBFBFBF' } }
const BORDER = { top: thin, left: thin, bottom: thin, right: thin }

const pad = (n) => String(n).padStart(2, '0')
const toDate = (v) => {
  if (!v) return null
  const [y, m, d] = String(v).slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
const stamp = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`

function cellValue(col, v) {
  if (v == null || v === '') return null
  if (col.type === 'date') return toDate(v)
  if (col.type === 'percent') return Number(v) / 100
  if (col.type === 'money' || col.type === 'int') return Number(v)
  return String(v)
}

function styleCell(cell, col) {
  if (col.type === 'money') cell.numFmt = '#,##0.00'
  if (col.type === 'percent') cell.numFmt = '0.00%'
  if (col.type === 'date') cell.numFmt = 'dd/mm/yyyy'
  cell.border = BORDER
}

// report: kết quả reportService.build (đủ cột, kể cả 14 khoản). meta: { userName, now }.
function addSheet(wb, report, meta) {
  const ws = wb.addWorksheet(report.sheet)
  const cols = report.columns
  ws.getCell(1, 1).value = report.title
  ws.getCell(1, 1).font = { bold: true, size: 14 }
  const month = report.month ? `Tháng ${report.month.slice(5)}/${report.month.slice(0, 4)}` : 'Chưa chọn tháng'
  ws.getCell(2, 1).value = `${month} · xuất ${stamp(meta.now)}${meta.userName ? ` bởi ${meta.userName}` : ''} · USD`
  ws.getCell(2, 1).font = { color: { argb: 'FF666666' } }

  // Tiêu đề nhóm (Dữ liệu tổng hợp) ở dòng 3, gộp ô theo nhóm liền nhau; cột không thuộc nhóm gộp dòng 3–4 làm một ô tiêu đề.
  const grouped = cols.some((c) => c.group)
  const headRow = 4
  const styleHead = (cell, fill) => {
    cell.font = { bold: true }
    cell.fill = fill
    cell.border = BORDER
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  }
  if (grouped) {
    let start = 0
    cols.forEach((col, i) => {
      if (col.group && i + 1 < cols.length && cols[i + 1].group === col.group) return
      const cell = ws.getCell(3, start + 1)
      cell.value = col.group || col.label
      styleHead(cell, col.group ? GROUP_FILL : HEAD_FILL)
      if (col.group && i > start) ws.mergeCells(3, start + 1, 3, i + 1)
      if (!col.group) ws.mergeCells(3, i + 1, headRow, i + 1)
      start = i + 1
    })
  }
  cols.forEach((col, i) => {
    ws.getColumn(i + 1).width = Math.max(WIDTH[col.type] || 14, Math.min(col.label.length + 2, 30))
    if (grouped && !col.group) return
    const cell = ws.getCell(headRow, i + 1)
    cell.value = col.label
    styleHead(cell, HEAD_FILL)
  })

  report.rows.forEach((row, r) => {
    cols.forEach((col, i) => {
      const cell = ws.getCell(headRow + 1 + r, i + 1)
      cell.value = cellValue(col, row[col.key])
      styleCell(cell, col)
      // Cột lãi: chữ đậm, lãi xanh / lỗ đỏ, không tô nền.
      if (col.strong) cell.font = { bold: true, color: { argb: Number(row[col.key]) < 0 ? 'FFC10007' : 'FF007A55' } }
    })
  })
  // Gộp ô Gộp thu / Thu theo đối tác (Lịch thu chi): số ở đầu nhóm, như trên màn hình.
  cols.forEach((col, i) => {
    if (!col.merge) return
    report.rows.forEach((row, r) => {
      const span = row._span?.[col.merge] || 0
      if (span > 1) ws.mergeCells(headRow + 1 + r, i + 1, headRow + r + span, i + 1)
      if (span > 0) ws.getCell(headRow + 1 + r, i + 1).alignment = { vertical: 'top' }
    })
  })

  const totalRow = headRow + 1 + report.rows.length
  cols.forEach((col, i) => {
    const cell = ws.getCell(totalRow, i + 1)
    cell.value = cellValue(col, report.totals[col.key])
    styleCell(cell, col)
    cell.font = col.strong ? { bold: true, color: { argb: Number(report.totals[col.key]) < 0 ? 'FFC10007' : 'FF007A55' } } : { bold: true }
    cell.border = { ...BORDER, top: { style: 'medium' } }
  })

  const lastSticky = cols.reduce((last, col, i) => (col.sticky ? i + 1 : last), 0)
  ws.views = [{ state: 'frozen', xSplit: lastSticky, ySplit: headRow }]
  ws.autoFilter = { from: { row: headRow, column: 1 }, to: { row: headRow, column: cols.length } }
  return ws
}

// reports: một hoặc nhiều kết quả build. Trả Buffer .xlsx.
async function reportWorkbook(reports, meta) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Catoro'
  for (const report of reports) addSheet(wb, report, meta)
  return Buffer.from(await wb.xlsx.writeBuffer())
}

const reportFileName = (key, month) => (key === 'all' ? `Catoro_Bao-cao_${month || 'chua-chon-thang'}.xlsx` : `Catoro_Bao-cao_${key}_${month || 'chua-chon-thang'}.xlsx`)

module.exports = { reportWorkbook, reportFileName }
