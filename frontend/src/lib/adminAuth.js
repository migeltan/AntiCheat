// Teacher sign-in state. Kept in sessionStorage, so closing the browser signs the teacher out.
const STORAGE_KEY = "anticheat_admin";
export const UNAUTHORIZED_EVENT = "anticheat:unauthorized";

let memory = null; // fallback if the browser blocks sessionStorage

function read() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // blocked or corrupt: fall back to memory
  }
  return memory;
}

export const getAdminToken = () => read()?.token || "";
export const getAdminUser = () => read()?.user || null;

// session = { token, user } exactly as returned by POST /admin/login
export function saveSignIn(session) {
  memory = session;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // storage blocked: held in memory only
  }
}

export function clearSignIn() {
  memory = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing stored
  }
}

// Tells AdminGate to show the sign-in screen.
export function notifyUnauthorized() {
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}
