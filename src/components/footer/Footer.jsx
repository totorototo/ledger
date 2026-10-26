import style from "./Footer.style.js";

// Waymark's footer: the one line closing the page.
function Footer({ className }) {
  return (
    <footer className={className}>
      © 2026 Ledger — La Vallée · uses Garmin Connect data, not made by Garmin
    </footer>
  );
}

export default style(Footer);
