/* Insights: what moves mood and energy, said plainly and labelled honestly. */

import { h } from "../core/dom.js";
import { ACCENTS, LABELS } from "../rings.js";

const OUTCOME_ACCENT = { mood: "mind", energy: "attention" };

export function insightCard(insight) {
  const accent = ACCENTS[OUTCOME_ACCENT[insight.outcome]] || "var(--overall)";
  const max = Math.max(insight.with_mean, insight.without_mean, 1);
  return h(
    "li",
    { class: "insight", style: { "--accent": accent } },
    h(
      "div",
      { class: "insight-head" },
      h("span", { class: "chip" }, insight.outcome_label),
      h(
        "span",
        { class: "chip chip--muted" },
        insight.delta > 0 ? "correlation, higher" : "correlation, lower"
      )
    ),
    h("p", {}, insight.sentence),
    h(
      "div",
      { class: "insight-compare" },
      compareRow("with", insight.condition_label, insight.with_mean, max, accent),
      compareRow("without", "everything else", insight.without_mean, max)
    )
  );
}

function compareRow(side, label, value, max, accent) {
  return h(
    "div",
    { class: "compare-row", "data-side": side, style: accent ? { "--accent": accent } : null },
    h("span", {}, label),
    h("span", { class: "compare-bar" }, h("span", { style: { width: `${(value / max) * 100}%` } })),
    h("span", { class: "num" }, value.toFixed(1))
  );
}

export function insightList(insights = []) {
  return h("ul", { class: "trend-list" }, insights.map(insightCard));
}

export function insightsEmpty({ ready, daysLogged } = {}) {
  return h(
    "div",
    { class: "empty" },
    h("strong", {}, ready === false ? "Not enough days yet" : "No patterns worth claiming yet"),
    h(
      "p",
      {},
      ready === false
        ? `${daysLogged ?? 0} of about 24 days logged. Around four weeks of data is where the patterns start to be worth saying out loud.`
        : "Nothing here clears the bar yet — the dashboard only speaks when a pattern is strong enough to be worth a sentence."
    )
  );
}

export { LABELS };
