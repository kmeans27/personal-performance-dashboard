/* One card: one thing you log, drawn the way that thing reads best.
   The card is the only way in — every instrument is dragged, tapped or
   toggled in place and saves itself. Nothing opens a second surface.

   The instrument is decided by the catalogue in `metrics.py`, never here: a
   card only knows how to draw the shape it was handed. */

import { h, s } from "../core/dom.js";
import { formatNumber } from "../core/format.js";

const clamp01 = (value) => Math.max(0, Math.min(1, value));

/** "22:45" -> 1365 minutes past midnight. */
function minutesOf(text) {
  if (typeof text !== "string") return null;
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return (Number(match[1]) % 24) * 60 + Number(match[2]);
}

/** 1365 -> "22:45". */
function clockOf(minutes) {
  const value = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function roundTo(value, step) {
  const size = step || 1;
  return Math.round(value / size) * size;
}

/** Where a value sits on an axis, as a fraction. */
function positionOf(value, lo, hi) {
  if (hi === lo) return 0;
  return clamp01((value - lo) / (hi - lo));
}

function dragTarget(node, onMove, onDone) {
  let active = null;
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    active = null;
    delete node.dataset.drag;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", finish);
    window.removeEventListener("blur", finish);
    onDone();
  };

  const move = (event) => {
    if (active == null || event.pointerId !== active) return;
    onMove(event);
  };

  node.addEventListener("pointerdown", (event) => {
    if (node.dataset.locked === "true") return;
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    active = event.pointerId;
    finished = false;
    try {
      node.setPointerCapture(event.pointerId);
    } catch {
      /* Window listeners below still carry the drag if capture is refused. */
    }
    node.dataset.drag = "true";
    onMove(event);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    window.addEventListener("blur", finish);
  });

  node.addEventListener("lostpointercapture", () => {
    if (active != null) finish();
  });
}

function valueFromEvent(node, event, lo, hi) {
  const box = node.getBoundingClientRect();
  const ratio = clamp01((event.clientX - box.left) / (box.width || 1));
  return lo + ratio * (hi - lo);
}

const CHECK = "M2 7.4 5.4 10.8 12 4.2";

function checkMark() {
  return s(
    "svg",
    { class: "card-check", viewBox: "0 0 14 14", "aria-hidden": "true", focusable: "false" },
    s("path", { d: CHECK, fill: "none", "stroke-width": 2.1, "stroke-linecap": "round", "stroke-linejoin": "round" })
  );
}

/* --------------------------------------------------------------- instruments */

/** A value on a track: a zone to land in, a marker for today, a tick for
    yesterday. Dragging the track sets the value. Also the plain bar. */
