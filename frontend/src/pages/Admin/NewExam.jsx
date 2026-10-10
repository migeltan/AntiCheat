import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";

const fieldError = (errors, name) => errors?.[name]?.[0];

export default function NewExam() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    duration_minutes: 60,
    max_violations: 3,
    form_url: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null); // ApiError
  const set = (name) => (e) =>
    setForm((f) => ({ ...f, [name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        title: form.title.trim(),
        duration_minutes: Number(form.duration_minutes),
        max_violations: Number(form.max_violations),
        ...(form.form_url.trim() ? { form_url: form.form_url.trim() } : {}),
      };
      const exam = await api("/exams", { method: "POST", body });
      // a new exam has no questions yet: go straight to importing them
      navigate(`/admin/exams/${exam.id}?tab=questions`);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  const errs = error?.errors;
  return (
    <>
      <header className="adm-head">
        <div>
          <h1>New exam</h1>
          <p className="adm-sub">
            You get an exam code to give your students. Add the questions on the
            next screen.
          </p>
        </div>
      </header>

      <form className="adm-form" onSubmit={submit} noValidate>
        {error && !errs && (
          <p className="adm-alert" role="alert">
            {error.message}
          </p>
        )}

        <label className="adm-field">
          <span>Exam title</span>
          <input
            required
            maxLength={255}
            value={form.title}
            onChange={set("title")}
            aria-invalid={!!fieldError(errs, "title")}
            placeholder="Midterm: Network Administration"
          />
          {fieldError(errs, "title") && (
            <em className="adm-field-error">{fieldError(errs, "title")}</em>
          )}
        </label>

        <div className="adm-form-row">
          <label className="adm-field">
            <span>Time allowed (minutes)</span>
            <input
              type="number"
              required
              min={1}
              max={600}
              value={form.duration_minutes}
              onChange={set("duration_minutes")}
              aria-invalid={!!fieldError(errs, "duration_minutes")}
            />
            {fieldError(errs, "duration_minutes") ? (
              <em className="adm-field-error">
                {fieldError(errs, "duration_minutes")}
              </em>
            ) : (
              <small>
                1 to 600. The timer starts when each student begins.
              </small>
            )}
          </label>
          <label className="adm-field">
            <span>Violations allowed</span>
            <input
              type="number"
              required
              min={1}
              max={20}
              value={form.max_violations}
              onChange={set("max_violations")}
              aria-invalid={!!fieldError(errs, "max_violations")}
            />
            {fieldError(errs, "max_violations") ? (
              <em className="adm-field-error">
                {fieldError(errs, "max_violations")}
              </em>
            ) : (
              <small>
                The exam is submitted automatically when a student reaches this
                number.
              </small>
            )}
          </label>
        </div>

        <p className="adm-note">
          New exams start as drafts. Add the questions on the next screen, then
          publish when you are ready. Students cannot use the code until then.
        </p>

        <label className="adm-field">
          <span>Google Form link (optional)</span>
          <input
            type="url"
            value={form.form_url}
            onChange={set("form_url")}
            aria-invalid={!!fieldError(errs, "form_url")}
            placeholder="https://docs.google.com/forms/..."
          />
          {fieldError(errs, "form_url") && (
            <em className="adm-field-error">{fieldError(errs, "form_url")}</em>
          )}
        </label>

        <div className="adm-form-actions">
          <button
            type="submit"
            className="adm-btn adm-btn-primary"
            disabled={busy || !form.title.trim()}
          >
            {busy ? "Creating…" : "Create exam"}
          </button>
          <Link to="/admin" className="adm-btn">
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
