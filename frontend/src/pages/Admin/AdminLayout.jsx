import { NavLink, Outlet, useLocation } from "react-router-dom";
// Inter 400/600/700 and Lato are loaded globally in main.jsx (same fonts as the student side).
import "@fontsource/inter/500.css";
import "@fontsource/ibm-plex-mono/500.css";
import "../../styles/admin.css";
import { api } from "../../lib/api";
import { usePolling } from "../../components/admin/usePolling";
import {
  clearSignIn,
  getAdminUser,
  notifyUnauthorized,
} from "../../lib/adminAuth";

// Small "Server online · 38 ms" indicator for the rail footer.
function ServerStatus() {
  const { data, error, loading } = usePolling(
    async (signal) => {
      const t = performance.now();
      await api("/ping", { signal });
      return Math.round(performance.now() - t);
    },
    { key: "ping", interval: 15000 },
  );

  const state = loading ? "checking" : error ? "offline" : "online";
  const text = {
    checking: "Checking server",
    online: `Server online${data != null ? `, ${data} ms` : ""}`,
    offline: "Server unreachable",
  }[state];
  return (
    <p className={`adm-server adm-server-${state}`} role="status">
      <span className="adm-server-dot" aria-hidden="true" />
      {text}
    </p>
  );
}

async function signOut() {
  try {
    await api("/admin/logout", { method: "POST" });
  } catch {
    // already expired or unreachable: signing out locally is enough
  }
  clearSignIn();
  notifyUnauthorized();
}

export default function AdminLayout() {
  const user = getAdminUser();
  // "Exams" stays highlighted on an exam or student page, but not on the New exam page.
  const onNewExam = useLocation().pathname.endsWith("/exams/new");
  return (
    <div className="adm">
      <a className="adm-skip" href="#adm-main">
        Skip to content
      </a>
      <aside className="adm-rail">
        <NavLink to="/admin" className="adm-brand" end>
          AntiCheat
          <span>Admin</span>
        </NavLink>
        <nav className="adm-nav" aria-label="Admin">
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              isActive && !onNewExam ? "adm-nav-link is-active" : "adm-nav-link"
            }
          >
            Exams
          </NavLink>
          <NavLink
            to="/admin/exams/new"
            className={({ isActive }) =>
              isActive ? "adm-nav-link is-active" : "adm-nav-link"
            }
          >
            New exam
          </NavLink>
        </nav>
        <div className="adm-rail-foot">
          <ServerStatus />
          <NavLink to="/" className="adm-nav-link adm-nav-link-quiet">
            Back to start page
          </NavLink>
          {user && (
            <p className="adm-user">
              {user.name}
              <span>{user.employee_id}</span>
            </p>
          )}
          <button
            type="button"
            className="adm-nav-link adm-nav-link-quiet"
            onClick={signOut}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main id="adm-main" className="adm-main">
        <Outlet />
      </main>
    </div>
  );
}
