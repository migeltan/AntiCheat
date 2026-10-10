# AntiCheat: context for Claude

Read this briefly, then continue from **Next**. Do not re-ask decided items or re-inspect files this file already describes. Conserve tokens.

## Start here (every new conversation)

1. Sync the clone (section 2). Read-only: no installs, no downloads.
2. Run the **Verify** greps (section 5) to see what has landed in `dev`.
3. Reply with one short line: current state and what you will do next. Then work on **Next**.

Kickoff prompt: "Continue AntiCheat. Clone dev, read /CLAUDE.md, verify status, continue from Next."

## 1. How we work

- **One phase/feature at a time, in small steps** (a previous conversation died doing a big UI rewrite in one shot). Present exact snippets grouped by file in implementation order: `Replace this:` (existing code, verbatim) then `with this:`. New file or a heavy rewrite: exact path, one-line reason, full contents. No unrelated refactors.
- **The user applies changes himself** (Windows, `C:\Users\migel\AntiCheat`). No output files or present_files unless he asks (CLAUDE.md is the exception: send it as a downloadable `.md`). Code goes in chat.
- His files may be Prettier-formatted (double quotes, semicolons) or not, per file (`usePolling.js` has no semicolons): match by content. If a snippet cannot match, ask him to paste the file, then return it in full.
- State manual steps explicitly (env vars, commands, deletions). Wait for approval before the next phase.
- **Cannot run the test suite or a browser** (no `vendor/`, `node_modules/`). Before sending, verify what you can: PHP with `php -l`; frontend by applying every snippet to a scratch copy with an exact-match script (each "Replace this" must match once) and syntax-checking with the global TypeScript at `/home/claude/.npm-global/lib/node_modules/typescript` (`ts.transpileModule`, jsx preserve). Say "syntax-checked" vs "not run". The user runs `php artisan test` and `npm run dev` and sends screenshots.
- **Tokens:** inspect only relevant files (`grep`, `sed -n` ranges), concise replies, at most one question per reply (prefer a stated default).
- Be direct; flag risks honestly. A violation is a review flag, never proof.

## 2. Seeing the code

```bash
mkdir -p /home/claude/migeltan && cd /home/claude/migeltan
[ -d anticheat ] || git clone --depth 1 --branch dev https://github.com/migeltan/AntiCheat.git anticheat
cd anticheat && git fetch --depth 15 origin dev && git reset --hard FETCH_HEAD && git log --oneline -5
```

- Read-only reference; never push. It shows only what is **pushed to `dev`**; if he says he applied something not visible, ask him to push or paste it.
- Ignore `backend/CLAUDE.md` / `backend/AGENTS.md` (boilerplate). Never run `composer install`, `npm install`, `pip install`.

## 3. Project

Web-based quiz system (school project, PUP, Philippines) replacing Google Forms. Students take exams in-app; the app silently records suspicious browser activity; teachers review the logs and decide.

- Google Forms are imported into native questions (public link via backend fetch, pasted page source, or manual). AntiCheat has its own timer, autosave, submit, tracking.
- Stack: Laravel ^13.17 / PHP ^8.3 (`.env` MySQL, `phpunit.xml` SQLite), React + Vite (no TS), react-router. Vite port **5180** `strictPort`.
- `VITE_API_URL` has **no** trailing `/api` (`lib/api.js` adds it). Herd `http://backend.test`; `artisan serve` `http://localhost:8000`.

## 4. Decisions already made (do not re-ask)

**Exam lifecycle** (`draft`/`published`/`closed`): new exams are always drafts; publish needs >=1 question; closed->published reopen allowed, no published->draft. Closing stops new attempts only. Question import only while draft with no sessions. `showByCode`/`start` accept published+closed (draft 404; closed + no session 409). Session endpoints do not check exam status.

**Student experience and tracking**

- `CodeEntry` goes straight to `/details` (`Launcher.jsx` unused). No in-exam warnings/modals/counters; violations logged silently. No auto-submit on violations; timer auto-submit stays.
- Tracking is disclosed: Details has a consent checkbox; `start` requires `consent` every call and stores `consented_at`. No browsing-history tracking.
- Tier 1 signals: tab_switch, window_blur, fullscreen_exit, paste_attempt (medium), copy_attempt, mouse_left (low, 5 s throttle). Nothing is blocked. Fullscreen requested on the Details "Start exam" click, exited on `Result`.
- `needs_review` = medium+high violations >= `max_violations` or any high. **`max_violations` is only this review threshold** (UI: "Review after N violations"); the backend still accepts submit reason `max_violations` but the student app never sends it. It is the system's suggestion only.
- Student header is link-free only in the exam room. Lockdown: Safe Exam Browser as optional per-exam setting later. No Electron.

**Admin auth:** teacher ID + password, no sign-up. Accounts via `php artisan admin:create {id} {name}`. `POST /api/admin/login` returns a random token (sha256 in `admin_tokens`, 12 h); `AdminAuth` middleware guards admin routes; token+user in sessionStorage; `AdminGate` shows sign-in on 401. All teachers see all exams.

**Teacher review verdict:** per session `flagged` (note required), `cleared`, or removed (`pending`); records `reviewed_by/at`. Hidden from student routes via `$hidden`. Admin: `GET /admin/sessions/{id}`, `PATCH /admin/sessions/{id}/review`. Summary exposes `review_status` per student and totals `awaiting_review`, `flagged`, `cleared`.

**Answer keys and scoring (done):** `correct_answer` per choice question, set in `AnswerKeyEditor` (draft only); `backend/app/Support/Scoring.php` auto-scores multiple choice/checkboxes, text answers are marked by the teacher; score shown in `SessionReview`; exam setting `show_score` ("Students see their score") controls the student `Result` page via `SessionResultController`.

