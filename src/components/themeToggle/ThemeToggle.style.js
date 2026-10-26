import styled from "styled-components";

// Terminus's ThemeToggle style on the CSS custom properties. From its why-comments: a plain
// tinted fill (not glass) stays legible over a flat page, and the ring's 0.4 alpha keeps
// about 3:1 non-text contrast against the background (WCAG 1.4.11).
const style = (Component) => styled(Component)`
  /* why not fixed, as in Terminus: a fixed button would sit over the list's right edge.
     It scrolls away with the masthead. */
  position: absolute;
  top: calc(env(safe-area-inset-top, 0px) + var(--space-5));
  right: calc(env(safe-area-inset-right, 0px) + var(--space-5));
  z-index: var(--z-index-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: color-mix(in srgb, var(--color-text) 12%, transparent);
  border: 1px solid var(--color-control-border);
  border-radius: var(--border-radius-full);
  color: var(--color-text);
  cursor: pointer;
  transition: all var(--transition-base);

  /* In the masthead's row: it flows with Refresh, on the content's edge. */
  &.is-inline {
    position: static;
    flex: none;
  }

  &:hover {
    background: color-mix(in srgb, var(--color-text) 18%, transparent);
    border-color: color-mix(in srgb, var(--color-primary) 60%, transparent);
    color: var(--color-primary-text);
  }
`;

export default style;