function scaleInstrument(tile, { save, locked, onPreview, onHold }) {
  const isBar = tile.chart === "bar";
  const lo = tile.track ? tile.track[0] : 0;
  const hi = tile.track ? tile.track[1] : Math.round((tile.target || 1) * 1.5);
  const step = tile.step || (hi <= 20 ? 0.5 : 1);
  const zone = tile.zone;

  const zoneEl = h("span", { class: "ins-zone" });
  const fill = h("span", { class: "ins-fill" });
  const yest = h("span", { class: "ins-yest" });
  const goal = h("span", { class: "ins-tick" });
  const mark = h("span", { class: "ins-mark" });
  const track = h("div", { class: "ins-track" }, zoneEl, fill, goal, yest, mark);
  const el = h(
    "div",
    {
      class: "ins ins--scale",
      role: "slider",
      tabindex: locked ? -1 : 0,
      "aria-valuemin": lo,
      "aria-valuemax": hi,
    },
    track
  );

  if (zone) {
    const from = positionOf(zone[0], lo, hi);
    const to = positionOf(zone[1], lo, hi);
    zoneEl.style.left = `${from * 100}%`;
    zoneEl.style.width = `${Math.max(1.5, (to - from) * 100)}%`;
  }
  if (tile.target != null && !zone) {
    goal.style.left = `${positionOf(tile.target, lo, hi) * 100}%`;
  }
  if (tile.chart !== "bar") fill.style.display = "none";

  let current = null;
  let value = null;

  const paint = () => {
    const known = typeof value === "number";
    el.dataset.known = known ? "true" : "false";
    const at = positionOf(known ? value : lo, lo, hi);
    mark.style.left = `${at * 100}%`;
    if (isBar) fill.style.width = `${(known ? at : 0) * 100}%`;
    if (typeof tile.yesterday === "number") {
      yest.style.left = `${positionOf(tile.yesterday, lo, hi) * 100}%`;
      yest.style.display = "block";
    } else {
      yest.style.display = "none";
    }
  };

  const set = (next) => {
    const raw = next.values?.[next.fields[0]];
    value = typeof raw === "number" ? raw : null;
    current = value;
    el.dataset.inside = zone && typeof value === "number" && value >= zone[0] && value <= zone[1] ? "true" : "false";
    el.dataset.beyond = zone && typeof value === "number" && value > zone[1] ? "true" : "false";
    el.setAttribute("aria-valuenow", value == null ? "" : String(value));
    el.setAttribute("aria-valuetext", value == null ? "not logged" : `${value}${next.unit ? ` ${next.unit}` : ""}`);
    paint();
  };

  const preview = (raw) => {
    value = raw;
    el.setAttribute("aria-valuenow", String(raw));
    el.setAttribute("aria-valuetext", `${raw}${tile.unit ? ` ${tile.unit}` : ""}`);
    paint();
    // The number follows the pointer, before anything is written.
    onPreview?.(formatNumber(raw, step, tile.id));
  };

  const nudge = (direction) => {
    const base = typeof current === "number" ? current : lo;
    const next = Math.max(lo, Math.min(hi, roundTo(base + direction * step, step)));
    current = next;
    preview(next);
    save({ [tile.fields[0]]: next });
  };

  if (!locked) {
    dragTarget(
      el,
      (event) => {
        const raw = roundTo(valueFromEvent(track, event, lo, hi), step);
        current = Math.max(lo, Math.min(hi, raw));
        onHold?.(true);
        preview(current);
      },
      () => {
        onHold?.(false);
        if (typeof current === "number") save({ [tile.fields[0]]: current });
      }
    );
    el.addEventListener("keydown", (event) => {
      const map = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };
      if (map[event.key]) {
        event.preventDefault();
        nudge(map[event.key]);
      }
      if (event.key === "Home") {
        event.preventDefault();
        current = lo;
        preview(lo);
        save({ [tile.fields[0]]: lo });
      }
      if (event.key === "End") {
        event.preventDefault();
        current = hi;
        preview(hi);
        save({ [tile.fields[0]]: hi });
      }
    });
  }

  set(tile);
  return { el, set };
}

/** Small counts you tick off: gym sessions, alcohol-free days. */
function dashesInstrument(tile, { save, locked }) {
  const field = tile.fields[0];
  const week = tile.id === "gym";
  const drinks = tile.id === "alcohol";
  const count = week ? Math.max(1, Math.round(tile.target || 3)) : tile.cells || 7;
  const today = typeof tile.values?.[field] === "number" ? tile.values[field] : 0;
  const cells = [];
  const row = h("div", { class: "ins-dashes" });

  /* A gym row is the week: tapping the third dash means "three this week".
     An alcohol row is the last seven days, so only today can still change. */
  const setWeek = (wanted) => {
    const others = Math.max(0, (tile.filled || 0) - today);
    save({ [field]: Math.max(0, Math.min(count, wanted) - others) });
  };
  const tapToday = () => {
    if (drinks) {
      save({ [field]: today ? 0 : 1 });
      return;
    }
    setWeek((tile.filled || 0) >= count ? 0 : (tile.filled || 0) + 1);
  };

  for (let index = 0; index < count; index += 1) {
    const isToday = index === count - 1;
    const live = week || (drinks && isToday);
    const cell = h(live ? "button" : "span", {
      type: live ? "button" : undefined,
      class: "dash",
      "data-today": isToday ? "true" : "false",
      "data-live": live ? "true" : "false",
      "aria-label": isToday ? "Today" : `${index + 1} this week`,
      title: isToday ? "Today" : `${index + 1} this week`,
      onclick: !live || locked ? undefined : () => (week ? setWeek(index + 1) : tapToday()),
    });
    cells.push(cell);
    row.append(cell);
  }
  const el = h("div", { class: "ins ins--dashes" }, row);

  function set(next) {
    cells.forEach((cell, index) => {
      cell.dataset.filled = index < (next.filled || 0) ? "true" : "false";
    });
  }

  set(tile);
  return { el, set };
}

/** A big count you stack up: deep blocks. */
function blocksInstrument(tile, { save, locked }) {
  const count = tile.cells || 3;
  const blocks = [];
  const row = h("div", { class: "ins-blocks" });
  for (let index = 0; index < count; index += 1) {
    const block = h("button", {
      type: "button",
      class: "block",
      "aria-label": `${index + 1} block${index ? "s" : ""}`,
      onclick: locked ? undefined : () => {
        const now = Number(tile.values?.[tile.fields[0]] ?? 0);
        save({ [tile.fields[0]]: now === index + 1 ? index : index + 1 });
      },
    });
    blocks.push(block);
    row.append(block);
  }
  const el = h("div", { class: "ins ins--blocks" }, row);

  function set(next) {
    const filled = next.filled || 0;
    blocks.forEach((block, index) => {
      block.dataset.filled = index < filled ? "true" : "false";
      block.dataset.next = index === filled ? "true" : "false";
    });
  }

  set(tile);
  return { el, set };
}

