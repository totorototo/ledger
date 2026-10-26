import { css } from "styled-components";

// The suite's mono voice, as Terminus's and Retrace's headings set it.

// A section's label (Terminus's .eyebrow, Retrace's .row-label): small, bold, spaced capitals.
export const eyebrow = css`
  font-family: var(--font-family-mono);
  font-size: var(--font-size-tiny);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--color-text-muted);
`;

// The app's name, as Retrace's masthead: large mono, tight, level with the 44px theme toggle.
export const wordmark = css`
  font-family: var(--font-family-mono);
  font-size: var(--font-size-xlarge);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.04em;
  line-height: 1;
  color: var(--color-text);
`;
