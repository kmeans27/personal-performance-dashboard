/* Tap a tile, answer it in place. The widgets are the ones the logging flow
   uses, so there is exactly one slider, counter and toggle in the codebase. */

import { h, mount } from "../core/dom.js";
import { buildWidget } from "../log/widgets.js";
import { toast } from "../core/chrome.js";
import { fieldValue } from "../core/format.js";

let current = null;

export function closeQuickLog() {
  if (!current) return;
  const { backdrop, sheet, restore, onKey } = current;
  current = null;
  document.removeEventListener("keydown", onKey);
  backdrop.dataset.open = "false";
  sheet.dataset.open = "false";
  setTimeout(() => {
    backdrop.remove();
    sheet.remove();
    if (restore?.focus) restore.focus({ preventScroll: true });
  }, 320);
}

export function openQuickLog({ tile, category, metrics, values, day, suggestion, save, onSaved, demo = false }) {
  closeQuickLog();
  if (demo) return;

  const fields = tile.fields.map((id) => metrics.get(id)).filter(Boolean);
  if (!fields.length) return;
  const multi = fields.length > 1;
  const suggestionFor = (id) => suggestion?.[id];

  const backdrop = h("div", { class: "sheet-backdrop", "data-open": "false" });
  const widgets = h("div", { class: "quick stack", style: { gap: "var(--s-5)" } });
  const rows = [];

  for (const metric of fields) {
    const value = values?.[metric.id];
    const seed = value ?? suggestionFor(metric.id)?.value ?? null;
    const widget = buildWidget(metric, {
      value: seed,
      onCommit: (answer) => commit(metric.id, answer),
      // Dragging, tapping or picking settles the answer without a second tap.
      onLive: (answer) => commit(metric.id, answer, { quiet: true }),
    });
    rows.push({ metric, widget });
    widgets.append(widget.el);
  }

  const context = fields
    .map((metric) => suggestionFor(metric.id))
    .filter((entry) => entry && entry.value != null);
  const contextLine = () => {
    if (!context.length) return "No suggestion yet — answer it or leave it.";
    const [first] = context;
    const metric = fields.find((entry) => entry.id === first.id) || fields[0];
    const text = fieldValue(metric, first.value);
    return first.source === "today" ? "Already logged today — change it any time." : `Yesterday: ${text}`;
  };

  const close = h("button", { class: "btn btn--quiet", onclick: () => closeQuickLog() }, "Close");
  const done = h("button", { class: "btn btn--primary", onclick: () => closeQuickLog() }, "Done");
  const clear = tile.settled
    ? h("button", { class: "btn btn--quiet", onclick: () => clearAll() }, "Clear")
    : null;

  async function clearAll() {
    for (const metric of fields) {
      await commit(metric.id, null, { quiet: true });
    }
    closeQuickLog();
  }

  const sheet = h(
    "section",
    {
      class: "sheet sheet--quick",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": `${tile.label} — log it`,
    },
    h("div", { class: "sheet-grip", "aria-hidden": "true" }),
    h(
      "div",
      { class: "quick-head" },
      h(
        "div",
        { class: "stack", style: { gap: "var(--s-2)" } },
        category ? h("span", { class: "chip", style: { "--accent": category.accent } }, category.label) : null,
        h("h2", { class: "quick-title" }, tile.label),
        h("p", { class: "quick-target" }, tile.caption)
      ),
      h("div", { style: { "margin-left": "auto" } }, close)
    ),
    h(
      "p",
      { class: "quick-context", style: { "margin-top": "var(--s-4)" } },
      h("span", { class: "dot" }),
      contextLine()
    ),
    widgets,
    h("div", { class: "quick-actions" }, clear, h("span", { class: "spacer" }), multi ? done : null)
  );

  document.body.append(backdrop, sheet);

  function onKey(event) {
    if (event.key === "Escape") closeQuickLog();
  }

  current = { backdrop, sheet, restore: document.activeElement, onKey };
  document.addEventListener("keydown", onKey);
  backdrop.addEventListener("click", () => closeQuickLog());

  requestAnimationFrame(() => {
    backdrop.dataset.open = "true";
    sheet.dataset.open = "true";
  });
  rows[0]?.widget.focus?.();

  async function commit(fieldId, answer, { quiet = false } = {}) {
    try {
      const payload = await save(fieldId, answer);
      onSaved?.(payload, tile.id);
      if (!multi) closeQuickLog();
      else if (!quiet) toast("Saved");
    } catch (error) {
      toast(`Not saved: ${error.message}`, "attention");
    }
  }

  return { sheet, close: closeQuickLog, day };
}
