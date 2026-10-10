import { useState } from "react";
import { api } from "../../lib/api";
import {
  ParseError,
  parseGoogleForm,
  toImportPayload,
  validateQuestions,
} from "../../lib/quizParser";
import { usePolling } from "./usePolling";
import AnswerKeyEditor from "./AnswerKeyEditor";
import { Loading, StateMessage } from "./ui";
import { QUESTION_TYPE_LABELS } from "./format";

const CHOICE_TYPES = ["multiple_choice", "checkboxes"];
const MODES = [
  { id: "link", label: "Google Form link" },
  { id: "source", label: "Paste page source" },
  { id: "manual", label: "Write manually" },
];
const EMPTY_DRAFT = {
  type: "multiple_choice",
  prompt: "",
  optionsText: "",
  required: true,
};

// Accepts a Google Form page's source (view-source: copy), the FB_PUBLIC_LOAD_DATA_
// array as JSON, or a ready-made { questions: [...] } object. All parsing and
// validation is lib/quizParser.js; this component only collects the input.
function parseInput(text) {
  const trimmed = text.trim();
  if (!trimmed) throw new ParseError("Paste the form source first.");
  if (trimmed.startsWith("{")) {
    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      throw new ParseError("That is not valid JSON.");
    }
    if (!Array.isArray(obj.questions))
      throw new ParseError('Expected an object with a "questions" list.');
    const problems = validateQuestions(obj.questions);
    if (problems.length)
      throw new ParseError("Some questions cannot be imported.", problems);
    return { questions: obj.questions, skipped: [] };
  }
  if (trimmed.startsWith("[")) {
    let arr;
    try {
      arr = JSON.parse(trimmed);
    } catch {
      throw new ParseError("That is not valid JSON.");
    }
    return parseGoogleForm(arr);
  }
  return parseGoogleForm(trimmed);
}

