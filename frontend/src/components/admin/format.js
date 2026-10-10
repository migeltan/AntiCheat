// Labels and formatters for the admin area. Pure functions, no React.

export const VIOLATION_LABELS = {
  tab_switch: "Switched tab",
  window_blur: "Left the exam window",
  fullscreen_exit: "Exited full screen",
  paste_attempt: "Pasted text",
  copy_attempt: "Copied or cut text",
  mouse_left: "Mouse left the window",
  app_detected: "Opened a blocked app",
  other: "Other",
};

export const SEVERITY_LABELS = { high: "High", medium: "Medium", low: "Low" };
export const REVIEW_LABELS = {
  flagged: "Flagged: cheating",
  cleared: "Cleared",
};
export const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

export const STATUS_LABELS = {
  in_progress: "In progress",
  submitted: "Submitted",
  auto_submitted: "Auto-submitted",
};

export const REASON_LABELS = {
  manual: "Student submitted",
  time_up: "Time ran out",
  max_violations: "Reached the violation limit",
};

export const QUESTION_TYPE_LABELS = {
  multiple_choice: "Multiple choice",
  checkboxes: "Checkboxes",
  short_answer: "Short answer",
  paragraph: "Paragraph",
};

const dateTime = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const timeOnly = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});
const dateOnly = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const valid = (iso) => iso && !Number.isNaN(Date.parse(iso));
export const fmtDateTime = (iso) =>
  valid(iso) ? dateTime.format(new Date(iso)) : "-";
export const fmtTime = (iso) =>
  valid(iso) ? timeOnly.format(new Date(iso)) : "-";
export const fmtDate = (iso) =>
  valid(iso) ? dateOnly.format(new Date(iso)) : "-";

// 754 -> "12:34", 3725 -> "1:02:05"
export function fmtClock(totalSeconds) {
  if (totalSeconds == null || Number.isNaN(totalSeconds)) return "-";
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// "12 min", "1 h 05 min"
export function fmtMinutes(min) {
  if (min == null) return "-";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")} min` : `${h} h`;
}

export function fmtAgo(ms, now = Date.now()) {
  if (!ms) return "";
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s} s ago`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ago`;
}

// The backend sets expires_at = started_at + duration, and the summary does not
// return expires_at, so the live board derives it. Returns ms epoch or null.
export function deadlineOf(startedAt, durationMinutes) {
  return valid(startedAt) && durationMinutes
    ? Date.parse(startedAt) + durationMinutes * 60000
    : null;
}

export const pct = (part, whole) =>
  whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : 0;

// ---- CSV export (client side) ----
// Student names are typed by students, so cells that start with = + - @ are
// prefixed with an apostrophe to stop spreadsheet formula injection.
function csvCell(value) {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(filename, header, rows) {
  const text = [header, ...rows]
    .map((r) => r.map(csvCell).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([`\uFEFF${text}`], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "exam";
