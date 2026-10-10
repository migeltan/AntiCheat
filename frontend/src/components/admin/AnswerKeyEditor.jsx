import { useState } from "react";
import { api } from "../../lib/api";
import { QUESTION_TYPE_LABELS } from "./format";

const CHOICE_TYPES = ["multiple_choice", "checkboxes"];

// What the editor holds per choice question: a string (multiple choice), a string[]
// (checkboxes) or null (no correct answer set).
const initialKey = (questions) =>
  Object.fromEntries(
    questions
      .filter((q) => CHOICE_TYPES.includes(q.type))
      .map((q) => [q.id, q.correct_answer ?? null]),
  );

const isSet = (v) => (Array.isArray(v) ? v.length > 0 : Boolean(v));

// Draft exams only. Sets the correct answer for each choice question so attempts are
// scored automatically. Text questions are marked by the teacher in the student review.
// Remount with a new React `key` when the question list changes.
export default function AnswerKeyEditor({ questions, examId }) {
  const [key, setKey] = useState(() => initialKey(questions));
  const [saved, setSaved] = useState(() =>
    JSON.stringify(initialKey(questions)),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const choice = questions.filter((q) => CHOICE_TYPES.includes(q.type));
  const withKey = choice.filter((q) => isSet(key[q.id])).length;
  const dirty = JSON.stringify(key) !== saved;

  const change = (id, value) => {
    setKey((k) => ({ ...k, [id]: value }));
    setDone(false);
  };

  const toggle = (q, option) => {
    const current = Array.isArray(key[q.id]) ? key[q.id] : [];
    const next = current.includes(option)
      ? current.filter((o) => o !== option)
      : q.options.filter((o) => current.includes(o) || o === option); // keep option order
    change(q.id, next.length ? next : null);
  };

  async function save() {
    setBusy(true);
    setError("");
    try {
      const updated = await api(`/exams/${examId}/answer-key`, {
        method: "PUT",
        body: { key },
      });
      const next = initialKey(updated);
      setKey(next);
      setSaved(JSON.stringify(next));
      setDone(true);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <div className="adm-keyed">
      {choice.length > 0 && (
        <p className="adm-note">
          Mark the correct answer for each choice question and attempts are
          scored automatically (one point each; checkboxes need every correct
          box and no others). Text answers are left for you to read.{" "}
          <strong>
            {withKey} of {choice.length} set.
          </strong>
        </p>
      )}
      <ol className="adm-qlist">
        {questions.map((q) => {
          const isChoice = CHOICE_TYPES.includes(q.type);
          const multi = q.type === "checkboxes";
          return (
            <li key={q.id}>
              <p className="adm-q-prompt">{q.prompt}</p>
              <p className="adm-q-meta">
                {QUESTION_TYPE_LABELS[q.type] ?? q.type}
                {q.required ? "" : ", optional"}
                {!isChoice && ", marked by you"}
              </p>
              {isChoice && (
                <fieldset className="adm-key-options">
                  <legend>
                    {multi ? "Correct answers (tick all)" : "Correct answer"}
                  </legend>
                  {q.options.map((o, j) => (
                    <label key={j} className="adm-key-option">
                      <input
                        type={multi ? "checkbox" : "radio"}
                        name={`key-${q.id}`}
                        checked={
                          multi
                            ? Array.isArray(key[q.id]) && key[q.id].includes(o)
                            : key[q.id] === o
                        }
                        onChange={() =>
                          multi ? toggle(q, o) : change(q.id, o)
                        }
                      />{" "}
                      {o}
                    </label>
                  ))}
                  {isSet(key[q.id]) && (
                    <button
                      type="button"
                      className="adm-btn adm-btn-quiet"
                      onClick={() => change(q.id, null)}
                    >
                      Clear answer
                    </button>
                  )}
                </fieldset>
              )}
            </li>
          );
        })}
      </ol>

      {error && (
        <div className="adm-alert" role="alert">
          <p>{error}</p>
        </div>
      )}
      {done && !dirty && (
        <p className="adm-ok" role="status">
          Answer key saved.
        </p>
      )}
      {choice.length > 0 && (
        <div className="adm-form-actions">
          <button
            type="button"
            className="adm-btn adm-btn-primary"
            onClick={save}
            disabled={busy || !dirty}
          >
            {busy ? "Saving…" : "Save answer key"}
          </button>
        </div>
      )}
    </div>
  );
}
