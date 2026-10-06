import { Link, Navigate, useParams } from 'react-router-dom'
import { Loading, StatePanel } from '../../components/student/StatePanel'
import { useExamByCode } from '../../components/student/useExamByCode'
import { isSafeExamBrowser } from '../../lib/environment'

// Flowchart: "Lockdown method?" -> Path A (.seb file, recommended) / Path B (Electron shell, fallback).
// The repository has no endpoint that generates a .seb file or hosts the shell app, so the
// download links come from VITE_SEB_FILE_URL / VITE_SHELL_APP_URL. Nothing is faked when unset.
const SEB_URL = import.meta.env.VITE_SEB_FILE_URL
const SHELL_URL = import.meta.env.VITE_SHELL_APP_URL

function Path({ title, hint, url, label }) {
  return (
    <section className="sa-card">
      <h2 className="sa-card-title">{title}</h2>
      <p className="sa-muted">{hint}</p>
      {url ? (
        <a className="sa-btn sa-btn-primary" href={url} download>{label}</a>
      ) : (
        <p className="sa-muted"><em>This download is not available yet. Ask your proctor.</em></p>
      )}
    </section>
  )
}

export default function Launcher() {
  const { code } = useParams()
  const { exam, error, loading } = useExamByCode(code)

  if (isSafeExamBrowser()) return <Navigate to={`/student/${encodeURIComponent(code)}/details`} replace />
  if (loading) return <Loading>Loading exam…</Loading>
  if (error) {
    return (
      <StatePanel title="Exam not available" tone="error" action={<Link className="sa-btn" to="/student">Enter a different code</Link>}>
        {error}
      </StatePanel>
    )
  }

  return (
    <section className="sa-narrow">
      <header className="sa-intro">
        <p className="sa-wordmark sa-wordmark-lg" aria-hidden="true">anticheat</p>
        <h1 className="sa-title">{exam.title}</h1>
        <p className="sa-lead">
          This exam requires a locked environment. Download the launcher below to begin.
        </p>
      </header>
      <Path title="Path A: Safe Exam Browser (recommended)" hint="Open the downloaded file with Safe Exam Browser installed." url={SEB_URL} label="Download .seb file" />
      <Path title="Path B: Electron Secure Shell (fallback)" hint="Use this only if Safe Exam Browser does not work on your computer." url={SHELL_URL} label="Download Secure Shell app" />
      <p className="sa-center-text sa-muted">
        Already inside the secure browser?{' '}
        <Link to={`/student/${encodeURIComponent(code)}/details`}>Continue to student details</Link>
      </p>
    </section>
  )
}
