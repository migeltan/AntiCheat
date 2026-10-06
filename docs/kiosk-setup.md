# Kiosk / Lockdown Setup (Safe Exam Browser)

This document explains how to install Safe Exam Browser (SEB), open the AntiCheat exam with the `.seb` config file, and what the lockdown blocks.

**Owner:** Kiosk/Lockdown Dev
**Config file:** `docs/anticheat.seb`

---

## 1. What this does

SEB locks the student's computer into the exam. With our config, students cannot:

- open other browsers (Chrome, Edge)
- visit other websites (including ChatGPT)
- open Word, Notepad, or PDF viewers
- open desktop AI apps (ChatGPT, Copilot, Claude)
- Alt+Tab or switch to other apps
- copy/paste, right-click, or open dev tools (F12)

The React app adds a second layer (violation counter: "Warning X of 5") for anything that slips through.

---

## 2. Requirements

- Windows PC
- Safe Exam Browser 3.10.2 or newer (download from https://safeexambrowser.org)
- The frontend and backend running (see the main `README.md`)

---

## 3. Install SEB

1. Download **Safe Exam Browser for Windows** from safeexambrowser.org.
2. Run the installer and finish the setup.
3. Do not run the installer again afterwards. If you see "Modify Setup" / "Uninstall", SEB is already installed. Click **Close**.

---

## 4. Run the exam in SEB

1. Close any prohibited programs first (Edge, Chrome, Word, Notepad, PDF readers, AI apps). SEB will not start the exam while they are running.
2. Start the backend (`herd link`, check `http://backend.test` loads).
3. Start the frontend:
   ```
   cd frontend
   npm run dev
   ```
   Leave this terminal running. If it says the port is already in use, the frontend is already running.
4. Double-click `docs/anticheat.seb`.
5. SEB opens full screen and loads the exam page.

**To quit SEB:** press `Ctrl+Q` and enter the quit password.

> **Quit / admin password:** `admin143` (test password for this project only, do not reuse it anywhere else).

---

## 5. Current config settings

| Setting | Value |
|---|---|
| Start URL | `http://localhost:5180` *(change to the shared/LAN URL for the live demo)* |
| Use SEB settings file for | Starting an exam |
| Encryption | None |
| Allow user to quit SEB | Yes (with password) |

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
| Registry | Ctrl+Alt+Del options (lock, task manager, log off, etc.) disabled, but only enforced with the SEB service (see Known limits) | [x] |

### Prohibited processes

Added by us:

`WINWORD.EXE`, `notepad.exe`, `chrome.exe`, `msedge.exe`, `AcroRd32.exe`, `Acrobat.exe`, `ChatGPT.exe`, `Copilot.exe`, `Claude.exe`

SEB also ships with default prohibited remote-access tools (ToDesk, AnyDesk, RustDesk, mstsc, Mouse Without Borders, etc.). We keep them on.

"Force quit" is **off**. SEB asks the student to close these programs instead of killing them, so no unsaved work is lost.

---

## 6. Editing the config

1. Open **SEB Configuration Tool** from the Start menu.
2. Click **Config File → Open Settings…** and choose `docs/anticheat.seb`.
3. Change the settings, then click **Save Settings** (and **Yes** on the encryption warning).
4. Test by double-clicking the `.seb` file.
5. Commit and push to `dev`:
   ```
   git pull
   git add docs/
   git commit -m "Update SEB config"
   git push
   ```

Keep a backup of a working `.seb` before experimenting.

---

## 7. Live demo notes

- `localhost` and `backend.test` only work on the computer that runs them.
- For the demo, host the app somewhere reachable or use the LAN IP (example: `http://192.168.x.x:5180`).
- Put that exact URL in the **Start URL** and in the **URL filter** allow list (Network tab). If the backend runs on another address, add that to the allow list too.
- Save the `.seb` file again, then push it to `dev`.
- Run the frontend with `npm run dev -- --host` so other computers can reach it.

---

## 8. Test results (Oct 8)

Try each of these from inside SEB and record the result.

| Test | Expected | Result |
|---|---|---|
| Exam page loads | Loads | |
| Alt+Tab | Blocked | |
| Windows key | Blocked | |
| F12 (dev tools) | Blocked | |
| Right-click | Blocked | |
| Copy / paste | Blocked | |
| Ctrl+F (find) | Blocked | |
| Open Chrome / Edge | Blocked | |
| Open Word | Blocked | |
| Open Notepad | Blocked | |
| Open a PDF | Blocked | |
| Visit chatgpt.com | Blocked | |
| Start SEB while Word/Notepad/Edge is open | SEB asks to close them | |
| Start SEB while an AI app is open | SEB asks to close it | |
| Quit with Ctrl+Q + password | Works | |

---

## 9. Known limits

- SEB only protects the computer it runs on. A student using a second device (phone) is not blocked.
- We run SEB with **"Ignore SEB Service"** on, so the Windows service is not needed. Because of this, Win+L, Ctrl+Alt+Del and the Registry-tab restrictions cannot be fully enforced.
- Some laptop keyboards have manufacturer shortcuts that SEB cannot intercept. Example: on one team laptop, F10 locks the device even though F10 is blocked in SEB.
- The `.seb` file is not encrypted, so anyone with the file can open and edit it in the Config Tool.
- The URL filter blocks websites. Desktop apps are blocked by "Create new desktop" and the prohibited-process list.
- If the exam is opened in a normal browser instead of SEB, the backend should reject it (check for `SEB` in the user agent or the SEB request hash header). This still needs to be agreed with the Backend/Data Lead.
- The violation counter ("Warning X of 5") lives in the React app and is not part of the `.seb` file.
- Fill in anything else found during testing here.

---

## 10. Troubleshooting

| Problem | Fix |
|---|---|
| Blank page in SEB | Make sure `npm run dev` is running and the Start URL matches the port (5180) |
| Page blocked in SEB | Add the URL to the URL filter allow list |
| `Port 5180 is already in use` | The frontend is already running in another terminal. Do not start it twice |
| SEB says to close programs | Close the programs it lists (Edge, Word, Notepad, AI apps, etc.) and open the `.seb` file again |
| "Backend offline" badge on the home page | Check that Herd is running, `http://backend.test` loads, and `VITE_API_URL` in `frontend/.env` is correct |
| Cannot exit SEB | Press `Ctrl+Q` and enter the quit password. Last resort: `Ctrl+Alt+Del` and sign out |
| Config won't open | Open the SEB Configuration Tool first, then use **Open Settings…** |
| Git opens a text editor (Vim) | Press `Esc`, type `:q!`, press Enter, then commit again with `git commit -m "message"` |