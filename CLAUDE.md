# AntiCheat: context for Claude

Read this briefly, conserve token use, then continue from **Next**. Do not re-ask decided items or re-inspect files this file already describes. Conserve tokens at all times.

## Start here (every new conversation)

1. Sync the clone (section 2). Read-only: no installs, no downloads.
2. Run the **Verify** greps (section 6) to see what has actually landed in `dev`.
3. Reply with one short line: current state and what you will do next. Then work on **Next**.

Kickoff prompt the user may paste: "Continue AntiCheat. Clone dev, read /CLAUDE.md, verify status, continue from Next."

## 1. How we work

- **One phase/feature at a time.** Before any change, present exact snippets grouped by file in implementation order:
  `Replace this:` (existing code, verbatim) then `with this:`.
  New file: exact path, one-line reason, full contents. No unrelated refactors.
- **The user applies changes himself** in his own repo (Windows, `C:\Users\migel\AntiCheat`). Do NOT create output files or call present_files unless he asks. Give code in chat.
- His local files may be Prettier-formatted (double quotes, semicolons) and differ from the clone. Match snippets by content. If a snippet cannot match, ask him to paste that file, then return it in full.
- State manual steps explicitly (env vars, paths, URLs, imports, commands he must run).
- Wait for approval before moving on. Do not start the next phase unprompted.
- **Cannot run tests.** No `vendor/` or `node_modules/` in the clone, and PHP may be absent (`which php`). Say "syntax-checked" vs "not run". JSX syntax can be checked without installing via the global TypeScript at `/home/claude/.npm-global/lib/node_modules/typescript` (`ts.transpileModule`, jsx preserve) if it exists. The user runs `php artisan test` and `npm run dev` himself.
- **Token rules:** inspect only files relevant to the task, using `grep`/`sed -n` ranges, never whole-file dumps. No repeated context. Concise replies. At most one question per reply; state a recommended default instead of asking when possible.
- Be direct. Flag risks honestly (privacy, security, wrong assumptions) and push back constructively. Treat violations as review flags, never proof.

## 2. Seeing the code

```bash
mkdir -p /home/claude/migeltan && cd /home/claude/migeltan
[ -d anticheat ] || git clone --depth 1 --branch dev https://github.com/migeltan/AntiCheat.git anticheat
cd anticheat && git fetch --depth 15 origin dev && git reset --hard FETCH_HEAD && git log --oneline -5
```

- The clone is a read-only reference. Never push. `reset --hard` is fine.
- It shows only what is **pushed to `dev`**. If the user says he applied something that is not visible, ask him to push or paste it.
- Ignore `backend/CLAUDE.md` and `backend/AGENTS.md`: Laravel Boost boilerplate whose setup/install steps do NOT apply here.
- Never run `composer install`, `npm install`, `pip install`, or download tools.

## 3. Project

AntiCheat is a web-based quiz system (school project, PUP, Philippines). Students take exams inside the app. The app records suspicious browser activity; teachers review the logs and decide. A violation is a **review flag, not proof of cheating**.

- Original brief: replace Google Forms, and detect students opening other webpages, ChatGPT, Word, notes, PDFs. Browser-only detection sees focus loss, not which app. Real lockdown needs software (Safe Exam Browser), optional later.
- Google Forms are imported into native questions (no iframe) three ways: public link (backend fetch), pasted page source, manual entry. Exams use AntiCheat's own timer, autosave, submit, tracking.
- Stack: Laravel ^13.17 / PHP ^8.3 (`.env` MySQL, `phpunit.xml` SQLite), React + Vite (no TypeScript), react-router. Vite port **5180** with `strictPort`.
- Frontend API base is `VITE_API_URL` **without** a trailing `/api` (`lib/api.js` adds `/api`). Herd: `http://backend.test`; `artisan serve`: `http://localhost:8000`.

## 4. Decisions already made (do not re-ask)

**Exam lifecycle** (`draft` / `published` / `closed`)

- New exams are always drafts (`store` ignores a client `status`; the DB default is still `'published'`, so status is set explicitly).
- Publish needs at least one question. `closed` -> `published` reopen is allowed. No `published` -> `draft`.
- Closing stops new attempts only. In-progress students resume and finish until their own timer ends; no force-submit.
- Question import only while draft and no sessions exist (replaces all questions).
- `showByCode` and `start` accept published + closed (draft = 404). Closed + no existing session = 409. Session endpoints (questions, answers, violations, submit) deliberately do not check exam status.
- Existing rows untouched; no status migration.

