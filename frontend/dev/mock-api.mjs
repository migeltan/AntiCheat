// Stand-in for the Laravel API so the admin dashboard can be built and demoed
// without PHP/MySQL. Mirrors the response shapes of backend/app/Http/Controllers
// (dev branch). It also simulates a live exam: students join and trigger
// violations while it runs. Data resets whenever you restart it.
//
//   node dev/mock-api.mjs            -> http://localhost:8000
//   VITE_API_URL=http://localhost:8000 in frontend/.env, then npm run dev
import http from 'node:http'

const PORT = Number(process.env.PORT) || 8000
const iso = (ms) => new Date(ms).toISOString()
const MIN = 60000
const now = () => Date.now()
let nextId = { exam: 1, session: 1, violation: 1, question: 1 }

const TYPES = { tab_switch: 'medium', window_blur: 'medium', app_detected: 'high', other: 'low' }
const db = { exams: [], sessions: [], violations: [], questions: [], answers: [] }

function addExam(e) {
  const exam = { id: nextId.exam++, form_url: null, max_violations: 3, status: 'published', created_at: iso(now() - 3 * 86400000), updated_at: iso(now()), ...e }
  exam.exam_code ??= Math.random().toString(36).slice(2, 8).toUpperCase()
  db.exams.push(exam)
  return exam
}
function addSession(examId, name, number, startedAgoMin, extra = {}) {
  const exam = db.exams.find((e) => e.id === examId)
  const started = now() - startedAgoMin * MIN
  const s = { id: nextId.session++, exam_id: examId, student_name: name, student_number: number, status: 'in_progress', submit_reason: null, started_at: iso(started), expires_at: iso(started + exam.duration_minutes * MIN), submitted_at: null, created_at: iso(started), updated_at: iso(started), ...extra }
  db.sessions.push(s)
  return s
}
function addViolation(sessionId, type, agoMin, details = null) {
  const v = { id: nextId.violation++, exam_session_id: sessionId, type, severity: TYPES[type], details, created_at: iso(now() - agoMin * MIN), updated_at: iso(now()) }
  db.violations.push(v)
  return v
}
function addQuestions(examId, list) {
  list.forEach((q, i) => db.questions.push({ id: nextId.question++, exam_id: examId, position: i + 1, options: null, required: true, ...q }))
}

// ---- seed ----
const net = addExam({ title: 'Network Administration: Midterm', duration_minutes: 60, exam_code: 'NET4X2' })
const dv = addExam({ title: 'Data Visualization: Quiz 2', duration_minutes: 30, max_violations: 2, exam_code: 'VIZ7QK' })
addExam({ title: 'Systems Analysis: Finals (not published yet)', duration_minutes: 90, status: 'draft', exam_code: 'SYS9DR' })

addQuestions(net.id, [
  { type: 'multiple_choice', prompt: 'Which protocol resolves an IP address to a MAC address on a local network?', options: ['DNS', 'ARP', 'DHCP', 'ICMP'] },
  { type: 'checkboxes', prompt: 'Select every private IPv4 range.', options: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '8.8.8.0/24'] },
  { type: 'short_answer', prompt: 'What port does HTTPS use by default?' },
  { type: 'paragraph', prompt: 'Explain the difference between a switch and a router, with one example of when you would use each.' },
  { type: 'multiple_choice', prompt: 'Which command shows the route packets take to a host on Windows?', options: ['ping', 'tracert', 'ipconfig', 'netstat'] },
])
addQuestions(dv.id, [{ type: 'short_answer', prompt: 'Name one chart suited to a time series.' }, { type: 'multiple_choice', prompt: 'Which library is used for the Python demo?', options: ['Matplotlib', 'Excel', 'Paint'] }])

