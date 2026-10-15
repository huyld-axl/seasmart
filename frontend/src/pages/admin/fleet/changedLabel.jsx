// Nhãn của trường đã sửa so với giá trị gốc: thêm chip "Đã sửa" cạnh nhãn.
export default function changedLabel(label, changed) {
  return changed ? <>{label}<span className="sf-chip">Đã sửa</span></> : label
}
