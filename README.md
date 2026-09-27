# AntiCheat

A web-based form/quiz system paired with Safe Exam Browser (SEB) to restrict students from using outside applications (browsers, ChatGPT, Word, Notes, PDF viewers) during an assessment.

Hello

## Tech Stack

- **Laravel (PHP)** — backend API only (`/backend`)
- **React (Vite)** — frontend UI, talks to backend via REST API (`/frontend`)
- **MySQL** — database
- **Git + GitHub/GitLab** — version control
- **Safe Exam Browser (SEB)** — lockdown/kiosk layer (config file, no code)

## Project Structure

```
AntiCheat/
├── backend/    (Laravel — API, DB, migrations)
└── frontend/   (React — form UI, admin dashboard UI)
```

## Prerequisites

Install before doing anything else:

- Laravel Herd (handles PHP + local web server; enable its MySQL service, or install MySQL separately)
- Composer
- Node.js + npm
- Git
- Code editor (VS Code recommended)

---

## For the Project Lead — Creating the Repo (do this once, before anyone clones)

**1. Create the backend (Laravel API)**

```
composer create-project laravel/laravel backend
cd backend
```

- Copy `.env.example` to `.env`
- Set DB credentials in `.env`:
  ```
  DB_CONNECTION=mysql
  DB_HOST=127.0.0.1
  DB_PORT=3306
  DB_DATABASE=anticheat
  DB_USERNAME=root
  DB_PASSWORD=
  ```
- Create the `anticheat` database (via Herd's database UI, phpMyAdmin, HeidiSQL, or CLI: `CREATE DATABASE anticheat;`)
- `php artisan key:generate`
- `php artisan migrate`
- `herd link` in the `backend` folder — serves it at `http://backend.test`
- Open `config/cors.php` and allow the frontend's origin (e.g. `http://frontend.test` or `http://localhost:5173`) so React can call the API
- `cd ..`

**2. Create the frontend (React)**

```
npm create vite@latest frontend -- --template react
cd frontend
npm install
```

- Create a `.env` file in `frontend/` with the backend API URL:
  ```
  VITE_API_URL=http://backend.test/api
  ```
- `herd link` in the `frontend` folder (optional — or just use `npm run dev`'s local server)
- `cd ..`

**3. Combine into one repo**

```
git init
```

- Add a root `.gitignore` covering both:
  ```
  backend/vendor
  backend/.env
  backend/node_modules
  frontend/node_modules
  frontend/.env
  frontend/dist
  ```
- `git add .`
- `git commit -m "Initial Laravel + React setup"`
- `git branch -M main`
- `git remote add origin https://github.com/migeltan/AntiCheat`
- `git push -u origin main`
- Create and push `dev` too, since that's the branch everyone will actually work on:
  ```
  git checkout -b dev
  git push -u origin dev
  ```
- Push `.env.example` files for both `backend` and `frontend` (copies with blank/placeholder values) so teammates know what to fill in locally.

---

## For Everyone Else — Cloning and Setup

1. `git clone https://github.com/migeltan/AntiCheat.git`
2. `cd AntiCheat`
3. `git checkout dev`

**Backend setup:**

1. `cd backend`
2. `composer install`
3. Copy `.env.example` to `.env`, fill in your own DB credentials
4. Create the `anticheat` database locally (same as lead's step above)
5. `php artisan key:generate`
6. `php artisan migrate`
7. `herd link` — confirm `http://backend.test` loads
8. `cd ..`

**Frontend setup:**

1. `cd frontend`
2. `npm install`
3. Copy `.env.example` to `.env`, confirm `VITE_API_URL` points to the backend
4. `npm run dev` — confirm the React app loads and can reach the backend
5. `cd ..`

## Git Workflow

- Two branches: `main` (stable/demo-ready) and `dev` (everyone works here directly — no per-person `feature/*` branches).
- **Before every `git push`, run `git pull` first** to avoid overwriting someone else's work.
- Since each role owns a separate folder (see below), conflicts should be rare — but if `git pull` shows a conflict, resolve it before pushing, don't force-push over it.
- Push small, push often. Don't sit on local changes for days — that's when conflicts get messy.
- Merge `dev` → `main` only at checkpoints (e.g. Sept 29, and before final submission), once `dev` is confirmed working.

## Roles & Folder Ownership

| Role                    | Owns                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| Backend/Data Lead       | `backend/app/Models`, `backend/database/migrations`, `backend/routes/api.php`, violation-log endpoint |
| Form/Frontend Dev       | `frontend/src/components/Form`, `frontend/src/pages` (form UI, timer, submission flow)                |
| Admin Dashboard + UI/UX | `frontend/src/pages/Admin`, `frontend/src/styles`, shared layout/components                           |
| Kiosk/Lockdown Dev      | `.seb` config file, `docs/kiosk-setup.md`, any focus-detection layer                                  |
| QA/Integration + Docs   | `README.md` upkeep, test checklist, merging `dev` into `main` at checkpoints                          |

## Safe Exam Browser (SEB) Setup

1. Download SEB (Windows/Mac) from the official site.
2. Kiosk dev creates a `.seb` config file: whitelist the exam URL (the frontend's URL), disable other browsers, disable alt-tab/task switching, disable clipboard.
3. Distribute the `.seb` file to the team — double-clicking it launches SEB directly into the locked exam view.
4. For the live demo: host both backend and frontend somewhere reachable (or on the same local network) so the `.seb` file points to a stable URL.

## Workflow

1. Each role works mainly in their own folder (see Roles above), on `dev`.
2. `git pull` before you start work, and again right before you `git push`.
3. Push small, push often — don't let local changes pile up for days.
4. QA/Integration lead spot-checks `dev` periodically, flags anyone falling behind, and merges `dev` → `main` at checkpoints.
5. Checkpoint (Sept 29): everyone must have `dev` running locally (both backend and frontend) without errors before deeper integration work begins.

## Timeline

| Dates           | Phase                                |
| --------------- | ------------------------------------ |
| Sept 26–29      | Planning / suggested system features |
| Sept 29 – Oct 9 | Programming                          |
| Oct 9–10        | System testing                       |
| Oct 11–12       | Submission of final system           |
