import { Button, Tooltip } from 'antd'
import { LeftOutlined, MinusOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons'
import './ds.css'

// Khung xem trang tài liệu gốc, cột trái màn duyệt (3.2.3). Chưa có mẫu đã duyệt: mượn khuôn card
// (card.md) + nút chỉ icon (small-controls.md). Bằng chứng ở mức trang (MVP không có bbox).
// `children` là ảnh trang; không truyền thì vẽ một trang sổ thuyền viên mẫu (synthetic).
// `regions` (tuỳ chọn) là các ô trên ảnh theo phần trăm [{ key, x, y, w, h }]; `activeRegion` được tô sáng,
// khớp với ô đang chọn bên phải (màn duyệt từng giấy). Cần AI trả vị trí ô; không có thì bỏ trống.
export default function DocumentViewer({
  fileName,
  page,
  pageCount,
  zoom = 100,
  evidenceLabel,
  regions = [],
  activeRegion,
  onRegionClick,
  children,
  onPrevPage,
  onNextPage,
  onZoomIn,
  onZoomOut,
}) {
  return (
    <section className="ds-viewer">
      <header className="ds-viewer__bar">
        <p className="ds-viewer__name" title={fileName}>{fileName}</p>
        <div className="ds-viewer__tools">
          <Tooltip title="Trang trước">
            <Button type="text" icon={<LeftOutlined />} aria-label="Trang trước" disabled={page <= 1} onClick={onPrevPage} />
          </Tooltip>
          <span className="ds-viewer__count">{page} / {pageCount}</span>
          <Tooltip title="Trang sau">
            <Button type="text" icon={<RightOutlined />} aria-label="Trang sau" disabled={page >= pageCount} onClick={onNextPage} />
          </Tooltip>
          <span className="ds-viewer__divider" aria-hidden />
          <Tooltip title="Thu nhỏ">
            <Button type="text" icon={<MinusOutlined />} aria-label="Thu nhỏ" onClick={onZoomOut} />
          </Tooltip>
          <span className="ds-viewer__count">{zoom}%</span>
          <Tooltip title="Phóng to">
            <Button type="text" icon={<PlusOutlined />} aria-label="Phóng to" onClick={onZoomIn} />
          </Tooltip>
        </div>
      </header>
      {evidenceLabel ? (
        <p className="ds-viewer__evidence">
          Bằng chứng cho <strong>{evidenceLabel}</strong> nằm ở trang này
        </p>
      ) : null}
      <div className="ds-viewer__stage">
        {regions.length > 0 ? (
          <div className="ds-viewer__sheet">
            {children || <SamplePage />}
            {regions.map((region) => (
              <button
                key={region.key}
                type="button"
                aria-label={`Ô ${region.label || region.key} trên bản gốc`}
                aria-pressed={region.key === activeRegion}
                className={`ds-viewer__region${region.key === activeRegion ? ' ds-viewer__region--active' : ''}`}
                style={{ left: `${region.x}%`, top: `${region.y}%`, width: `${region.w}%`, height: `${region.h}%` }}
                onClick={() => onRegionClick?.(region.key)}
              />
            ))}
          </div>
        ) : (
          children || <SamplePage />
        )}
      </div>
    </section>
  )
}

const SAMPLE_ROWS = [
  ['MV Lotus Pearl', '9163283', 'AB', '02/03/2021', '14/11/2021'],
  ['MV Halong Spirit', '9194945', 'AB', '05/01/2022', '30/09/2022'],
  ['MV Lotus Pearl', '9524454', 'AB', '24/09/2022', '░░/░░/2023'],
]

// Trang sổ thuyền viên giả: chữ máy đánh, bảng có ô viết tay, một ô mờ (UNKNOWN).
function SamplePage() {
  return (
    <div className="ds-sample-page" role="img" aria-label="Trang sổ thuyền viên mẫu, dữ liệu giả">
      <p className="ds-sample-page__title">SEAMAN'S DISCHARGE BOOK · Record of sea service</p>
      <table>
        <thead>
          <tr><th>Vessel</th><th>IMO</th><th>Rank</th><th>Sign on</th><th>Sign off</th></tr>
        </thead>
        <tbody>
          {SAMPLE_ROWS.map((row) => (
            <tr key={row.join()}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
      <p className="ds-sample-page__stamp">Master's signature &amp; stamp</p>
    </div>
  )
}
