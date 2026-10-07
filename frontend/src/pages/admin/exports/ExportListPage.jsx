import { useNavigate } from 'react-router-dom'
import { Button } from 'antd'
import { RightOutlined } from '@ant-design/icons'
import StatusBadge from '../../../components/ds/StatusBadge'
import { EmptyState } from '../../../components/ds/Controls'
import { template } from './packModel'
import { signProgress, usePacks } from './packStore'
import '../seafarers/SeafarerListPage.css'
import './exports.css'

// Bản xuất: các bộ giấy đã tạo. Bản đầy đủ (C1: tab trạng thái, lọc) làm ở nhóm C.
export default function ExportListPage() {
  const navigate = useNavigate()
  const packs = usePacks()
  return (
    <div className="ds-page">
      <div className="ds-page__head">
        <div>
          <h1 className="ds-page__title">Bản xuất</h1>
          <p className="ds-page__desc">Các bộ giấy đã tạo cho thuyền viên, kèm trạng thái duyệt và ký. Bộ giấy tạo từ hồ sơ một thuyền viên.</p>
        </div>
      </div>
      <div className="ds-card">
        {packs.length ? (
          <ul className="crew-list">
            {packs.map((pack) => {
              const progress = signProgress(pack)
              return (
                <li key={pack.id}>
                  <button type="button" className="crew-list__row ex-row" onClick={() => navigate(`/exports/${pack.id}`)}>
                    <span className="ds-cell2">
                      <span className="ds-cell2__main">{pack.title} · {pack.seafarerName}</span>
                      <span className="ds-cell2__sub">#{pack.id} · {pack.docs.map((key) => template(key).name).join(', ')}</span>
                    </span>
                    <span className="ex-row__end">
                      <StatusBadge group="export" value={pack.status} />
                      {progress.total > 0 && <span className="ds-num rv-muted">Ký {progress.done}/{progress.total}</span>}
                      <RightOutlined className="crew-chevron" aria-hidden />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState title="Chưa có bộ giấy nào" description="Bộ giấy được tạo từ hồ sơ một thuyền viên." action={<Button onClick={() => navigate('/seafarers')}>Mở danh sách thuyền viên</Button>} />
        )}
      </div>
    </div>
  )
}
