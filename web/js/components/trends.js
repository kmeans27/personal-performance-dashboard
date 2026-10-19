/* Trends read as sentences, with a sparkline to prove it. */

import { h } from "../core/dom.js";
import { sparkline } from "../sparkline.js";
import { ACCENTS } from "../rings.js";

const VERDICT = { good: "working", watch: "watch", flat: "steady" };

export function accentFor(key) {
  return ACCENTS[key] || "var(--overall)";
}

export function trendRow(trend) {
  const accent = accentFor(trend.category === "overall" ? "overall" : trend.category);
  const verdict = trend.direction === "flat" ? "flat" : trend.polarity === "watch" ? "watch" : "good";
  return h(
    "li",
    { class: "trend", style: { "--accent": accent } },
    h("p", { class: "trend-sentence" }, trend.sentence),
    sparkline(trend.series, { accent }),
    h("span", { class: "trend-verdict", "data-polarity": verdict }, VERDICT[verdict])
  );
}

export function trendList(trends = []) {
  return h("ul", { class: "trend-list" }, trends.map(trendRow));
}

export function ringTrends(trends = []) {
  return trends.filter((t) => t.key === "total" || ACCENTS[t.key]);
}

export function signalTrends(trends = []) {
  return trends.filter((t) => t.key !== "total" && !ACCENTS[t.key]);
}
