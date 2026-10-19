/* Sparkline: the smallest honest chart there is. */

import { s } from "./core/dom.js";

export function sparkline(values, { width = 96, height = 30, accent = "var(--ink-2)" } = {}) {
  const clean = (values || []).filter((v) => Number.isFinite(v));
  const svg = s("svg", {
    class: "spark",
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: "none",
    style: { color: accent },
    "aria-hidden": "true",
  });
  if (clean.length < 2) return svg;

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = max - min || 1;
  const pad = 3;
  const points = clean.map((value, index) => {
    const x = (index / (clean.length - 1)) * width;
    const y = pad + (1 - (value - min) / span) * (height - pad * 2);
    return [x, y];
  });

  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;

  svg.append(s("path", { class: "area", d: area }));
  svg.append(s("path", { class: "line", d: line }));
  const [lastX, lastY] = points[points.length - 1];
  svg.append(s("circle", { cx: lastX, cy: lastY, r: 2, fill: "currentColor" }));
  return svg;
}
