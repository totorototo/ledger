import styled from "styled-components";

import { chip } from "../../theme/controls.js";
import { eyebrow } from "../../theme/type.js";

// The Year and All-time pages, a dashboard in a centred column: the heading with the type
// filter, four totals as tiles, the column chart, then two tables side by side.
// The chart's categorical palette, by theme: the dataviz reference's first four hues (blue,
// orange, aqua, yellow), then a neutral grey for "other". Checked with its validator on this
// app's surfaces: CVD and normal-vision separation pass in both themes; on light's grey
// (#c4c4c4) the hues sit under 3:1, which the legend's text and the tables relieve.
// why not darker light steps: they reach 3:1 only by pulling the aqua and yellow together
// for colour-blind readers (ΔE under 8).
const SERIES = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#7a7677"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#8f8a8b"],
};

// The evolution charts' hue (running total, load, efficiency, intensity): violet, the
// reference's slot 7, which no sport takes. One ordinal ramp, soft to strong, made in OKLCH at
// hue 285 and checked with the validator's --ordinal on each surface (soft end 2.35:1 light,
// 2.16:1 dark). Strong is the step furthest from the surface: dark on light, light on dark.
// why not a sport's hue: a year or an effort drawn in blue would read as running.
const TREND = {
  light: ["#7973ca", "#5644b4", "#352180"],
  dark: ["#635dab", "#8b85de", "#b7b6f6"],
};

const palette = (props) => {
  const variant = TREND[props.theme.currentVariant] ? props.theme.currentVariant : "light";
  const [one, two, three, four, other] = SERIES[variant];
  const [soft, trend, strong] = TREND[variant];
  return `--series-1: ${one}; --series-2: ${two}; --series-3: ${three}; --series-4: ${four}; --series-other: ${other}; --trend-soft: ${soft}; --trend: ${trend}; --trend-strong: ${strong};`;
};