/** A yes/no that must look unmistakably answered — "No" is an answer. */
function switchInstrument(tile, { save, locked }) {
  const options = [
    ["Yes", true],
    ["No", false],
  ];
  const buttons = options.map(([text, value]) =>
    h(
      "button",
      {
        type: "button",
        class: "choice",
        "data-value": String(value),
        onclick: locked ? undefined : () => save({ [tile.fields[0]]: value }),
      },
      text
    )
  );
  const el = h("div", { class: "ins ins--switch" }, buttons);

  function set(next) {
    const raw = next.values?.[next.fields[0]];
    buttons.forEach((button, index) => {
      button.dataset.on = raw === options[index][1] ? "true" : "false";
    });
  }

  set(tile);
  return { el, set };
}

/** A felt 1–5: five bars standing on a hairline, the word under each, the
    usual marked on the line. The same ladder the detail editor draws. */
function ladderInstrument(tile, { save, locked }) {
  const metric = tile.cells || 5;
  const low = tile.min ?? 1;
  const labels = tile.labels || [];
  // The editor's ladder: each bar a little taller than the one before it.
  const shares = [0.17, 0.38, 0.58, 0.79, 1];
  const rungs = [];
  const row = h("div", { class: "ladder" });
  for (let index = 0; index < metric; index += 1) {
    const value = low + index;
    const share = shares[index] ?? 1;
    const rung = h(
      "button",
      {
        type: "button",
        class: "ladder-rung",
        "data-step": String(value),
        "aria-label": labels[index] || String(value),
        style: { "--share": String(share), "--rest": String(1 - share) },
        onclick: locked ? undefined : () => save({ [tile.fields[0]]: value }),
      },
      h("span", { class: "ladder-spacer", "aria-hidden": "true" }),
      h("span", { class: "ladder-bar" }),
      h("span", { class: "ladder-word" }, labels[index] || String(value))
    );
    rungs.push(rung);
    row.append(rung);
  }
  const usual = h("span", { class: "ladder-usual" });
  const el = h(
    "div",
    { class: "ins ins--ladder" },
    tile.prompt ? h("p", { class: "ins-prompt" }, tile.prompt) : null,
    h("div", { class: "ladder-wrap" }, row, usual)
  );

  function set(next) {
    const raw = Number(next.values?.[next.fields[0]]);
    const filled = Number.isFinite(raw) ? raw : null;
    rungs.forEach((rung, index) => {
      rung.dataset.on = filled != null && index === Math.round(filled) - low ? "true" : "false";
    });
    const mark = typeof next.usual === "number" ? Math.round(next.usual) - low : null;
    usual.hidden = mark == null || mark < 0 || mark >= metric;
    if (!usual.hidden) usual.style.left = `${((mark + 0.5) / metric) * 100}%`;
  }

  set(tile);
  return { el, set };
}

/** The evening: 21:00 to 02:00, the hours most people actually get to bed.
    You enter one thing — when you lay down. The hour you got up is worked out
    from how long you slept, so there is never a second clock to keep. */
