# Kiosk / Lockdown Setup (Safe Exam Browser)

This document explains how the lockdown works, how to open the AntiCheat exam in Safe Exam Browser (SEB), what the `.seb` config blocks, and what it cannot do.

**Owner:** Kiosk/Lockdown Dev
**Config file:** `docs/anticheat.seb`

## Status summary

- **The lockdown works inside SEB.** The test table in section 11 records the results.
- **It only exists inside SEB.** It is not part of our URL. A website cannot lock a computer, so SEB is a separate program that opens our URL. Section 8 explains how we make SEB the easy way in and what is still missing to make it the only way in.
- **No passwords are set.** The administrator and quit passwords were removed so the team can test and record easily. `Ctrl+Q` closes SEB right away (see the known limits).
- **Violation warnings rarely appear inside SEB.** SEB blocks the action first, so the web page never sees it. The warnings and logs still work in a normal browser and for anything SEB cannot block. This is by design (section 1).

---

## 1. How the lockdown fits with the web app

AntiCheat has two layers. They do different jobs.

| Layer | Where it lives | What it does |
|---|---|---|
| **Prevention** | Safe Exam Browser + `docs/anticheat.seb` | Blocks other apps, other windows, shortcuts and the clipboard, so the student cannot leave the exam |
| **Detection** | The React app + Laravel backend | Logs what the student does inside the exam page (tab switch, lost focus, leaving full screen, etc.), shows "Warning X of N", and auto-submits at the limit |

Why two layers?

- A web page cannot lock a computer. A browser does not let a website block Alt+Tab, other apps or the clipboard. Only a locked-down browser such as SEB can do that, so the lockdown is a separate program that opens our URL.
- The `.seb` file is SEB's settings file. It tells SEB which URL to open, which sites are allowed, which keys are blocked and how to quit.
- Inside SEB, most cheating attempts are blocked before the web page can see them, so few or no warnings appear there. This is expected: the action was prevented.
- In a normal browser (Chrome, Edge) nothing is blocked, so the detection layer is the protection. Tab switches are logged and warned there.

With a normal browser, the lockdown does not apply. See section 8 for how we make SEB the only way in.

---

## 2. What SEB blocks

Inside SEB, students cannot:

- open other browsers (Chrome, Edge)
- visit other websites (including ChatGPT)
- open Word, Notepad, or PDF viewers
- open desktop AI apps (ChatGPT, Copilot, Claude)
- Alt+Tab or use the Windows key to switch to other apps
- copy/paste, right-click, search the page (Ctrl+F) or open dev tools (F12)
- open new windows

---

## 3. Requirements

