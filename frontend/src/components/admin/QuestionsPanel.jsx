import { useState } from 'react'
import { api } from '../../lib/api'
import { ParseError, parseGoogleForm, toImportPayload, validateQuestions } from '../../lib/quizParser'
import { usePolling } from './usePolling'
import { Loading, StateMessage } from './ui'
import { QUESTION_TYPE_LABELS } from './format'

// Accepts a Google Form page's source (view-source: copy), the FB_PUBLIC_LOAD_DATA_
// array as JSON, or a ready-made { questions: [...] } object. All parsing and
// validation is the lead's lib/quizParser.js; this component only collects the input.
function parseInput(text) {
  const trimmed = text.trim()
  if (!trimmed) throw new ParseError('Paste the form source first.')
  if (trimmed.startsWith('{')) {
    let obj
    try { obj = JSON.parse(trimmed) } catch { throw new ParseError('That is not valid JSON.') }
    if (!Array.isArray(obj.questions)) throw new ParseError('Expected an object with a "questions" list.')
    const problems = validateQuestions(obj.questions)
    if (problems.length) throw new ParseError('Some questions cannot be imported.', problems)
    return { questions: obj.questions, skipped: [] }
  }
  if (trimmed.startsWith('[')) {
    let arr
    try { arr = JSON.parse(trimmed) } catch { throw new ParseError('That is not valid JSON.') }
    return parseGoogleForm(arr)
  }
  return parseGoogleForm(trimmed)
}

export default function QuestionsPanel({ summary, onImported }) {
  const { exam, totals } = summary
  const { data: questions, error, loading, refresh } = usePolling(
    (signal) => api(`/exams/${exam.id}/questions`, { signal }),
    { key: `questions:${exam.id}`, interval: 0 },
  )
  const [text, setText] = useState('')
  const [preview, setPreview] = useState(null) // { questions, skipped }
  const [problem, setProblem] = useState(null) // { message, problems[] }
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const locked = totals.sessions > 0 // backend answers 409 once students have started

  const check = () => {
    setDone(false)
    try {
      setPreview(parseInput(text))
      setProblem(null)
    } catch (err) {
      setPreview(null)
      setProblem({ message: err.message, problems: err.problems ?? [] })
    }
  }

  const save = async () => {
    setBusy(true)
    setProblem(null)
    try {
      await api(`/exams/${exam.id}/questions`, { method: 'POST', body: toImportPayload(preview) })
      setDone(true)
      setPreview(null)
      setText('')
      refresh()
      onImported?.()
    } catch (err) {
      setProblem({ message: err.message, problems: Object.values(err.errors ?? {}).flat() })
    }
    setBusy(false)
  }

  return (
    <div className="adm-split">
      <div>
        <h2 className="adm-h2">{questions?.length ? `${questions.length} ${questions.length === 1 ? 'question' : 'questions'}` : 'Questions'}</h2>
        {loading && <Loading label="Loading questions" />}
        {!loading && !questions && <StateMessage tone="error" title="Could not load questions">{error?.message}</StateMessage>}
        {questions?.length === 0 && <StateMessage title="No questions yet">Import them from a Google Form. Students cannot start until the exam has questions.</StateMessage>}
        {questions?.length > 0 && (
          <ol className="adm-qlist">
            {questions.map((q) => (
              <li key={q.id}>
                <p className="adm-q-prompt">{q.prompt}</p>
                <p className="adm-q-meta">{QUESTION_TYPE_LABELS[q.type] ?? q.type}{q.required ? '' : ', optional'}</p>
                {q.options?.length > 0 && (
                  <ul className="adm-q-options">{q.options.map((o, i) => <li key={i}>{o}</li>)}</ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      <aside className="adm-import">
        <h2 className="adm-h2">Import questions</h2>
        {locked ? (
          <p className="adm-note">{totals.sessions} {totals.sessions === 1 ? 'student has' : 'students have'} already started this exam, so its questions can no longer be changed.</p>
        ) : (
          <>
            <p className="adm-note">
              Open your Google Form, view the page source, and paste all of it here. {questions?.length > 0 && <strong>Importing replaces the {questions.length} questions above.</strong>}
            </p>
            <label className="adm-field">
              <span className="adm-sr">Google Form page source</span>
              <textarea rows={8} value={text} onChange={(e) => { setText(e.target.value); setPreview(null); setProblem(null); setDone(false) }} placeholder="Paste the page source here" spellCheck={false} />
            </label>

            {problem && (
              <div className="adm-alert" role="alert">
                <p>{problem.message}</p>
                {problem.problems.length > 0 && <ul>{problem.problems.slice(0, 6).map((p, i) => <li key={i}>{p}</li>)}</ul>}
              </div>
            )}
            {done && <p className="adm-ok" role="status">Questions imported.</p>}

            {preview ? (
              <div className="adm-preview">
                <p><strong>{preview.questions.length} {preview.questions.length === 1 ? 'question' : 'questions'}</strong> {preview.questions.length === 1 ? 'is' : 'are'} ready to import.</p>
                {preview.skipped?.length > 0 && <p className="adm-note">Skipped (not supported): {preview.skipped.slice(0, 4).join(', ')}{preview.skipped.length > 4 ? ` and ${preview.skipped.length - 4} more` : ''}.</p>}
                <div className="adm-form-actions">
                  <button type="button" className="adm-btn adm-btn-primary" onClick={save} disabled={busy}>{busy ? 'Importing…' : 'Import questions'}</button>
                  <button type="button" className="adm-btn" onClick={() => setPreview(null)} disabled={busy}>Cancel</button>
                </div>
              </div>
            ) : (
              <button type="button" className="adm-btn adm-btn-primary" onClick={check} disabled={!text.trim()}>Check questions</button>
            )}
          </>
        )}
      </aside>
    </div>
  )
}