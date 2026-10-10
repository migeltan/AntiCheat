# AntiCheat: context for Claude

Read this briefly, then continue from **Next**. Do not re-ask decided items or re-inspect files this file already describes. Conserve tokens.

## Start here (every new conversation)

1. Sync the clone (section 2). Read-only: no installs, no downloads.
2. Run the **Verify** greps (section 5) to see what has landed in `dev`.
3. Reply with one short line: current state and what you will do next. Then work on **Next**.

Kickoff prompt: "Continue AntiCheat. Clone dev, read /CLAUDE.md, verify status, continue from Next."

## 1. How we work

- **One phase/feature at a time.** Present exact snippets grouped by file in implementation order: `Replace this:` (existing code, verbatim) then `with this:`. New file: exact path, one-line reason, full contents. No unrelated refactors.
- **The user applies changes himself** (Windows, `C:\Users\migel\AntiCheat`). No output files or present_files unless he asks (CLAUDE.md is the exception: send it as a downloadable `.md`). Code goes in chat.
- His files may be Prettier-formatted (double quotes, semicolons) or not, per file: match by content. If a snippet cannot match, ask him to paste the file, then return it in full.
- State manual steps explicitly (env vars, commands, deletions). Wait for approval before the next phase.
- **Cannot run the test suite** (no `vendor/` or `node_modules/` in the clone). Before sending, verify what you can: PHP with `php -l` (php exists in the sandbox); frontend by applying every snippet to a scratch copy with an exact-match script (each "Replace this" must match once) and syntax-checking with the global TypeScript at `/home/claude/.npm-global/lib/node_modules/typescript` (`ts.transpileModule`, jsx preserve). Say "syntax-checked" vs "not run". The user runs `php artisan test` and `npm run dev`.
- **Tokens:** inspect only relevant files (`grep`, `sed -n` ranges), no whole-file dumps, concise replies, at most one question per reply (prefer a stated default).
- Be direct; flag risks honestly. A violation is a review flag, never proof.

## 2. Seeing the code

```bash
mkdir -p /home/claude/migeltan && cd /home/claude/migeltan
[ -d anticheat ] || git clone --depth 1 --branch dev https://github.com/migeltan/AntiCheat.git anticheat
cd anticheat && git fetch --depth 15 origin dev && git reset --hard FETCH_HEAD && git log --oneline -5
```

- Read-only reference; never push. It shows only what is **pushed to `dev`**; if he says he applied something not visible, ask him to push or paste it.
- Ignore `backend/CLAUDE.md` / `backend/AGENTS.md` (boilerplate, removed upstream). Never run `composer install`, `npm install`, `pip install`.

## 3. Project

Web-based quiz system (school project, PUP, Philippines) replacing Google Forms. Students take exams in-app; the app silently records suspicious browser activity; teachers review the logs and decide.

- Google Forms are imported into native questions (public link via backend fetch, pasted page source, or manual). AntiCheat has its own timer, autosave, submit, tracking.
- Stack: Laravel ^13.17 / PHP ^8.3 (`.env` MySQL, `phpunit.xml` SQLite), React + Vite (no TS), react-router. Vite port **5180** `strictPort`.
- `VITE_API_URL` has **no** trailing `/api` (`lib/api.js` adds it). Herd `http://backend.test`; `artisan serve` `http://localhost:8000`.

## 4. Decisions already made (do not re-ask)

**Exam lifecycle** (`draft`/`published`/`closed`): new exams are always drafts; publish needs >=1 question; closed->published reopen allowed, no published->draft. Closing stops new attempts only (in-progress students finish on their own timer). Question import only while draft with no sessions. `showByCode`/`start` accept published+closed (draft 404; closed + no session 409). Session endpoints do not check exam status.

**Student experience and tracking**

- `CodeEntry` goes straight to `/details` (`Launcher.jsx` unused). No in-exam warnings/modals/counters; violations logged silently (`store` returns `{recorded:true}`). No auto-submit on violations; timer auto-submit stays.
- Tracking is disclosed: Details has a consent checkbox listing exactly what is recorded; `start` requires `consent` (every call, resume included) and stores `consented_at`. No browsing-history tracking.
- Tier 1 signals: tab_switch, window_blur, fullscreen_exit, paste_attempt (medium), copy_attempt, mouse_left (low, 5 s throttle). Copy/cut/paste listened at document level (also catches copying question text); nothing is blocked. Fullscreen is requested on the Details "Start exam" click and exited on `Result` (not in the monitor cleanup: StrictMode would exit it on mount).
- `needs_review` = medium+high violations >= `max_violations` (`significant_violations_count`) or any high. Low ones stay in the log only. It is the system's suggestion only.
- Student header is link-free only in the exam room (`/student/session/:id`); elsewhere it links to the start page.
- Lockdown: Safe Exam Browser as optional per-exam setting later (server must verify its hash header). No Electron.

**Admin auth:** teacher ID + password (e.g. `2020-0001-MN-0`), no open demo mode, no sign-up form. Accounts via `php artisan admin:create {id} {name}` (same ID again resets password and signs out everywhere; password >= 8). `POST /api/admin/login` (throttle 10/min) returns a random token (sha256 stored in `admin_tokens`, 12 h); `AdminAuth` middleware (`admin.auth`) guards admin routes; frontend keeps token+user in sessionStorage and `AdminGate` shows the sign-in screen on 401. All teachers see all exams (no ownership).

