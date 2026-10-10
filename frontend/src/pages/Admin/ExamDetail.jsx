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

  // A draft has nothing to watch yet, so it opens on Questions; other exams on the Live board.
  const defaultTab = summary?.exam.status === "draft" ? "questions" : "live";
  const tab = TABS.some((t) => t.id === params.get("tab"))
    ? params.get("tab")
    : defaultTab;

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

  const changeScoreVisibility = async (show) => {
    setActing(true);
    setActionError("");
    try {
      await api(`/exams/${examId}/score-visibility`, {
        method: "PATCH",
        body: { show_score: show },
      });
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

  // Five numbers instead of six: submitted + auto-submitted are both "finished" to a
  // teacher. "To review" is a link that opens the Students tab already filtered.
  const stats = [
    {
      label: "Taking now",
      value: totals.in_progress,
      tone: totals.in_progress ? "live" : "",
    },
    { label: "Finished", value: totals.submitted + totals.auto_submitted },
    {
      label: "Violations",
      value: totals.violations,
      tone: totals.violations ? "warn" : "",
    },
    {
      label: "To review",
      value: totals.awaiting_review,
      tone: totals.awaiting_review ? "warn" : "",
      to: `?tab=students&review=awaiting`,
    },
    { label: "Questions", value: totals.questions },
  ];

  // Always write the tab into the URL: on a draft, "Live board" must not bounce back to Questions.
  const goTab = (id) => setParams({ tab: id }, { replace: true });

  // A draft nobody has started shows what to do next instead of a strip of zeros.
  const setup = exam.status === "draft" && totals.sessions === 0;
  const hasQuestions = totals.questions > 0;
  const steps = [
    {
      title: "Add questions",
      note: hasQuestions
        ? `${totals.questions} added`
        : "Import from a Google Form or write them yourself",
      state: hasQuestions ? "done" : "now",
    },
    {
      title: "Set correct answers",
      note: "Optional. Choice questions are then scored automatically",
      state: hasQuestions ? "now" : "wait",
    },
    {
      title: "Publish and share the code",
      note: `Students enter ${exam.exam_code} to join`,
      state: "wait",
    },
  ];

  return (
    <>
      <nav className="adm-crumbs" aria-label="Breadcrumb">
        <Link to="/admin">Exams</Link>
      </nav>

      {/* Title and facts on the left, what you can DO on the right. */}
      <header className="adm-head">
        <div>
          <h1>{exam.title}</h1>
          <p className="adm-meta">
            <ExamStatus status={exam.status} />
            <CodeChip code={exam.exam_code} />
            <span>{fmtMinutes(exam.duration_minutes)}</span>
            <span title="A student with this many medium or serious violations is marked Needs review. Nothing is blocked.">
              Review after {exam.max_violations} violations
            </span>
            <label className="adm-switch">
              <input
                type="checkbox"
                role="switch"
                checked={Boolean(exam.show_score)}
                onChange={(e) => changeScoreVisibility(e.target.checked)}
                disabled={acting}
              />
              <span className="adm-switch-track" aria-hidden="true" />
              <span>Students see their score</span>
            </label>
          </p>

          {actionError && (
            <p className="adm-alert" role="alert">
              {actionError}
            </p>
          )}
        </div>
        <div className="adm-head-actions">
          <Freshness updatedAt={updatedAt} error={error} onRefresh={refresh} />
          {exam.status !== "published" && (
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              onClick={() => changeStatus("publish")}
              disabled={acting || totals.questions === 0}
              title={totals.questions === 0 ? "Add questions first" : undefined}
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
      </header>

      {setup ? (
        <ol className="adm-steps" aria-label="Getting this exam ready">
          {steps.map((s, i) => (
            <li key={s.title} className={`adm-step is-${s.state}`}>
              <span className="adm-step-dot" aria-hidden="true">
                {s.state === "done" ? "" : i + 1}
              </span>
              <span>
                <b>{s.title}</b>
                <small>{s.note}</small>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <dl className="adm-stats">
          {stats.map((s) => (
            <div
              key={s.label}
              className={`adm-stat ${s.tone ? `adm-stat-${s.tone}` : ""} ${s.to ? "adm-stat-link" : ""}`}
            >
              <dd>{s.value}</dd>
              <dt>{s.to ? <Link to={s.to}>{s.label}</Link> : s.label}</dt>
            </div>
          ))}
        </dl>
      )}

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
            onClick={() => goTab(t.id)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              const i = TABS.findIndex((x) => x.id === tab);
              const next =
                TABS[
                  (i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) %
                    TABS.length
                ];
              goTab(next.id);
              requestAnimationFrame(() =>
                document.getElementById(`tab-${next.id}`)?.focus(),
              );
            }}
          >
            {t.label}
            {t.id === "students" && totals.awaiting_review > 0 && (
              <span className="adm-tab-count">{totals.awaiting_review}</span>
            )}
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
        {tab === "students" && (
          // key: clicking "To review" while already on this tab must re-apply the filter
          <StudentsTable
            key={params.get("review") ?? "all"}
            summary={summary}
          />
        )}
        {tab === "violations" && <ViolationLog summary={summary} />}
        {tab === "questions" && (
          <QuestionsPanel summary={summary} onImported={refresh} />
        )}
      </section>
    </>
  );
}
