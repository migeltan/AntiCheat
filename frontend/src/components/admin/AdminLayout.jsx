import { NavLink, Outlet } from 'react-router-dom'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/500.css'
import '../../styles/admin.css'
import { api } from '../../lib/api'
import { usePolling } from '../../components/admin/usePolling'

// Small "Server online · 38 ms" indicator for the rail footer.
function ServerStatus() {
  const { data, error, loading } = usePolling(async (signal) => {
    const t = performance.now()
    await api('/ping', { signal })
    return Math.round(performance.now() - t)
  }, { key: 'ping', interval: 15000 })

  const state = loading ? 'checking' : error ? 'offline' : 'online'
  const text = { checking: 'Checking server', online: `Server online${data != null ? `, ${data} ms` : ''}`, offline: 'Server unreachable' }[state]
  return (
    <p className={`adm-server adm-server-${state}`} role="status">
      <span className="adm-server-dot" aria-hidden="true" />
      {text}
    </p>
  )
}

export default function AdminLayout() {
  return (
    <div className="adm">
      <a className="adm-skip" href="#adm-main">Skip to content</a>
      <aside className="adm-rail">
        <NavLink to="/admin" className="adm-brand" end>
          AntiCheat
          <span>Admin</span>
        </NavLink>
        <nav className="adm-nav" aria-label="Admin">
          <NavLink to="/admin" end className={({ isActive }) => (isActive ? 'adm-nav-link is-active' : 'adm-nav-link')}>
            Exams
          </NavLink>
          <NavLink to="/admin/exams/new" className={({ isActive }) => (isActive ? 'adm-nav-link is-active' : 'adm-nav-link')}>
            New exam
          </NavLink>
        </nav>
        <div className="adm-rail-foot">
          <ServerStatus />
          <NavLink to="/" className="adm-nav-link adm-nav-link-quiet">Back to start page</NavLink>
        </div>
      </aside>
      <main id="adm-main" className="adm-main">
        <Outlet />
      </main>
    </div>
  )
}