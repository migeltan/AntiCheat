import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { usePolling } from "../../components/admin/usePolling";
import {
  Freshness,
  Loading,
  ReviewBadge,
  Severity,
  StateMessage,
  StatusBadge,
  StrikePips,
} from "../../components/admin/ui";
import ReviewPanel from "../../components/admin/ReviewPanel";
import {
  REASON_LABELS,
  VIOLATION_LABELS,
  fmtClock,
  fmtDateTime,
  fmtMinutes,
  fmtTime,
} from "../../components/admin/format";

// Everything about one student's attempt:
//   GET /admin/sessions/{id}        session + exam + the teacher's verdict
//   GET /sessions/{id}/violations   newest first
//   GET /sessions/{id}/answers      [{ question_id, value }]
//   GET /exams/{exam_id}/questions  to put each answer next to its question
//   GET /exams/{exam_id}/summary    the exam's other students, for previous / next
async function loadSession(id, signal) {
  const session = await api(`/admin/sessions/${id}`, { signal });
  const [violations, answers, questions, summary] = await Promise.all([
    api(`/sessions/${id}/violations`, { signal }),
    api(`/sessions/${id}/answers`, { signal }),
    api(`/exams/${session.exam_id}/questions`, { signal }),
    // navigation is a convenience: if this fails the page still works without it
    api(`/exams/${session.exam_id}/summary`, { signal }).catch(() => null),
  ]);
  return { session, violations, answers, questions, summary };
}

const answerText = (value) =>
  Array.isArray(value)
    ? value.filter(Boolean).join(", ")
    : value == null
      ? ""
      : String(value).trim();

// Where this student sits in the exam's list (same order as the Students tab,
// newest first), plus the next student still waiting for a decision.
function rosterNav(summary, sessionId) {
  const roster = [...(summary?.students ?? [])].sort(
    (a, b) => Date.parse(b.started_at) - Date.parse(a.started_at),
  );
  const i = roster.findIndex((s) => s.session_id === Number(sessionId));
  if (i === -1) return null;
  const waiting = (s) => s.needs_review && !s.review_status;
  // look below the current student first, then wrap around to the top
  const order = [...roster.slice(i + 1), ...roster.slice(0, i)];
  return {
    position: i + 1,
    total: roster.length,
    prev: roster[i - 1] ?? null,
    next: roster[i + 1] ?? null,
    nextWaiting: order.find(waiting) ?? null,
    waitingCount: roster.filter(waiting).length,
  };
}

function StepLink({ student, label }) {
  return student ? (
    <Link
      to={`/admin/sessions/${student.session_id}`}
      className="adm-btn"
      title={student.student_name}
    >
      {label}
    </Link>
  ) : (
    <span className="adm-btn adm-btn-off" aria-disabled="true">
      {label}
    </span>
  );
}

