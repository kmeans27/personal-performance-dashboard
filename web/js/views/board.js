/* The board: every field for one day, one screen, nothing to scroll.
   Rings and the score on the left, the four categories as quadrants on the
   right. Tap a tile, log it, watch it light up. */

import { h, mount } from "../core/dom.js";
import { createRings, microRings } from "../rings.js";
import { createTile } from "../components/tile.js";
import { openQuickLog } from "../components/quickLog.js";
import { openDaySheet } from "../components/daySheet.js";
import { categoryMap, metricMap } from "../core/catalogue.js";
import { longDay, points } from "../core/format.js";
import { api, demoApi } from "../core/api.js";

export function boardView({
  payload,
  schema,
  suggestion = new Map(),
  strip = [],
  demo = false,
  framed = false,
  onSelectDay,
  onPayload,
}) {
  const categories = categoryMap(schema);
  const metrics = metricMap(schema);
  const accents = new Map(schema.categories.map((category) => [category.id, category.accent]));
  const tiles = new Map();
  const bandCounts = new Map();

  const rings = createRings({ caption: demo ? "Demo day" : "" });
  rings.setScores(payload.score);
  requestAnimationFrame(() => rings.settleNow());

  const countLine = h("p", { class: "rail-count" });
  const focusLine = h("p", { class: "focus", style: { "--accent": "var(--overall)" } });
  const closing = h("p", { class: "rail-closing" });
  const board = h("div", {
    class: framed ? "board board--framed" : "board",
    "data-complete": "false",
    "data-demo": String(demo),
  });

  const rail = h(
    "aside",
    { class: "rail" },
    rings.el,
    h(
      "div",
      { class: "rail-read" },
      h("p", { class: "rail-day" }, demo ? "A lived-in demo" : longDay(payload.day)),
      countLine,
      focusLine,
      closing,
      h(
        "div",
        { class: "rail-actions" },
        demo
          ? h("a", { class: "btn btn--quiet", href: "/log" }, "Try the logging flow")
          : h("a", { class: "btn btn--primary", href: `/log?day=${payload.day}` }, "Log everything"),
        h("a", { class: "btn btn--quiet", href: "/calendar" }, "Calendar")
      )
    ),
    strip.length ? stripNode(strip) : null
  );

  const bands = schema.ring_order.map((categoryId) => {
    const category = categories.get(categoryId);
    const count = h("span", { class: "band-count num" });
    bandCounts.set(categoryId, count);
    const grid = h("div", { class: "tiles" });
    for (const tile of payload.board.tiles.filter((entry) => entry.category === categoryId)) {
      const component = createTile(tile, {
        accent: accents.get(categoryId),
        onOpen: () => openQuickLog({
          tile: currentTile(tile.id),
          category,
          metrics,
          values: payload.values,
          day: payload.day,
          suggestion: suggestionObject(tile),
          save,
          onSaved: setPayload,
          demo,
        }),
      });
      tiles.set(tile.id, component);
      grid.append(component.el);
    }
    return h(
      "section",
      { class: "band", "data-category": categoryId, "data-accent": categoryId },
      h("header", { class: "band-head" }, h("span", { class: "dot" }), h("span", {}, category.label), count),
      grid
    );
  });

  mount(board, rail, ...bands);
  setPayload(payload);

  return { el: board, setPayload, tiles };

  // -------------------------------------------------------------- internals

  function currentTile(id) {
    return payload.board.tiles.find((entry) => entry.id === id);
  }

  function suggestionObject(tile) {
    const out = {};
    for (const field of tile.fields) out[field] = suggestion.get(field);
    return out;
  }

  async function save(fieldId, value) {
    const next = await api.saveDay(payload.day, { [fieldId]: value });
    setPayload(next);
    return next;
  }

  function setPayload(next) {
    payload = next;
    rings.setScores(next.score);

    const boardData = next.board;
    board.dataset.complete = String(boardData.complete);

    mount(
      countLine,
      boardData.complete ? h("span", { class: "dot" }) : null,
      boardData.complete
        ? "Every field logged."
        : `${boardData.daily_logged} of ${boardData.daily_total} logged today`
    );
    countLine.dataset.complete = String(boardData.complete);

    const focus = next.focus;
    focusLine.dataset.show = focus && !boardData.complete ? "true" : "false";
    if (focus) {
      focusLine.style.setProperty("--accent", focus.accent);
      mount(
        focusLine,
        h("span", { class: "dot" }),
        h("span", {}, h("strong", {}, `${focus.category_label}. `), focus.line)
      );
    }
    closing.textContent = boardData.complete ? next.closing : "";
    closing.dataset.show = boardData.complete ? "true" : "false";

    for (const tile of boardData.tiles) {
      tiles.get(tile.id)?.update(tile);
    }
    for (const [categoryId, node] of bandCounts) {
      const daily = boardData.tiles.filter(
        (tile) => tile.category === categoryId && !tile.weekly && !tile.optional
      );
      const settled = daily.filter((tile) => tile.settled).length;
      node.textContent = `${settled} / ${daily.length}`;
      node.parentElement.parentElement.dataset.complete = String(daily.length > 0 && settled === daily.length);
    }
    onPayload?.(next);
  }

  function stripNode(days) {
    const fetchDay = demo ? (day) => demoApi.day(day) : (day) => api.day(day);
    return h(
      "div",
      { class: "rail-strip" },
      days.map((day) =>
        h(
          "button",
          {
            type: "button",
            "data-today": String(day.day === payload.day),
            "data-empty": String(day.total == null),
            title: `${longDay(day.day)} — ${points(day.total)}`,
            onclick: () => {
              openDaySheet(day.day, { fetchDay });
              onSelectDay?.(day.day);
            },
          },
          microRings(day.categories, { size: 34, stroke: 2.5 }),
          h("span", { class: "strip-label num" }, day.day.slice(8))
        )
      )
    );
  }
}
