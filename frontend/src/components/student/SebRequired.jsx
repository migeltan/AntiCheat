import { Link } from "react-router-dom";

// Where the .seb settings file is served (see docs/kiosk-setup.md). Relative paths work too.
const SEB_FILE = import.meta.env.VITE_SEB_FILE_URL || "/anticheat.seb";

// seb:// (or sebs:// on https) makes the browser hand the settings file to Safe Exam Browser.
const sebLink = () =>
  new URL(SEB_FILE, window.location.origin).href.replace(/^http/, "seb");

// Shown instead of the details form when the teacher turned Lockdown on for this exam
// and the student is still in a normal browser. The server refuses them anyway.
export default function SebRequired({ title }) {
  return (
    <section className="sa-narrow">
      <header className="sa-intro">
        <p className="sa-wordmark sa-wordmark-lg" aria-hidden="true">
          anticheat
        </p>
        <h1 className="sa-title">{title}</h1>
        <p className="sa-lead">
          Your instructor requires this exam to be taken in Safe Exam Browser.
          It cannot be started in a regular browser.
        </p>
      </header>

      <section className="sa-card" aria-labelledby="seb-heading">
        <h2 id="seb-heading" className="sa-card-title">
          How to start
        </h2>
        <ul className="sa-rules">
          <li>
            Install{" "}
            <a
              href="https://safeexambrowser.org"
              target="_blank"
              rel="noreferrer"
            >
              Safe Exam Browser
            </a>{" "}
            if you do not have it yet.
          </li>
          <li>
            Close other programs first (other browsers, Word, Notepad, PDF
            readers, AI apps). Safe Exam Browser will not start while they are
            open.
          </li>
          <li>
            Press <b>Open in Safe Exam Browser</b> below and allow the prompt.
          </li>
          <li>Once it opens, enter your exam code again to continue.</li>
        </ul>
        <p>
          <a className="sa-btn sa-btn-primary sa-btn-wide" href={sebLink()}>
            Open in Safe Exam Browser
          </a>
        </p>
        <p className="sa-muted">
          Prompt did not appear?{" "}
          <a href={SEB_FILE} download>
            Download the .seb file
          </a>{" "}
          and open it with Safe Exam Browser.
        </p>
      </section>

      <p className="sa-center-text sa-muted">
        Wrong exam? <Link to="/student">Enter a different code</Link>
      </p>
    </section>
  );
}