- Windows PC
- Safe Exam Browser 3.10.2 or newer (https://safeexambrowser.org)
- Backend running (Laravel Herd, `http://backend.test`) and frontend running (`npm run dev`, `http://localhost:5180`)

---

## 4. Install SEB

1. Download **Safe Exam Browser for Windows** from safeexambrowser.org.
2. Run the installer and finish the setup.
3. Do not run the installer again afterwards. If you see "Modify Setup" / "Uninstall", SEB is already installed. Click **Close**.

---

## 5. Run the exam in SEB

1. Close any prohibited programs first (Edge, Chrome, Word, Notepad, PDF readers, AI apps). SEB will not start the exam while they are running.
2. Start the backend (Herd) and check that `http://backend.test/api/ping` shows `"status":"ok"`.
3. Start the frontend:
   ```
   cd frontend
   npm run dev
   ```
   Leave this terminal running. If it says the port is already in use, the frontend is already running.
4. Open the exam in SEB in one of these ways:
   - double-click `docs/anticheat.seb`, or
   - paste `seb://localhost:5180/anticheat.seb` into Chrome and allow the prompt (tested: it opens SEB straight into the exam page), or
   - on the student page, enter the exam code and click **Download .seb file** on the Launcher page, then open the downloaded file.
5. SEB opens full screen and loads the exam page. The app detects SEB (the user agent contains `SEB/`) and skips the Launcher.

**Leaving SEB:**

- Students: after submitting, click **Exit** on the result screen. This loads the quit link and SEB closes without a password.
- Proctors and testers: press `Ctrl+Q`.

**Passwords:** no administrator or quit password is set in the current config, so `Ctrl+Q` closes SEB right away. This makes testing easy but it is also a way out of the exam (see section 10).

---

## 6. Current config settings

| Setting | Value |
|---|---|
| Start URL | `http://localhost:5180/` *(change to the shared/LAN URL for the live demo)* |
| Quit link (Exam tab) | `http://localhost:5180/seb-quit` (must match `VITE_SEB_QUIT_URL` in `frontend/.env`) |
| Use SEB settings file for | Starting an exam |
| Encryption | None |
| Administrator / quit password | None (removed so the team can test and record easily) |
| Allow user to quit SEB | Yes |

### Lockdown settings

| Tab | Setting | Status |
|---|---|---|
| Network | URL filtering on, allow only `http://localhost:5180/*` and `http://backend.test/*` | [x] |
| Browser | Links that open a new window are blocked | [x] |
| Browser | Block when directing to a different server | [x] |
| Browser | Text search (Ctrl+F) off | [x] |
| Browser | Back/forward navigation off, additional-window navigation and reload off | [x] |
| Browser | Printing of web content and PDF toolbar off | [x] |
| Browser | Reload in the exam window is allowed (so a student can refresh if the page glitches) | [x] |
| Security | Kiosk mode: Create new desktop | [x] |
| Security | Clipboard policy: Block | [x] |
| Security | Screen capture, virtual machines and sticky keys not allowed; max 1 display | [x] |
| Applications | Prohibited processes added (see below) | [x] |
| Hooked Keys | Esc, Ctrl+Esc, Alt+Esc, Alt+Tab, Alt+F4, middle/right mouse, PrintScreen, Alt+Mousewheel blocked | [x] |
| Hooked Keys | F1 to F12 blocked (this includes F12 dev tools and F5 refresh) | [x] |
| Exam | Quit link set, "Ask user to confirm quitting" off | [x] |
| Registry | Ctrl+Alt+Del options (lock, task manager, log off, etc.) disabled, but only enforced with the SEB service (see section 10) | [x] |

### Prohibited processes

Added by us:

`WINWORD.EXE`, `notepad.exe`, `chrome.exe`, `msedge.exe`, `AcroRd32.exe`, `Acrobat.exe`, `ChatGPT.exe`, `Copilot.exe`, `Claude.exe`

SEB also ships with default prohibited remote-access tools (ToDesk, AnyDesk, RustDesk, mstsc, Mouse Without Borders, etc.). We keep them on.

"Force quit" is **off**. SEB asks the student to close these programs instead of killing them, so no unsaved work is lost.

---

## 7. Editing the config

1. Open **SEB Configuration Tool** from the Start menu.
2. Click **Config File → Open Settings…** and choose `docs/anticheat.seb`.
3. Change the settings, then click **Save Settings** (and **Yes** on the encryption warning).
4. Copy the saved file so the Launcher download serves the latest version:
   ```
   copy docs\anticheat.seb frontend\public\anticheat.seb
   ```
5. Test by opening the `.seb` file.
6. Commit and push to `dev`:
   ```
   git pull --no-rebase --no-edit
   git add docs/ frontend/public/anticheat.seb
   git commit -m "Update SEB config"
   git push
   ```

Keep a backup of a working `.seb` before experimenting.

### Environment variables (`frontend/.env`)

```
VITE_SEB_FILE_URL=/anticheat.seb
VITE_SEB_QUIT_URL=http://localhost:5180/seb-quit
```

`.env` is not pushed to GitHub, so every teammate adds these two lines to their own `frontend/.env` and restarts `npm run dev`.

---

## 8. Making SEB the only way in

The lockdown only exists inside SEB, and a website cannot force a browser to be SEB. What we can do is make SEB the easy path and refuse the rest.

| Step | What it does | Status |
|---|---|---|
| One-click link | `seb://localhost:5180/anticheat.seb` opens SEB straight into the exam (`sebs://` when the app is served over https) | Tested |
| Launcher page | Offers the `.seb` download, and skips itself when the student is already inside SEB | Done |
| Backend check | Backend refuses to start a session unless the user agent contains `SEB/` (for example behind a `REQUIRE_SEB` setting in `.env`, off while developing and on for the demo) | **Proposed to the Backend/Data Lead, not done yet** |
| Launcher button | "Open in Safe Exam Browser" button using the `seb://` link, and hide the "Continue to student details" link when SEB is required | **Proposed to the Form/Frontend Dev, not done yet** |
| Browser Exam Key | Stronger check: SEB sends a hash with every request and the backend verifies it | Not set up (optional) |

Until the backend check is on, a student can open the exam in Chrome and skip the lockdown. In that case only the detection layer (warnings and logs) protects the exam.

A user agent can be faked by someone technical. The Browser Exam Key is harder to fake but needs more setup on the backend.

---

## 9. Live demo notes

- `localhost` and `backend.test` only work on the computer that runs them.
- For another device, host the app or use the LAN IP (example: `http://192.168.x.x:5180`). Put that exact address in the **Start URL**, the **URL filter** allow list (Network tab) and the **quit link** (Exam tab), and in `VITE_SEB_QUIT_URL`. Save the `.seb` file, copy it into `frontend/public/`, then push it.
- Run the frontend with `npm run dev -- --host` so other computers can reach it.
- Install SEB on the demo device, pull `dev`, add the two `.env` lines, and close Edge, Chrome, Word and Notepad before opening the `.seb` file.
- SEB blocks screen recording (screen capture is not allowed in the config). Test a short recording first, or film the screen with a phone.
- To show the detection layer, use a normal browser: switching tabs logs a warning. To show the prevention layer, use SEB: Alt+Tab, the Windows key, copy/paste and other apps do nothing.

---

## 10. Known limits

- SEB only protects the computer it runs on. A student using a second device (phone) is not blocked.
- The lockdown only exists inside SEB. Until the backend requires SEB (section 8), the exam can be opened in a normal browser.
- No quit password is set, so anyone can press `Ctrl+Q` to leave SEB mid-exam. For a real exam, set a quit password on the General tab.
- We run SEB with **"Ignore SEB Service"** on, so the Windows service is not needed. Because of this, Win+L, Ctrl+Alt+Del and the Registry-tab restrictions cannot be fully enforced.
- Some laptop keyboards have manufacturer shortcuts that SEB cannot intercept. Example: on one team laptop, F10 locks the device even though F10 is blocked in SEB.
- The `.seb` file is not encrypted, so anyone with the file can open and edit it in the Config Tool.
- The URL filter blocks websites. Desktop apps are blocked by "Create new desktop" and the prohibited-process list.
- Actions that SEB blocks never reach the web page, so they do not produce violation warnings. This is by design.
- The violation counter ("Warning X of N", N is set per exam) lives in the React app and backend, not in the `.seb` file.
- Fill in anything else found during testing here.

---

## 11. Test results

Try each of these from inside SEB and record the result.

| Test | Expected | Result |
|---|---|---|
| Exam page loads from the `.seb` file | Loads | |
| `seb://localhost:5180/anticheat.seb` from Chrome | Opens SEB into the exam | Works |
| Alt+Tab | Blocked | |
| Windows key | Blocked | |
| F12 (dev tools) | Blocked | |
| Right-click | Blocked | |
| Copy / paste | Blocked | |
| Ctrl+F (find) | Blocked | |
| Ctrl+N / new window | Blocked | |
| Open Chrome / Edge | Blocked | |
| Open Word | Blocked | |
| Open Notepad | Blocked | |
| Open a PDF | Blocked | |
| Visit chatgpt.com | Blocked | |
| Start SEB while Word/Notepad/Edge is open | SEB asks to close them | |
| Start SEB while an AI app is open | SEB asks to close it | |
| Move the mouse to the screen edge | No false warning | |
| Ctrl+Q, then cancel | No false warning | |
| Timer runs and autosave shows "Saved just now" | Works | |
| Submit, then click **Exit** | SEB closes without a password | |
| Same exam in Chrome: switch tabs | Warning logged | |

---

## 12. Troubleshooting

| Problem | Fix |
|---|---|
| Blank page in SEB | Make sure `npm run dev` is running and the Start URL matches the port (5180) |
| Page blocked in SEB | Add the URL to the URL filter allow list |
| `Port 5180 is already in use` | The frontend is already running in another terminal. Do not start it twice |
| SEB says to close programs | Close the programs it lists (Edge, Word, Notepad, AI apps, etc.) and open the `.seb` file again |
| "Backend offline" or "Cannot reach the server" | Check `http://backend.test/api/ping`. If the browser says `DNS_PROBE_FINISHED_NXDOMAIN`, open Herd → General → **Write to Hosts File** and run `herd link` in the `backend` folder |
| Apache "Not Found" page at `backend.test` | Another web server (XAMPP, WAMP) is using port 80. Stop it, restart Herd and run `herd link` again |
| "You have already submitted this exam" | Each student number can submit once. Use a new student number to test again |
| Exit button does nothing in SEB | The quit link in the Config Tool (Exam tab) must match `VITE_SEB_QUIT_URL` exactly. Restart `npm run dev` after changing `.env` |
| Cannot exit SEB | Press `Ctrl+Q`. Last resort: `Ctrl+Alt+Del` and sign out |
| Config won't open | Open the SEB Configuration Tool first, then use **Open Settings…** |
| Git opens a text editor (Vim) | Press `Esc`, type `:q!`, press Enter, then commit again with `git commit -m "message"` |