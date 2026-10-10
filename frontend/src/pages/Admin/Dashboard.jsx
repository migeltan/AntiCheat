import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { usePolling } from "../../components/admin/usePolling";
import {
  CodeChip,
  ExamStatus,
  Freshness,
  Loading,
  StateMessage,
} from "../../components/admin/ui";
import { fmtDate, fmtMinutes } from "../../components/admin/format";

// GET /exams has no session counts yet, so each exam's numbers come from its
// summary endpoint. Fine for a class-sized list; ask backend for counts on /exams
// if the list grows (see the handoff notes).
async function loadExams(signal) {
  const exams = await api("/exams", { signal });
  const summaries = await Promise.all(
    exams.map((e) =>
      api(`/exams/${e.id}/summary`, { signal }).catch(() => null),
    ),
  );
  return exams.map((exam, i) => ({
    exam,
    totals: summaries[i]?.totals ?? null,
  }));
}

// Opens the exam's Students tab already filtered to "Needs review".
const reviewLink = (examId) =>
  `/admin/exams/${examId}?tab=students&review=awaiting`;

const toReview = (r) => r.totals?.awaiting_review ?? 0;

// Exams that need a decision first, then ones being taken right now, then newest.
const byAttention = (a, b) =>
  toReview(b) - toReview(a) ||
  (b.totals?.in_progress ?? 0) - (a.totals?.in_progress ?? 0) ||
  Date.parse(b.exam.created_at) - Date.parse(a.exam.created_at);

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export default function Dashboard() {
  const navigate = useNavigate();
  const { data, error, loading, updatedAt, refresh } = usePolling(loadExams, {
    key: "exams",
    interval: 10000,
  });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? [])
      .filter(({ exam }) => {
        if (status !== "all" && exam.status !== status) return false;
        return (
          !q ||
          exam.title.toLowerCase().includes(q) ||
          exam.exam_code.toLowerCase().includes(q)
        );
      })
      .sort(byAttention);
  }, [data, query, status]);

  // Not affected by the search box: the review strip always shows everything pending.
  const attention = useMemo(
    () => (data ?? []).filter((r) => toReview(r) > 0).sort(byAttention),
    [data],
  );
  const pendingTotal = attention.reduce((n, r) => n + toReview(r), 0);

  const liveNow = (data ?? []).reduce(
    (n, r) => n + (r.totals?.in_progress ?? 0),
    0,
  );

  return (
    <>
      <header className="adm-head">
        <div>
          <h1>Exams</h1>
          <p className="adm-sub">
            {data
              ? [
                  liveNow > 0
                    ? `${plural(liveNow, "student is", "students are")} taking an exam right now.`
                    : "No one is taking an exam right now.",
                  pendingTotal > 0
                    ? `${plural(pendingTotal, "student needs", "students need")} your review.`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")
              : "Your exams and who is sitting them."}
          </p>
        </div>
        <div className="adm-head-actions">
          <Freshness
            updatedAt={updatedAt}
            error={error && data}
            onRefresh={refresh}
          />
          <Link to="/admin/exams/new" className="adm-btn adm-btn-primary">
            New exam
          </Link>
        </div>
      </header>

      {loading && <Loading label="Loading exams" />}

      {!loading && !data && (
        <StateMessage
          tone="error"
          title="Could not load exams"
          action={
            <button className="adm-btn" onClick={refresh}>
              Try again
            </button>
          }
        >
          {error?.message}
        </StateMessage>
      )}

      {data && data.length === 0 && (
        <StateMessage
          title="No exams yet"
          action={
            <Link to="/admin/exams/new" className="adm-btn adm-btn-primary">
              Create the first exam
            </Link>
          }
        >
          Create an exam to get a code your students can enter.
        </StateMessage>
      )}

      {attention.length > 0 && (
        <section className="adm-attn" aria-labelledby="adm-attn-title">
          <h2 id="adm-attn-title">
            Needs your review
            <span className="adm-attn-num">{pendingTotal}</span>
          </h2>
          <ul>
            {attention.map(({ exam, totals }) => (
              <li key={exam.id}>
                <Link to={reviewLink(exam.id)} className="adm-attn-row">
                  <span className="adm-attn-title">{exam.title}</span>
                  <span className="adm-attn-count">
                    {plural(totals.awaiting_review, "student", "students")}{" "}
                    flagged by the system
                  </span>
                  <span className="adm-attn-go" aria-hidden="true">
                    Review
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data && data.length > 0 && (
        <>
          <div className="adm-toolbar">
            <label className="adm-field adm-field-inline">
              <span className="adm-sr">Search exams</span>
              <input
                type="search"
                placeholder="Search by title or code"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label className="adm-field adm-field-inline">
              <span className="adm-sr">Filter by status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="all">All exams</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="closed">Closed</option>
              </select>
            </label>
          </div>

          <div className="adm-tablewrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th scope="col">Exam</th>
                  <th scope="col">Code</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num">
                    Length
                  </th>
                  <th scope="col" className="num">
                    Taking now
                  </th>
                  <th scope="col" className="num">
                    Finished
                  </th>
                  <th scope="col" className="num">
                    To review
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ exam, totals }) => (
                  <tr
                    key={exam.id}
                    className="is-link"
                    onClick={(e) =>
                      !e.target.closest("a,button") &&
                      navigate(`/admin/exams/${exam.id}`)
                    }
                  >
                    <td>
                      <Link
                        to={`/admin/exams/${exam.id}`}
                        className="adm-rowlink"
                      >
                        {exam.title}
                      </Link>
                      <span className="adm-cell-sub">
                        Created {fmtDate(exam.created_at)}
                      </span>
                    </td>
                    <td>
                      <CodeChip code={exam.exam_code} />
                    </td>
                    <td>
                      <ExamStatus status={exam.status} />
                    </td>
                    <td className="num">{fmtMinutes(exam.duration_minutes)}</td>
                    <td className="num">
                      {totals ? (
                        totals.in_progress > 0 ? (
                          <strong className="adm-live">
                            {totals.in_progress}
                          </strong>
                        ) : (
                          <span className="adm-faint">0</span>
                        )
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="num">
                      {totals ? totals.submitted + totals.auto_submitted : "-"}
                    </td>
                    <td className="num">
                      {totals ? (
                        totals.awaiting_review > 0 ? (
                          <Link
                            to={reviewLink(exam.id)}
                            className="adm-todo"
                            aria-label={`${plural(totals.awaiting_review, "student", "students")} to review in ${exam.title}`}
                          >
                            {totals.awaiting_review}
                          </Link>
                        ) : (
                          <span className="adm-faint">0</span>
                        )
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="adm-empty-row">
                      No exams match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
