---

## 🌐 Demo Deployment (other devices, other networks)

For demos, the **frontend runs on Cloudflare Pages** and the **backend runs on the presenter's laptop**, exposed to the internet through an ngrok tunnel. Students and teachers only need a browser and the links below.

| What        | Where                                                     |
| ----------- | --------------------------------------------------------- |
| Students    | https://anticheat-5vy.pages.dev/student                   |
| Teachers    | https://anticheat-5vy.pages.dev/admin                     |
| API (ngrok) | https://gainfully-strum-viewpoint.ngrok-free.dev/api/ping |

**One-time setup** (already done on the demo laptop)

- Backend `.env`: `APP_ENV=production`, `APP_DEBUG=false`, MySQL credentials set
- `php artisan migrate --seed --force` and `php artisan admin:create T001 "Your Name"`
- Backend linked in Laravel Herd: run `herd link backend` inside `backend/`
- Cloudflare Pages project: root `frontend`, build `npm run build`, output `dist`, with environment variables `VITE_API_URL=https://gainfully-strum-viewpoint.ngrok-free.dev` (no trailing `/` or `/api`) and `NODE_VERSION=22`

**Before every demo**

1. Plug in the laptop, keep it awake (Power settings: never sleep), and connect it to stable Wi-Fi.
2. Make sure Laravel Herd and MySQL are running, then check http://backend.test/api/ping returns `"status":"ok"`.
3. Start the tunnel in a terminal and keep it open for the whole demo:

```bash
   ngrok http backend.test:80 --host-header=backend.test --url=gainfully-strum-viewpoint.ngrok-free.dev
```

4. From a phone on mobile data (not your Wi-Fi), open the API link above, then the student link, and confirm the exam code screen loads.
5. Sign in at `/admin`, check the exam is **published**, and share its code with students.

No frontend terminal is needed. Cloudflare Pages redeploys automatically whenever you push to the production branch.

**Demo notes**

- Leave **Require Safe Exam Browser** turned **off** for the demo. The `.seb` file points to `localhost`, so it only works for local testing.
- If you change `VITE_API_URL` in Cloudflare, trigger a new deployment. The value is baked in at build time.
- The free ngrok plan has request and bandwidth limits. If students start getting "Cannot reach the server", check the ngrok terminal and dashboard.

**Demo troubleshooting**

| Problem                            | Fix                                                                                            |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| "Cannot reach the server" on phone | Is ngrok still running? Does the ngrok `/api/ping` link load?                                  |
| `backend.test` shows a 404 page    | Another Herd site is using that name. Run `herd links`, then `herd link backend` in `backend/` |
| ngrok shows a warning page         | Click **Visit Site** once. The app already sends the header that skips it for API calls        |
| Pages build fails                  | Check `NODE_VERSION=22` and root directory `frontend` in the Cloudflare project settings       |
