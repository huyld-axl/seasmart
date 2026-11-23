// Báo cáo tháng (docs/mcah-ke-hoach-bao-cao.md). Một chỗ khai báo cột cho cả bảng trên màn hình và file Excel.
// Chỉ cột có trong mẫu gốc (Q6). Một cột: key (tên trường của dòng), label, group (tiêu đề tầng trên), type: text | date | money | int | percent,
// detail: một trong 14 khoản (ẩn trên màn khi tắt "Hiện 14 khoản"), merge: 'day' | 'owner' (gộp ô), sticky: cột dính, link: loại trang chi tiết,
// strong: cột kết quả làm nổi (nền nhạt, chữ đậm) trên màn và trong Excel.
const { DEFAULT_ITEMS } = require('./voyage_contract')

// Thứ tự hiện trên màn và thứ tự sheet khi xuất cả 4: Dữ liệu tổng hợp đầu tiên.
const REPORT_KEYS = ['base', 'sales', 'cost', 'cashflow']

const itemColumns = (prefix, group) => DEFAULT_ITEMS.map((item) => ({ key: `${prefix}_${item.code}`, label: item.name, group, type: 'money', detail: true }))

// Phải thu / Phải chi theo đối tác (取引先別売上表 / 仕入表): cùng cột.
const ownerColumns = () => [
  { key: 'no', label: 'STT', type: 'int' },
  { key: 'month', label: 'Tháng', type: 'text' },
  { key: 'ship_owner_name', label: 'Đối tác', type: 'text', sticky: true, link: 'partner' },
  { key: 'monthly', label: 'Khoản hằng tháng', type: 'money' },
  { key: 'one_time', label: 'Khoản một lần', type: 'money' },
  { key: 'total', label: 'Tổng', type: 'money' },
  { key: 'headcount', label: 'Số thuyền viên', type: 'int' },
  { key: 'share', label: 'Tỷ lệ số người', type: 'percent' },
]

const G_INFO = 'Thông tin hợp đồng'
const G_BILL = 'Yêu cầu thanh toán'
const G_PAY = 'Trả lương'
const G_RTERM = 'Điều kiện phải thu'
const G_PTERM = 'Điều kiện phải chi'

// Điều kiện một bên của hợp đồng: kỳ thanh toán + 14 khoản tiền ghi trong hợp đồng áp vào kỳ này (dự kiến).
const termColumns = (prefix, group, side) => [
  { key: `${prefix}_closing`, label: 'Chốt sổ', group, type: 'text' },
  { key: `${prefix}_pay`, label: 'Ngày thanh toán', group, type: 'text' },
  { key: `${prefix}_holiday`, label: 'Gặp ngày nghỉ', group, type: 'text' },
  ...itemColumns(`${prefix}i`, group),
  { key: `${prefix}i_monthly`, label: `${side} hằng tháng`, group, type: 'money' },
  { key: `${prefix}i_one_time`, label: `${side} một lần`, group, type: 'money' },
  { key: `${prefix}i_total`, label: `${side} tổng`, group, type: 'money' },
]

const REPORTS = {
  sales: { title: 'Phải thu theo đối tác', sheet: 'Phai thu', totalLabelKey: 'ship_owner_name', columns: ownerColumns() },
  cost: { title: 'Phải chi theo đối tác', sheet: 'Phai chi', totalLabelKey: 'ship_owner_name', columns: ownerColumns() },
  // Lịch thu chi (入出金予定表): bỏ 手数料, gộp 支払先 + 対象 thành Thuyền viên. Không cột trạng thái.
  cashflow: {
    title: 'Lịch thu chi',
    sheet: 'Lich thu chi',
    totalLabelKey: 'due_date',
    columns: [
      { key: 'no', label: 'STT', type: 'int' },
      { key: 'due_date', label: 'Hạn thu', type: 'date' },
      { key: 'day_total', label: 'Gộp thu', type: 'money', merge: 'day' },
      { key: 'ship_owner_name', label: 'Nguồn thu', type: 'text', link: 'partner' },
      { key: 'owner_total', label: 'Thu theo đối tác', type: 'money', merge: 'owner' },
      { key: 'payable_due_date', label: 'Hạn trả', type: 'date' },
      { key: 'seafarer_name', label: 'Người nhận tiền', type: 'text', link: 'seafarer' },
      { key: 'pic_name', label: 'Phụ trách', type: 'text' },
      { key: 'receivable', label: 'Thu kỳ này', type: 'money' },
      { key: 'payable', label: 'Trả kỳ này', type: 'money' },
      { key: 'margin', label: 'Lãi gộp', type: 'money' },
      { key: 'period_start', label: 'Kỳ từ', type: 'date' },
      { key: 'period_end', label: 'Kỳ đến', type: 'date' },
    ],
  },
  // Dữ liệu tổng hợp (売上管理基礎データ): tiêu đề hai tầng theo nhóm. Thực tế lấy từ yêu cầu thanh toán và trả lương;
  // dự kiến lấy từ khoản tiền ghi trong hợp đồng (khoản hằng tháng mọi kỳ, khoản một lần chỉ kỳ 1, như khi sinh bill).
  base: {
    title: 'Dữ liệu tổng hợp',
    sheet: 'Du lieu tong hop',
    totalLabelKey: 'contract_number',
    columns: [
      { key: 'month', label: 'Tháng', group: G_INFO, type: 'text', sticky: true },
      { key: 'contract_number', label: 'Số hợp đồng', group: G_INFO, type: 'text', sticky: true, link: 'contract' },
      { key: 'pic_name', label: 'Phụ trách', group: G_INFO, type: 'text' },
      { key: 'vessel_name', label: 'Tàu', group: G_INFO, type: 'text' },
      { key: 'ship_owner_name', label: 'Đối tác', group: G_INFO, type: 'text', link: 'partner' },
      { key: 'seafarer_name', label: 'Thuyền viên', group: G_INFO, type: 'text', link: 'seafarer' },
      { key: 'contract_start', label: 'Ngày bắt đầu HĐ', group: G_INFO, type: 'date' },
      { key: 'contract_end', label: 'Ngày kết thúc HĐ', group: G_INFO, type: 'date' },
      { key: 'period_start', label: 'Kỳ từ', group: G_BILL, type: 'date' },
      { key: 'period_end', label: 'Kỳ đến', group: G_BILL, type: 'date' },
      ...itemColumns('thu', G_BILL),
      { key: 'thu_monthly', label: 'Thu hằng tháng', group: G_BILL, type: 'money' },
      { key: 'thu_one_time', label: 'Thu một lần', group: G_BILL, type: 'money' },
      { key: 'thu_total', label: 'Thu tổng', group: G_BILL, type: 'money' },
      ...itemColumns('tra', G_PAY),
      { key: 'tra_monthly', label: 'Trả hằng tháng', group: G_PAY, type: 'money' },
      { key: 'tra_one_time', label: 'Trả một lần', group: G_PAY, type: 'money' },
      { key: 'tra_total', label: 'Trả tổng', group: G_PAY, type: 'money' },
      { key: 'margin', label: 'Lãi thực tế', type: 'money', strong: true, hint: 'Yêu cầu thanh toán trừ trả lương' },
      ...termColumns('r', G_RTERM, 'Phải thu'),
      ...termColumns('p', G_PTERM, 'Phải chi'),
      { key: 'planned_margin', label: 'Lãi gộp dự kiến', type: 'money', strong: true, hint: 'Phải thu trừ phải chi theo hợp đồng' },
    ],
  },
}

module.exports = { REPORT_KEYS, REPORTS }