const roster = [
  ['Angelo Reyes', '2023-01482', 52, ['tab_switch', 'app_detected']],
  ['Bianca Santos', '2023-02210', 41, []],
  ['Carlo Dimaculangan', '2023-00977', 33, ['window_blur']],
  ['Dahlia Mendoza', '2023-03145', 27, ['tab_switch', 'window_blur', 'tab_switch']],
  ['Ezekiel Villanueva', '2023-01833', 18, []],
  ['Faith Cruz', '2023-02764', 12, ['window_blur']],
  ['Gabriel Tan', '2023-00415', 6, []],
  ['Hannah Lim', '2023-02999', 3, []],
]
roster.forEach(([name, no, ago, vs]) => {
  const s = addSession(net.id, name, no, ago)
  vs.forEach((t, i) => addViolation(s.id, t, Math.max(1, ago - 5 - i * 4), t === 'app_detected' ? 'WINWORD.EXE' : null))
  const answered = Math.min(db.questions.filter((q) => q.exam_id === net.id).length, Math.floor(ago / 9))
  db.questions.filter((q) => q.exam_id === net.id).slice(0, answered).forEach((q, i) => db.answers.push({ id: db.answers.length + 1, exam_session_id: s.id, question_id: q.id, value: q.options ? (q.type === 'checkboxes' ? q.options.slice(0, 2) : q.options[1]) : i === 2 ? '443' : 'A switch forwards frames inside one network; a router forwards packets between networks.' }))
})
const done = [
  ['Isabel Garcia', '2023-01120', 'submitted', 'manual', 118, 74],
  ['Joaquin Bautista', '2023-02033', 'submitted', 'manual', 120, 82],
  ['Katrina Ramos', '2023-01556', 'auto_submitted', 'time_up', 130, 70],
  ['Luis Navarro', '2023-02871', 'auto_submitted', 'max_violations', 125, 95],
]
done.forEach(([name, no, status, reason, ago, tookLater]) => {
  const s = addSession(net.id, name, no, ago, { status, submit_reason: reason })
  s.submitted_at = iso(now() - (ago - Math.min(tookLater, 60)) * MIN)
  if (reason === 'max_violations') ['tab_switch', 'app_detected', 'window_blur'].forEach((t, i) => addViolation(s.id, t, ago - 10 - i * 5))
})
addSession(dv.id, '=HYPERLINK("http://x")', '2023-09999', 40, { status: 'submitted', submit_reason: 'manual', submitted_at: iso(now() - 15 * MIN) })

// ---- simulate a live exam ----
const extraNames = ['Mika Aquino', 'Nathan Soriano', 'Olivia Castro', 'Paolo Ferrer']
setInterval(() => {
  const live = db.sessions.filter((s) => s.exam_id === net.id && s.status === 'in_progress')
  const pick = live[Math.floor(Math.random() * live.length)]
  if (!pick || Math.random() > 0.6) return
  const type = ['tab_switch', 'window_blur', 'window_blur', 'app_detected'][Math.floor(Math.random() * 4)]
  addViolation(pick.id, type, 0, type === 'app_detected' ? 'Notes' : null)
  if (db.violations.filter((v) => v.exam_session_id === pick.id).length >= net.max_violations) Object.assign(pick, { status: 'auto_submitted', submit_reason: 'max_violations', submitted_at: iso(now()) })
}, 7000)
setInterval(() => {
  const name = extraNames.shift()
  if (name) addSession(net.id, name, `2023-0${Math.floor(1000 + Math.random() * 8999)}`, 0)
}, 25000)

// ---- API ----
const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Accept' })
  res.end(JSON.stringify(body))
}
const sessionsOf = (id) => db.sessions.filter((s) => s.exam_id === id)
const violationsOf = (sid) => db.violations.filter((v) => v.exam_session_id === sid)
const newest = (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id
const countBy = (list, key) => Object.fromEntries(Object.entries(list.reduce((m, x) => ({ ...m, [x[key]]: (m[x[key]] ?? 0) + 1 }), {})))

function summary(exam) {
  const sessions = sessionsOf(exam.id).sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at))
  const students = sessions.map((s) => {
    const vs = violationsOf(s.id)
    return { session_id: s.id, student_name: s.student_name, student_number: s.student_number, status: s.status, submit_reason: s.submit_reason, started_at: s.started_at, submitted_at: s.submitted_at, violation_count: vs.length, high_violation_count: vs.filter((v) => v.severity === 'high').length, answered_count: db.answers.filter((a) => a.exam_session_id === s.id).length }
  })
  const vs = sessions.flatMap((s) => violationsOf(s.id))
  const c = (st) => students.filter((s) => s.status === st).length
  return {
    exam: { id: exam.id, title: exam.title, exam_code: exam.exam_code, status: exam.status, duration_minutes: exam.duration_minutes, max_violations: exam.max_violations },
    totals: { sessions: students.length, in_progress: c('in_progress'), submitted: c('submitted'), auto_submitted: c('auto_submitted'), questions: db.questions.filter((q) => q.exam_id === exam.id).length, violations: vs.length },
    violations_by_type: countBy(vs, 'type'), violations_by_severity: countBy(vs, 'severity'), students,
  }
}