**Teacher review verdict:** per session: `flagged` ("Flag as cheating"), `cleared`, or removed (`pending`). A note is required when flagging, optional when clearing; records `reviewed_by` + `reviewed_at`; allowed on in-progress sessions. Stored on `exam_sessions` (`review_status/note/by/at`) but **hidden from student routes** via `$hidden` on `ExamSession` (student `GET /sessions/{id}` and `start` return the raw model). Admin reads `GET /admin/sessions/{id}` (reveals verdict + `reviewer`) and writes `PATCH /admin/sessions/{id}/review`. Summary exposes `review_status` per student and totals `awaiting_review` (needs_review and no verdict), `flagged`, `cleared`.

## 5. Where things are and status

```
backend/  routes/api.php (student routes, POST admin/login, admin routes under admin.auth)
  app/Http/Middleware/AdminAuth.php   app/Console/Commands/CreateAdmin.php
  app/Http/Controllers/  Exam, ExamSession, Question, Answer, Violation, ExamSummary, GoogleForm,
                         AdminAuth, SessionReview
  app/Models/  Exam, ExamSession (REVIEW_* consts, $hidden), Question, Answer, Violation (TYPES), AdminToken, User
  tests/Feature/  ExamLifecycle, GoogleFormFetch, ReviewEvidence, TierOneHardening, AdminAuth, ReviewVerdict
  tests/Concerns/SignsInAsAdmin.php
frontend/src/  App.jsx (/student/*, /admin/* wrapped in AdminGate)
  lib/ api.js (Bearer token, fires unauthorized event on 401), adminAuth.js, quizParser.js, quiz.js, answers.js, environment.js
  hooks/ useExamSession, useAnswerStore, useExamTimer, useViolationMonitor, useNow
  pages/Student/ CodeEntry, Details, ExamRoom, Result (Launcher unused)
  components/student/ StudentLayout, ExamRoomView, questions/*
  pages/Admin/ AdminLayout, Dashboard, NewExam, ExamDetail (tabs live/students/violations/questions), SessionReview
  components/admin/ AdminGate, ReviewPanel, QuestionsPanel, LiveBoard, StudentsTable, ViolationLog,
                    ui.jsx (StatusBadge, ExamStatus, ReviewBadge, ...), format.js (labels), usePolling.js
  styles/ admin.css (.adm-*), student.css (.sa-*)
```

- `components/admin/AdminLayout.jsx` is an unused duplicate of `pages/Admin/AdminLayout.jsx` (ask before deleting). `services/formParser.js` is a stale stub: do not touch.

**Pushed to `dev` (50c7c92):** lifecycle, Google Form fetch, silent tracking, Phase 3 admin UI, Tier 1 hardening, teacher accounts (27 tests passed locally).

**Applied locally, may not be pushed (verify):**

- Review verdict backend (migration `2026_10_10_000002`, SessionReviewController, summary fields, `ReviewVerdictTest`): **32 tests passed**.
- Review verdict frontend (ReviewPanel, ReviewBadge, SessionReview on `/admin/sessions/{id}`, StudentsTable Decision column + filter + CSV column, ExamDetail "Awaiting review" stat, CSS): syntax-checked on a scratch copy, **not yet reported working in the browser**.

**Verify (run in the clone):**

```bash
cd /home/claude/migeltan/anticheat
for p in backend/app/Http/Controllers/SessionReviewController.php backend/tests/Feature/ReviewVerdictTest.php \
  frontend/src/components/admin/ReviewPanel.jsx; do [ -e $p ] && echo "yes $p" || echo "NO  $p"; done
grep -c "review_status" backend/app/Http/Controllers/ExamSummaryController.php   # >0 = summary exposes verdicts
grep -c "ReviewBadge" frontend/src/components/admin/StudentsTable.jsx            # >0 = UI applied
grep -c "admin/sessions" frontend/src/pages/Admin/SessionReview.jsx              # >0 = page uses admin endpoint
```

Gotchas: `VITE_API_URL` must not end in `/api` (symptom `api/api/exams`); `npm install` after pulling new deps; Vite 5180 busy = old dev server still running; test helper methods must not reuse Laravel TestCase names (e.g. `session()`; use `makeSession`).

## 6. Next (user's queue, one at a time)

1. **Confirm the review verdict UI in the browser** (flag with/without note, clear, remove, Students tab column + filter, exam "Awaiting review" stat); fix anything. Optional: drop the now partly redundant "Only students with violations" checkbox.
2. **Answer keys and scoring:** Google Forms import has no answer key, so add a per-question correct answer in `QuestionsPanel` (draft only), auto-score multiple choice/checkboxes, show correct/incorrect and a score in `SessionReview`; text answers manual.
3. **Admin navigation:** dashboard is hard to navigate: add "to review" (`totals.awaiting_review`) column and drill-down on `Dashboard`, clearer review flow between exam, students and a session (prev/next student).
4. **Student UI/UX polish** (code entry page is sparse; general improvements).
5. Phase 5 leftovers: unguessable session tokens for student routes, seed data + demo walkthrough, optional per-exam SEB, optional "time away" evidence, delete the duplicate `AdminLayout.jsx`.

## 7. Known risks (state them, do not hide them)

- Student session IDs are sequential and guessable: one student could read another's name/answers (verdict is hidden, but answers are not).
- `exam` payload sent to students includes `max_violations`.
- `lib/api.js` replaces any 5xx message with a generic one (a `/forms/fetch` 502 shows a generic error).
- Browser-only detection misses second devices; reload loses fullscreen (no re-request, no log); F11 is not detected; `mouse_left` is noisy.
- Admin token sits in sessionStorage (readable by any injected script); teachers are not separated by exam.

## 8. Updating this file

Only when the conversation nears ~90% usage or he says it is ending: update sections 4-7 only, deliver the full file once as a downloadable `.md` (keep it dense, under ~130 lines, drop stale detail), and remind him to commit it to the repo root and push to `dev` so a fresh clone sees it.
