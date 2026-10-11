import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ReviewBadge, StateMessage, StatusBadge, StrikePips } from "./ui";
import {
  REASON_LABELS,
  REVIEW_LABELS,
  STATUS_LABELS,
  downloadCsv,
  fmtDateTime,
  fmtMinutes,
  slug,
} from "./format";

const minutesBetween = (a, b) =>
  a && b
    ? Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 60000))
    : null;

// 'awaiting' = the system suggests a review and the teacher has not decided yet
const matchesReview = (s, filter) =>
  filter === "all" ||
  (filter === "awaiting"
    ? s.needs_review && !s.review_status
    : s.review_status === filter);

const REVIEW_CHIPS = [
  ["all", "Everyone"],
  ["awaiting", "Needs review"],
  ["flagged", "Flagged: cheating"],
  ["cleared", "Cleared"],
];

export default function StudentsTable({ summary }) {
  const { exam, totals, students } = summary;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  // Dashboard links here with ?review=awaiting to open the list already filtered.
  const [params] = useSearchParams();
  const [review, setReview] = useState(() =>
    ["awaiting", "flagged", "cleared"].includes(params.get("review"))
      ? params.get("review")
      : "all",
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students
      .filter((s) => status === "all" || s.status === status)
      .filter((s) => matchesReview(s, review))
      .filter(
        (s) =>
          !q ||
          s.student_name.toLowerCase().includes(q) ||
          s.student_number.toLowerCase().includes(q),
      )
      .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at));
  }, [students, query, status, review]);

  if (students.length === 0) {
    return (
      <StateMessage title="No students yet">
        Once someone starts this exam, they appear here with their progress and
        violations.
      </StateMessage>
    );
  }

  // Chip counts always reflect the whole exam, not the current search.
  const count = (filter) =>
    students.filter((s) => matchesReview(s, filter)).length;

  const exportCsv = () =>
    downloadCsv(
      `${slug(exam.title)}-students.csv`,
      [
        "Student name",
        "Student number",
        "Status",
        "How it ended",
        "Started",
        "Submitted",
        "Minutes taken",
        "Questions answered",
        "Violations",
        "Serious violations",
        "Teacher decision",
      ],
      rows.map((s) => [
        s.student_name,
        s.student_number,
        STATUS_LABELS[s.status],
        REASON_LABELS[s.submit_reason] ?? "",
        s.started_at,
        s.submitted_at ?? "",
        minutesBetween(s.started_at, s.submitted_at) ?? "",
        `${s.answered_count}/${totals.questions}`,
        s.violation_count,
        s.high_violation_count,
        REVIEW_LABELS[s.review_status] ?? "",
      ]),
    );

  return (
    <>
      {/* One-click decision filter with counts (replaces the dropdown and the
          "only students with violations" checkbox, which overlapped it). */}
      <div
        className="adm-chips"
        role="group"
        aria-label="Filter by your decision"
      >
        {REVIEW_CHIPS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={review === value ? "adm-chip is-on" : "adm-chip"}
            aria-pressed={review === value}
            onClick={() => setReview(value)}
          >
            {label} <b>{count(value)}</b>
          </button>
        ))}
      </div>

      <div className="adm-toolbar">
        <label className="adm-field adm-field-inline">
          <span className="adm-sr">Search students</span>
          <input
            type="search"
            placeholder="Search name or student number"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="adm-field adm-field-inline">
          <span className="adm-sr">Filter by status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Every status</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="adm-btn adm-toolbar-end"
          onClick={exportCsv}
          disabled={rows.length === 0}
        >
          Export CSV
        </button>
      </div>

      <div className="adm-tablewrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th scope="col">Student</th>
              <th scope="col">Status</th>
              <th scope="col">Started</th>
              <th scope="col" className="num">
                Time taken
              </th>
              <th scope="col" className="num">
                Answered
              </th>
              <th scope="col">Violations</th>
              <th scope="col">Decision</th>
              <th scope="col">
                <span className="adm-sr">Review</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const taken = minutesBetween(s.started_at, s.submitted_at);
              return (
                <tr key={s.session_id}>
                  <td>
                    <Link
                      to={`/admin/sessions/${s.session_id}`}
                      className="adm-rowlink"
                    >
                      {s.student_name}
                    </Link>
                    <span className="adm-cell-sub adm-mono">
                      {s.student_number}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={s.status} reason={s.submit_reason} />
                    {s.submit_reason && s.status === "auto_submitted" && (
                      <span className="adm-cell-sub">
                        {REASON_LABELS[s.submit_reason]}
                      </span>
                    )}
                  </td>
                  <td>{fmtDateTime(s.started_at)}</td>
                  <td className="num">{taken ? fmtMinutes(taken) : "-"}</td>
                  <td className="num">
                    {s.answered_count} / {totals.questions}
                  </td>
                  <td>
                    <span className="adm-vcell">
                      <StrikePips
                        count={s.violation_count}
                        max={exam.max_violations}
                      />
                      <span>
                        {s.violation_count}
                        {s.high_violation_count > 0 && (
                          <b className="adm-serious">
                            {" "}
                            · {s.high_violation_count} serious
                          </b>
                        )}
                      </span>
                    </span>
                  </td>
                  <td>
                    <ReviewBadge
                      status={s.review_status}
                      suggested={s.needs_review}
                    />
                  </td>
                  <td className="num">
                    <Link
                      to={`/admin/sessions/${s.session_id}`}
                      className="adm-btn adm-btn-quiet"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="adm-empty-row">
                  No students match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
