import { Button } from 'antd'
import { BellOutlined, CloseOutlined, EditOutlined, SyncOutlined } from '@ant-design/icons'
import { DownloadIcon } from './TransferIcons'
import StatusBadge from './StatusBadge'
import './ds.css'

// Bảng chứng chỉ của thuyền viên (T5, tab Chứng chỉ). Rộng thì bảng, hẹp thì thẻ.
// cert: { id, name, category, number, issuedOn, expiresOn ('' = không thời hạn), status (khoá statusMap.cert),
//         alert ('expired' | 'expiring' | null), muted (cảnh báo đã tắt), daysLeft, canRenew, hasFile, replaced (đã có bản mới thay: xuống cuối, màu xám) }
// `thumb(cert)` (tuỳ chọn) vẽ ảnh thu nhỏ trước tên; có ảnh thì bỏ link "Xem bản gốc" (bấm ảnh để xem).
// Hết hạn đánh dấu viền trái đỏ, sắp hết hạn viền vàng; dòng có cảnh báo ghi "Còn N ngày" / "Quá hạn N ngày" và nút tắt.
const alertText = (cert) => {
  if (cert.alert === 'expired') return `Quá hạn ${-cert.daysLeft} ngày`
  return cert.daysLeft === 0 ? 'Hết hạn hôm nay' : `Còn ${cert.daysLeft} ngày`
}

// Nhãn loại giấy có màu theo nhóm (categoryKey: DOCUMENT, COMPETENCY, STCW, MEDICAL, OTHER); không có khoá thì chữ thường.
// cert.country (tuỳ chọn): nước cấp của loại giấy, hiện chữ nhỏ sau nhãn.
export const CategoryTag = ({ cert }) => (cert.category
  ? (
    <span className="ds-cat-wrap">
      <span className={`ds-cat ds-cat--${(cert.categoryKey || 'OTHER').toLowerCase()}`}>{cert.category}</span>
      {cert.country ? <span className="ds-cat-country">{cert.country}</span> : null}
    </span>
  )
  : '—')

const badge = (cert) => <StatusBadge group="cert" value={cert.replaced ? 'REPLACED' : cert.status} />

export default function CertificateTable({ certs = [], thumb, onEdit, onOpenSource, onDownload, onRenew, onDismiss, onRestore }) {
  const name = (cert) => (thumb ? <span className="ds-ctable__name">{thumb(cert)}<b>{cert.name}</b></span> : <b>{cert.name}</b>)
  const source = (cert) => (thumb || !onOpenSource || !(cert.hasFile ?? !cert.manual) ? null : <button type="button" className="ds-link" onClick={() => onOpenSource?.(cert)}>Xem bản gốc</button>)
  // Các nút chỉ hiện khi truyền handler tương ứng (theo quyền) và dòng đủ điều kiện.
  const renew = (cert) => (onRenew && cert.canRenew ? <Button type="text" size="small" icon={<SyncOutlined />} aria-label={`Cập nhật ${cert.name}`} title="Cập nhật chứng chỉ" onClick={() => onRenew(cert)} /> : null)
  const download = (cert) => (onDownload && cert.hasFile ? <Button type="text" size="small" icon={<DownloadIcon />} aria-label={`Tải ${cert.name}`} title="Tải về" onClick={() => onDownload(cert)} /> : null)
  const edit = (cert) => (onEdit ? <Button type="text" size="small" icon={<EditOutlined />} aria-label={`Xem và sửa ${cert.name}`} title="Xem và sửa" onClick={() => onEdit(cert)} /> : null)
  const alertNote = (cert) => (cert.alert ? (
    <span className={`ds-ctable__alert ds-ctable__alert--${cert.alert}`}>
      {alertText(cert)}
      <button type="button" className="ds-ctable__alert-x" aria-label={`Tắt cảnh báo ${cert.name}`} title="Tắt cảnh báo" onClick={() => onDismiss?.(cert)}><CloseOutlined /></button>
    </span>
  ) : cert.muted && onRestore ? (
    <button type="button" className="ds-ctable__alert-x ds-ctable__alert-x--restore" aria-label={`Bật lại cảnh báo ${cert.name}`} title="Bật lại cảnh báo" onClick={() => onRestore(cert)}><BellOutlined /></button>
  ) : null)
  const expires = (cert) => (cert.noExpiry ? 'Không thời hạn' : cert.expiresOn)

  return (
    <div className="ds-ctable">
      <table className="ds-ctable__table">
        <thead>
          <tr>
            <th>Tên</th>
            <th>Loại</th>
            <th>Số</th>
            <th>Cấp ngày</th>
            <th>Hết hạn</th>
            <th>Trạng thái</th>
            <th className="ds-ctable__r">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {certs.map((cert) => (
            <tr key={cert.id} data-replaced={cert.replaced ? '' : undefined} data-tone={cert.alert === 'expired' ? 'error' : cert.alert === 'expiring' ? 'warn' : ''}>
              <td>{name(cert)}</td>
              <td><CategoryTag cert={cert} /></td>
              <td className="ds-ctable__mono">{cert.number}</td>
              <td className="ds-ctable__mono">{cert.issuedOn}</td>
              <td className={cert.noExpiry ? undefined : 'ds-ctable__mono'}>{expires(cert)}</td>
              <td>
                <span className="ds-ctable__state">{badge(cert)}{alertNote(cert)}</span>
              </td>
              <td className="ds-ctable__r"><span className="ds-ctable__src">{source(cert)}{renew(cert)}{download(cert)}{edit(cert)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="ds-ccards">
        {certs.map((cert) => (
          <li key={cert.id} data-replaced={cert.replaced ? '' : undefined} data-tone={cert.alert === 'expired' ? 'error' : cert.alert === 'expiring' ? 'warn' : ''}>
            <div className="ds-ccards__top">{name(cert)}{badge(cert)}</div>
            <span className="ds-ctable__note">
              {cert.category ? <><CategoryTag cert={cert} />{' '}</> : null}<span className="ds-ctable__mono">{cert.number}</span> · Cấp {cert.issuedOn} · {cert.noExpiry ? 'Không thời hạn' : `Hết hạn ${cert.expiresOn}`}
            </span>
            {alertNote(cert)}
            <span className="ds-ctable__src">{source(cert)}{renew(cert)}{download(cert)}{edit(cert)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
