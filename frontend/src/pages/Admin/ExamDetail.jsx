import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";
import { usePolling } from "../../components/admin/usePolling";
import {
  CodeChip,
  ExamStatus,
  Freshness,
  Loading,
  StateMessage,
} from "../../components/admin/ui";
import { fmtMinutes } from "../../components/admin/format";
import LiveBoard from "../../components/admin/LiveBoard";
import StudentsTable from "../../components/admin/StudentsTable";
import ViolationLog from "../../components/admin/ViolationLog";
import QuestionsPanel from "../../components/admin/QuestionsPanel";

const TABS = [
  { id: "live", label: "Live board" },
  { id: "students", label: "Students" },
  { id: "violations", label: "Violations" },
  { id: "questions", label: "Questions" },
];

export default function ExamDetail() {
  const { examId } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get("tab"))
    ? params.get("tab")
    : "live";

  const {
    data: summary,
    error,
    loading,
    updatedAt,
    refresh,
  } = usePolling((signal) => api(`/exams/${examId}/summary`, { signal }), {
    key: `summary:${examId}`,
    interval: 5000,
  });

  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState("");

  const changeStatus = async (action) => {
    setActing(true);
    setActionError("");
    try {
      await api(`/exams/${examId}/${action}`, { method: "PATCH" });
      await refresh();
    } catch (err) {
      setActionError(err.message);
    }
    setActing(false);
  };

  if (loading) return <Loading label="Loading exam" />;
  if (!summary) {
    const missing = error?.status === 404;
    return (
      <StateMessage
        tone="error"
        title={missing ? "Exam not found" : "Could not load this exam"}
        action={
          missing ? (
            <Link to="/admin" className="adm-btn">
              Back to exams
            </Link>
          ) : (
            <button className="adm-btn" onClick={refresh}>
              Try again
            </button>
          )
        }
      >
        {missing
          ? "It may have been deleted, or the link is wrong."
          : error?.message}
      </StateMessage>
    );
  }

  const { exam, totals } = summary;
  const stats = [
    {
      label: "Taking now",
      value: totals.in_progress,
      tone: totals.in_progress ? "live" : "",
    },
    { label: "Submitted", value: totals.submitted },
    { label: "Auto-submitted", value: totals.auto_submitted },
    {
      label: "Violations",
      value: totals.violations,
      tone: totals.violations ? "warn" : "",
    },
    {
      label: "Awaiting review",
      value: totals.awaiting_review,
      tone: totals.awaiting_review ? "warn" : "",
    },
    { label: "Questions", value: totals.questions },
  ];

  return (
    <>
      <nav className="adm-crumbs" aria-label="Breadcrumb">
        <Link to="/admin">Exams</Link>
      </nav>
      <header className="adm-head">
        <div>
          <h1>{exam.title}</h1>
          <p className="adm-meta">
            <ExamStatus status={exam.status} />
            <CodeChip code={exam.exam_code} />
            <span>{fmtMinutes(exam.duration_minutes)}</span>
            <span>{exam.max_violations} violations allowed</span>
          </p>
          <div className="adm-form-actions">
            {exam.status !== "published" && (
              <button
                type="button"
                className="adm-btn adm-btn-primary"
                onClick={() => changeStatus("publish")}
                disabled={acting || totals.questions === 0}
              >
                {exam.status === "closed" ? "Reopen exam" : "Publish exam"}
              </button>
            )}
            {exam.status === "published" && (
              <button
                type="button"
                className="adm-btn"
                onClick={() =>
                  window.confirm(
                    "Close this exam? Students already taking it can finish, but nobody new can join.",
                  ) && changeStatus("close")
                }
                disabled={acting}
              >
                Close exam
              </button>
            )}
          </div>
          {exam.status === "draft" && totals.questions === 0 && (
            <p className="adm-note">
              Add questions in the Questions tab before publishing.
            </p>
          )}
          {actionError && (
            <p className="adm-alert" role="alert">
              {actionError}
            </p>
          )}
        </div>
        <Freshness updatedAt={updatedAt} error={error} onRefresh={refresh} />
      </header>

      <dl className="adm-stats">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`adm-stat ${s.tone ? `adm-stat-${s.tone}` : ""}`}
          >
            <dd>{s.value}</dd>
            <dt>{s.label}</dt>
          </div>
        ))}
      </dl>

      <div className="adm-tabs" role="tablist" aria-label="Exam sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="adm-panel"
            tabIndex={tab === t.id ? 0 : -1}
            className={tab === t.id ? "adm-tab is-active" : "adm-tab"}
            onClick={() =>
              setParams(t.id === "live" ? {} : { tab: t.id }, { replace: true })
            }
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              const i = TABS.findIndex((x) => x.id === tab);
              const next =
                TABS[
                  (i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) %
                    TABS.length
                ];
              setParams(next.id === "live" ? {} : { tab: next.id }, {
                replace: true,
              });
              requestAnimationFrame(() =>
                document.getElementById(`tab-${next.id}`)?.focus(),
              );
            }}
          >
            {t.label}
            {t.id === "violations" && totals.violations > 0 && (
              <span className="adm-tab-count">{totals.violations}</span>
            )}
          </button>
        ))}
      </div>

      <section
        id="adm-panel"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className="adm-panel"
      >
        {tab === "live" && <LiveBoard summary={summary} />}
        {tab === "students" && <StudentsTable summary={summary} />}
        {tab === "violations" && <ViolationLog summary={summary} />}
        {tab === "questions" && (
          <QuestionsPanel summary={summary} onImported={refresh} />
        )}
      </section>
    </>
  );
}
