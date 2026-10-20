/* One card: one thing you log, drawn the way that thing reads best.
   The card is the only way in — every instrument is dragged, tapped or
   toggled in place and saves itself. Nothing opens a second surface.

   The instrument is decided by the catalogue in `metrics.py`, never here: a
   card only knows how to draw the shape it was handed. */

import { h, mount, s } from "../core/dom.js";
import { clock, compactNumber } from "../core/format.js";

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
  node.addEventListener("pointerdown", (event) => {
    if (node.dataset.locked === "true") return;
    event.preventDefault();
    node.setPointerCapture(event.pointerId);
    node.dataset.drag = "true";
    onMove(event);
    const move = (next) => onMove(next);
    const finish = () => {
      delete node.dataset.drag;
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", finish);
      node.removeEventListener("pointercancel", finish);
      onDone();
    };
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", finish);
    node.addEventListener("pointercancel", finish);
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
function scaleInstrument(tile, { save, locked }) {
  const isBar = tile.chart === "bar";
  const lo = tile.track ? tile.track[0] : 0;
  const hi = tile.track ? tile.track[1] : Math.round((tile.target || 1) * 1.5);
  const step = tile.step || (hi <= 20 ? 0.5 : 1);
  const zone = tile.zone;
  const digits = step < 0.11 ? 1 : 0;

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
    paint();
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
      track,
      (event) => {
        const raw = roundTo(valueFromEvent(track, event, lo, hi), step);
        current = Math.max(lo, Math.min(hi, raw));
        preview(current);
      },
      () => {
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

/** A felt 1–5: five steps, with a tick where your usual sits. */
function scaleStepsInstrument(tile, { save, locked }) {
  const metric = tile.cells || 5;
  const low = tile.min ?? 1;
  const labels = tile.labels || [];
  const steps = [];
  const row = h("div", { class: "ins-steps" });
  for (let index = 0; index < metric; index += 1) {
    const value = low + index;
    const step = h(
      "button",
      {
        type: "button",
        class: "step",
        "data-step": String(value),
        "aria-label": labels[index] || String(value),
        onclick: locked ? undefined : () => save({ [tile.fields[0]]: value }),
      },
      h("i"),
      h("span", {}, labels[index] || String(value))
    );
    steps.push(step);
    row.append(step);
  }
  const el = h("div", { class: "ins ins--steps" }, row);

  function set(next) {
    const raw = Number(next.values?.[next.fields[0]]);
    const filled = Number.isFinite(raw) ? raw : null;
    steps.forEach((step, index) => {
      step.dataset.filled = filled != null && index < Math.round(filled) ? "true" : "false";
      step.dataset.on = filled != null && index === Math.round(filled) - low ? "true" : "false";
      step.dataset.usual =
        typeof next.usual === "number" && Math.round(next.usual) - low === index ? "true" : "false";
    });
  }

  set(tile);
  return { el, set };
}

/** A window across the day: when you slept. Both ends drag. */
function nightInstrument(tile, { save, locked }) {
  const DEFAULTS = { bed_time: "23:00", wake_time: "07:00" };
  const windows = [h("span", { class: "night-window" }), h("span", { class: "night-window" })];
  const handles = {
    bed_time: h("button", { type: "button", class: "night-handle night-handle--bed", "aria-label": "Bed time" }),
    wake_time: h("button", { type: "button", class: "night-handle night-handle--wake", "aria-label": "Wake time" }),
  };
  const track = h("div", { class: "night-track" }, ...windows, handles.bed_time, handles.wake_time);
  const el = h("div", { class: "ins ins--night" }, track);

  let values = { ...DEFAULTS };

  const paint = (known) => {
    const bed = minutesOf(values.bed_time);
    const wake = minutesOf(values.wake_time);
    el.dataset.known = known ? "true" : "false";
    for (const handle of Object.values(handles)) handle.style.display = locked ? "none" : "block";
    handles.bed_time.style.left = `${((bed ?? 0) / 1440) * 100}%`;
    handles.wake_time.style.left = `${((wake ?? 0) / 1440) * 100}%`;
    const [evening, morning] = windows;
    if (bed <= wake) {
      evening.style.left = `${(bed / 1440) * 100}%`;
      evening.style.width = `${Math.max(0.8, ((wake - bed) / 1440) * 100)}%`;
      morning.style.display = "none";
    } else {
      evening.style.left = `${(bed / 1440) * 100}%`;
      evening.style.width = `${Math.max(0.8, 100 - (bed / 1440) * 100)}%`;
      morning.style.left = "0%";
      morning.style.width = `${Math.max(0.8, (wake / 1440) * 100)}%`;
      morning.style.display = "block";
    }
  };

  for (const [field, handle] of Object.entries(handles)) {
    if (locked) continue;
    dragTarget(
      handle,
      (event) => {
        const next = Math.round(valueFromEvent(track, event, 0, 1440) / 15) * 15;
        const other = minutesOf(values[field === "bed_time" ? "wake_time" : "bed_time"]);
        let value = ((next % 1440) + 1440) % 1440;
        // A quarter-hour is the smallest honest move, and never the same minute.
        if (other != null && Math.abs(value - other) < 15) {
          value = ((other + (field === "bed_time" ? 1425 : 15)) % 1440 + 1440) % 1440;
        }
        values[field] = clockOf(value);
        paint(true);
      },
      () => save({ bed_time: values.bed_time, wake_time: values.wake_time })
    );
  }

  function set(next) {
    const known = typeof next.values?.bed_time === "string" || typeof next.values?.wake_time === "string";
    values = {
      bed_time: next.values?.bed_time || DEFAULTS.bed_time,
      wake_time: next.values?.wake_time || DEFAULTS.wake_time,
    };
    paint(known);
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
      return scaleStepsInstrument(tile, options);
    case "night":
      return nightInstrument(tile, options);
    case "range":
    default:
      return scaleInstrument(tile, options);
  }
}

/* -------------------------------------------------------------------- card */

export function createCard(tile, { accent, locked = false, onSave } = {}) {
  const label = h("span", { class: "card-label" }, tile.label);
  const value = h("span", { class: "card-value num" });
  const points = h("span", { class: "card-points num" });
  const note = h("p", { class: "card-gap" });
  const head = h("div", { class: "card-head" }, label, value, points);

  const options = {
    locked,
    save: (values) => onSave?.(values),
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
    note
  );

  /* Learned is the one switch that carries a written note: choosing Yes asks
     for the one thing, in the card itself. */
  let noteField = null;
  let noteTimer = null;
  if (tile.id === "learned") {
    noteField = h("input", {
      class: "card-note",
      type: "text",
      maxlength: 140,
      placeholder: "What did you learn?",
      "aria-label": "What did you learn?",
      oninput: () => {
        clearTimeout(noteTimer);
        noteTimer = setTimeout(() => options.save({ learned_what: noteField.value || null }), 700);
      },
      onkeydown: (event) => {
        if (event.key === "Enter") {
          clearTimeout(noteTimer);
          options.save({ learned_what: noteField.value || null });
        }
      },
    });
    el.append(noteField);
  }

  function setValue(next) {
    value.textContent = next.display == null ? "—" : next.display;
    if (next.unit && next.display != null) {
      value.append(h("small", { class: "card-unit" }, next.unit));
    }
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
    setValue(next);
    instrument.set(next);

    head.dataset.done = next.state === "done" ? "true" : "false";
    if (next.state === "done") {
      if (!head.querySelector(".card-check")) head.insertBefore(checkMark(), points);
    } else {
      head.querySelector(".card-check")?.remove();
    }

    if (next.weight == null) {
      // Not part of the score: say so, rather than showing a zero it did not earn.
      points.dataset.chip = "true";
      points.textContent = next.id === "weight" ? "Optional" : "Not in the score";
    } else {
      points.dataset.chip = "false";
      points.textContent = `${next.points ?? 0}`;
      points.append(h("small", {}, "/10"));
    }

    note.textContent = next.gap;
    note.dataset.state = next.state;

    if (noteField) {
      const wanted = next.sub == null ? "" : String(next.sub);
      if (document.activeElement !== noteField && noteField.value !== wanted) noteField.value = wanted;
      noteField.hidden = next.values?.learned !== true;
    }

    if (wasEmpty && next.display != null) {
      el.dataset.landed = "true";
      setTimeout(() => delete el.dataset.landed, 640);
    }
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