function QuestionList({ questions }) {
  return (
    <ol className="adm-qlist">
      {questions.map((q, i) => (
        <li key={q.id ?? i}>
          <p className="adm-q-prompt">{q.prompt}</p>
          <p className="adm-q-meta">
            {QUESTION_TYPE_LABELS[q.type] ?? q.type}
            {q.required ? "" : ", optional"}
          </p>
          {q.options?.length > 0 && (
            <ul className="adm-q-options">
              {q.options.map((o, j) => {
                const correct = [].concat(q.correct_answer ?? []).includes(o);
                return (
                  <li key={j} className={correct ? "is-correct" : undefined}>
                    {o}
                    {correct && (
                      <span className="adm-key-tag">Correct answer</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}

export default function QuestionsPanel({ summary, onImported }) {
  const { exam, totals } = summary;
  const {
    data: questions,
    error,
    loading,
    refresh,
  } = usePolling((signal) => api(`/exams/${exam.id}/questions`, { signal }), {
    key: `questions:${exam.id}`,
    interval: 0,
  });
  const [mode, setMode] = useState("link");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [manual, setManual] = useState([]);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [preview, setPreview] = useState(null); // { questions, skipped }
  const [problem, setProblem] = useState(null); // { message, problems[] }
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  // With questions already in place the importer starts collapsed (see below).
  const [showImport, setShowImport] = useState(false);

  // Backend answers 409 unless the exam is a draft with no sessions.
  const locked = exam.status !== "draft" || totals.sessions > 0;
  const hasQuestions = questions?.length > 0;
  const count = (n) => `${n} ${n === 1 ? "question" : "questions"}`;

  const reset = () => {
    setPreview(null);
    setProblem(null);
    setDone(false);
  };
  const fail = (err) => {
    setPreview(null);
    setProblem({ message: err.message, problems: err.problems ?? [] });
  };

  const checkSource = (source) => {
    setDone(false);
    try {
      setPreview(parseInput(source));
      setProblem(null);
    } catch (err) {
      fail(err);
    }
  };

  const fetchLink = async () => {
    setBusy(true);
    reset();
    try {
      const { source } = await api("/forms/fetch", {
        method: "POST",
        body: { url: url.trim() },
      });
      checkSource(source);
    } catch (err) {
      fail(err);
    }
    setBusy(false);
  };

  const addManual = () => {
    const q = {
      type: draft.type,
      prompt: draft.prompt.trim(),
      required: draft.required,
      ...(CHOICE_TYPES.includes(draft.type)
        ? {
            options: draft.optionsText
              .split("\n")
              .map((o) => o.trim())
              .filter(Boolean),
          }
        : {}),
    };
    const problems = validateQuestions([q]);
    if (problems.length)
      return setProblem({
        message: "That question cannot be added.",
        problems,
      });
    setManual((list) => [...list, q]);
    setDraft({ ...EMPTY_DRAFT, type: draft.type });
    reset();
  };

  const save = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await api(`/exams/${exam.id}/questions`, {
        method: "POST",
        body: toImportPayload(preview),
      });
      setDone(true);
      setShowImport(false);
      setPreview(null);
      setUrl("");
      setText("");
      setManual([]);
      refresh();
      onImported?.();
    } catch (err) {
      setProblem({
        message: err.message,
        problems: Object.values(err.errors ?? {}).flat(),
      });
    }
    setBusy(false);
  };

  return (
    <div className="adm-split">
      <div>
        <h2 className="adm-h2">
          {questions?.length ? count(questions.length) : "Questions"}
        </h2>
        {loading && <Loading label="Loading questions" />}
        {!loading && !questions && (
          <StateMessage tone="error" title="Could not load questions">
            {error?.message}
          </StateMessage>
        )}
        {questions?.length === 0 && (
          <StateMessage title="No questions yet">
            Add them from a Google Form or write them yourself. The exam cannot
            be published until it has questions.
          </StateMessage>
        )}
        {questions?.length > 0 &&
          (locked ? (
            <QuestionList questions={questions} />
          ) : (
            <AnswerKeyEditor
              key={questions.map((q) => q.id).join("-")}
              questions={questions}
              examId={exam.id}
            />
          ))}
      </div>

      <aside className="adm-import">
        <h2 className="adm-h2">
          {locked
            ? "Questions are locked"
            : hasQuestions
              ? "Replace questions"
              : "Add questions"}
        </h2>
        {locked ? (
          <p className="adm-note">
            {exam.status !== "draft"
              ? `This exam is ${exam.status}, so its questions can no longer be changed.`
              : `${totals.sessions} ${totals.sessions === 1 ? "student has" : "students have"} already started this exam, so its questions can no longer be changed.`}
          </p>
        ) : hasQuestions && !showImport ? (
          <>
            {done && (
              <p className="adm-ok" role="status">
                Questions imported. Set the correct answers on the left, then
                publish the exam.
              </p>
            )}
            <p className="adm-note">
              Set each question's correct answer on the left. To start over,
              import a new set: it replaces the {count(questions.length)} you
              have now.
            </p>
            <button
              type="button"
              className="adm-btn"
              onClick={() => setShowImport(true)}
            >
              Import a different set
            </button>
          </>
        ) : (
          <>
            <div
              className="adm-seg"
              role="group"
              aria-label="How to add questions"
            >
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={
                    mode === m.id ? "adm-seg-btn is-on" : "adm-seg-btn"
                  }
                  aria-pressed={mode === m.id}
                  onClick={() => {
                    setMode(m.id);
                    reset();
                  }}
                  disabled={busy}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {hasQuestions && (
              <p className="adm-note">
                <strong>
                  Importing replaces the {count(questions.length)} on the left.
                </strong>{" "}
                <button
                  type="button"
                  className="adm-link"
                  onClick={() => {
                    setShowImport(false);
                    reset();
                  }}
                >
                  Never mind
                </button>
              </p>
            )}

            {mode === "link" && (
              <label className="adm-field">
                <span>Public Google Form link</span>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    reset();
                  }}
                  placeholder="https://docs.google.com/forms/d/e/.../viewform"
                />
                <small>
                  The form must be viewable by anyone with the link. If it is
                  private, paste its page source instead.
                </small>
              </label>
            )}

            {mode === "source" && (
              <label className="adm-field">
                <span>Google Form page source</span>
                <textarea
                  rows={8}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    reset();
                  }}
                  placeholder="Open your Google Form, view the page source, and paste all of it here"
                  spellCheck={false}
                />
              </label>
            )}

            {mode === "manual" && (
              <>
                {manual.length > 0 && (
                  <>
                    <QuestionList questions={manual} />
                    <button
                      type="button"
                      className="adm-btn adm-btn-quiet"
                      onClick={() => {
                        setManual((l) => l.slice(0, -1));
                        reset();
                      }}
                    >
                      Remove last question
                    </button>
                  </>
                )}
                <label className="adm-field">
                  <span>Question type</span>
                  <select
                    value={draft.type}
                    onChange={(e) =>
                      setDraft({ ...draft, type: e.target.value })
                    }
                  >
                    {Object.entries(QUESTION_TYPE_LABELS).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="adm-field">
                  <span>Question</span>
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={draft.prompt}
                    onChange={(e) =>
                      setDraft({ ...draft, prompt: e.target.value })
                    }
                  />
                </label>
                {CHOICE_TYPES.includes(draft.type) && (
                  <label className="adm-field">
                    <span>Options (one per line, at least 2)</span>
                    <textarea
                      rows={4}
                      value={draft.optionsText}
                      onChange={(e) =>
                        setDraft({ ...draft, optionsText: e.target.value })
                      }
                    />
                  </label>
                )}
                <label className="adm-check">
                  <input
                    type="checkbox"
                    checked={draft.required}
                    onChange={(e) =>
                      setDraft({ ...draft, required: e.target.checked })
                    }
                  />
                  Required
                </label>
                <button
                  type="button"
                  className="adm-btn"
                  onClick={addManual}
                  disabled={!draft.prompt.trim()}
                >
                  Add question
                </button>
              </>
            )}

            {problem && (
              <div className="adm-alert" role="alert">
                <p>{problem.message}</p>
                {problem.problems.length > 0 && (
                  <ul>
                    {problem.problems.slice(0, 6).map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {done && (
              <p className="adm-ok" role="status">
                Questions imported. Review them on the left, then publish the
                exam.
              </p>
            )}

            {preview ? (
              <div className="adm-preview">
                <p>
                  <strong>Review {count(preview.questions.length)}</strong>{" "}
                  before importing.
                </p>
                <QuestionList questions={preview.questions} />
                {preview.skipped?.length > 0 && (
                  <p className="adm-note">
                    Skipped (not supported):{" "}
                    {preview.skipped.slice(0, 4).join(", ")}
                    {preview.skipped.length > 4
                      ? ` and ${preview.skipped.length - 4} more`
                      : ""}
                    .
                  </p>
                )}
                <div className="adm-form-actions">
                  <button
                    type="button"
                    className="adm-btn adm-btn-primary"
                    onClick={save}
                    disabled={busy}
                  >
                    {busy ? "Importing…" : "Import questions"}
                  </button>
                  <button
                    type="button"
                    className="adm-btn"
                    onClick={() => setPreview(null)}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {mode === "link" && (
                  <button
                    type="button"
                    className="adm-btn adm-btn-primary"
                    onClick={fetchLink}
                    disabled={busy || !url.trim()}
                  >
                    {busy ? "Fetching…" : "Fetch questions"}
                  </button>
                )}
                {mode === "source" && (
                  <button
                    type="button"
                    className="adm-btn adm-btn-primary"
                    onClick={() => checkSource(text)}
                    disabled={!text.trim()}
                  >
                    Check questions
                  </button>
                )}
                {mode === "manual" && manual.length > 0 && (
                  <button
                    type="button"
                    className="adm-btn adm-btn-primary"
                    onClick={() =>
                      setPreview({ questions: manual, skipped: [] })
                    }
                  >
                    Review {count(manual.length)}
                  </button>
                )}
              </>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