function bedInstrument(tile, { save, locked, onPreview, onHold }) {
  const START = 21 * 60; // 21:00
  const SPAN = 5 * 60; // 02:00
  const zone = h("span", { class: "bed-zone" });
  const usualTick = h("span", { class: "bed-tick bed-tick--usual", title: "Your usual" });
  const yesterdayTick = h("span", { class: "bed-tick bed-tick--yesterday", title: "Yesterday" });
  const mark = h("span", { class: "bed-mark" });
  const track = h("div", { class: "bed-track" }, zone, usualTick, yesterdayTick, mark);
  const labels = h(
    "div",
    { class: "bed-labels", "aria-hidden": "true" },
    ...["21:00", "22:00", "23:00", "00:00", "01:00", "02:00"].map((text) => h("span", {}, text))
  );
  const el = h("div", { class: "ins ins--bed" }, track, labels);

  let value = null;
  let usual = null;
  let yesterday = null;
  let timer = null;

  /** Minutes past 21:00, as a share of the five-hour window. Anything outside
      it sits on the nearer edge — the card never lies about the axis. */
  const share = (minutes) => {
    if (minutes == null) return null;
    const raw = (((minutes - START) % 1440) + 1440) % 1440;
    if (raw <= SPAN) return raw / SPAN;
    const toStart = Math.min(raw, 1440 - raw);
    const toEnd = Math.min(Math.abs(raw - SPAN), 1440 - Math.abs(raw - SPAN));
    return toStart <= toEnd ? 0 : 1;
  };

  const place = (node, minutes) => {
    const at = share(minutes);
    if (at == null) {
      node.hidden = true;
      return;
    }
    node.hidden = false;
    node.style.left = `${at * 100}%`;
  };

  function paint() {
    el.dataset.known = value == null ? "false" : "true";
    place(mark, value);
    place(usualTick, usual);
    place(yesterdayTick, yesterday);
    if (usual == null) {
      zone.hidden = true;
    } else {
      const lo = share(usual - 45);
      const hi = share(usual + 45);
      zone.hidden = false;
      zone.style.left = `${Math.min(lo, hi) * 100}%`;
      zone.style.width = `${Math.abs(hi - lo) * 100}%`;
    }
    if (value == null) {
      el.removeAttribute("aria-valuenow");
      el.removeAttribute("aria-valuetext");
    } else {
      el.setAttribute("aria-valuenow", String(value));
      el.setAttribute("aria-valuetext", clockOf(value));
    }
  }

  const settle = () => {
    clearTimeout(timer);
    if (value != null) save({ bed_time: clockOf(value) });
  };

  if (!locked) {
    el.tabIndex = 0;
    el.setAttribute("role", "slider");
    el.setAttribute("aria-label", "Bed time");
    el.setAttribute("aria-valuemin", "0");
    el.setAttribute("aria-valuemax", "1439");

    dragTarget(
      el,
      (event) => {
        const raw = valueFromEvent(track, event, START, START + SPAN);
        value = ((Math.round(raw / 15) * 15) % 1440 + 1440) % 1440;
        onHold?.(true);
        paint();
        // The clock follows the pointer, before anything is written.
        onPreview?.(clockOf(value));
      },
      () => {
        onHold?.(false);
        settle();
      }
    );

    el.addEventListener("keydown", (event) => {
      const step = event.shiftKey ? 60 : 15;
      let next = value ?? 23 * 60;
      if (event.key === "ArrowLeft" || event.key === "ArrowDown") next -= step;
      else if (event.key === "ArrowRight" || event.key === "ArrowUp") next += step;
      else if (event.key === "Home") next = START;
      else if (event.key === "End") next = START + SPAN;
      else return;
      event.preventDefault();
      value = ((Math.round(next / 15) * 15) % 1440 + 1440) % 1440;
      paint();
      clearTimeout(timer);
      timer = setTimeout(settle, 450);
    });
  }

  function set(next) {
    value = typeof next.bed === "number" ? next.bed : null;
    usual = typeof next.usual_bed === "number" ? next.usual_bed : null;
    yesterday = typeof next.yesterday_bed === "number" ? next.yesterday_bed : null;
    paint();
  }

  set(tile);
  return { el, set };
}

/** Thirty days of one habit, with today at the end of the row. */
function cleanInstrument(tile, { save, locked }) {
  const days = tile.days || [];
  const cells = days.map((entry) => {
    const cell = h("span", {
      class: "clean-day",
      "data-filled": entry.clean ? "true" : "false",
      "data-today": entry.day === days[days.length - 1]?.day ? "true" : "false",
    });
    return cell;
  });
  const row = h("div", { class: "ins-clean" }, cells);
  const el = h("div", { class: "ins ins--clean" }, row);

  if (!locked) {
    row.addEventListener("click", () => {
      const today = days[days.length - 1];
      save({ avoid_habit: !today.clean });
    });
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", "Toggle today");
    el.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const today = days[days.length - 1];
        if (today) save({ avoid_habit: !today.clean });
      }
    });
  }

  function set(next) {
    (next.days || []).forEach((entry, index) => {
      if (cells[index]) cells[index].dataset.filled = entry.clean ? "true" : "false";
    });
    el.setAttribute("aria-pressed", next.values?.avoid_habit === true ? "true" : "false");
  }

  set(tile);
  return { el, set };
}

function instrumentFor(tile, options) {
  switch (tile.chart) {
    case "bar":
      return tile.id === "avoid_habit" ? cleanInstrument(tile, options) : scaleInstrument(tile, options);
    case "segments":
      return dashesInstrument(tile, options);
    case "blocks":
      return blocksInstrument(tile, options);
    case "switch":
      return switchInstrument(tile, options);
    case "scale":
      return ladderInstrument(tile, options);
    case "bedtime":
      return bedInstrument(tile, options);
    case "range":
    default:
      return scaleInstrument(tile, options);
  }
}

