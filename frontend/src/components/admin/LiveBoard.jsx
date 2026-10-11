import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { StateMessage, StrikePips } from './ui'
import { useNow } from '../../hooks/useNow'
import { deadlineOf, fmtClock, pct } from './format'

const SORTS = {
  risk: 'Most violations first',
  time: 'Least time left first',
  name: 'Name',
}

// One tile per student currently taking the exam. Strike pips show violations
// against the exam's limit; the bar along the bottom is time left.
export default function LiveBoard({ summary }) {
  const { exam, totals, students } = summary
  const now = useNow(1000)
  const [sort, setSort] = useState('risk')

  const live = useMemo(() => {
    const list = students
      .filter((s) => s.status === 'in_progress')
      .map((s) => ({ ...s, deadline: deadlineOf(s.started_at, exam.duration_minutes) }))
    const byName = (a, b) => a.student_name.localeCompare(b.student_name)
    if (sort === 'name') return list.sort(byName)
    if (sort === 'time') return list.sort((a, b) => (a.deadline ?? Infinity) - (b.deadline ?? Infinity))
    return list.sort((a, b) => b.high_violation_count - a.high_violation_count || b.violation_count - a.violation_count || byName(a, b))
  }, [students, exam.duration_minutes, sort])

  if (live.length === 0) {
    return (
      <StateMessage title="No one is taking this exam right now">
        {exam.status === 'published'
          ? <>Students can join with the code <strong className="adm-mono">{exam.exam_code}</strong>. This board updates on its own.</>
          : 'This exam is a draft, so students cannot join yet.'}
        {totals.sessions > 0 && <> See the Students tab for the {totals.sessions} who already took part.</>}
      </StateMessage>
    )
  }

  const total = exam.duration_minutes * 60

  return (
    <>
      <div className="adm-toolbar">
        <p className="adm-toolbar-note">{live.length} {live.length === 1 ? 'student' : 'students'} taking the exam</p>
        <label className="adm-field adm-field-inline">
          <span className="adm-sr">Sort students</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {Object.entries(SORTS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>

      <ul className="adm-board">
        {live.map((s) => {
          const left = s.deadline ? Math.max(0, Math.round((s.deadline - now) / 1000)) : null
          const atLimit = s.violation_count >= exam.max_violations
          const level = s.high_violation_count > 0 || atLimit ? 'high' : s.violation_count > 0 ? 'some' : 'clear'
          return (
            <li key={s.session_id}>
              <Link to={`/admin/sessions/${s.session_id}`} className={`adm-tile adm-tile-${level}`}>
                <span className="adm-tile-name">{s.student_name}</span>
                <span className="adm-tile-num adm-mono">{s.student_number}</span>

                <span className="adm-tile-strikes">
                  <StrikePips count={s.violation_count} max={exam.max_violations} />
                  <span>
                    {s.violation_count} of {exam.max_violations}
                    {s.high_violation_count > 0 && <b> · {s.high_violation_count} serious</b>}
                  </span>
                </span>

                <span className="adm-tile-row">
                  <span>{s.answered_count} of {totals.questions} answered</span>
                  <span className={left != null && left < 300 ? 'adm-tile-clock is-low' : 'adm-tile-clock'}>{fmtClock(left)} left</span>
                </span>
                <span className="adm-tile-bar" aria-hidden="true">
                  <span style={{ width: `${left == null ? 0 : pct(left, total)}%` }} />
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}