**Student experience and tracking**

- No launcher/SEB download screen: `CodeEntry` goes straight to `/details`. `Launcher.jsx` stays, unused.
- No in-exam warnings, modals or counters. Violations are logged silently; `ViolationController::store` returns only `{recorded: true}`; the student client never fetches violations.
- No auto-submit on violation count. Timer auto-submit stays. `max_violations` is the teacher's review threshold: summary `needs_review` = violations >= `max_violations` or any high severity.
- Tracking is never hidden: the Details page carries a neutral disclosure line, and Tier 1 adds a consent checkbox. No browsing-history tracking (impossible from a web page; disproportionate under the PH Data Privacy Act).
- Lockdown: Safe Exam Browser as an optional per-exam setting later (server must verify SEB's hash header; the user-agent check in `lib/environment.js` is cosmetic). No Electron shell.

**Admin auth:** `AdminKey` middleware, switchable. Empty `ADMIN_API_KEY` = open demo mode. Never enable it until the admin frontend has a key prompt that sends `Authorization: Bearer`.

## 5. Where things are

```
backend/
  routes/api.php                     student routes, then admin routes under ->middleware('admin.key')
  config/anticheat.php               admin_key from ADMIN_API_KEY
  bootstrap/app.php                  registers 'admin.key' alias
  app/Http/Middleware/AdminKey.php
  app/Http/Controllers/
    ExamController                   index, store(draft), publish, close, showByCode
    ExamSessionController            start(resume/409), show, index, submit
    QuestionController               import(draft only), index, forSession
    AnswerController                 save(autosave), index
    ViolationController              store(silent), index, forExam
    ExamSummaryController            per-exam totals + students + needs_review
    GoogleFormController             fetch: public docs.google.com/forms/d/[e/]{id}/viewform only,
                                     no redirects, 3 MB cap, throttle 10/min; 422 not public, 502 upstream
  app/Models/                        Exam (STATUS_* consts), ExamSession, Question (TYPES), Answer,
                                     Violation (TYPES map type => severity)
  database/migrations/2026_10_04_*   exams, exam_sessions, violations, questions, answers, ...
  tests/Feature/                     ExamLifecycleTest, GoogleFormFetchTest, ReviewEvidenceTest
frontend/src/
  App.jsx                            routes: /student/*, /admin/*
  lib/                               api.js (ApiError .status .errors; 5xx message is generic),
                                     quizParser.js (parseGoogleForm, validateQuestions, toImportPayload),
                                     quiz.js, answers.js, environment.js
  hooks/                             useExamSession, useAnswerStore, useExamTimer, useViolationMonitor, useNow
  pages/Student/                     CodeEntry, Launcher(unused), Details, ExamRoom, Result
  components/student/                ExamRoomView (timer, autosave, submit, violation monitor), Modal, questions/*
  pages/Admin/                       Dashboard, NewExam, ExamDetail (tabs: live/students/violations/questions), SessionReview
  components/admin/                  QuestionsPanel, LiveBoard, StudentsTable, ViolationLog, ui.jsx (ExamStatus), format.js, usePolling.js
  styles/                            admin.css (tokens, .adm-*), student.css (.sa-*), main.css
docs/                                kiosk-setup.md, anticheat.seb      frontend/tests/parser.test.js
```

- `components/admin/AdminLayout.jsx` is a byte-identical unused copy of `pages/Admin/AdminLayout.jsx` (the one `App.jsx` imports). Ask before deleting.
- `frontend/src/services/formParser.js` is a stale stub: do not touch.
- Student routes: `GET /exams/code/{code}`, `POST /exams/code/{code}/sessions`, `GET /sessions/{id}`, `GET .../questions`, `GET|PUT .../answers`, `POST .../violations`, `POST .../submit`, `GET /ping`.

## 6. Milestones

**Pushed to `dev` (commit `63323a7` "phase 1"):** Phase 1 lifecycle (Exam constants, publish/close endpoints, lifecycle-aware start/showByCode, draft-only import, `ExamLifecycleTest`).

**Written by Claude, applied locally by the user, tests reported passing (may not be pushed; verify):**

- Phase 2: `GoogleFormController` + `POST /forms/fetch` + `GoogleFormFetchTest`.
- Phase 4 backend: quiet violation response, `needs_review`, `AdminKey` + `config/anticheat.php` + route grouping, `ReviewEvidenceTest`.
- Student silent tracking: `ExamRoomView.jsx` (no warning modal, no violation auto-submit); `useExamSession` no longer fetches violations; `CodeEntry` -> `/details`; Details wording/disclosure.

**Proposed, not confirmed applied (user deferred UI: "functionality before interface"):** Phase 3 UI: closed badge (`ui.jsx`, `admin.css`), Dashboard "Closed" filter, `NewExam` without the status radio, `ExamDetail` publish/close/reopen buttons, `QuestionsPanel` rewrite (link / pasted source / manual, review before import, lock unless draft).

**Verify (run in the clone):**

```bash
cd /home/claude/migeltan/anticheat
for p in backend/app/Http/Controllers/GoogleFormController.php backend/app/Http/Middleware/AdminKey.php \
  backend/config/anticheat.php backend/tests/Feature/ReviewEvidenceTest.php; do [ -e $p ] && echo "yes $p" || echo "NO  $p"; done
grep -c "Reopen exam" frontend/src/pages/Admin/ExamDetail.jsx        # >0 = Phase 3 UI applied
grep -c "/details" frontend/src/pages/Student/CodeEntry.jsx          # >0 = launcher skipped
grep -c "setWarning" frontend/src/components/student/ExamRoomView.jsx # 0 = silent tracking applied
grep -c "needs_review" backend/app/Http/Controllers/ExamSummaryController.php
```

Past setup gotchas: `VITE_API_URL` must not end in `/api` (symptom: `api/api/exams`); run `npm install` after pulling new deps; Vite port 5180 busy means an old dev server is still running.

## 7. Next

1. **Tier 1 browser hardening** (approved). Backend first, then wait for approval, then student snippets, then admin labels.
   - Backend: add `Violation::TYPES` entries (proposed: `fullscreen_exit` medium, `paste_attempt` medium, `copy_attempt` low, `mouse_left` low). Migration adding nullable `consented_at` to `exam_sessions`; `ExamSession` fillable + datetime cast; `start` requires `consent` accepted and stores `consented_at`; tests.
   - Student: Details consent checkbox whose text states exactly what is recorded (tab switches, loss of window focus, fullscreen exit, copy/paste in answers, mouse leaving the window; reviewed by the instructor); `useViolationMonitor` emits the new types; `ExamRoomView` requests fullscreen on start and logs exits; copy/cut/paste handlers on answer inputs (`components/student/questions/*`).
   - Admin: labels for the new types in `components/admin/format.js` (`VIOLATION_LABELS`).
2. Phase 3 UI (see Milestones), if not yet applied.
3. Phase 4 UI: show `needs_review` in `StudentsTable`/Dashboard; wording that frames logs as evidence for review, not proof.
4. Phase 5: unguessable session tokens for student routes, admin key prompt in the frontend, seed data and an end-to-end demo walkthrough, optional per-exam SEB with server-side hash verification, optional "time away" evidence (needs a new endpoint), consider removing the duplicate `AdminLayout.jsx`.

## 8. Known risks (state them, do not hide them)

- Admin endpoints are unauthenticated unless `ADMIN_API_KEY` is set (and the frontend cannot send it yet). Not safe for public production use.
- Student routes use sequential, guessable session IDs, so one student could read another's name/answers.
- `exam` payloads sent to students include `max_violations`.
- `lib/api.js` replaces any 5xx message with a generic one, so a `/forms/fetch` 502 shows a generic error.
- Browser-only detection misses second devices and blocked focus events.

## 9. Updating this file

Do **not** update it per feature. When the conversation nears ~90% of its usage, or the user says it is ending:

1. Update only: section 6 (milestones: move finished items up, keep Verify current), section 7 (Next: delete done items), section 4 (new decisions), section 8 (risks).
2. Deliver the complete updated file once, in a single code block, for the user to commit to the repo root and push to `dev`. Remind him that it must be pushed for a fresh clone to see it.
3. Keep it under ~200 lines and dense; remove stale detail rather than adding to it.
