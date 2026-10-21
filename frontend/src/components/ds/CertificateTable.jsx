import { Button } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import StatusBadge from './StatusBadge'
import './ds.css'

// Bảng chứng chỉ của thuyền viên (T5, tab Chứng chỉ). Rộng thì bảng, hẹp thì thẻ.
// cert: { id, name, number, issuedOn, expiresOn, status (khoá statusMap.cert), manual }
// Chứng chỉ nhập tay ghi "Nhập tay" thay cho link bản gốc. Hết hạn đánh dấu viền trái.
export default function CertificateTable({ certs = [], onEdit, onOpenSource }) {
  const source = (cert) => (cert.manual
    ? <span className="ds-ctable__note">Nhập tay</span>
    : <button type="button" className="ds-link" onClick={() => onOpenSource?.(cert)}>Xem bản gốc</button>)
  // Nút Sửa chỉ hiện khi truyền `onEdit` (theo quyền).
  const edit = (cert) => (onEdit ? <Button type="text" size="small" icon={<EditOutlined />} aria-label={`Sửa ${cert.name}`} onClick={() => onEdit(cert)} /> : null)

  return (
    <div className="ds-ctable">
      <table className="ds-ctable__table">
        <thead>
          <tr>
            <th>Chứng chỉ</th>
            <th>Số</th>
            <th>Cấp ngày</th>
            <th>Hết hạn</th>
            <th>Trạng thái</th>
            <th className="ds-ctable__r">Nguồn</th>
          </tr>
        </thead>
        <tbody>
          {certs.map((cert) => (
            <tr key={cert.id} data-tone={cert.status === 'EXPIRED' ? 'warn' : ''}>
              <td><b>{cert.name}</b></td>
              <td className="ds-ctable__mono">{cert.number}</td>
              <td className="ds-ctable__mono">{cert.issuedOn}</td>
              <td className="ds-ctable__mono">{cert.expiresOn || '—'}</td>
              <td><StatusBadge group="cert" value={cert.status} /></td>
              <td className="ds-ctable__r"><span className="ds-ctable__src">{source(cert)}{edit(cert)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="ds-ccards">
        {certs.map((cert) => (
          <li key={cert.id}>
            <div className="ds-ccards__top"><b>{cert.name}</b><StatusBadge group="cert" value={cert.status} /></div>
            <span className="ds-ctable__note">
              <span className="ds-ctable__mono">{cert.number}</span> · Cấp {cert.issuedOn} · {cert.expiresOn ? `Hết hạn ${cert.expiresOn}` : 'Không thời hạn'}
            </span>
            <span className="ds-ctable__src">{source(cert)}{edit(cert)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
