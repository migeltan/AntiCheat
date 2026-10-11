import { useEffect, useRef } from "react";

// Browser-level detection only. Everything is logged silently for the instructor to review;
// nothing is blocked and nothing is shown to the student. OS-level lockdown and 'app_detected'
// would come from SEB, not from React.
const DEBOUNCE_MS = 1500;
const MOUSE_DEBOUNCE_MS = 5000;

export function useViolationMonitor(enabled, onViolation) {
  const cb = useRef(onViolation);
  useEffect(() => {
    cb.current = onViolation;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    let last = 0;
    let timer = null;
    const lastByType = {};

    // tab switch + blur share one debounce: a tab switch fires both events
    const report = (type) => {
      const now = Date.now();
      if (now - last < DEBOUNCE_MS) return;
      last = now;
      cb.current(type);
    };
    // per-type throttle for the other events
    const throttled = (type, ms = DEBOUNCE_MS) => {
      const now = Date.now();
      if (now - (lastByType[type] ?? 0) < ms) return;
      lastByType[type] = now;
      cb.current(type);
    };

    const onVisibility = () => {
      if (document.hidden) report("tab_switch");
    };
    const onBlur = () => {
      clearTimeout(timer);
      // give visibilitychange a moment so a tab switch is labelled correctly
      timer = setTimeout(
        () => report(document.hidden ? "tab_switch" : "window_blur"),
        150,
      );
    };
    const onFullscreen = () => {
      if (!document.fullscreenElement) throttled("fullscreen_exit");
    };
    const onCopy = () => throttled("copy_attempt");
    const onPaste = () => throttled("paste_attempt");
    const onMouseLeave = () => throttled("mouse_left", MOUSE_DEBOUNCE_MS);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCopy);
    document.addEventListener("paste", onPaste);
    document.documentElement.addEventListener("mouseleave", onMouseLeave);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCopy);
      document.removeEventListener("paste", onPaste);
      document.documentElement.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [enabled]);
}
