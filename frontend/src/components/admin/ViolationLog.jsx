import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { usePolling } from './usePolling'
import { Loading, Severity, StateMessage } from './ui'
import { SEVERITY_LABELS, VIOLATION_LABELS, downloadCsv, fmtDateTime, fmtTime, slug } from './format'

// GET /exams/{id}/violations: newest first, each row carries { session: { id, student_name, student_number } }.
export default function ViolationLog({ summary }) {
  const { exam } = summary
  const { data, error, loading } = usePolling(
    (signal) => api(`/exams/${exam.id}/violations`, { signal }),
    { key: `violations:${exam.id}`, interval: 5000 },
  )
  const [type, setType] = useState('all')
  const [severity, setSeverity] = useState('all')
  const [query, setQuery] = useState('')

  const counts = useMemo(() => {
    const c = {}
    ;(data ?? []).forEach((v) => { c[v.type] = (c[v.type] ?? 0) + 1 })
    return c
  }, [data])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data ?? []).filter((v) => {
      if (type !== 'all' && v.type !== type) return false
      if (severity !== 'all' && v.severity !== severity) return false
      return !q || v.session?.student_name.toLowerCase().includes(q) || v.session?.student_number.toLowerCase().includes(q)
    })
  }, [data, type, severity, query])

  if (loading) return <Loading label="Loading violations" />
  if (!data) return <StateMessage tone="error" title="Could not load the violation log">{error?.message}</StateMessage>
  if (data.length === 0) {
    return <StateMessage title="No violations recorded">Switching tabs, leaving the window or opening a blocked app is logged here as it happens.</StateMessage>
  }

  const exportCsv = () =>
    downloadCsv(
      `${slug(exam.title)}-violations.csv`,
      ['Time', 'Student name', 'Student number', 'What happened', 'Severity', 'Details'],
      rows.map((v) => [v.created_at, v.session?.student_name, v.session?.student_number, VIOLATION_LABELS[v.type] ?? v.type, SEVERITY_LABELS[v.severity] ?? v.severity, v.details ?? '']),
    )

  return (
    <>
      <div className="adm-chips" role="group" aria-label="Filter by what happened">
        <button type="button" className={type === 'all' ? 'adm-chip is-on' : 'adm-chip'} aria-pressed={type === 'all'} onClick={() => setType('all')}>
          All <b>{data.length}</b>
        </button>
        {Object.keys(VIOLATION_LABELS).filter((t) => counts[t]).map((t) => (
          <button key={t} type="button" className={type === t ? 'adm-chip is-on' : 'adm-chip'} aria-pressed={type === t} onClick={() => setType(type === t ? 'all' : t)}>
            {VIOLATION_LABELS[t]} <b>{counts[t]}</b>
          </button>
        ))}
      </div>

      <div className="adm-toolbar">
        <label className="adm-field adm-field-inline">
          <span className="adm-sr">Search students</span>
          <input type="search" placeholder="Search name or student number" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label className="adm-field adm-field-inline">
          <span className="adm-sr">Filter by severity</span>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="all">Every severity</option>
            {Object.entries(SEVERITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <button type="button" className="adm-btn adm-toolbar-end" onClick={exportCsv} disabled={rows.length === 0}>Export CSV</button>
      </div>

      <div className="adm-tablewrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Student</th>
              <th scope="col">What happened</th>
              <th scope="col">Severity</th>
              <th scope="col">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id}>
                <td title={fmtDateTime(v.created_at)}>{fmtTime(v.created_at)}</td>
                <td>
                  {v.session ? <Link to={`/admin/sessions/${v.session.id}`} className="adm-rowlink">{v.session.student_name}</Link> : 'Unknown'}
                  {v.session && <span className="adm-cell-sub adm-mono">{v.session.student_number}</span>}
                </td>
                <td>{VIOLATION_LABELS[v.type] ?? v.type}</td>
                <td><Severity level={v.severity} /></td>
                <td>{v.details || <span className="adm-faint">-</span>}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="adm-empty-row">No violations match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}