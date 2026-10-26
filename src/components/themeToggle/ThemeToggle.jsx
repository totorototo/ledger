import { Moon } from "@styled-icons/feather/Moon";
import { Sun } from "@styled-icons/feather/Sun";
import { memo } from "react";

import useStore from "../../store/store.js";
import style from "./ThemeToggle.style.js";

// Copied from Terminus: a viewport-fixed corner button that flips light and dark.
// `inline` puts it in the masthead's row (once the list shows) instead of the corner.
const ThemeToggle = memo(function ThemeToggle({ className, inline = false }) {
  const theme = useStore((state) => state.theme);
  const toggleTheme = useStore((state) => state.toggleTheme);

  return (
    <button
      type="button"
      className={inline ? `${className} is-inline` : className}
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
});

export default style(ThemeToggle);
