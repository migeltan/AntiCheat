import { useEffect, useRef, useState } from 'react'
import { REASON_LABELS, SEVERITY_LABELS, STATUS_LABELS, fmtAgo } from './format'
import { useNow } from '../../hooks/useNow'

export function StatusBadge({ status, reason }) {
  return (
    <span className={`adm-badge adm-badge-${status}`} title={reason ? REASON_LABELS[reason] : undefined}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

export function ExamStatus({ status }) {
  return <span className={`adm-badge adm-badge-exam-${status}`}>{status === 'published' ? 'Published' : 'Draft'}</span>
}

export function Severity({ level }) {
  return <span className={`adm-sev adm-sev-${level}`}>{SEVERITY_LABELS[level] ?? level}</span>
}

// One pip per allowed violation. Filled pips = violations so far.
export function StrikePips({ count, max }) {
  const total = Math.max(max || 0, 1)
  const filled = Math.min(count, total)
  const tone = count >= total ? 'over' : count > 0 ? 'some' : 'none'
  return (
    <span className={`adm-pips adm-pips-${tone}`} role="img" aria-label={`${count} of ${total} violations allowed`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < filled ? 'adm-pip is-on' : 'adm-pip'} />
      ))}
    </span>
  )
}

// Exam code in monospace with a copy button.
export function CodeChip({ code }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard blocked (http, permissions): the code is still selectable text
    }
  }

  return (
    <span className="adm-code">
      <span className="adm-code-text">{code}</span>
      <button type="button" className="adm-code-copy" onClick={copy} aria-label={`Copy exam code ${code}`}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  )
}

export function StateMessage({ title, children, action, tone = 'neutral' }) {
  return (
    <div className={`adm-state adm-state-${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

export function Loading({ label = 'Loading' }) {
  return (
    <div className="adm-loading" role="status">
      <span className="adm-spinner" aria-hidden="true" />
      {label}
    </div>
  )
}

// "Updated 4 s ago" + refresh button. Turns into a warning if the last refresh failed.
export function Freshness({ updatedAt, error, onRefresh }) {
  const now = useNow(1000)
  return (
    <div className="adm-fresh" role="status">
      {error ? (
        <span className="adm-fresh-bad">Connection lost. Showing the last data from {fmtAgo(updatedAt, now) || 'earlier'}.</span>
      ) : (
        <span>{updatedAt ? `Updated ${fmtAgo(updatedAt, now)}` : 'Loading'}</span>
      )}
      <button type="button" className="adm-btn adm-btn-quiet" onClick={onRefresh}>
        Refresh
      </button>
    </div>
  )
}