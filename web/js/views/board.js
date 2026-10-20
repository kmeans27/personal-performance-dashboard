/* The board: today, one screen, nothing to scroll.
   A left rail says what the day means — the ring, where it is going, and the
   week so far. The rest is the cards themselves: three category columns, every
   field in its own instrument, logged where it is read. The bar along the
   bottom shows where the score comes from, one segment per field, sized by
   what the field is worth. */

import { h, mount } from "../core/dom.js";
import { createRings, microRings } from "../rings.js";
import { createCard } from "../components/card.js";
import { openDaySheet } from "../components/daySheet.js";
import { openCardEditor } from "../components/editor.js";
import { categoryMap } from "../core/catalogue.js";
import { dayOfMonth, longDay, points, weekdayInitial } from "../core/format.js";
import { api, demoApi } from "../core/api.js";
import { toast } from "../core/chrome.js";

export function boardView({
  payload,
  schema,
  demo = false,
  framed = false,
  onSelectDay,
  onPayload,
}) {
  const categories = categoryMap(schema);
  const accents = new Map(schema.categories.map((category) => [category.id, category.accent]));
  const cards = new Map();
  const catNodes = new Map();
  const weekCells = new Map();
  const segments = new Map();
  let weekAverage = null;

  const rings = createRings();
  rings.setScores(payload.score);
  requestAnimationFrame(() => rings.settleNow());

  const board = h("div", {
    class: framed ? "board board--framed" : "board",
    "data-demo": String(demo),
  });

  /* ------------------------------------------------------------- the rail */

  const dateLine = h("p", { class: "rail-date" }, longDay(payload.day));
  const compare = h("div", { class: "rail-compare" });
  const move = h("section", { class: "move", "data-empty": "true" });
  const week = h("section", { class: "week" });

  const rail = h(
    "aside",
    { class: "rail" },
    h("div", { class: "rail-top" }, dateLine, h("div", { class: "rail-rings" }, rings.el)),
    h("div", { class: "rail-mid" }, compare, move),
    week
  );

  /* ------------------------------------------------------------ the cards */

  const main = h("main", { class: "main" });
  for (const categoryId of schema.ring_order) {
    const category = categories.get(categoryId);
    const count = h("span", { class: "cat-count num" });
    const score = h("span", { class: "cat-score num" }, "—");
    const grid = h("div", { class: "cat-cards" });
    for (const tile of payload.board.tiles.filter((entry) => entry.category === categoryId)) {
      const card = createCard(tile, {
        accent: accents.get(categoryId),
        locked: demo,
        onSave: (values) => save(tile.id, values),
        onOpen: () => openEditor(tile.id, categoryId),
      });
      cards.set(tile.id, card);
      grid.append(card.el);
    }
    const section = h(
      "section",
      { class: "cat", "data-category": categoryId, "data-accent": categoryId },
      h(
        "header",
        { class: "cat-head" },
        h("span", { class: "cat-dot" }),
        h("span", { class: "cat-name" }, category.label),
        count,
        score
      ),
      grid
    );
    catNodes.set(categoryId, { score, count, section });
    main.append(section);
  }

  /* ------------------------------------------------------- the score bar */

  const readout = h("span", { class: "seg-readout" });
  const segmentsRow = h("div", { class: "segments" });
  const breakdown = h(
    "footer",
    { class: "breakdown" },
    h("p", { class: "eyebrow" }, "Where your score comes from", readout),
    segmentsRow
  );

  buildSegments();
  buildWeek();
  mount(board, rail, main, breakdown);
  setPayload(payload);

  return { el: board, setPayload, cards };

  // -------------------------------------------------------------- internals

  async function save(fieldId, values) {
    if (demo) return null;
    try {
      const next = await api.saveDay(payload.day, values);
      setPayload(next);
      return next;
    } catch (error) {
      toast(`Not saved: ${error.message}`, "attention");
      return null;
    }
  }

  /** Writes to any day, not just today: the detail editor can fix Tuesday. */
  async function saveDay(day, values) {
    if (demo) return null;
    try {
      await api.saveDay(day, values);
      const next = await api.day(payload.day);
      setPayload(next);
      return next;
    } catch (error) {
      toast(`Not saved: ${error.message}`, "attention");
      return null;
    }
  }

  /** The card, opened up: a bigger control for the same field. */
  function openEditor(id, categoryId) {
    if (demo) return;
    const seed = payload.board.tiles.find((tile) => tile.id === id);
    if (!seed) return;
    openCardEditor(seed, {
      accent: accents.get(categoryId),
      category: (categories.get(categoryId) || {}).label || categoryId,
      tile: () => payload.board.tiles.find((tile) => tile.id === id),
      save: (values) => save(id, values),
      saveDay,
    });
  }

  /** Navigation, never logging: bring a card into view and let it pulse. */
  function reveal(id) {
    cards.get(id)?.reveal();
  }

  function buildSegments() {
    for (const tile of payload.board.tiles) {
      if (tile.weight == null) continue;
      const fill = h("span", { class: "seg-fill" });
      const group = (categories.get(tile.category) || {}).label || tile.category;
      const segment = h(
        "button",
        {
          type: "button",
          class: "seg",
          "data-card": tile.id,
          style: { flexGrow: String(tile.weight), "--accent": accents.get(tile.category) },
          title: `${tile.label} — ${group}`,
          onclick: () => reveal(tile.id),
          onmouseenter: () => describe(tile, group),
          onfocus: () => describe(tile, group),
          onmouseleave: () => readout.replaceChildren(),
          onblur: () => readout.replaceChildren(),
        },
        fill
      );
      segments.set(tile.id, { segment, fill });
      segmentsRow.append(segment);
    }
  }

  function describe(tile, group) {
    const share = Math.round((tile.weight / 3) * 100);
    mount(
      readout,
      h("b", {}, tile.label),
      ` · ${group} · ${share}% of the score · ${tile.points == null ? "not scored" : `${tile.points}/10`}`
    );
  }

  /* The week strip is built once — the board never changes the day it shows —
     then only its rings move when a day gets its score. */
  function buildWeek() {
    const fetchDay = demo ? (day) => demoApi.day(day) : (day) => api.day(day);
    const track = h(
      "div",
      { class: "week-row" },
      (payload.week || []).map((entry) => {
        const ring = h("span", { class: "week-ring" });
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
          ring,
          h("span", { class: "week-date num" }, String(dayOfMonth(entry.day)))
        );
        weekCells.set(entry.day, { ring, cell });
        return cell;
      })
    );
    const average = h("b", { class: "num week-avg" }, "—");
    mount(
      week,
      h("p", { class: "eyebrow" }, "This week", average),
      track
    );
    weekAverage = average;
  }

  function setPayload(next) {
    payload = next;
    const boardData = next.board;
    rings.setScores(next.score);
    board.dataset.complete = String(boardData.complete);

    const missing = schema.ring_order.filter((id) => next.score.categories?.[id] == null);
    const provisional = missing.length > 0 && next.score.total != null;
    rings.setCaption(provisional ? "so far" : "");

    mount(
      compare,
      compareCell("Yesterday", next.compare?.yesterday),
      compareCell("Usual", next.compare?.usual)
    );

    const moveData = boardData.next_move;
    move.dataset.empty = String(!moveData);
    if (moveData) {
      move.style.setProperty("--accent", accents.get(moveData.category) || "var(--amber)");
      mount(
        move,
        h("p", { class: "eyebrow eyebrow--amber" }, "Next best move"),
        h(
          "button",
          { type: "button", class: "move-card", onclick: () => reveal(moveData.id) },
          h(
            "span",
            { class: "move-head" },
            h("span", { class: "move-label" }, moveData.label),
            h("span", { class: "move-points num" }, `+${moveData.points}`)
          ),
          h("span", { class: "move-line" }, moveData.line),
          h("span", { class: "move-go" }, "Show card")
        )
      );
    } else {
      mount(
        move,
        h("p", { class: "eyebrow eyebrow--amber" }, "Next best move"),
        h(
          "div",
          { class: "move-card move-card--clear" },
          h("span", { class: "move-head" }, h("span", { class: "move-label" }, "Everything that counts is in")),
          h("span", { class: "move-line" }, "Nothing left that would move the score today.")
        )
      );
    }

    for (const entry of next.week || []) {
      const slot = weekCells.get(entry.day);
      if (!slot) continue;
      mount(slot.ring, microRings(entry.categories || {}, { size: 30, stroke: 2.4 }));
      slot.cell.dataset.empty = String(!entry.logged);
      slot.cell.title = `${longDay(entry.day)} — ${points(entry.total)}`;
    }
    const logged = (next.week || []).filter((entry) => entry.logged);
    const totals = logged.map((entry) => entry.total).filter((value) => typeof value === "number");
    weekAverage.textContent = totals.length
      ? points(totals.reduce((sum, value) => sum + value, 0) / totals.length)
      : "—";

    for (const categoryId of schema.ring_order) {
      const node = catNodes.get(categoryId);
      const tiles = boardData.tiles.filter((tile) => tile.category === categoryId);
      const settled = tiles.filter((tile) => tile.settled).length;
      node.count.textContent = `${settled}/${tiles.length}`;
      const score = next.score.categories?.[categoryId];
      node.score.textContent = points(score);
      node.score.dataset.empty = String(score == null);
      node.section.dataset.complete = String(tiles.length > 0 && settled === tiles.length);
    }

    for (const tile of boardData.tiles) {
      cards.get(tile.id)?.update(tile);
      const segment = segments.get(tile.id);
      if (!segment) continue;
      segment.fill.style.width = `${Math.round((tile.score ?? 0) * 100)}%`;
      segment.segment.dataset.logged = tile.settled || tile.state !== "empty" ? "true" : "false";
      segment.segment.dataset.open = tile.progress != null && tile.progress < 1 ? "true" : "false";
    }

    onPayload?.(next);
  }

  function compareCell(label, value) {
    return h(
      "div",
      { class: "compare-cell" },
      h("span", { class: "compare-label" }, label),
      h("span", { class: "compare-value num" }, points(value))
    );
  }
}