/* -------------------------------------------------------------------- card */

export function createCard(tile, { accent, locked = false, onSave, onOpen } = {}) {
  const label = h("span", { class: "card-label" }, tile.label);
  const number = h("span", { class: "card-number" });
  const unit = h("small", { class: "card-unit" });
  const value = h("span", { class: "card-value num" }, number, unit);
  const points = h("span", { class: "card-points num" });
  const gap = h("p", { class: "card-gap" });
  const headRow = h("span", { class: "card-head-row" }, label, points);
  const valueRow = h("span", { class: "card-head-value" }, value);
  // The head is a real button so the detail editor is one Tab away. A click
  // anywhere on the card that is not an instrument opens it too.
  const head = h(
    "button",
    {
      type: "button",
      class: "card-head",
      "aria-label": `Edit ${tile.label} in detail`,
      "aria-haspopup": "dialog",
      title: "Open in detail",
    },
    headRow,
    valueRow
  );

  /* While a slider is held, the card shows the value under the pointer and
     the target it is heading for. The server's own sentence comes back when
     the pointer is let go and the write has landed. */
  let held = false;
  let cardEl = null;
  const options = {
    locked,
    save: (values) => onSave?.(values),
    onPreview: (text) => {
      number.textContent = text;
      unit.textContent = tile.unit || "";
    },
    onHold: (state) => {
      if (held === state) return;
      held = state;
      if (cardEl) {
        if (state) cardEl.dataset.dragging = "true";
        else delete cardEl.dataset.dragging;
      }
      gap.textContent = state ? tile.target_label || "" : gap.dataset.answer || "";
    },
  };
  const instrument = instrumentFor(tile, options);

  const el = h(
    "article",
    {
      class: "card",
      "data-card": tile.id,
      "data-category": tile.category,
      "data-chart": tile.chart,
      "data-w": String(tile.w || 1),
      style: { "--accent": accent },
    },
    head,
    instrument.el,
    gap
  );
  cardEl = el;

  function setValue(next) {
    number.textContent = next.display == null ? "—" : next.display;
    unit.textContent = next.unit && next.display != null ? next.unit : "";
  }

  function update(next) {
    const wasEmpty = el.dataset.state === "empty";
    el.dataset.state = next.state;
    el.dataset.settled = next.settled ? "true" : "false";
    el.dataset.optional = next.optional ? "true" : "false";
    el.setAttribute(
      "aria-label",
      `${next.label}: ${next.display ?? "not logged"}${next.unit ? ` ${next.unit}` : ""}. ${next.gap}`
    );

    label.textContent = next.label;
    // A write landing while the pointer is still down never pulls the number
    // or the knob away from the value under the hand.
    if (!held) {
      setValue(next);
      instrument.set(next);
    }

    head.dataset.done = next.state === "done" ? "true" : "false";
    if (next.state === "done") {
      if (!valueRow.querySelector(".card-check")) valueRow.append(checkMark());
    } else {
      valueRow.querySelector(".card-check")?.remove();
    }

    if (next.weight == null) {
      // Not part of the score: say so, rather than showing a zero it did not earn.
      points.dataset.chip = "true";
      points.textContent = next.id === "weight" ? "Optional" : "Not in the score";
      points.removeAttribute("title");
    } else if (next.points == null) {
      // Scored, but too early to say: a rhythm needs a few nights first.
      points.dataset.chip = "true";
      points.textContent = "—";
      points.title = "Scores after a few nights";
    } else {
      points.dataset.chip = "false";
      points.textContent = `${next.points ?? 0}`;
      points.append(h("small", {}, "/10"));
    }

    gap.dataset.answer = next.gap;
    if (!held) gap.textContent = next.gap;
    gap.dataset.state = next.state;

    if (wasEmpty && next.display != null) {
      el.dataset.landed = "true";
      setTimeout(() => delete el.dataset.landed, 640);
    }
  }

  if (!locked && onOpen) {
    el.dataset.editable = "true";
    el.addEventListener("click", (event) => {
      // Instruments answer in place; the rest of the card opens it up.
      if (event.target.closest(".ins")) return;
      onOpen();
    });
  }

  update(tile);

  /** Bring the card into view and let it glow once — navigation, never logging. */
  function reveal() {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.dataset.pulse = "true";
    setTimeout(() => delete el.dataset.pulse, 1400);
  }

  return { el, update, id: tile.id, reveal };
}
