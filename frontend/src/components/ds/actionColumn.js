// Cột chuẩn cho antd Table: dính mép phải, có kẻ trái. `buttons`: số nút trong RowActions (2 = Xem, Sửa; 3 = thêm Xoá).
// `width` ghi đè khi cột có nút chữ (vd. Tải về).
export function actionColumn(render, { buttons = 2, width } = {}) {
  return { title: 'Thao tác', key: 'actions', width: width || buttons * 28 + 40, align: 'center', fixed: 'right', className: 'ds-col-actions', render: (_, row) => render(row) }
}
