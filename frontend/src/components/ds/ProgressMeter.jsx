import './ds.css'

// Thanh tiến độ KPI (Tổng quan). done / target: phần đặc; pending: phần gạch chéo nối tiếp (việc sắp vào);
// pace: vạch đứng "tiến độ cần có hôm nay". Đã ký dưới vạch thì thanh đỏ. target null thì không vẽ gì.
export default function ProgressMeter({ done, target, pace = null, pending = 0, size = 'md' }) {
  if (target == null || target <= 0) return null
  const pct = (v) => Math.min(100, (Math.max(0, v) / target) * 100)
  const behind = pace != null && done < pace && done < target
  return (
    <span
      className={`ds-meter ds-meter--${size}${behind ? ' ds-meter--behind' : ''}`}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={target}
      aria-valuenow={done}
      aria-label={`${done} / ${target}${behind ? ', chậm tiến độ' : ''}`}
    >
      <i className="ds-meter__done" style={{ width: `${pct(done)}%` }} />
      {pending > 0 ? <i className="ds-meter__pending" style={{ left: `${pct(done)}%`, width: `${pct(done + pending) - pct(done)}%` }} /> : null}
      {pace != null ? <span className="ds-meter__pace" style={{ left: `${pct(pace)}%` }} title="Tiến độ cần có hôm nay" /> : null}
    </span>
  )
}
