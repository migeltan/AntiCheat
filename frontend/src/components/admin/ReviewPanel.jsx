import { useState } from "react";
import { api } from "../../lib/api";
import { ReviewBadge } from "./ui";
import { fmtDateTime } from "./format";

// The teacher's decision on one attempt. Violations are evidence, not proof: this is where a
// person decides. Students never see it (the backend hides it from the student routes).
export default function ReviewPanel({ session, suggested, onSaved }) {
  const [note, setNote] = useState(session.review_note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const decided = Boolean(session.review_status);

  async function save(status) {
    setBusy(true);
    setError("");
    try {
      await api(`/admin/sessions/${session.id}/review`, {
        method: "PATCH",
        body: { status, note: note.trim() || null },
      });
      if (status === "pending") setNote("");
      await onSaved?.();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <section className="adm-review" aria-labelledby="h-review">
      <div className="adm-review-head">
        <h2 className="adm-h2" id="h-review">
          Your decision
        </h2>
        <ReviewBadge status={session.review_status} suggested={suggested} />
      </div>
      <p className="adm-review-hint">
        Violations are evidence for you to weigh, not proof.{" "}
        {suggested
          ? "This attempt reached the review threshold."
          : "This attempt is below the review threshold."}{" "}
        Students never see your decision.
      </p>
      {decided && session.reviewed_at && (
        <p className="adm-review-meta">
          Decided by {session.reviewer?.name ?? "a teacher"} on{" "}
          {fmtDateTime(session.reviewed_at)}.
        </p>
      )}
      <label className="adm-field">
        <span>Note</span>
        <textarea
          rows={3}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What did you find? Required when flagging as cheating."
        />
      </label>
      {error && (
        <p className="adm-field-error" role="alert">
          {error}
        </p>
      )}
      <div className="adm-review-actions">
        <button
          type="button"
          className="adm-btn adm-btn-danger"
          disabled={busy}
          onClick={() => save("flagged")}
        >
          Flag as cheating
        </button>
        <button
          type="button"
          className="adm-btn adm-btn-primary"
          disabled={busy}
          onClick={() => save("cleared")}
        >
          Clear: no cheating found
        </button>
        {decided && (
          <button
            type="button"
            className="adm-btn adm-btn-quiet"
            disabled={busy}
            onClick={() => save("pending")}
          >
            Remove decision
          </button>
        )}
      </div>
    </section>
  );
}
