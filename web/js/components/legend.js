/* The four rings as a readable list. */

import { h } from "../core/dom.js";
import { points } from "../core/format.js";

export function legend(items, { focus = null, showBlurb = false } = {}) {
  return h(
    "ul",
    { class: "legend" },
    items.map((item) =>
      h(
        "li",
        {
          class: "legend-item",
          "data-focus": item.id === focus ? "true" : "false",
          style: { "--accent": item.accent },
        },
        h(
          "span",
          { class: "legend-label" },
          h("span", { class: "dot" }),
          h("span", {}, item.label),
          showBlurb && item.blurb ? h("span", { class: "sr-only" }, item.blurb) : null
        ),
        h(
          "span",
          { class: "bar", role: "presentation" },
          h("span", { style: { width: `${Math.round((item.score ?? 0) * 100)}%` } })
        ),
        h(
          "span",
          { class: "legend-value num", "data-empty": item.score == null ? "true" : "false" },
          points(item.score)
        )
      )
    )
  );
}
