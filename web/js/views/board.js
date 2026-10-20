/* The board: today, one screen, nothing to scroll.
   A left rail says what the day means — the ring, where it is going, and the
   week so far. The rest is the cards themselves: three category columns, every
   field in its own instrument, logged where it is read. The bar along the
   bottom shows where the score comes from, grouped by category. */

import { h, mount } from "../core/dom.js";
import { createRings, microRings } from "../rings.js";
import { createCard } from "../components/card.js";
import { openDaySheet } from "../components/daySheet.js";
import { openCardEditor } from "../components/editor.js";
import { categoryMap } from "../core/catalogue.js";
import { dayOfMonth, longDay, points, weekdayInitial } from "../core/format.js";
import { api, demoApi } from "../core/api.js";
import { toast } from "../core/chrome.js";

/** The import's UTC timestamp as the clock time on this machine. */
function syncedClock(iso) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat([], {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

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
  const notes = new Map();
  const catNodes = new Map();
  const weekCells = new Map();
  const segments = new Map();
  const groupScores = new Map();
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
  const moves = h("section", { class: "moves", "data-empty": "true" });
  const week = h("section", { class: "week" });
  const sources = createSourcesCard();

  const rail = h(
    "aside",
    { class: "rail" },
    h("div", { class: "rail-top" }, dateLine, h("div", { class: "rail-rings" }, rings.el)),
    compare,
    moves,
    week,
    sources.el
  );

  /* ------------------------------------------------------------ the cards */

  const main = h("main", { class: "main" });
  for (const categoryId of schema.ring_order) {
    const category = categories.get(categoryId);
    const count = h("span", { class: "cat-count num" });
    const score = h("span", { class: "cat-score num" }, "—");
    const grid = h("div", { class: "cat-cards" });
    /* A column is a stack of rows, and a row is a pair of cards: Steps sits
       beside Gym, Read beside Learned. The plan — how many rows a column
       has, and how tall each one is — lives in board.css. */
    let row = null;
    let used = 0;
    let pending = [];

    /* A note belongs to the pair it annotates, so it waits until the row is
       complete and then opens under it, full width. */
    const closeRow = () => {
      if (!row) return;
      for (const tile of pending) {
        const noteRow = createNoteRow(tile);
        notes.set(tile.id, noteRow);
        row.append(noteRow.el);
      }
      row = null;
      used = 0;
      pending = [];
    };

    for (const tile of payload.board.tiles.filter((entry) => entry.category === categoryId)) {
      const span = tile.w || 1;
      if (!row || used + span > 2) {
        closeRow();
        row = h("div", { class: "card-row" });
        grid.append(row);
      }
      const card = createCard(tile, {
        accent: accents.get(categoryId),
        locked: demo,
        onSave: (values) => save(tile.id, values),
        onOpen: () => openEditor(tile.id, categoryId),
      });
      cards.set(tile.id, card);
      row.append(card.el);
      used += span;
      if (tile.note) pending.push(tile);
      if (used >= 2) closeRow();
    }
    closeRow();
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

  /* A note belongs to the answer, not to the card: when a yes/no is Yes, the
     written line opens as its own full-width row below the pair. */
  function createNoteRow(tile) {
    const field = tile.note.field;
    const input = h("input", {
      class: "note-input",
      type: "text",
      maxlength: 140,
      placeholder: tile.note.prompt,
      "aria-label": tile.note.prompt,
    });
    let timer = null;
    const commit = () => {
      clearTimeout(timer);
      save(tile.id, { [field]: input.value || null });
    };
    input.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(commit, 700);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commit();
      }
    });
    input.addEventListener("blur", () => {
      if (timer) commit();
    });

    const el = h(
      "div",
      { class: "card-note-row", "data-card": tile.id, "data-open": "false" },
      h("div", { class: "card-note-inner" }, input)
    );
    el.hidden = true;

    function update(next) {
      const open = next.values?.[tile.fields[0]] === true;
      if (!open) {
        el.dataset.open = "false";
        el.hidden = true;
        return;
      }
      const wasHidden = el.hidden;
      el.hidden = false;
      if (wasHidden) {
        el.dataset.open = "false";
        requestAnimationFrame(() => {
          el.dataset.open = "true";
        });
      }
      const wanted = next.values?.[field] == null ? "" : String(next.values[field]);
      if (document.activeElement !== input && input.value !== wanted) input.value = wanted;
    }

    update(tile);
    return { el, update };
  }

  function buildSegments() {
    for (const categoryId of schema.ring_order) {
      const category = categories.get(categoryId) || { label: categoryId };
      const track = h("div", { class: "seg-group-track" });
      const score = h("b", { class: "seg-group-score num" }, "—");
      groupScores.set(categoryId, score);
      const group = h(
        "div",
        {
          class: "seg-group",
          "data-category": categoryId,
          style: { "--accent": accents.get(categoryId) },
        },
        h(
          "div",
          { class: "seg-group-head" },
          h("span", { class: "seg-group-name" }, category.label),
          score
        ),
        track
      );

      for (const tile of payload.board.tiles) {
        if (tile.category !== categoryId || tile.weight == null) continue;
        const fill = h("span", { class: "seg-fill" });
        const worth = tile.points == null ? "not scored" : `${tile.points}/10`;
        const name = h("span", { class: "seg-name" }, `${tile.label} · ${tile.points ?? "—"}`);
        const segment = h(
          "button",
          {
            type: "button",
            class: "seg",
            "data-card": tile.id,
            style: { flexGrow: String(tile.weight), "--accent": accents.get(tile.category) },
            title: `${tile.label} — ${worth}`,
            "aria-label": `${tile.label}, ${worth}, ${category.label}`,
            onclick: () => reveal(tile.id),
            onmouseenter: () => describe(tile, category.label),
            onfocus: () => describe(tile, category.label),
            onmouseleave: () => readout.replaceChildren(),
            onblur: () => readout.replaceChildren(),
          },
          fill,
          name
        );
        segments.set(tile.id, { segment, fill });
        track.append(segment);
      }
      segmentsRow.append(group);
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
    mount(week, h("p", { class: "eyebrow" }, "This week", average), track);
    weekAverage = average;
  }

  function setPayload(next) {
    payload = next;
    const boardData = next.board;
    rings.setScores(next.score);
    if (!demo) rings.celebrate(next.day, next.score.total);
    board.dataset.complete = String(boardData.complete);

    const missing = schema.ring_order.filter((id) => next.score.categories?.[id] == null);
    const provisional = missing.length > 0 && next.score.total != null;
    rings.setCaption(
      next.score.total == null ? "not logged" : provisional ? "so far" : ""
    );

    mount(
      compare,
      compareCell("Yesterday", next.compare?.yesterday),
      compareCell("Usual", next.compare?.usual)
    );

    renderMoves(boardData);
    sources.set(next.sources);

    for (const entry of next.week || []) {
      const slot = weekCells.get(entry.day);
      if (!slot) continue;
      mount(slot.ring, microRings(entry.categories || {}, { size: 26, stroke: 2.2 }));
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
      const groupScore = groupScores.get(categoryId);
      if (groupScore) {
        groupScore.textContent = points(score);
        groupScore.dataset.empty = String(score == null);
      }
    }

    for (const tile of boardData.tiles) {
      cards.get(tile.id)?.update(tile);
      notes.get(tile.id)?.update(tile);
      const segment = segments.get(tile.id);
      if (!segment) continue;
      segment.fill.style.width = `${Math.round((tile.score ?? 0) * 100)}%`;
      segment.segment.dataset.logged = tile.settled || tile.state !== "empty" ? "true" : "false";
      segment.segment.dataset.open = tile.progress != null && tile.progress < 1 ? "true" : "false";
      segment.segment.dataset.move = boardData.next_move?.id === tile.id ? "true" : "false";
    }

    onPayload?.(next);
  }

  function renderMoves(boardData) {
    const list = boardData.next_moves || (boardData.next_move ? [boardData.next_move] : []);
    moves.dataset.empty = String(!list.length);
    if (!list.length) {
      mount(
        moves,
        h("p", { class: "eyebrow eyebrow--amber" }, "Next best moves"),
        h(
          "div",
          { class: "move-empty" },
          h("b", {}, "Everything that counts is in"),
          h("span", {}, "Nothing left that would move the score today.")
        )
      );
      return;
    }
    mount(
      moves,
      h("p", { class: "eyebrow eyebrow--amber" }, "Next best moves"),
      h(
        "div",
        { class: "move-list" },
        list.map((moveData) =>
          h(
            "button",
            {
              type: "button",
              class: "move-item",
              style: { "--accent": accents.get(moveData.category) || "var(--amber)" },
              title: `${moveData.label} — show the card`,
              onclick: () => reveal(moveData.id),
            },
            h(
              "span",
              { class: "move-head" },
              h("span", { class: "move-label" }, moveData.label),
              h("span", { class: "move-points num" }, `+${moveData.points}`)
            ),
            h("span", { class: "move-line" }, moveData.line)
          )
        )
      )
    );
  }

  /* ------------------------------------------------------------- sources */

  function createSourcesCard() {
    const card = h("section", { class: "sources" });
    card.hidden = true;

    async function dismiss() {
      if (demo) return;
      try {
        await api.saveSettings({ sources_dismissed: true });
        card.hidden = true;
      } catch (error) {
        toast(`Not saved: ${error.message}`, "attention");
      }
    }

    function set(data) {
      if (!data || !data.show) {
        card.hidden = true;
        return;
      }
      card.hidden = false;
      mount(
        card,
        h(
          "div",
          { class: "sources-head" },
          h("p", { class: "eyebrow" }, "Sources"),
          h(
            "button",
            { type: "button", class: "sources-hide", onclick: dismiss, title: "Hide the Sources card" },
            "Hide"
          )
        ),
        h(
          "div",
          { class: "source-list" },
          data.rows.map((row) =>
            h(
              "div",
              { class: "source-row", "data-synced": String(row.recent) },
              h("span", { class: "source-name" }, row.label),
              row.recent
                ? h("span", { class: "source-time num" }, `synced ${syncedClock(row.received_at)}`)
                : h("a", { class: "source-setup", href: "/settings#sources" }, "Set up")
            )
          )
        )
      );
    }

    return { el: card, set };
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
