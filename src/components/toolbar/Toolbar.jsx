import { RefreshCw } from "@styled-icons/feather/RefreshCw";

import useStore from "../../store/store.js";
import { MARK_PATH } from "../../theme/mark.js";
import ThemeToggle from "../themeToggle/ThemeToggle.jsx";
import style from "./Toolbar.style.js";

// The name is the page's h1, as on the suite's start pages.
function Brand() {
  return (
    <h1 className="brand">
      <svg className="mark" viewBox="0 0 64 64" aria-hidden="true">
        <path d={MARK_PATH} fillRule="evenodd" />
      </svg>
      {/* why not "garmin": the app is not Garmin's; the footer says whose data it reads. */}
      <span>ledger</span>
    </h1>
  );
}

function Toolbar({ className }) {
  const status = useStore((state) => state.status);
  const profile = useStore((state) => state.profile);
  const refresh = useStore((state) => state.refresh);
  const view = useStore((state) => state.view);
  const setView = useStore((state) => state.setView);
  const history = useStore((state) => state.history);
  // Reading: the whole history, or what's new since the kept one.
  const busy = history?.status === "loading" || history?.syncing === true;
  // The kept history shows, but what's new since couldn't be read.
  const stale = history?.status === "ready" && Boolean(history.error);

  if (status !== "ready") {
    return (
      <header className={`${className} is-start`}>
        <Brand />
      </header>
    );
  }

  return (
    <header className={className}>
      <Brand />
      {/* Whose data this is, in a word: the label added nothing the name doesn't say. */}
      <span className="account" title={`Signed in as ${profile?.displayName ?? "–"}`}>
        {profile?.displayName ?? "–"}
      </span>
      <nav className="views" aria-label="Views">
        <button type="button" aria-pressed={view === "year"} onClick={() => setView("year")}>
          Year
        </button>
        <button type="button" aria-pressed={view === "all"} onClick={() => setView("all")}>
          All time
        </button>
      </nav>
      {/* why say nothing once up to date: that is the usual case; only a read under way,
          or kept data that may be old, is worth a word. */}
      <span className={`sync${stale ? " is-stale" : ""}`} role="status">
        {busy && "Updating…"}
        {stale && <span title={history.error}>Couldn&rsquo;t update · showing saved data</span>}
      </span>
      <button
        type="button"
        className={`refresh${busy ? " is-busy" : ""}`}
        aria-busy={busy}
        onClick={refresh}
      >
        <RefreshCw size={16} aria-hidden="true" />
        <span className="refresh-label">Refresh</span>
      </button>
      {/* In the row, so it lines up with the content's edge, not the window's. */}
      <ThemeToggle inline />
    </header>
  );
}

export default style(Toolbar);
