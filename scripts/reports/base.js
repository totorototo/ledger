// Shared by every report page (scripts/reports/*.html): the report's data, formats, the
// masthead and footer, and one line chart. Top-level names are the page script's to use.
/* eslint-disable no-unused-vars -- the page scripts, in their own <script>, use these. */

const R = JSON.parse(document.getElementById("report").textContent);
const NS = "http://www.w3.org/2000/svg";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Dates are "YYYY-MM-DD" or "YYYY-MM" strings, read as parts: no zone moves them.
const parts = (iso) => iso.split("-").map(Number);
const fmt = {
  date: (v) => {
    const [y, m, d] = parts(v);
    return `${d} ${MONTHS[m - 1]} ${y}`;
  },
  short: (v) => {
    const [, m, d] = parts(v);
    return `${d} ${MONTHS[m - 1]}`;
  },
  month: (v) => {
    const [y, m] = parts(v);
    return `${MONTHS[m - 1]} ${y}`;
  },
  weekday: (v) => {
    const [y, m, d] = parts(v);
    return DAYS[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7];
  },
  one: (v) => Number(v).toFixed(1),
  two: (v) => Number(v).toFixed(2),
  int: (v) => String(Math.round(v)),
  km: (v) => `${Number(v).toFixed(1)} km`,
  // "AEROBIC_BASE" → "Aerobic base".
  effect: (v) =>
    v
      ? v
          .toLowerCase()
          .replaceAll("_", " ")
          .replace(/^./, (c) => c.toUpperCase())
      : "—",
};
const show = (v, f) => (v == null || v === "" ? "—" : (f ? fmt[f] : String)(v));

const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  Object.assign(n, props);
  n.append(...kids.filter((k) => k != null));
  return n;
};
const svg = (tag, attrs = {}, text) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (text != null) n.textContent = text;
  return n;
};
const get = (path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), R);
const strong = (text) => el("strong", {}, text);

// Every [data-f="path"] gets that field of the report, formatted by [data-fmt].
function fill(root = document) {
  for (const n of root.querySelectorAll("[data-f]"))
    n.textContent = show(get(n.dataset.f), n.dataset.fmt);
}

// The masthead and the footer, the same on every report.
function frame() {
  const head = document.querySelector("[data-masthead]");
  if (head)
    head.replaceChildren(
      el("span", { className: "wordmark" }, el("span", {}, "Led"), "ger"),
      el("span", { className: "eyebrow" }, fmt.date(R.until)),
    );
  const foot = document.querySelector("[data-foot]");
  if (foot)
    foot.replaceChildren(
      el("p", {}, R.disclaimer),
      el("p", {}, "Ledger reads Garmin Connect data. It isn't Garmin's."),
    );
}

// A stat of the hero row: the value large, its label, a line under it, an optional note.
function stat({ label, value, unit, sub, why, anchor }) {
  return el(
    "div",
    { className: `stat${anchor ? " anchor" : ""}` },
    el("dt", {}, label),
    el("dd", { className: "value" }, value, unit ? el("small", {}, unit) : null),
    sub ? el("dd", { className: "sub" }, sub) : null,
    why ? el("dd", { className: "why" }, why) : null,
  );
}