**Admin UI design (done, do not redo):**

- Light-only blue/white palette matching the student side; tokens at the top of `admin.css` (`.adm`). `--pine*` are the legacy names of the accent and now hold the student blue `#1f5fd6`. Fonts Inter + Lato (global in `main.jsx`); no dark mode. `.adm h1-h3` colour is pinned (main.css makes headings white in OS dark mode).
- Dashboard: "Needs your review" strip + "To review" column, sorted by pending reviews then live exams. Deep link: `/admin/exams/:id?tab=students&review=awaiting` (StudentsTable reads `review` on mount; ExamDetail keys it on that param).
- Exam page: draft opens on the Questions tab; a draft with no sessions shows setup steps instead of stats; otherwise 5 stats ("To review" is a link); score-visibility switch; Students tab has decision filter chips with counts (no "only with violations" checkbox).
- Session page: "Student N of M", Previous/Next (Students-tab order, newest first), "Next to review" (wraps), Students breadcrumb.
- `usePolling().refresh()` returns a promise that resolves when the reload finishes; `Freshness` shows a spinner while refreshing. Rail "Exams" stays active on exam/session pages.
- Questions tab: segmented mode picker; importer collapses to a card when the draft already has questions.

## 5. Where things are and status

```
backend/  routes/api.php, app/Http/Middleware/AdminAuth.php, app/Console/Commands/CreateAdmin.php
  app/Http/Controllers/  Exam, ExamSession, Question, Answer, Violation, ExamSummary, GoogleForm,
                         AdminAuth, SessionReview, SessionResult
  app/Support/Scoring.php   app/Models/  Exam, ExamSession, Question, Answer, Violation, AdminToken, User
  tests/Feature/  ExamLifecycle, GoogleFormFetch, ReviewEvidence, TierOneHardening, AdminAuth,
                  ReviewVerdict, AnswerKey, ScoreVisibility   (48 tests passed locally)
frontend/src/  App.jsx (/student/*, /admin/* wrapped in AdminGate)
  lib/ api.js, adminAuth.js, quizParser.js, quiz.js, answers.js, environment.js
  hooks/ useExamSession, useAnswerStore, useExamTimer, useViolationMonitor, useNow
  pages/Student/ CodeEntry, Details, ExamRoom, Result (Launcher unused)
  pages/Admin/ AdminLayout, Dashboard, NewExam, ExamDetail, SessionReview
  components/admin/ AdminGate, ReviewPanel, QuestionsPanel, AnswerKeyEditor, LiveBoard, StudentsTable,
                    ViolationLog, ui.jsx (badges, Freshness, ...), format.js, usePolling.js
  styles/ admin.css (.adm-*), student.css (.sa-*)
```

- `components/admin/AdminLayout.jsx` is an unused duplicate of `pages/Admin/AdminLayout.jsx` (ask before deleting). `services/formParser.js` is a stale stub: do not touch.

**Pushed to `dev` (6edd931):** everything through answer keys, score visibility, Dashboard review strip, session prev/next, exam page restyle.

**Applied locally, may not be pushed (verify):** blue palette + fonts, Refresh feedback, Questions tab restyle, draft setup steps/default tab, NewExam wording, rail highlight. Syntax-checked; the palette and Questions tab were seen working in screenshots.

**Verify (run in the clone):**

```bash
cd /home/claude/migeltan/anticheat/frontend/src
grep -c "prefers-color-scheme" styles/admin.css      # 0 = blue palette applied
grep -c "adm-seg" styles/admin.css                    # >0 = Questions tab restyle
grep -c "waiters" components/admin/usePolling.js      # >0 = refresh promise
grep -c "adm-steps" styles/admin.css                  # >0 = draft setup steps
grep -c "rosterNav" pages/Admin/SessionReview.jsx     # >0 = prev/next
```

Gotchas: `VITE_API_URL` must not end in `/api`; Vite 5180 busy = old dev server still running; test helper methods must not reuse Laravel TestCase names (use `makeSession`).

## 6. Next (user's queue, one at a time)

Done: 1 (review verdict UI confirmed), 2 (answer keys + scoring).

3. **Admin UI polish (in progress, nearly done).** Remaining: confirm the last batch in the browser (draft setup steps, rail highlight, NewExam text); check `AnswerKeyEditor` layout, sign-in page and the `SessionReview` page against the new palette (no screenshots seen yet); small fixes only. Then mark 3 done.
4. **Student UI/UX polish** (code entry page is sparse; general improvements).
5. Phase 5 leftovers: unguessable session tokens for student routes, seed data + demo walkthrough, optional per-exam SEB, optional "time away" evidence, delete the duplicate `AdminLayout.jsx`.

## 7. Known risks (state them, do not hide them)

- Student session IDs are sequential and guessable: one student could read another's name/answers (verdict is hidden, but answers are not).
- `exam` payload sent to students includes `max_violations`.
- `lib/api.js` replaces any 5xx message with a generic one (a `/forms/fetch` 502 shows a generic error).
- Dashboard calls `/exams/{id}/summary` once per exam every 10 s (fine for a class, add counts to `GET /exams` if the list grows).
- Browser-only detection misses second devices; reload loses fullscreen; F11 is not detected; `mouse_left` is noisy.
- Admin token sits in sessionStorage; teachers are not separated by exam.

## 8. Updating this file

Only when the conversation nears ~90% usage or he says it is ending: update sections 4-7 only, deliver the full file once as a downloadable `.md` (keep it dense, under ~130 lines, drop stale detail), and remind him to commit it to the repo root and push to `dev` so a fresh clone sees it.
