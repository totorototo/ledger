import styled, { keyframes } from "styled-components";

import { chip } from "../../theme/controls.js";
import { wordmark } from "../../theme/type.js";

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

// Regimen's masthead: the mark and name, the account, the views, then the one action. One row
// wherever it fits; on a phone the views take a row of their own.
const style = (Component) => styled(Component)`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  max-width: calc(var(--measure-dash) + 2 * var(--gutter-tool));
  margin: 0 auto;
  /* The theme toggle is the row's last item: the row runs to the content's edge. */
  padding: var(--space-4) var(--gutter-tool);
  border-bottom: 1px solid var(--color-hairline);

  /* Before the list, the masthead heads the centred column (App.style.js), level with the
     theme toggle, with no rule under it: nothing below to set apart yet. */
  &.is-start {
    max-width: none;
    padding: calc(env(safe-area-inset-top, 0px) + var(--space-5))
      calc(var(--space-5) + var(--touch-target) + var(--space-4)) 0 var(--start-inset);
    border-bottom: 0;
  }

  button {
    ${chip}
  }

  /* The sync note pushes Refresh to the row's end; empty, it takes no room. */
  .sync {
    margin-left: auto;
    font-family: var(--font-family-mono);
    font-size: var(--font-size-small);
    color: var(--color-text-muted);
  }

  .sync.is-stale {
    color: var(--color-behind-text);
  }

  button.refresh.is-busy svg {
    animation: ${spin} 1s linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    button.refresh.is-busy svg {
      animation: none;
    }
  }

  /* The theme toggle keeps its round shape against the row's chip style. */
  button.is-inline {
    width: var(--touch-target);
    padding: 0;
    border-radius: var(--border-radius-full);
  }

  /* A segmented control: the views share one outline, the picked one filled.
     why segmented, not separate chips: the views are one exclusive choice, and joined
     segments say that before anyone clicks. */
  .views {
    display: flex;
    gap: var(--space-1);
    margin-left: var(--space-2);
    padding: var(--space-1);
    border: 1px solid var(--color-control-border);
    border-radius: var(--border-radius-base);
  }

  /* No border of their own: the outline is the group's. The radius is the outline's less the
     inset (padding + border), so the corners run parallel to it. */
  .views button {
    min-height: calc(var(--touch-target) - 2 * var(--space-1) - 2px);
    padding-inline: var(--space-4);
    border: 0;
    border-radius: calc(var(--border-radius-base) - var(--space-1) - 1px);
    color: var(--color-text-muted);
  }

  .views button[aria-pressed="true"] {
    background: color-mix(in srgb, var(--color-primary) 14%, transparent);
    color: var(--color-primary-text);
  }

  .brand {
    ${wordmark}
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 44px;
    margin-right: var(--space-2);
  }

  .mark {
    flex: none;
    width: 44px;
    height: 44px;
  }

  /* One ink, as the favicon's: dark's primary is its gold, light's its blue. */
  .mark path {
    fill: var(--color-primary);
  }

  .account {
    min-width: 0;
    max-width: 18rem;
    margin-left: var(--space-2);
    padding-left: var(--space-5);
    overflow: hidden;
    border-left: 1px solid var(--color-hairline);
    font-family: var(--font-family-mono);
    font-size: var(--font-size-small);
    color: var(--color-text-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* A phone: the brand and Refresh (its icon alone) on one row, the views full width under
     them; the account is left out. */
  @media (max-width: 40em) {
    .account {
      display: none;
    }

    /* Under the views, so it never crowds the brand's row. */
    .sync {
      order: 2;
      width: 100%;
      margin-left: 0;
    }

    .sync:empty {
      display: none;
    }

    .views {
      order: 1;
      width: 100%;
      margin-left: 0;
    }

    .views button {
      flex: 1;
    }

    button.refresh {
      width: var(--touch-target);
      margin-left: auto;
      padding: 0;
    }

    /* Out of sight but still the button's name. */
    .refresh-label {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  }
`;

export default style;
