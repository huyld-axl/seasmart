import './ds.css'

// Biểu đồ cột KPI theo tháng (Tổng quan). Tự vẽ bằng CSS, repo không dùng thư viện biểu đồ.
// data: [{ key, label, short?, value, projected }] — cột projected (tháng đang chạy) gạch chéo. `short`: nhãn trục ở điện thoại.
// target: đường mục tiêu nét đứt (null thì không vẽ). format: số trên đầu cột.
// Cột co theo chiều cao khung cha (đặt chiều cao cho khung hoặc để flex: 1).
export default function KpiBars({ data, target = null, format = (v) => String(v), label }) {
  const top = Math.max(...data.map((d) => d.value), target ?? 0) * 1.18 || 1
  const pct = (v) => `${(Math.max(0, v) / top) * 100}%`
  return (
    <div className="ds-kpibars" role="img" aria-label={label || data.map((d) => `${d.label}: ${format(d.value)}`).join(', ')}>
      <div className="ds-kpibars__plot">
        {target != null ? <span className="ds-kpibars__target" style={{ bottom: pct(target) }} aria-hidden /> : null}
        {data.map((d) => (
          <span key={d.key ?? d.label} className={`ds-kpibars__bar${d.projected ? ' ds-kpibars__bar--projected' : ''}`} aria-hidden>
            <i style={{ height: pct(d.value) }} />
            <b style={{ bottom: `calc(${pct(d.value)} + 4px)` }}>{format(d.value)}</b>
          </span>
        ))}
      </div>
      <div className="ds-kpibars__labels" aria-hidden>
        {data.map((d) => (
          <span key={d.key ?? d.label}>
            {d.short ? <><span className="ds-kpibars__long">{d.label}</span><span className="ds-kpibars__short">{d.short}</span></> : d.label}
          </span>
        ))}
      </div>
    </div>
  )
}
