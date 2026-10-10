# AntiCheat: context for Claude

Read this briefly, then continue from **Next**. Do not re-ask decided items or re-inspect files this file already describes. Conserve tokens.

## Start here (every new conversation)

1. Sync the clone (section 2). Read-only: no installs, no downloads.
2. Run the **Verify** greps (section 5) to see what has landed in `dev`.
3. Reply with one short line: current state and what you will do next. Then work on **Next**.

Kickoff prompt: "Continue AntiCheat. Clone dev, read /CLAUDE.md, verify status, continue from Next."

## 1. How we work

- **One phase/feature at a time.** Present exact snippets grouped by file in implementation order: `Replace this:` (existing code, verbatim) then `with this:`. New file: exact path, one-line reason, full contents. No unrelated refactors.
- **The user applies changes himself** (Windows, `C:\Users\migel\AntiCheat`). No output files or present_files unless he asks. Code goes in chat.
- His files may be Prettier-formatted (double quotes, semicolons) and differ from the clone: match by content. If a snippet cannot match, ask him to paste the file, then return it in full.
- State manual steps explicitly (env vars, commands, deletions). Wait for approval before the next phase.
- **Cannot run tests** (no `vendor/` or `node_modules/` in the clone). Say "syntax-checked" vs "not run". The user runs `php artisan test` and `npm run dev`.
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
- `needs_review` = medium+high violations >= `max_violations` (`significant_violations_count`) or any high. Low ones stay in the log only.
- Student header is link-free only in the exam room (`/student/session/:id`); elsewhere it links to the start page.
- Lockdown: Safe Exam Browser as optional per-exam setting later (server must verify its hash header). No Electron.

**Admin auth:** teacher ID + password (e.g. `2020-0001-MN-0`), no open demo mode, no sign-up form. Accounts via `php artisan admin:create {id} {name}` (same ID again resets password and signs out everywhere; password >= 8). `POST /api/admin/login` (throttle 10/min) returns a random token (sha256 stored in `admin_tokens`, 12 h); `AdminAuth` middleware (`admin.auth`) guards admin routes; frontend keeps token+user in sessionStorage and `AdminGate` shows the sign-in screen on 401. All teachers see all exams (no ownership).

## 5. Where things are and status

```
backend/  routes/api.php (student routes, POST admin/login, admin routes under admin.auth)
  app/Http/Middleware/AdminAuth.php   app/Http/Controllers/AdminAuthController.php
  app/Console/Commands/CreateAdmin.php
  app/Http/Controllers/  Exam, ExamSession, Question, Answer, Violation, ExamSummary, GoogleForm
  app/Models/  Exam, ExamSession, Question, Answer, Violation (TYPES type=>severity), AdminToken, User
  tests/Feature/  ExamLifecycle, GoogleFormFetch, ReviewEvidence, TierOneHardening, AdminAuth
  tests/Concerns/SignsInAsAdmin.php
frontend/src/  App.jsx (/student/*, /admin/* wrapped in AdminGate)
  lib/ api.js (adds Bearer token, fires unauthorized event on 401), adminAuth.js, quizParser.js, quiz.js, answers.js, environment.js
  hooks/ useExamSession, useAnswerStore, useExamTimer, useViolationMonitor, useNow
  pages/Student/ CodeEntry, Details, ExamRoom, Result (Launcher unused)
  components/student/ StudentLayout, ExamRoomView, questions/*
  pages/Admin/ AdminLayout, Dashboard, NewExam, ExamDetail (tabs live/students/violations/questions), SessionReview
  components/admin/ AdminGate, QuestionsPanel, LiveBoard, StudentsTable, ViolationLog, ui.jsx, format.js (VIOLATION_LABELS), usePolling.js
  styles/ admin.css (.adm-*), student.css (.sa-*)
```

- `components/admin/AdminLayout.jsx` is an unused duplicate of `pages/Admin/AdminLayout.jsx` (ask before deleting). `services/formParser.js` is a stale stub: do not touch.

**Pushed to `dev` (a1c2b32):** lifecycle, Google Form fetch, silent tracking, Phase 3 admin UI (closed badge, publish/close/reopen, QuestionsPanel rewrite), `needs_review`.

**Applied locally, reported/expected OK, may not be pushed (verify):**

- Tier 1 backend + student + admin labels (22 tests passed before the auth step).
- Teacher accounts (migration `2026_10_10_000001`, AdminAuth, AdminToken, AdminAuthController, `admin:create`, AdminGate, adminAuth.js, StudentLayout exit link, `significant_violations_count`). Auth step: tests **not yet reported**.

**Verify (run in the clone):**

```bash
cd /home/claude/migeltan/anticheat
for p in backend/app/Http/Middleware/AdminAuth.php backend/app/Console/Commands/CreateAdmin.php \
  backend/tests/Feature/AdminAuthTest.php frontend/src/components/admin/AdminGate.jsx; do [ -e $p ] && echo "yes $p" || echo "NO  $p"; done
ls backend/app/Http/Middleware/AdminKey.php backend/config/anticheat.php 2>&1 | grep -v "No such"   # should print nothing
grep -c "fullscreen_exit" backend/app/Models/Violation.php            # >0 = Tier 1 backend
grep -c "fullscreenchange" frontend/src/hooks/useViolationMonitor.js  # >0 = Tier 1 student
grep -c "significant_violations_count" backend/app/Http/Controllers/ExamSummaryController.php
```

Gotchas: `VITE_API_URL` must not end in `/api` (symptom `api/api/exams`); `npm install` after pulling new deps; Vite 5180 busy = old dev server still running.

## 6. Next (user's queue, one at a time)

1. **Confirm the auth step** (tests + manual sign-in), fix anything.
2. **Review verdict:** per-session teacher decision (Flagged / Cleared + note, who/when). Migration on `exam_sessions` (`review_status`, `review_note`, `reviewed_by`, `reviewed_at`), endpoint under `admin.auth`, controls in `SessionReview`, status shown in `StudentsTable`/Dashboard. Framed as the teacher's decision on evidence, not a system verdict.
3. **Answer keys and scoring:** Google Forms import has no answer key, so add a per-question correct answer in `QuestionsPanel` (draft only), auto-score multiple choice/checkboxes, show correct/incorrect and a score in `SessionReview`; text answers manual.
4. **Admin navigation:** dashboard is hard to navigate (drill-down, `needs_review` in `StudentsTable`/Dashboard, clearer review flow).
5. **Student UI/UX polish** (code entry page is sparse; general improvements).
6. Phase 5 leftovers: unguessable session tokens for student routes, seed data + demo walkthrough, optional per-exam SEB, optional "time away" evidence, delete the duplicate `AdminLayout.jsx`.

## 7. Known risks (state them, do not hide them)

- Student session IDs are sequential and guessable: one student could read another's name/answers.
- `exam` payload sent to students includes `max_violations`.
- `lib/api.js` replaces any 5xx message with a generic one (a `/forms/fetch` 502 shows a generic error).
- Browser-only detection misses second devices; reload loses fullscreen (no re-request, no log); F11 is not detected; `mouse_left` is noisy.
- Admin token sits in sessionStorage (readable by any injected script); teachers are not separated by exam.

## 8. Updating this file

Only when the conversation nears ~90% usage or he says it is ending: update sections 4-7 only, deliver the full file once as a downloadable `.md` (keep it dense, under ~130 lines, drop stale detail), and remind him to commit it to the repo root and push to `dev` so a fresh clone sees it.
