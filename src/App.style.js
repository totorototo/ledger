import styled from "styled-components";

import { chipPrimary } from "./theme/controls.js";
import { eyebrow } from "./theme/type.js";

// Regimen's page: the start (an eyebrow, a mono title, the one action), then the list.
export const Layout = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  /* The start page's column: the measure, centred, never closer to the edge than the gutter.
     The toolbar's masthead reads it too, so the mark sits over the eyebrow. */
  --start-inset: max(var(--gutter), (100% - var(--measure)) / 2);
  /* The dashboard's width, read by the masthead and the stats pages: the start's measure
     plus the list's, so two tables fit side by side. why not a literal: widths come from
     the tokens, which this app never edits. */
  --measure-dash: calc(var(--measure) + var(--measure-list));

  main {
    display: flex;
    flex: 1;
    flex-direction: column;
    padding-inline: ${(props) => (props.$list ? "var(--gutter-tool)" : "var(--start-inset)")};
  }

  .start {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    max-width: var(--measure);
    padding: var(--start-gap) 0 var(--space-12);
  }

  .start .eyebrow {
    ${eyebrow}
    margin-bottom: var(--space-4);
  }

  .start .title {
    font-family: var(--font-family-mono);
    font-size: clamp(2.25rem, 6vw, 3.5rem);
    font-weight: var(--font-weight-bold);
    letter-spacing: -0.04em;
    line-height: 1;
    max-width: 16ch;
    text-wrap: balance;
    margin-bottom: var(--space-4);
  }

  .start .lede {
    max-width: var(--measure-lede);
    margin-bottom: var(--space-10);
    color: var(--color-text-muted);
  }

  .start .retry {
    ${chipPrimary}
  }

  .start .note {
    max-width: 40ch;
    margin-top: var(--space-8);
    font-family: var(--font-family-mono);
    font-size: var(--font-size-tiny);
    color: var(--color-text-muted);
  }

  @media (max-width: 52em) {
    .start {
      padding-inline: 0;
    }
  }
`;
