import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import {
  UNAUTHORIZED_EVENT,
  clearSignIn,
  getAdminToken,
  saveSignIn,
} from "../../lib/adminAuth";

// Wraps the admin area. Without a valid teacher sign-in, shows the sign-in form instead.
export default function AdminGate({ children }) {
  const [state, setState] = useState("checking"); // checking | login | ok | offline
  const [form, setForm] = useState({ employee_id: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    setError("");
    if (!getAdminToken()) return setState("login");
    setState("checking");
    try {
      await api("/admin/me");
      setState("ok");
    } catch (err) {
      if (err.status === 401) {
        clearSignIn();
        setState("login");
      } else {
        setError(err.message);
        setState("offline");
      }
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  // any admin request that comes back 401 (expired, signed out) returns here
  useEffect(() => {
    const onUnauthorized = () => {
      clearSignIn();
      setForm((f) => ({ ...f, password: "" }));
      setState("login");
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function signIn(e) {
    e.preventDefault();
    if (!form.employee_id.trim() || !form.password) {
      return setError("Enter your teacher ID and password.");
    }
    setBusy(true);
    setError("");
    try {
      const session = await api("/admin/login", {
        method: "POST",
        body: { employee_id: form.employee_id.trim(), password: form.password },
      });
      saveSignIn(session);
      setForm({ employee_id: "", password: "" });
      setState("ok");
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  if (state === "ok") return children;

  return (
    <div className="adm adm-login-wrap">
      <main className="adm-login-card">
        <p className="adm-login-brand">
          AntiCheat <span>Admin</span>
        </p>

        {state === "checking" && <p role="status">Checking access…</p>}

        {state === "offline" && (
          <>
            <p className="adm-login-error" role="alert">
              {error}
            </p>
            <button type="button" className="adm-btn" onClick={check}>
              Try again
            </button>
          </>
        )}

        {state === "login" && (
          <form onSubmit={signIn} noValidate className="adm-login-form">
            <h1>Teacher sign in</h1>
            <label className="adm-field">
              <span>Teacher ID</span>
              <input
                value={form.employee_id}
                onChange={set("employee_id")}
                placeholder="2020-0001-MN-0"
                autoComplete="username"
                autoCapitalize="characters"
                spellCheck={false}
                autoFocus
              />
            </label>
            <label className="adm-field">
              <span>Password</span>
              <input
                type="password"
                value={form.password}
                onChange={set("password")}
                autoComplete="current-password"
              />
            </label>
            {error && (
              <p className="adm-login-error" role="alert">
                {error}
              </p>
            )}
            <button className="adm-btn adm-btn-primary" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}

        <Link className="adm-login-back" to="/">
          Back to start page
        </Link>
      </main>
    </div>
  );
}