// Lines over points in a row (months, weeks): `labels` [{text, sub, strong}], `series`
// [{values, color, dashed}], optional `bands` [{from, to}] and `refs` [{value, label}] in y,
// `step` between gridlines, `tip(i)` → [head, ...lines]. The first solid series draws in, its
// last point filled; gaps (null) break the line. Redrawn when the box's width changes.
function lineChart(
  box,
  { labels, series, step = 5, bands = [], refs = [], tip, format = String, height },
) {
  const tipEl = el("div", { className: "tip", hidden: true });
  const draw = () => {
    box.replaceChildren();
    const W = Math.max(280, box.clientWidth);
    const H = height ?? (W < 560 ? 180 : 230);
    const top = 10,
      bottom = 40;
    const all = [
      ...series.flatMap((s) => s.values),
      ...bands.flatMap((b) => [b.from, b.to]),
      ...refs.map((r) => r.value),
    ].filter((v) => v != null);
    let lo = Math.floor((Math.min(...all) - step / 2) / step) * step;
    let hi = Math.ceil((Math.max(...all) + step / 2) / step) * step;
    let gridStep = step;
    while ((hi - lo) / gridStep > 6) gridStep *= 2;
    lo = Math.floor(lo / gridStep) * gridStep;
    hi = Math.ceil(hi / gridStep) * gridStep;
    // A measure that can't go negative (a ratio, a time) starts its scale at zero, not under it.
    if (Math.min(...all) >= 0) lo = Math.max(lo, 0);
    const y = (v) => top + (H - top - bottom) * (1 - (v - lo) / (hi - lo));
    const n = labels.length;
    const colW = W / n;
    const x = (i) => colW * (i + 0.5);
    const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, height: H, role: "img" });

    for (const b of bands)
      s.append(
        svg("rect", {
          x: 0,
          width: W,
          y: y(b.to),
          height: Math.max(0, y(b.from) - y(b.to)),
          fill: "var(--hairline)",
        }),
      );
    const round = (v) => Math.round(v * 1000) / 1000;
    for (let v = lo; v <= hi + 1e-9; v += gridStep) {
      s.append(
        svg("line", {
          x1: 0,
          x2: W,
          y1: y(v),
          y2: y(v),
          stroke: "var(--hairline)",
          "stroke-width": 1,
        }),
      );
      s.append(
        svg(
          "text",
          {
            x: W,
            y: y(v) - 4,
            "text-anchor": "end",
            "font-family": "var(--mono)",
            "font-size": 9,
            "font-weight": 600,
            fill: "var(--faint)",
          },
          format(round(v)),
        ),
      );
    }
    for (const r of refs) {
      s.append(
        svg("line", {
          x1: 0,
          x2: W,
          y1: y(r.value),
          y2: y(r.value),
          stroke: "var(--rule)",
          "stroke-width": 1,
          "stroke-dasharray": "4 4",
        }),
      );
      if (r.label)
        s.append(
          svg(
            "text",
            {
              x: 0,
              y: y(r.value) - 4,
              "font-family": "var(--mono)",
              "font-size": 9,
              "font-weight": 600,
              fill: "var(--faint)",
            },
            r.label,
          ),
        );
    }
    // Labels under the plot; a narrow plot keeps every other one.
    const thin = colW < 34;
    labels.forEach((l, i) => {
      if (thin && (n - 1 - i) % 2 && !l.sub) return;
      s.append(
        svg(
          "text",
          {
            x: x(i),
            y: H - 22,
            "text-anchor": "middle",
            "font-family": "var(--mono)",
            "font-size": 10,
            "font-weight": l.strong ? 600 : 400,
            fill: l.strong ? "var(--text)" : "var(--faint)",
          },
          l.text,
        ),
      );
      if (l.sub)
        s.append(
          svg(
            "text",
            {
              x: x(i),
              y: H - 6,
              "text-anchor": "middle",
              "font-family": "var(--mono)",
              "font-size": 9,
              "font-weight": 600,
              "letter-spacing": "0.04em",
              fill: "var(--faint)",
            },
            l.sub,
          ),
        );
    });
    let drawn = null;
    for (const se of series) {
      let d = "",
        pen = false;
      se.values.forEach((v, i) => {
        if (v == null) {
          pen = false;
          return;
        }
        d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
        pen = true;
      });
      const color = se.color ?? "var(--trend)";
      const path = svg("path", {
        d,
        fill: "none",
        stroke: color,
        "stroke-width": 2,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      });
      if (se.dashed) path.setAttribute("stroke-dasharray", "5 4");
      else if (!drawn) {
        path.setAttribute("class", "line");
        drawn = path;
      }
      s.append(path);
      if (se.dashed) continue;
      const lastI = se.values.findLastIndex((v) => v != null);
      se.values.forEach((v, i) => {
        if (v == null) return;
        s.append(
          svg("circle", {
            cx: x(i),
            cy: y(v),
            r: i === lastI ? 4.5 : 3,
            fill: i === lastI ? color : "var(--bg)",
            stroke: color,
            "stroke-width": 2,
          }),
        );
      });
    }
    const rule = svg("line", {
      y1: top,
      y2: H - bottom,
      stroke: "var(--rule)",
      "stroke-width": 1,
      visibility: "hidden",
    });
    s.append(rule);
    if (tip) {
      const hit = svg("rect", { x: 0, y: 0, width: W, height: H, fill: "transparent" });
      hit.addEventListener("pointermove", (ev) => {
        const r = s.getBoundingClientRect();
        const i = Math.max(
          0,
          Math.min(n - 1, Math.floor(((ev.clientX - r.left) * (W / r.width)) / colW)),
        );
        rule.setAttribute("x1", x(i));
        rule.setAttribute("x2", x(i));
        rule.setAttribute("visibility", "visible");
        const [head, ...lines] = tip(i);
        tipEl.replaceChildren(
          el("span", {}, head),
          ...lines.flatMap((l, k) => (k ? [el("br"), l] : [l])),
        );
        tipEl.hidden = false;
        const px = x(i) * (r.width / W),
          tw = tipEl.offsetWidth;
        const v = series.map((se) => se.values[i]).find((q) => q != null);
        tipEl.style.left = `${Math.min(Math.max(0, px - tw / 2), r.width - tw)}px`;
        tipEl.style.top = `${Math.max(0, (v == null ? top : y(v)) * (r.height / H) - tipEl.offsetHeight - 12)}px`;
      });
      hit.addEventListener("pointerleave", () => {
        tipEl.hidden = true;
        rule.setAttribute("visibility", "hidden");
      });
      s.append(hit);
    }
    box.append(s, tipEl);
    if (drawn) drawn.style.setProperty("--len", Math.ceil(drawn.getTotalLength()));
  };
  draw();
  let w = box.clientWidth;
  new ResizeObserver(() => {
    if (box.clientWidth !== w) {
      w = box.clientWidth;
      draw();
    }
  }).observe(box);
}

// Month labels: the initial, the year under the first month and each January, the last bold.
const monthLabels = (months) =>
  months.map((m, i) => {
    const [y, mo] = parts(m);
    return {
      text: MONTHS[mo - 1][0],
      sub: i === 0 || mo === 1 ? String(y) : null,
      strong: i === months.length - 1,
    };
  });

frame();
fill();
