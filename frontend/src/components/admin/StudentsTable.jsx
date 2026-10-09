import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { StateMessage, StatusBadge, StrikePips } from './ui'
import { REASON_LABELS, STATUS_LABELS, downloadCsv, fmtDateTime, fmtMinutes, slug } from './format'

const minutesBetween = (a, b) => (a && b ? Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 60000)) : null)

export default function StudentsTable({ summary }) {
  const { exam, totals, students } = summary
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [flaggedOnly, setFlaggedOnly] = useState(false)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return students
      .filter((s) => (status === 'all' || s.status === status) && (!flaggedOnly || s.violation_count > 0))
      .filter((s) => !q || s.student_name.toLowerCase().includes(q) || s.student_number.toLowerCase().includes(q))
      .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))
  }, [students, query, status, flaggedOnly])

  if (students.length === 0) {
    return <StateMessage title="No students yet">Once someone starts this exam, they appear here with their progress and violations.</StateMessage>
  }

  const exportCsv = () =>
    downloadCsv(
      `${slug(exam.title)}-students.csv`,
      ['Student name', 'Student number', 'Status', 'How it ended', 'Started', 'Submitted', 'Minutes taken', 'Questions answered', 'Violations', 'Serious violations'],
      rows.map((s) => [
        s.student_name, s.student_number, STATUS_LABELS[s.status], REASON_LABELS[s.submit_reason] ?? '',
        s.started_at, s.submitted_at ?? '', minutesBetween(s.started_at, s.submitted_at) ?? '',
        `${s.answered_count}/${totals.questions}`, s.violation_count, s.high_violation_count,
      ]),
    )

  return (
    <>
      <div className="adm-toolbar">
        <label className="adm-field adm-field-inline">
          <span className="adm-sr">Search students</span>
          <input type="search" placeholder="Search name or student number" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label className="adm-field adm-field-inline">
          <span className="adm-sr">Filter by status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Every status</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="adm-check">
          <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
          Only students with violations
        </label>
        <button type="button" className="adm-btn adm-toolbar-end" onClick={exportCsv} disabled={rows.length === 0}>Export CSV</button>
      </div>

      <div className="adm-tablewrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th scope="col">Student</th>
              <th scope="col">Status</th>
              <th scope="col">Started</th>
              <th scope="col" className="num">Time taken</th>
              <th scope="col" className="num">Answered</th>
              <th scope="col">Violations</th>
              <th scope="col"><span className="adm-sr">Review</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const taken = minutesBetween(s.started_at, s.submitted_at)
              return (
                <tr key={s.session_id}>
                  <td>
                    <Link to={`/admin/sessions/${s.session_id}`} className="adm-rowlink">{s.student_name}</Link>
                    <span className="adm-cell-sub adm-mono">{s.student_number}</span>
                  </td>
                  <td>
                    <StatusBadge status={s.status} reason={s.submit_reason} />
                    {s.submit_reason && s.status === 'auto_submitted' && <span className="adm-cell-sub">{REASON_LABELS[s.submit_reason]}</span>}
                  </td>
                  <td>{fmtDateTime(s.started_at)}</td>
                  <td className="num">{taken ? fmtMinutes(taken) : '-'}</td>
                  <td className="num">{s.answered_count} / {totals.questions}</td>
                  <td>
                    <span className="adm-vcell">
                      <StrikePips count={s.violation_count} max={exam.max_violations} />
                      <span>{s.violation_count}{s.high_violation_count > 0 && <b className="adm-serious"> · {s.high_violation_count} serious</b>}</span>
                    </span>
                  </td>
                  <td className="num"><Link to={`/admin/sessions/${s.session_id}`} className="adm-btn adm-btn-quiet">Review</Link></td>
                </tr>
              )
            })}
            {rows.length === 0 && <tr><td colSpan={7} className="adm-empty-row">No students match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}