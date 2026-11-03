import { useId } from 'react'

// Decorative companions to the adjacent, accessible numeric totals.
export function ProgressRing({ value = 0, target = 1, label, children }) {
  const progress = Math.max(0, Math.min(1, value / (target || 1)))
  return <div className="daily-ring" aria-hidden={label ? undefined : true} role={label ? 'progressbar' : undefined} aria-label={label} aria-valuemin={label ? 0 : undefined} aria-valuemax={label ? target : undefined} aria-valuenow={label ? Math.round(progress * target) : undefined}>
    <svg viewBox="0 0 100 100" aria-hidden="true"><circle className="ring-track" cx="50" cy="50" r="42" />
      <circle className="ring-value" cx="50" cy="50" r="42" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - progress * 100} />
    </svg><span aria-hidden="true">{children}</span>
  </div>
}

export function WaterGlass({ value = 0, target = 1 }) {
  const id = useId()
  const progress = Math.max(0, Math.min(1, value / (target || 1)))
  return <svg className="water-glass" viewBox="0 0 88 116" aria-hidden="true">
    <defs><clipPath id={id}><path d="M17 14h54l-5 84a10 10 0 0 1-10 9H32a10 10 0 0 1-10-9Z" /></clipPath></defs>
    <path className="glass-body" d="M17 14h54l-5 84a10 10 0 0 1-10 9H32a10 10 0 0 1-10-9Z" />
    <g clipPath={`url(#${id})`}><g className="glass-fill" style={{ transform: `translateY(${117 - progress * 110}px)` }}>
      <path d="M10 0Q28-8 44 0T78 0V120H10Z" fill="currentColor" opacity=".6" />
      <path d="M10 4Q28 12 44 4T78 4V120H10Z" fill="currentColor" opacity=".5" />
    </g></g>
    <path className="glass-outline" d="M17 14h54l-5 84a10 10 0 0 1-10 9H32a10 10 0 0 1-10-9Z" />
    <path d="M27 27l3 59" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".4" />
  </svg>
}
