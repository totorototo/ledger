import { useEffect } from "react";

import { Layout } from "./App.style.js";
import Footer from "./components/footer/Footer.jsx";
import LoadingSpinner from "./components/loadingSpinner/LoadingSpinner.jsx";
import AllTime from "./components/stats/AllTime.jsx";
import YearStats from "./components/stats/YearStats.jsx";
import ThemeToggle from "./components/themeToggle/ThemeToggle.jsx";
import Toolbar from "./components/toolbar/Toolbar.jsx";
import useStore from "./store/store.js";

// What to do about a refusal, by the proxy's status (server/garmin.js).
export function connectHint(status) {
  if (status === 503) {
    return {
      title: "No API key yet",
      hint: "Put GARMIN_PERSONAL_API_KEY in the repo's .env, then restart the dev server.",
    };
  }
  if (status === 401 || status === 403) {
    return {
      title: "Garmin refused the key",
      hint: "Create a new one in Garmin Connect's settings (Personal API Key) and replace it in .env.",
    };
  }
  return {
    title: "Garmin did not answer",
    hint: "Garmin could not be reached. Check the connection and try again.",
  };
}

export default function App() {
  const status = useStore((state) => state.status);
  const error = useStore((state) => state.error);
  const errorStatus = useStore((state) => state.errorStatus);
  const connect = useStore((state) => state.connect);
  const view = useStore((state) => state.view);

  // The key is the server's, so there is nothing to ask for: the page connects as it opens.
  useEffect(() => {
    if (useStore.getState().status === "idle") connect();
  }, [connect]);

  return (
    <Layout $list={status === "ready"}>
      {/* Once the list shows, the masthead holds it (Toolbar.jsx). */}
      {status !== "ready" && <ThemeToggle />}
      <Toolbar />
      <main>
        {(status === "idle" || status === "loading") && (
          <LoadingSpinner label="Reading your Garmin account…" />
        )}
        {status === "error" && (
          <div className="start" role="alert">
            <span className="eyebrow">Personal API</span>
            {/* why the headline follows the cause: "did not answer" over a missing key sent
                people to check their network. */}
            <h2 className="title">{connectHint(errorStatus).title}</h2>
            <p className="lede">{connectHint(errorStatus).hint}</p>
            <button type="button" className="retry" onClick={connect}>
              Try again
            </button>
            <p className="note detail">The server said: {error}</p>
          </div>
        )}
        {status === "ready" && view === "year" && <YearStats />}
        {status === "ready" && view === "all" && <AllTime />}
      </main>
      <Footer />
    </Layout>
  );
}