export default function SessionReview() {
  const { sessionId } = useParams();
  // Moving to another student keeps the old scroll position otherwise.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [sessionId]);
  const { data, error, loading, updatedAt, refresh } = usePolling(
    (signal) => loadSession(sessionId, signal),
    {
      key: `session:${sessionId}`,
      interval: 5000,
    },
  );

  const timeline = useMemo(
    () => (data ? [...data.violations].reverse() : []),
    [data],
  );
  const answerByQuestion = useMemo(
    () => new Map((data?.answers ?? []).map((a) => [a.question_id, a.value])),
    [data],
  );
  const nav = useMemo(
    () => rosterNav(data?.summary, sessionId),
    [data, sessionId],
  );

  if (loading) return <Loading label="Loading student" />;
  if (!data) {
    const missing = error?.status === 404;
    return (
      <StateMessage
        tone="error"
        title={
          missing ? "Student attempt not found" : "Could not load this attempt"
        }
        action={
          <Link to="/admin" className="adm-btn">
            Back to exams
          </Link>
        }
      >
        {missing
          ? "The link may be wrong, or the exam was deleted."
          : error?.message}
      </StateMessage>
    );
  }

  const { session, violations, questions } = data;
  const exam = session.exam;
  const score = session.score;
  const answeredCount = questions.filter(
    (q) => answerText(answerByQuestion.get(q.id)) !== "",
  ).length;
  const takenMin = session.submitted_at
    ? Math.max(
        1,
        Math.round(
          (Date.parse(session.submitted_at) - Date.parse(session.started_at)) /
            60000,
        ),
      )
    : null;
  const live = session.status === "in_progress";
  const significant = violations.filter((v) => v.severity !== "low").length;
  const suggested =
    significant >= exam.max_violations ||
    violations.some((v) => v.severity === "high");

  return (
    <>
      <nav className="adm-crumbs" aria-label="Breadcrumb">
        <Link to="/admin">Exams</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/admin/exams/${exam.id}`}>{exam.title}</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/admin/exams/${exam.id}?tab=students`}>Students</Link>
      </nav>

      {nav && (
        <div className="adm-stepper">
          <p className="adm-stepper-pos">
            Student {nav.position} of {nav.total}
          </p>
          <div className="adm-stepper-actions">
            <StepLink student={nav.prev} label="Previous" />
            <StepLink student={nav.next} label="Next" />
            {nav.nextWaiting && (
              <Link
                to={`/admin/sessions/${nav.nextWaiting.session_id}`}
                className="adm-btn adm-btn-primary"
              >
                Next to review
                <span className="adm-stepper-count">{nav.waitingCount}</span>
              </Link>
            )}
          </div>
        </div>
      )}

      <header className="adm-head">
        <div>
          <h1>{session.student_name}</h1>
          <p className="adm-meta">
            <span className="adm-mono">{session.student_number}</span>
            <StatusBadge
              status={session.status}
              reason={session.submit_reason}
            />
            {session.submit_reason && (
              <span>{REASON_LABELS[session.submit_reason]}</span>
            )}
            <ReviewBadge status={session.review_status} suggested={suggested} />
          </p>
        </div>
        {live && (
          <Freshness updatedAt={updatedAt} error={error} onRefresh={refresh} />
        )}
      </header>

      <dl className="adm-facts">
        <div>
          <dt>Started</dt>
          <dd>{fmtDateTime(session.started_at)}</dd>
        </div>
        <div>
          <dt>{live ? "Time ends" : "Submitted"}</dt>
          <dd>
            {fmtDateTime(live ? session.expires_at : session.submitted_at)}
          </dd>
        </div>
        <div>
          <dt>Time taken</dt>
          <dd>{takenMin ? fmtMinutes(takenMin) : "Still going"}</dd>
        </div>
        <div>
          <dt>Answered</dt>
          <dd>
            {answeredCount} of {questions.length}
          </dd>
        </div>
        <div>
          <dt>{live ? "Score so far" : "Score"}</dt>
          <dd>
            {score.total > 0
              ? `${score.earned} of ${score.total} (${score.percent}%)`
              : "No answer key"}
            {score.total > 0 && score.ungraded > 0 && (
              <small> {score.ungraded} left for you to mark</small>
            )}
          </dd>
        </div>
        <div>
          <dt>Violations</dt>
          <dd className="adm-vcell">
            <StrikePips count={violations.length} max={exam.max_violations} />{" "}
            {violations.length} of {exam.max_violations}
          </dd>
        </div>
      </dl>

      <ReviewPanel
        key={session.id}
        session={session}
        suggested={suggested}
        onSaved={refresh}
      />

      <div className="adm-split">
        <section aria-labelledby="h-violations">
          <h2 className="adm-h2" id="h-violations">
            Violation timeline
          </h2>
          {timeline.length === 0 ? (
            <StateMessage title="Clean attempt">
              No violations were recorded for this student.
            </StateMessage>
          ) : (
            <ol className="adm-timeline">
              {timeline.map((v) => (
                <li key={v.id} className={`adm-tl adm-tl-${v.severity}`}>
                  <span className="adm-tl-when">
                    {fmtTime(v.created_at)}
                    <small>
                      {fmtClock(
                        (Date.parse(v.created_at) -
                          Date.parse(session.started_at)) /
                          1000,
                      )}{" "}
                      in
                    </small>
                  </span>
                  <span className="adm-tl-what">
                    {VIOLATION_LABELS[v.type] ?? v.type}{" "}
                    <Severity level={v.severity} />
                    {v.details && <small>{v.details}</small>}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section aria-labelledby="h-answers">
          <h2 className="adm-h2" id="h-answers">
            Answers
          </h2>
          {questions.length === 0 ? (
            <StateMessage title="This exam has no questions" />
          ) : (
            <ol className="adm-qlist">
              {questions.map((q) => {
                const text = answerText(answerByQuestion.get(q.id));
                const result = score.results[q.id]; // true, false or undefined (not scored)
                return (
                  <li key={q.id}>
                    <p className="adm-q-prompt">{q.prompt}</p>
                    {result !== undefined && (
                      <p
                        className={`adm-mark ${result ? "is-right" : "is-wrong"}`}
                      >
                        {result ? "Correct" : "Incorrect"}
                      </p>
                    )}
                    {text ? (
                      <p className="adm-answer">{text}</p>
                    ) : (
                      <p className="adm-answer is-empty">
                        {live ? "Not answered yet" : "No answer"}
                      </p>
                    )}
                    {result === false && (
                      <p className="adm-key-line">
                        Correct answer: {answerText(q.correct_answer)}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
