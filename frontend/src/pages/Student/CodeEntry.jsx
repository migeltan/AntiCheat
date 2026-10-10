import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";

// Flowchart: "Student enters exam code" -> GET /api/exams/code/{code}
export default function CodeEntry() {
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!clean) return setError("Enter your exam code.");
    setBusy(true);
    setError("");
    try {
      await api(`/exams/code/${encodeURIComponent(clean)}`);
      nav(`/student/${encodeURIComponent(clean)}/details`);
    } catch (err) {
      setError(
        err.status === 404
          ? "That exam code is not valid, or the exam is not open yet. Check the code and try again."
          : err.message,
      );
      setBusy(false);
    }
  }

  return (
        <section className="sa-gate">
      <div className="sa-gate-card">
        <p className="sa-wordmark sa-wordmark-lg" aria-hidden="true">
          anticheat
        </p>
        <form onSubmit={submit} className="sa-form sa-form-center" noValidate>
          <div className="sa-gate-text">
            <label htmlFor="code" className="sa-title">
              Enter exam code
            </label>
            <p className="sa-hint">
              Your teacher gave you this code. It is not case-sensitive.
            </p>
          </div>
          <input
            id="code"
            className="sa-code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={12}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="ABC123"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "code-error" : undefined}
            autoFocus
          />
          {error && (
            <p id="code-error" className="sa-notice" role="alert">
              {error}
            </p>
          )}
          <button className="sa-btn sa-btn-primary sa-btn-wide" disabled={busy}>
            {busy ? "Checking…" : "Continue"}
          </button>
        </form>
        <p className="sa-hint sa-gate-foot">
          Instructor? <Link to="/admin">Sign in to the admin area</Link>
        </p>
      </div>
    </section>
  );
}
