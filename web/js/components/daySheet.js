/* The day sheet: everything about one day, opened from the calendar or home. */

import { h, mount, clear } from "../core/dom.js";
import { totalRing } from "../rings.js";
import { fieldValue, longDay, points, isToday } from "../core/format.js";
import { api } from "../core/api.js";
import { catalogue, byCategory, categoryMap } from "../core/catalogue.js";

let current = null;

export async function openDaySheet(day, { fetchDay = (value) => api.day(value), onEdit } = {}) {
  closeDaySheet();

  const backdrop = h("div", { class: "sheet-backdrop", "data-open": "false" });
  const body = h("div", { class: "stack" }, skeleton());
  const title = h("h2", { class: "sheet-title" }, longDay(day));
  const chip = h("span", { class: "chip chip--muted" }, "loading");
  const ringSlot = h("span", { style: { display: "grid", "place-items": "center" } });

  const closeButton = h("button", { class: "btn btn--quiet", onclick: () => closeDaySheet() }, "Close");
  const editButton = h(
    "a",
    { class: "btn btn--primary", href: `/log?day=${day}` },
    "Edit this day"
  );

  const sheet = h(
    "section",
    {
      class: "sheet",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": `Day detail for ${longDay(day)}`,
    },
    h("div", { class: "sheet-grip", "aria-hidden": "true" }),
    h(
      "div",
      { class: "sheet-head" },
      ringSlot,
      h("div", { class: "stack", style: { gap: "var(--s-2)" } }, chip, title),
      h("div", { style: { "margin-left": "auto", display: "flex", gap: "var(--s-2)" } }, editButton, closeButton)
    ),
    body
  );

  document.body.append(backdrop, sheet);
  current = { backdrop, sheet, restore: document.activeElement };

  requestAnimationFrame(() => {
    backdrop.dataset.open = "true";
    sheet.dataset.open = "true";
  });
  closeButton.focus({ preventScroll: true });

  const onKey = (event) => {
    if (event.key === "Escape") closeDaySheet();
  };
  document.addEventListener("keydown", onKey);
  backdrop.addEventListener("click", () => closeDaySheet());
  dragToClose(sheet, () => closeDaySheet());

  try {
    const [payload, schema] = await Promise.all([fetchDay(day), catalogue()]);
    if (!current) return;
    mount(ringSlot, totalRing(payload.score.total));
    chip.className = payload.logged ? "chip" : "chip chip--muted";
    chip.textContent = payload.logged ? `score ${points(payload.score.total)}` : "not logged";
    editButton.hidden = payload.demo === true;
    mount(body, bodyFor(payload, schema));
    if (onEdit) editButton.addEventListener("click", onEdit);
  } catch (error) {
    mount(body, h("div", { class: "empty" }, h("strong", {}, "Could not open this day"), h("p", {}, error.message)));
  }

  return { close: closeDaySheet, removeKey: () => document.removeEventListener("keydown", onKey) };
}

function bodyFor(payload, schema) {
  const grouped = byCategory(schema);
  const categories = categoryMap(schema);
  const focus = payload.focus?.category;

  const sections = [...grouped.entries()].map(([categoryId, metrics]) => {
    const category = categories.get(categoryId);
    const score = payload.score.categories[categoryId];
    return h(
      "section",
      { class: "stack", style: { gap: "var(--s-2)", "--accent": category.accent } },
      h(
        "div",
        { class: "section-head", style: { margin: "var(--s-4) 0 var(--s-1)" } },
        h("h3", { class: "section-title", style: { "font-size": "var(--fs-sm)" } }, category.label),
        h("span", { class: "section-note num" }, score == null ? "—" : points(score)),
        focus === categoryId ? h("span", { class: "chip" }, "needs attention") : null
      ),
      h(
        "div",
        { class: "field-grid" },
        metrics.map((metric) => {
          const raw = payload.values[metric.id];
          const text = fieldValue(metric, raw);
          return h(
            "div",
            { class: "field-row" },
            h("span", { class: "field-name" }, metric.label),
            h("span", { class: "field-value", "data-missing": text == null ? "true" : "false" }, text ?? "—")
          );
        })
      )
    );
  });

  if (payload.insight) {
    sections.push(
      h(
        "section",
        { class: "stack", style: { gap: "var(--s-2)", "margin-top": "var(--s-5)" } },
        h("h3", { class: "section-title", style: { "font-size": "var(--fs-sm)" } }, "What this week says"),
        h("p", { class: "section-note" }, payload.insight.sentence)
      )
    );
  }

  if (!payload.logged && isToday(payload.day)) {
    sections.unshift(
      h(
        "div",
        { class: "focus", style: { "--accent": "var(--overall)", "max-width": "none" } },
        h("span", { class: "dot" }),
        h("span", {}, "Nothing logged for today yet. ", h("a", { href: "/log", style: { "text-decoration": "underline" } }, "Start the flow"), " — it takes about thirty seconds.")
      )
    );
  }
  return sections;
}

function skeleton() {
  return h(
    "div",
    { class: "loading" },
    h("div", { class: "skeleton", style: { height: "18px", width: "40%" } }),
    h("div", { class: "skeleton", style: { height: "120px" } })
  );
}

function dragToClose(sheet, close) {
  let startY = null;
  const grip = sheet.querySelector(".sheet-grip");
  const target = grip || sheet;
  target.addEventListener("pointerdown", (event) => {
    if (window.innerWidth >= 860) return;
    startY = event.clientY;
  });
  target.addEventListener("pointermove", (event) => {
    if (startY == null) return;
    const delta = Math.max(0, event.clientY - startY);
    sheet.style.transform = `translateY(${delta}px)`;
  });
  const end = (event) => {
    if (startY == null) return;
    const delta = Math.max(0, event.clientY - startY);
    sheet.style.transform = "";
    startY = null;
    if (delta > 90) close();
  };
  target.addEventListener("pointerup", end);
  target.addEventListener("pointercancel", end);
}

export function closeDaySheet() {
  if (!current) return;
  const { backdrop, sheet, restore } = current;
  current = null;
  backdrop.dataset.open = "false";
  sheet.dataset.open = "false";
  setTimeout(() => {
    backdrop.remove();
    sheet.remove();
    if (restore?.focus) restore.focus({ preventScroll: true });
  }, 320);
}
