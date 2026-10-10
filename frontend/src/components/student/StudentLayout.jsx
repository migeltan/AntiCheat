import { Link, Outlet, useLocation } from "react-router-dom";
import { Logo, UserIcon } from "./Icons";

// Header from the mockup: [logo anticheat] | [student (icon)].
// Locked (no links) only while the exam itself is open: /student/session/:id.
// Everywhere else (code, details, result) the student can go back to the start page.
export default function StudentLayout() {
  const { pathname } = useLocation();
  const inExam = /^\/student\/session\/[^/]+\/?$/.test(pathname);

  const brand = (
    <>
      <Logo />
      <span className="sa-wordmark">anticheat</span>
    </>
  );

  return (
    <div className="sa">
      <header className="sa-header">
        {inExam ? (
          <div className="sa-brand">{brand}</div>
        ) : (
          <Link to="/" className="sa-brand" aria-label="AntiCheat start page">
            {brand}
          </Link>
        )}
        <div className="sa-user">
          {!inExam && (
            <Link to="/" className="sa-exit">
              Start page
            </Link>
          )}
          <span className="sa-script">student</span>
          <UserIcon />
        </div>
      </header>
      <main className="sa-main">
        <Outlet />
      </main>
    </div>
  );
}