const style = (Component) => styled(Component)`
  ${palette}
  width: 100%;
  /* why the dashboard's measure (App.style.js): two tables side by side on a desktop. */
  max-width: var(--measure-dash);
  margin: 0 auto;
  padding: var(--space-10) 0 var(--space-12);

  .eyebrow {
    ${eyebrow}
    display: block;
    margin-bottom: var(--space-4);
  }

  .heading {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-4) var(--space-6);
    margin-bottom: var(--space-8);
  }

  .title {
    font-family: var(--font-family-mono);
    font-size: clamp(2rem, 5vw, 3rem);
    font-weight: var(--font-weight-bold);
    letter-spacing: -0.04em;
    line-height: 1;
  }

  .years {
    display: flex;
    gap: var(--space-2);
  }

  button {
    ${chip}
  }

  .years button {
    width: var(--touch-target);
    padding: 0;
  }

  /* The year title as a picker: the select covers it, transparent; the focus ring is the
     title's, drawn when the select has keyboard focus. */
  .title-pick {
    position: relative;
    border-radius: var(--border-radius-base);
  }

  .title-pick:has(select:focus-visible) {
    outline: 2px solid var(--color-focus);
    outline-offset: var(--space-1);
  }

  .title-pick select {
    position: absolute;
    inset: 0;
    width: 100%;
    opacity: 0;
    cursor: pointer;
  }

  .title-caret {
    margin-left: var(--space-1);
    color: var(--color-text-muted);
    vertical-align: middle;
  }

  .title-pick:hover .title-caret {
    color: var(--color-primary-text);
  }

  /* The compared year beside the title, smaller, underlined dashed in the soft trend step as
     its line is in the running total: the picker names its own key. */
  .against {
    display: inline-flex;
    align-items: baseline;
    gap: var(--space-2);
    font-family: var(--font-family-mono);
    font-size: var(--font-size-large);
    color: var(--color-text-muted);
  }

  .against-year {
    display: inline-block;
    border-bottom: 2px dashed var(--trend-soft);
    font-weight: var(--font-weight-bold);
    color: var(--color-text);
  }

  /* The page's controls, under the heading and over all it filters: the types at the start,
     the measure at the end, wrapped onto two rows on a phone. */
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3) var(--space-6);
    margin-bottom: var(--space-6);
  }

  .controls .legend {
    margin-bottom: 0;
  }

  /* The change against the year before, under each total: the number in ink, the words muted. */
  .totals .delta {
    font-family: var(--font-family-mono);
    font-size: var(--font-size-tiny);
    font-weight: var(--font-weight-medium);
    letter-spacing: 0;
    white-space: normal;
    color: var(--color-text-muted);
  }

  .totals .delta strong {
    font-weight: var(--font-weight-bold);
    color: var(--color-text);
  }

  .training-head {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }

  .training-head .section-title {
    margin-bottom: 0;
  }

  .tag {
    padding: var(--space-hair) var(--space-2);
    border: 1px solid var(--color-hairline);
    border-radius: var(--border-radius-base);
    font-family: var(--font-family-mono);
    font-size: var(--font-size-tiny);
    color: var(--color-text-muted);
  }

  /* Four tiles: two by two on a phone, a row of four once there is room. */
  .totals {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
    margin-bottom: var(--space-10);
  }

  .totals > div {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4) var(--space-5);
    background: color-mix(in srgb, var(--color-surface) 35%, transparent);
    border: 1px solid var(--color-hairline);
    border-radius: var(--border-radius-base);
  }

  dt,
  .readout-label {
    font-family: var(--font-family-mono);
    font-size: var(--font-size-tiny);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  /* Medium on a phone, where "123,650 m D+" overflowed half a row; large once wide. */
  .totals dd {
    font-family: var(--font-family-mono);
    font-size: var(--font-size-medium);
    font-weight: var(--font-weight-bold);
    letter-spacing: -0.02em;
    white-space: nowrap;
  }

  @media (min-width: 40em) {
    .totals {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .totals dd {
      font-size: var(--font-size-large);
    }
  }

  .chart {
    margin-bottom: var(--space-10);
  }

  .chart-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

  .chart-title,
  .section-title {
    font-family: var(--font-family-mono);
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-bold);
  }

  .measures button[aria-pressed="true"] {
    border-color: var(--color-primary);
    color: var(--color-primary-text);
  }

  /* The legend: toggles like the measures, each led by its series' swatch. */
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }

  .legend button {
    padding-inline: var(--space-3);
  }

  .legend button[aria-pressed="true"] {
    border-color: var(--color-primary);
  }

  .legend-count {
    font-weight: var(--font-weight-medium);
    color: var(--color-text-muted);
  }

  .swatch {
    flex: none;
    width: var(--space-3);
    height: var(--space-3);
    border-radius: var(--space-hair);
    background: var(--series);
  }

  /* Each series sets --series once; the swatch, the segment and the readout read it. */
  .series-1 {
    --series: var(--series-1);
  }
  .series-2 {
    --series: var(--series-2);
  }
  .series-3 {
    --series: var(--series-3);
  }
  .series-4 {
    --series: var(--series-4);
  }
  .series-other {
    --series: var(--series-other);
  }

  .measures {
    display: flex;
    gap: var(--space-2);
  }

  .measures button {
    padding-inline: var(--space-3);
  }

  .readout {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-1) var(--space-3);
    min-height: var(--space-8);
    margin-bottom: var(--space-4);
    font-family: var(--font-family-mono);
    font-size: var(--font-size-small);
    color: var(--color-text-muted);
  }

  .readout strong {
    font-size: var(--font-size-medium);
    color: var(--color-text);
  }

  /* The bars stand on the grid's last line; the month initials sit in the row below it. */
  .plot {
    position: relative;
    height: 12rem;
    padding-top: var(--space-4);
  }

  /* After the base rule, so it wins: a taller plot once the page is wide. */
  @media (min-width: 40em) {
    .plot {
      height: 16rem;
    }
  }

  .grid {
    position: absolute;
    inset: var(--space-4) 0 var(--space-6) 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    pointer-events: none;
  }

  /* A line with no height: its value, aligned to the end, sits just above it. */
  .gridline {
    display: flex;
    align-items: flex-end;
    height: 0;
    border-top: 1px solid var(--color-hairline);
    font-family: var(--font-family-mono);
    font-size: var(--font-size-xsmall);
    line-height: 1;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }

  /* Clear of the tick values, which sit in this gutter at the lines' left end. */
  .columns {
    position: relative;
    display: flex;
    height: 100%;
    margin-left: var(--space-12);
  }

  /* The whole column is the hit target, not just the bar. */
  .column {
    flex: 1;
    display: grid;
    grid-template-rows: 1fr var(--space-6);
    justify-items: center;
    min-width: 0;
  }

  /* The stack, first series at the base. The gap between segments is the surface showing
     through; the rounded top is the stack's, whichever series ends it. */
  .bar {
    align-self: end;
    display: flex;
    flex-direction: column-reverse;
    gap: var(--space-hair);
    width: min(24px, calc(100% - 4px));
    overflow: hidden;
    border-radius: 4px 4px 0 0;
  }

  .segment {
    flex: 1 1 0;
    min-height: 1px;
    background: var(--series);
  }

  /* What the column under the pointer is made of, after its total. */
  .readout-parts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-4);
    width: 100%;
    font-size: var(--font-size-tiny);
  }

  .readout-part {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--color-text);
  }

  /* The running total: lines over the same grid as the columns, the month initials under it.
     The focus year (or measure) in the trend hue, the year before dashed in its soft step, the
     others faint grey. */
  .lines {
    position: absolute;
    inset: var(--space-4) 0 var(--space-6) var(--space-12);
    cursor: crosshair;
    touch-action: pan-y;
  }

  .lines svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .line {
    fill: none;
    stroke: color-mix(in srgb, var(--color-text-muted) 40%, transparent);
    stroke-width: 1;
    stroke-linejoin: round;
  }

  .line.is-before {
    stroke: var(--trend-soft);
    stroke-width: 2;
    stroke-dasharray: 4 3;
  }

  .line.is-focus {
    stroke: var(--trend);
    stroke-width: 2;
  }

  .crosshair {
    position: absolute;
    top: 0;
    bottom: 0;
    border-left: 1px solid var(--color-text-muted);
    pointer-events: none;
  }

  /* A surface ring, so the dot stands off the line it sits on. */
  .dot {
    position: absolute;
    width: var(--space-2);
    height: var(--space-2);
    border-radius: 50%;
    background: var(--trend);
    box-shadow: 0 0 0 2px var(--color-background);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  .dot.is-before {
    background: var(--trend-soft);
  }

  .axis {
    position: absolute;
    top: 100%;
    right: 0;
    left: 0;
    height: var(--space-6);
  }

  .axis span {
    position: absolute;
    bottom: 0;
    font-family: var(--font-family-mono);
    font-size: var(--font-size-tiny);
    line-height: 1;
    color: var(--color-text-muted);
  }

  .change {
    font-weight: var(--font-weight-bold);
    color: var(--color-text);
  }

  .line-key {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-5);
    margin-top: var(--space-3);
    padding: 0;
    list-style: none;
    font-family: var(--font-family-mono);
    font-size: var(--font-size-tiny);
    color: var(--color-text-muted);
  }

  .line-key li {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .key-line {
    width: var(--space-5);
    border-top: 1px solid color-mix(in srgb, var(--color-text-muted) 40%, transparent);
  }

  .key-line.is-before {
    border-top: 2px dashed var(--trend-soft);
  }

  .key-line.is-focus {
    border-top: 2px solid var(--trend);
  }

  /* Training: the load full width, then efficiency and intensity side by side once both fit.
     The intensity bands are the trend ramp, soft to strong: easy to hard. */
  .training {
    margin-bottom: var(--space-10);
    padding-top: var(--space-8);
    border-top: 1px solid var(--color-hairline);
  }

  .coverage {
    max-width: var(--measure);
    margin-bottom: var(--space-6);
  }

  /* A chart's own note, right under it. */
  .chart-note {
    max-width: var(--measure);
    margin-top: var(--space-3);
    font-size: var(--font-size-tiny);
    color: var(--color-text-muted);
  }

  .coverage {
    font-size: var(--font-size-tiny);
    color: var(--color-text-muted);
  }

  .training-pair {
    display: grid;
    gap: 0 var(--space-10);
  }

  @media (min-width: 64em) {
    .training-pair {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .band-easy {
    --series: var(--trend-soft);
  }
  .band-grey {
    --series: var(--trend);
  }
  .band-hard {
    --series: var(--trend-strong);
  }

  /* A year's label is wider than a month's column: it overflows, the column keeps its share. */
  .share .column {
    grid-template-columns: minmax(0, 1fr);
  }

  /* A trend's ticks name a point, so they centre on it; the last one then stays in the box. */
  .trend .axis span {
    transform: translateX(-50%);
  }

  .share .bar {
    border-radius: var(--space-hair) var(--space-hair) 0 0;
  }

  .dot.is-lone {
    width: var(--space-1);
    height: var(--space-1);
    box-shadow: none;
  }

  .month {
    align-self: end;
    font-family: var(--font-family-mono);
    font-size: var(--font-size-tiny);
    line-height: 1;
    color: var(--color-text-muted);
  }

  /* A month still to come: its initial faint, a dotted foot where a bar will stand. */
  .column.is-future .month {
    color: color-mix(in srgb, var(--color-text-muted) 45%, transparent);
  }

  .column.is-future .bar {
    height: 0;
    border-top: 2px dotted color-mix(in srgb, var(--color-text-muted) 45%, transparent);
    border-radius: 0;
  }

  .column.is-shown .month {
    font-weight: var(--font-weight-bold);
    color: var(--color-text);
  }

  .table-view {
    margin-top: var(--space-4);
  }

  .table-view summary {
    font-family: var(--font-family-mono);
    font-size: var(--font-size-tiny);
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .table-view table {
    margin-top: var(--space-3);
  }

  /* Rows in the sans at small, figures lined up by tabular numerals; the headers stay mono.
     why not mono throughout: at 12px a page of mono rows read as code, cramped on a phone. */
  table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-family-sansSerif);
    font-size: var(--font-size-small);
    font-variant-numeric: tabular-nums;
  }

  th,
  td {
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--color-hairline);
    text-align: right;
    white-space: nowrap;
  }

  th:first-child {
    text-align: left;
  }

  thead th {
    font-family: var(--font-family-mono);
    font-size: var(--font-size-tiny);
    font-weight: var(--font-weight-bold);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  tbody th {
    font-weight: var(--font-weight-bold);
    white-space: normal;
  }

  td + td,
  th + td,
  th + th {
    padding-left: var(--space-3);
  }

  .section-title {
    margin-bottom: var(--space-3);
  }

  /* A period with nothing in it: still a row, so the months stay twelve, but faint. */
  tr.is-empty {
    color: var(--color-text-muted);
  }

  /* Two tables side by side once both fit, stacked before. */
  .tables {
    display: grid;
    gap: var(--space-10);
    align-items: start;
  }

  @media (min-width: 64em) {
    .tables {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  /* A year's name opens it: a link's look, as the row is the control's room. */
  button.pick {
    min-height: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    font-size: inherit;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .empty {
    color: var(--color-text-muted);
  }

  .year-error {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
    color: var(--color-behind-text);
  }
`;

export default style;
