import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <section className="card center-card">
      <div className="big-icon">🕵️</div>
      <h1>404 - Page not found</h1>
      <p className="muted">Nothing to see here. Maybe a typo in the URL?</p>
      <Link to="/" className="btn btn-primary">Go home</Link>
    </section>
  )
}
