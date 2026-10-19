/* Small layout pieces shared by the reading pages. */

import { h } from "../core/dom.js";

export function pageHeader({ title, note, actions }) {
  return h(
    "header",
    { class: "section-head", style: { "align-items": "flex-end", "flex-wrap": "wrap" } },
    h(
      "div",
      { class: "stack", style: { gap: "var(--s-2)" } },
      h("h1", { class: "cal-month" }, title),
      note ? h("p", { class: "section-note", style: { "max-width": "58ch" } }, note) : null
    ),
    actions ? h("div", { class: "head-actions" }, actions) : null
  );
}

export function section(title, note, content) {
  return h(
    "section",
    { class: "section" },
    h(
      "div",
      { class: "section-head" },
      h("h2", { class: "section-title" }, title),
      note ? h("p", { class: "section-note" }, note) : null
    ),
    content
  );
}

export function segmented(options, active, onSelect) {
  return h(
    "div",
    { class: "tabs", style: { "margin-left": "0" } },
    options.map((option) =>
      h(
        "button",
        {
          class: "tab",
          "aria-current": option.value === active ? "page" : null,
          onclick: () => onSelect(option.value),
        },
        option.label
      )
    )
  );
}

export function empty(title, text) {
  return h("div", { class: "empty" }, h("strong", {}, title), h("p", {}, text));
}