http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {})
  const url = new URL(req.url, 'http://x')
  const path = url.pathname.replace(/^\/api/, '')
  let raw = ''
  req.on('data', (c) => (raw += c))
  req.on('end', () => {
    let body = {}
    try { body = raw ? JSON.parse(raw) : {} } catch { /* ignore */ }
    const m = (re) => path.match(re)
    const exam = (id) => db.exams.find((e) => e.id === Number(id))
    const session = (id) => db.sessions.find((s) => s.id === Number(id))
    let r
    setTimeout(() => {
      if (path === '/ping') return send(res, 200, { app: 'AntiCheat API (mock)', status: 'ok', time: iso(now()) })
      if (path === '/exams' && req.method === 'GET') return send(res, 200, [...db.exams].reverse())
      if (path === '/exams' && req.method === 'POST') {
        const errors = {}
        if (!body.title?.trim()) errors.title = ['The title field is required.']
        if (!Number.isInteger(body.duration_minutes) || body.duration_minutes < 1 || body.duration_minutes > 600) errors.duration_minutes = ['The duration minutes field must be between 1 and 600.']
        if (Object.keys(errors).length) return send(res, 422, { message: 'The given data was invalid.', errors })
        return send(res, 201, addExam({ title: body.title, duration_minutes: body.duration_minutes, max_violations: body.max_violations ?? 3, status: body.status ?? 'published', form_url: body.form_url ?? null, created_at: iso(now()) }))
      }
      if ((r = m(/^\/exams\/(\d+)\/summary$/))) return exam(r[1]) ? send(res, 200, summary(exam(r[1]))) : send(res, 404, { message: 'No query results for model [App\\Models\\Exam].' })
      if ((r = m(/^\/exams\/(\d+)\/sessions$/))) return send(res, 200, sessionsOf(Number(r[1])).reverse())
      if ((r = m(/^\/exams\/(\d+)\/violations$/))) {
        const log = sessionsOf(Number(r[1])).flatMap((s) => violationsOf(s.id).map((v) => ({ ...v, session: { id: s.id, student_name: s.student_name, student_number: s.student_number } })))
        return send(res, 200, log.sort(newest))
      }
      if ((r = m(/^\/exams\/(\d+)\/questions$/))) {
        const id = Number(r[1])
        if (!exam(id)) return send(res, 404, { message: 'Not found.' })
        if (req.method === 'GET') return send(res, 200, db.questions.filter((q) => q.exam_id === id))
        if (sessionsOf(id).length) return send(res, 409, { message: 'Students have already started this exam.' })
        db.questions = db.questions.filter((q) => q.exam_id !== id)
        addQuestions(id, body.questions)
        return send(res, 201, db.questions.filter((q) => q.exam_id === id))
      }
      if ((r = m(/^\/sessions\/(\d+)$/))) return session(r[1]) ? send(res, 200, { ...session(r[1]), exam: exam(session(r[1]).exam_id) }) : send(res, 404, { message: 'Not found.' })
      if ((r = m(/^\/sessions\/(\d+)\/violations$/))) return send(res, 200, violationsOf(Number(r[1])).sort(newest))
      if ((r = m(/^\/sessions\/(\d+)\/answers$/))) return send(res, 200, db.answers.filter((a) => a.exam_session_id === Number(r[1])))
      send(res, 404, { message: 'Not found.' })
    }, 60)
  })
}).listen(PORT, () => console.log(`Mock AntiCheat API on http://localhost:${PORT}`))