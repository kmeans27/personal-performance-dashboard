/* Weekly fields: progress toward a target, never a daily zero. */

import { h } from "../core/dom.js";

const DISPLAY = {
  gym: (card) => ({ value: card.count, unit: "of 2–3 sessions" }),
  alcohol: (card) => ({ value: card.count, unit: "of 7 days" }),
  avoid_habit: (card) => ({ value: card.count, unit: "days clean in 30" }),
};

export function weeklyCards(cards = []) {
  return h(
    "div",
    { class: "week-grid" },
    cards.map((card) => {
      const format = DISPLAY[card.id];
      const shown = format ? format(card) : { value: card.count, unit: card.unit };
      const accent =
        card.id === "avoid_habit" ? "var(--attention)" : card.id === "gym" || card.id === "alcohol" ? "var(--body)" : "var(--people)";
      return h(
        "figure",
        { class: "week-card", style: { "--accent": accent } },
        h("h3", {}, card.label),
        h(
          "div",
          { class: "week-value" },
          h("strong", { class: "num" }, String(shown.value)),
          h("span", {}, shown.unit)
        ),
        h(
          "div",
          { class: "bar", role: "img", "aria-label": `${Math.round(card.progress * 100)}% of target` },
          h("span", { style: { width: `${Math.round(card.progress * 100)}%` } })
        ),
        h("figcaption", {}, card.caption)
      );
    })
  );
}
