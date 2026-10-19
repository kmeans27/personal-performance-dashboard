/* The board: every field for one day, one screen, nothing to scroll.
   The left third is what the day *means* — rings, the three categories, the
   week so far and a few honest numbers. The right two thirds are the fields
   themselves: small, uniform boxes, one per thing you log. Tap a tile, log it,
   watch it light up. */

import { h, mount } from "../core/dom.js";
import { createRings } from "../rings.js";
import { createTile } from "../components/tile.js";
import { openQuickLog } from "../components/quickLog.js";
import { openDaySheet } from "../components/daySheet.js";
import { categoryMap, metricMap } from "../core/catalogue.js";
import { dayOfMonth, longDay, points, weekdayInitial } from "../core/format.js";
import { api, demoApi } from "../core/api.js";

export function boardView({
  payload,
  schema,
  suggestion = new Map(),
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
  const meter = h("div", { class: "rail-meter" }, h("i"));
  const note = h("p", { class: "rail-note" });
  const catRows = new Map();
  const weekCells = new Map();
  const statCells = new Map();

  const board = h("div", {
    class: framed ? "board board--framed" : "board",
    "data-complete": "false",
    "data-demo": String(demo),
  });

  /* ------------------------------------------------------------ the rail */

  const cats = h("div", { class: "cats" });
  for (const categoryId of schema.ring_order) {
    const fill = h("i");
    const score = h("span", { class: "cat-score num" }, "—");
    catRows.set(categoryId, { fill, score });
    cats.append(
      h(
        "div",
        { class: "cat-row", style: { "--accent": accents.get(categoryId) } },
        h("span", { class: "cat-label" }, categories.get(categoryId).label),
        h("span", { class: "cat-bar" }, fill),
        score
      )
    );
  }

  const week = h("div", { class: "week" });
  buildWeek();

  const stats = h("div", { class: "rail-stats" });
  for (const [key, label] of [
    ["average", "Week average"],
    ["logged", "Days logged"],
    ["best", "Best day"],
  ]) {
    const value = h("span", { class: "rail-stat-value num" }, "—");
    statCells.set(key, value);
    stats.append(
      h(
        "div",
        { class: "rail-stat" },
        h("span", { class: "rail-stat-label" }, label),
        value
      )
    );
  }

  const rail = h(
    "aside",
    { class: "rail" },
    h("div", { class: "rail-rings" }, rings.el),
    h(
      "div",
      { class: "rail-read" },
      h("p", { class: "rail-day" }, demo ? "A lived-in demo" : longDay(payload.day)),
      countLine,
      meter,
      note
    ),
    cats,
    week,
    stats,
    h(
      "div",
      { class: "rail-actions" },
      demo
        ? h("a", { class: "btn btn--quiet", href: "/log" }, "Try the logging flow")
        : h("a", { class: "btn btn--primary", href: `/log?day=${payload.day}` }, "Log everything"),
      h("a", { class: "btn btn--quiet", href: "/calendar" }, "Calendar")
    )
  );

  /* ---------------------------------------------------------- the fields */

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
      h(
        "header",
        { class: "band-head" },
        h("span", { class: "dot" }),
        h("span", {}, category.label),
        h("span", { class: "rule" }),
        count
      ),
      grid
    );
  });

  mount(board, rail, h("div", { class: "fields" }, ...bands));
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

  /* The week strip is built once — the board never changes the day it shows —
     then only its bars move when a day gets its score. */
  function buildWeek() {
    const fetchDay = demo ? (day) => demoApi.day(day) : (day) => api.day(day);
    const days = payload.week || [];
    const track = h(
      "div",
      { class: "week-track" },
      days.map((entry) => {
        const fill = h("i", { class: "week-fill" });
        const cell = h(
          "button",
          {
            type: "button",
            class: "week-cell",
            "data-today": String(entry.day === payload.day),
            "data-empty": String(!entry.logged),
            title: `${longDay(entry.day)} — ${points(entry.total)}`,
            onclick: () => {
              openDaySheet(entry.day, { fetchDay });
              onSelectDay?.(entry.day);
            },
          },
          h("span", { class: "week-letter" }, weekdayInitial(entry.day)),
          h("span", { class: "week-bar" }, fill),
          h("span", { class: "week-date num" }, String(dayOfMonth(entry.day)))
        );
        weekCells.set(entry.day, { fill, cell });
        return cell;
      })
    );
    mount(week, h("p", { class: "eyebrow" }, "This week"), track);
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

    const ratio = boardData.daily_total ? boardData.daily_logged / boardData.daily_total : 0;
    meter.firstChild.style.width = `${Math.round(ratio * 100)}%`;
    meter.dataset.complete = String(boardData.complete);

    const focus = next.focus;
    const message = boardData.complete ? next.closing : focus?.line;
    note.dataset.show = message ? "true" : "false";
    note.dataset.complete = String(boardData.complete);
    note.style.setProperty("--accent", focus?.accent || "var(--overall)");
    mount(
      note,
      focus && !boardData.complete ? h("span", { class: "dot" }) : null,
      message ? h("span", {}, message) : null
    );

    for (const categoryId of schema.ring_order) {
      const row = catRows.get(categoryId);
      const score = next.score.categories?.[categoryId];
      row.fill.style.width = score == null ? "0%" : `${Math.round(score * 100)}%`;
      row.score.textContent = points(score);
      row.score.dataset.empty = String(score == null);
    }

    for (const entry of next.week || []) {
      const slot = weekCells.get(entry.day);
      if (!slot) continue;
      slot.fill.style.height = entry.logged && typeof entry.total === "number"
        ? `${Math.max(6, Math.round(entry.total * 100))}%`
        : "0%";
      slot.cell.dataset.empty = String(!entry.logged);
      slot.cell.title = `${longDay(entry.day)} — ${points(entry.total)}`;
    }

    const logged = (next.week || []).filter((entry) => entry.logged);
    const totals = logged.map((entry) => entry.total).filter((value) => typeof value === "number");
    statCells.get("average").textContent = totals.length
      ? points(totals.reduce((sum, value) => sum + value, 0) / totals.length)
      : "—";
    statCells.get("logged").textContent = `${logged.length} of 7`;
    statCells.get("best").textContent = totals.length ? points(Math.max(...totals)) : "—";

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
}
