/* The detail editor: one dedicated instrument per field.

   The card is still the way in — its own control answers in one gesture. This
   sheet is what opens when you click the card itself: the value as big as it
   deserves, and the control that actually fits what the field is. A quantity
   gets a gauge you can drag or type into; weight gets a scale around the goal;
   a mood gets a row of bars; a weekly count gets the seven days; a bed time
   gets the night.

   Everything saves live. There is no Save button to forget; Done just closes. */

import { h, mount, s } from "../core/dom.js";
import { digitsFor, formatNumber } from "../core/format.js";

const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const numeric = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const tidy = (value) => Number(Number(value).toFixed(4));

const roundTo = (value, step) => tidy(Math.round(value / (step || 1)) * (step || 1));

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayName(day) {
  return WEEKDAYS[new Date(`${day}T12:00:00`).getDay()];
}

function clockOf(minutes) {
  const value = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

/** "23:15", "23.15", "2315" and "23:1" all mean a time. */
function parseTime(text) {
  const raw = String(text || "").trim();
  let match = /^(\d{1,2})[:.h ](\d{2})$/.exec(raw);
  if (match) return Number(match[1]) * 60 + Number(match[2]);
  match = /^(\d{1,2})[:.h ](\d)$/.exec(raw);
  if (match) return Number(match[1]) * 60 + Number(match[2]) * 10;
  match = /^(\d{3,4})$/.exec(raw);
  if (match) {
    const digits = match[1].padStart(4, "0");
    return Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2));
  }
  return null;
}

/* A row of ticks says "this is an instrument" better than a plain bar does.
   The step is the largest round number that still leaves a few of them. */
const TICK_STEPS = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 15, 20, 25, 30, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];

function tickList(lo, hi) {
  const span = hi - lo;
  if (!(span > 0)) return [];
  const target = span / 6;
  let step = TICK_STEPS[0];
  for (const candidate of TICK_STEPS) if (candidate <= target) step = candidate;
  const ticks = [];
  const first = Math.ceil(tidy(lo / step)) * step;
  for (let value = first; value <= hi + step * 0.001; value = tidy(value + step)) {
    if (value >= lo - step * 0.001) ticks.push(tidy(value));
  }
  return ticks;
}

const CROSS = "M4 4 12 12 M12 4 4 12";
const CHECK = "M2 7.4 5.4 10.8 12 4.2";

function crossIcon() {
  return s(
    "svg",
    { class: "ed-icon", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false" },
    s("path", { d: CROSS, fill: "none", "stroke-width": 1.6, "stroke-linecap": "round" })
  );
}

function checkIcon() {
  return s(
    "svg",
    { class: "ed-check", viewBox: "0 0 14 14", "aria-hidden": "true", focusable: "false" },
    s("path", { d: CHECK, fill: "none", "stroke-width": 2.1, "stroke-linecap": "round", "stroke-linejoin": "round" })
  );
}

/* ------------------------------------------------------------- the sheet */

let active = null;

export function closeCardEditor({ restore = true } = {}) {
  if (!active) return;
  const { backdrop, sheet, cleanup, focus } = active;
  active = null;
  cleanup();
  backdrop.dataset.open = "false";
  sheet.dataset.open = "false";
  setTimeout(() => {
    backdrop.remove();
    sheet.remove();
  }, 480);
  if (restore) focus?.focus?.();
}

export function openCardEditor(initial, context) {
  closeCardEditor({ restore: false });

  const ctx = context || {};
  const focus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const current = () => {
    const guess = ctx.tile?.();
    return guess && guess.id === initial.id ? guess : initial;
  };

  let tile = current();
  let widget = null;

  const dot = h("span", { class: "ed-dot" });
  const kicker = h("span", { class: "ed-kicker" }, ctx.category || "");
  const pointsChip = h("span", { class: "ed-points num" });
  const closeBtn = h(
    "button",
    { type: "button", class: "ed-x", "aria-label": "Close", onclick: () => closeCardEditor() },
    crossIcon()
  );
  const title = h("h2", { class: "ed-title", id: "card-editor-title" }, tile.label);
  const status = h("p", { class: "ed-status" });
  const help = h("p", { class: "ed-help" });

  const clearBtn = h(
    "button",
    { type: "button", class: "btn btn--quiet", onclick: () => clearToday() },
    "Clear today"
  );
  const doneBtn = h(
    "button",
    { type: "button", class: "btn btn--primary", onclick: () => closeCardEditor() },
    "Done"
  );

  widget = buildBody(tile, ctx, sync);

  const sheet = h(
    "section",
    {
      class: "sheet sheet--editor",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "card-editor-title",
      "data-open": "false",
      style: { "--accent": ctx.accent || "var(--accent)" },
    },
    h("div", { class: "sheet-grip" }),
    h("header", { class: "ed-head" }, dot, kicker, pointsChip, closeBtn),
    h("div", { class: "ed-scroll" }, title, widget.hero, status, widget.stage, help),
    h("footer", { class: "ed-actions" }, clearBtn, doneBtn)
  );

  const backdrop = h("div", {
    class: "sheet-backdrop",
    "data-open": "false",
    onclick: () => closeCardEditor(),
  });

  document.body.append(backdrop, sheet);

  function sync() {
    tile = current();
    paintHead();
    widget?.sync?.();
  }

  function paintHead() {
    help.textContent = tile.help || "";
    help.hidden = !tile.help;

    /* The status is the card's own gap sentence. When it is just the prompt
       written twice ("How was today overall?", "Target 7–9 h"), it says
       nothing the title and the gauge have not already said. */
    const words = tile.gap || "";
    const repeats = !words || words === tile.prompt || words === tile.target_label;
    status.textContent = words;
    status.hidden = repeats;
    status.dataset.flag = tile.weight != null && tile.state === "done" ? "true" : "false";

    if (tile.weight == null) {
      pointsChip.dataset.chip = "true";
      pointsChip.textContent = tile.optional ? "Optional" : "Not in the score";
    } else if (tile.points == null) {
      pointsChip.dataset.chip = "true";
      pointsChip.textContent = "No score yet";
    } else {
      pointsChip.dataset.chip = "false";
      mount(pointsChip, `${tile.points}`, h("small", {}, "/10"));
    }
  }

  async function clearToday() {
    const values = {};
    for (const field of tile.fields || []) values[field] = null;
    if (tile.id === "learned") values.learned_what = null;
    await ctx.save?.(values);
    sync();
  }

  const onKey = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeCardEditor();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...sheet.querySelectorAll("button, [href], input, textarea, [tabindex]:not([tabindex='-1'])")]
      .filter((node) => !node.disabled && node.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  document.addEventListener("keydown", onKey);
  requestAnimationFrame(() => {
    backdrop.dataset.open = "true";
    sheet.dataset.open = "true";
    const first = sheet.querySelector("[data-autofocus]") || sheet.querySelector("input, .ed-track, button");
    first?.focus?.({ preventScroll: true });
    if (first instanceof HTMLInputElement) first.select?.();
  });

  active = {
    backdrop,
    sheet,
    focus,
    cleanup: () => document.removeEventListener("keydown", onKey),
  };

  paintHead();
  widget.sync?.();
}

/* ------------------------------------------------------- the body picker */

function buildBody(tile, ctx, sync) {
  switch (tile.chart) {
    case "bedtime":
      return bedEditor(tile, ctx, sync);
    case "segments":
      return weekEditor(tile, ctx, sync);
    case "switch":
      return toggleEditor(tile, ctx, sync);
    case "scale":
      return scaleEditor(tile, ctx, sync);
    case "blocks":
      return blocksEditor(tile, ctx, sync);
    case "bar":
      return tile.id === "avoid_habit" ? cleanEditor(tile, ctx, sync) : railEditor(tile, ctx, sync);
    case "range":
    default:
      return railEditor(tile, ctx, sync);
  }
}

/* --------------------------------------------------- a number on a gauge */

function railEditor(tile, ctx, onSaved) {
  const field = tile.fields[0];
  const min = tile.min ?? 0;
  const max = tile.max ?? 100;
  const step = tile.step || 1;
  const weight = tile.id === "weight";

  /* The card draws a narrower window than the hard limits — screen time runs to
     16 h, but nobody reaches for that half of the rail. Weight with no goal gets
     a window around today instead of the whole catalogue range. */
  let lo = tile.track ? tile.track[0] : min;
  let hi = tile.track ? tile.track[1] : max;
  if (weight && tile.goal == null) {
    /* Whole kilos at both ends: the ruler reads "82 kg … 92 kg", and the
       kilogram ticks land on round numbers. */
    const anchor = numeric((ctx.tile?.() || tile).values?.[field]) ?? (lo + hi) / 2;
    lo = Math.max(min, Math.floor(anchor - 5));
    hi = Math.min(max, Math.ceil(anchor + 5));
  }

  const settled = () => numeric((ctx.tile?.() || tile).values?.[field]);
  let value = settled();
  let timer = null;

  const share = (next) => (hi === lo ? 0 : clamp((next - lo) / (hi - lo), 0, 1));
  const shortUnit = tile.unit && tile.unit !== "steps" ? tile.unit : "";
  const withUnit = (next) => {
    const text = formatNumber(next, step, tile.id);
    return tile.unit === "steps" || !tile.unit ? text : `${text} ${tile.unit}`;
  };
  const axisText = (next) => {
    const text = formatNumber(next, step, tile.id);
    return shortUnit ? `${text} ${shortUnit}` : text;
  };

  /* the value: big, and editable in place */
  const input = h("input", {
    class: "ed-hero-input num",
    type: "text",
    inputmode: "decimal",
    autocomplete: "off",
    spellcheck: "false",
    placeholder: "—",
    "aria-label": tile.label,
  });
  const unitEl = tile.unit ? h("span", { class: "ed-hero-unit" }, tile.unit) : null;
  const less = h(
    "button",
    { type: "button", class: "ed-bump", "aria-label": `Less ${tile.label}`, onclick: () => nudge(-1) },
    "−"
  );
  const more = h(
    "button",
    { type: "button", class: "ed-bump", "aria-label": `More ${tile.label}`, onclick: () => nudge(1) },
    "+"
  );
  const hero = h(
    "div",
    { class: "ed-hero" },
    h("div", { class: "ed-hero-field" }, input, unitEl),
    h("div", { class: "ed-bumps" }, less, more)
  );

  /* the gauge */
  const band = h("span", { class: "ed-band" });
  const fill = h("span", { class: "ed-fill" });
  if (weight) fill.hidden = true;
  const goal = h("span", { class: "ed-tick ed-tick--goal", title: "Target" });
  const yest = h("span", { class: "ed-tick ed-tick--yest", title: "Yesterday" });
  const knob = h("span", { class: "ed-knob" });
  const track = h(
    "div",
    {
      class: "ed-track",
      tabindex: 0,
      role: "slider",
      "aria-label": tile.label,
      "aria-valuemin": String(min),
      "aria-valuemax": String(max),
    },
    band,
    fill,
    goal,
    yest,
    knob
  );

  const tickRow = h(
    "div",
    { class: "ed-ticks" },
    ...tickList(lo, hi).map((tick) => h("i", { style: { left: `${share(tick) * 100}%` } }))
  );

  const axisLeft = h("span", { class: "ed-axis-end" }, axisText(lo));
  const axisRight = h("span", { class: "ed-axis-end ed-axis-end--right" }, axisText(hi));
  const axisMid = h("span", { class: "ed-axis-mid" });
  const axisGoal = h("span", { class: "ed-axis-goal" });
  const axis = h("div", { class: "ed-axis" }, axisLeft, axisMid, axisGoal, axisRight);

  /* what the band means: a target zone, or the goal on the weight scale */
  if (tile.zone) {
    const from = share(tile.zone[0]) * 100;
    const to = share(tile.zone[1]) * 100;
    band.style.left = `${from}%`;
    band.style.width = `${Math.max(1.5, to - from)}%`;
    if (weight) {
      axisMid.textContent = "goal";
      axisMid.style.left = `${(from + to) / 2}%`;
    } else {
      axisMid.textContent = `${formatNumber(tile.zone[0], step, tile.id)}–${axisText(tile.zone[1])}`;
      axisMid.style.left = `${(from + to) / 2}%`;
    }
  } else {
    band.hidden = true;
    axisMid.hidden = true;
  }

  if (tile.chart === "bar" && tile.target != null) {
    goal.hidden = false;
    goal.style.left = `${share(tile.target) * 100}%`;
    axisGoal.hidden = false;
    axisGoal.textContent = axisText(tile.target);
    axisGoal.style.left = `${share(tile.target) * 100}%`;
  } else {
    goal.hidden = true;
    axisGoal.hidden = true;
  }

  if (tile.yesterday != null) {
    yest.hidden = false;
    yest.style.left = `${share(tile.yesterday) * 100}%`;
  } else {
    yest.hidden = true;
  }

  /* the shortcuts */
  const chips = [];
  const presetRow = h("div", { class: "ed-presets" });
  const presetText = (amount) => {
    const text = formatNumber(amount, step, tile.id);
    return tile.unit === "steps" || !tile.unit ? text : `${text} ${tile.unit}`;
  };
  for (const amount of tile.presets || []) {
    const chip = h("button", { type: "button", class: "ed-preset", onclick: () => set(amount, 0) }, presetText(amount));
    chips.push([chip, Number(amount)]);
    presetRow.append(chip);
  }
  if (tile.yesterday != null) {
    const chip = h(
      "button",
      { type: "button", class: "ed-preset ed-preset--yest", onclick: () => set(tile.yesterday, 0) },
      h("span", { class: "ed-preset-tag" }, "Yesterday"),
      ` ${presetText(tile.yesterday)}`
    );
    chips.push([chip, Number(tile.yesterday)]);
    presetRow.append(chip);
  }
  if (!chips.length) presetRow.hidden = true;

  const stage = h(
    "div",
    { class: "ed-stage" },
    h("div", { class: "ed-rail" }, track, tickRow, axis),
    presetRow
  );

  function paint() {
    const known = value != null;
    const text = known ? formatNumber(value, step, tile.id) : "";
    if (document.activeElement !== input) input.value = text;
    const shown = document.activeElement === input ? input.value : text;
    /* ch is the width of "0"; a decimal point and a comma are narrower. */
    input.style.width = `${Math.max(2, (shown.length || 1) * 0.92)}ch`;

    knob.hidden = !known;
    /* A weight is not a quantity filling up: the knob is the whole answer. */
    if (!weight) fill.style.width = `${known ? share(value) * 100 : 0}%`;
    if (known) knob.style.left = `${share(value) * 100}%`;

    /* Same rule as the card: outside the band, the knob is drawn hollow. */
    const beyond = known && tile.zone && value > tile.zone[1];
    track.dataset.beyond = beyond ? "true" : "false";
    track.dataset.known = known ? "true" : "false";
    track.setAttribute("aria-valuenow", known ? String(value) : "");
    track.setAttribute("aria-valuetext", known ? withUnit(value) : "not logged");

    for (const [chip, amount] of chips) {
      chip.dataset.selected = known && amount === value ? "true" : "false";
    }
  }

  function set(next, wait = 450) {
    value = next == null ? null : clamp(roundTo(next, step), min, max);
    paint();
    clearTimeout(timer);
    timer = setTimeout(async () => {
      await ctx.save?.({ [field]: value });
      onSaved?.();
    }, wait);
  }

  function nudge(direction) {
    const base = value ?? (tile.zone ? tile.zone[0] : lo);
    set(base + direction * step, 0);
  }

  const readInput = () => {
    const raw = Number(String(input.value).replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(raw) && String(input.value).trim() !== "" ? raw : null;
  };

  input.addEventListener("focus", () => input.select());
  input.addEventListener("input", () => {
    const raw = readInput();
    if (raw == null) {
      paint();
      return;
    }
    value = clamp(raw, min, max);
    paint();
    clearTimeout(timer);
    timer = setTimeout(async () => {
      await ctx.save?.({ [field]: value });
      onSaved?.();
    }, 700);
  });
  input.addEventListener("blur", () => {
    const raw = readInput();
    if (raw == null) {
      value = settled();
      paint();
      return;
    }
    set(raw, 0);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      input.blur();
    }
  });

  track.addEventListener("keydown", (event) => {
    const size = event.shiftKey ? step * 5 : step;
    let next = value ?? min;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next -= size;
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") next += size;
    else if (event.key === "Home") next = min;
    else if (event.key === "End") next = max;
    else return;
    event.preventDefault();
    set(next, 350);
  });

  dragTrack(
    track,
    (event) => {
      const raw = lo + shareFromEvent(track, event) * (hi - lo);
      set(raw, 10_000);
      clearTimeout(timer);
    },
    () => set(value, 0)
  );

  paint();
  return {
    hero,
    stage,
    sync: () => {
      value = settled();
      paint();
    },
  };
}

/* ---------------------------------------------------------- yes and no */

function toggleEditor(tile, ctx, onSaved) {
  const field = tile.fields[0];
  const read = () => (ctx.tile?.() || tile).values?.[field];
  let value = read() === true ? true : read() === false ? false : null;
  const words = tile.id === "creatine" ? ["Taken", "Not today"] : ["Yes", "No"];

  const heroValue = h("span", { class: "ed-hero-value num" }, "—");
  const hero = h("div", { class: "ed-hero" }, h("div", { class: "ed-hero-field" }, heroValue));

  const doors = [
    h(
      "button",
      { type: "button", class: "ed-door", onclick: () => choose(true) },
      checkIcon(),
      h("b", {}, words[0])
    ),
    h(
      "button",
      { type: "button", class: "ed-door", onclick: () => choose(false) },
      checkIcon(),
      h("b", {}, words[1])
    ),
  ];

  /* A switch can carry a sentence: choosing Yes opens the note underneath,
     and the note is part of the same answer. */
  let note = null;
  let noteTimer = null;
  const noteField = tile.note?.field;
  if (noteField) {
    note = h("textarea", {
      class: "ed-noteinput",
      rows: 3,
      maxlength: 140,
      placeholder: `One line: ${tile.note.prompt.toLowerCase()}`,
      "aria-label": tile.note.prompt,
    });
    note.addEventListener("input", () => {
      clearTimeout(noteTimer);
      noteTimer = setTimeout(async () => {
        await ctx.save?.({ [noteField]: note.value || null });
        onSaved?.();
      }, 600);
    });
  }

  const learnedBox = note ? h("div", { class: "ed-learned" }, note) : null;
  const stage = h("div", { class: "ed-stage" }, h("div", { class: "ed-doors" }, ...doors), learnedBox);

  function paint() {
    doors[0].dataset.on = value === true ? "true" : "false";
    doors[1].dataset.on = value === false ? "true" : "false";
    doors[0].setAttribute("aria-pressed", String(value === true));
    doors[1].setAttribute("aria-pressed", String(value === false));
    heroValue.textContent = value === true ? "Yes" : value === false ? "No" : "—";
    if (note) {
      learnedBox.hidden = value !== true;
      const wanted = (ctx.tile?.() || tile).values?.[noteField] || "";
      if (document.activeElement !== note && note.value !== wanted) note.value = wanted;
    }
  }

  async function choose(next) {
    value = next;
    paint();
    await ctx.save?.({ [field]: next });
    onSaved?.();
    if (next === true) note?.focus({ preventScroll: true });
  }

  doors[0].dataset.autofocus = "";
  paint();
  return {
    hero,
    stage,
    sync: () => {
      value = read() === true ? true : read() === false ? false : null;
      paint();
    },
  };
}

/* ------------------------------------------------------ a five-step word */

function scaleEditor(tile, ctx, onSaved) {
  const field = tile.fields[0];
  const words = tile.labels || [];
  const read = () => numeric((ctx.tile?.() || tile).values?.[field]);
  let value = read();
  const heights = [18, 40, 62, 84, 106];

  const heroValue = h("span", { class: "ed-hero-value" }, "—");
  const hero = h("div", { class: "ed-hero" }, h("div", { class: "ed-hero-field" }, heroValue));

  const columns = [];
  const meter = h(
    "div",
    { class: "ed-meter", role: "group", "aria-label": tile.label },
    ...words.map((word, index) => {
      const bar = h("span", { class: "ed-meter-bar", style: { height: `${heights[index] ?? 60}px` } });
      const column = h(
        "button",
        { type: "button", class: "ed-meter-col", onclick: () => choose(index + 1) },
        bar,
        h("span", { class: "ed-meter-word" }, word)
      );
      columns.push(column);
      return column;
    })
  );

  columns[0]?.setAttribute("data-autofocus", "");

  const stage = h("div", { class: "ed-stage" }, meter);

  function paint() {
    columns.forEach((column, index) => {
      column.dataset.on = value === index + 1 ? "true" : "false";
      column.setAttribute("aria-pressed", String(value === index + 1));
    });
    heroValue.textContent = value != null ? words[value - 1] || "—" : "—";
  }

  async function choose(next) {
    value = next;
    paint();
    await ctx.save?.({ [field]: next });
    onSaved?.();
  }

  paint();
  return {
    hero,
    stage,
    sync: () => {
      value = read();
      paint();
    },
  };
}

/* --------------------------------------------------------- a few blocks */

function blocksEditor(tile, ctx, onSaved) {
  const field = tile.fields[0];
  const read = () => numeric((ctx.tile?.() || tile).values?.[field]);
  let value = read();
  const words = ["None", "One", "Two", "Three"];

  const heroValue = h("span", { class: "ed-hero-value num" }, "—");
  const hero = h("div", { class: "ed-hero" }, h("div", { class: "ed-hero-field" }, heroValue));

  const tiles = words.map((word, index) =>
    h(
      "button",
      { type: "button", class: "ed-tile", onclick: () => choose(index) },
      h(
        "span",
        { class: "ed-tile-bars" },
        ...Array.from({ length: index }, () => h("i"))
      ),
      h("span", { class: "ed-tile-word" }, word)
    )
  );

  tiles[0]?.setAttribute("data-autofocus", "");
  const stage = h("div", { class: "ed-stage" }, h("div", { class: "ed-tiles" }, ...tiles));

  function paint() {
    tiles.forEach((node, index) => {
      node.dataset.on = value === index ? "true" : "false";
      node.setAttribute("aria-pressed", String(value === index));
    });
    heroValue.textContent = value == null ? "—" : String(value);
  }

  async function choose(next) {
    value = next;
    paint();
    await ctx.save?.({ [field]: next });
    onSaved?.();
  }

  paint();
  return {
    hero,
    stage,
    sync: () => {
      value = read();
      paint();
    },
  };
}

/* --------------------------------------------------------- the whole week */

function weekEditor(tile, ctx, onSaved) {
  const field = tile.fields[0];
  const gym = tile.id === "gym";
  const max = gym ? 3 : 10;

  const heroValue = h("span", { class: "ed-hero-value num" }, "—");
  const heroUnit = h("span", { class: "ed-hero-unit" }, gym ? "sessions" : "days");
  const hero = h("div", { class: "ed-hero" }, h("div", { class: "ed-hero-field" }, heroValue, heroUnit));

  const rows = new Map();
  const timers = new Map();
  const list = h("div", { class: "ed-week" });

  const days = () => (ctx.tile?.() || tile).week_days || tile.week_days || [];
  const share = (next) => clamp(next / max, 0, 1);

  for (const entry of days()) {
    const valueEl = h("span", { class: "ed-wvalue num" });
    const fill = h("span", { class: "ed-wfill" });
    const knob = h("span", { class: "ed-wknob" });
    const ticks = h(
      "div",
      { class: "ed-wticks" },
      ...Array.from({ length: max + 1 }, (_, index) =>
        h("i", { style: { left: `${(index / max) * 100}%` } })
      )
    );
    const rail = h(
      "div",
      {
        class: "ed-wrail",
        tabindex: 0,
        role: "slider",
        "aria-label": `${dayName(entry.day)} ${entry.day.slice(8, 10)}`,
        "aria-valuemin": "0",
        "aria-valuemax": String(max),
      },
      ticks,
      fill,
      knob
    );
    const row = h(
      "div",
      {
        class: "ed-week-row",
        "data-today": entry.today ? "true" : "false",
      },
      h("span", { class: "ed-week-day" }, dayName(entry.day), h("small", {}, entry.day.slice(8, 10))),
      rail,
      valueEl
    );

    const item = { entry, row, rail, valueEl, fill, knob };
    rows.set(entry.day, item);
    if (entry.today) rail.dataset.autofocus = "";

    rail.addEventListener("pointerdown", (event) => {
      if (event.button != null && event.button !== 0) return;
      event.preventDefault();
      rail.setPointerCapture(event.pointerId);
      rail.dataset.drag = "true";
      moveTo(item, event);
      const follow = (next) => moveTo(item, next);
      const finish = () => {
        delete rail.dataset.drag;
        rail.removeEventListener("pointermove", follow);
        rail.removeEventListener("pointerup", finish);
        rail.removeEventListener("pointercancel", finish);
        commit(item);
      };
      rail.addEventListener("pointermove", follow);
      rail.addEventListener("pointerup", finish);
      rail.addEventListener("pointercancel", finish);
    });

    rail.addEventListener("keydown", (event) => {
      let next = item.entry.value ?? 0;
      if (event.key === "ArrowLeft" || event.key === "ArrowDown") next -= 1;
      else if (event.key === "ArrowRight" || event.key === "ArrowUp") next += 1;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = max;
      else return;
      event.preventDefault();
      item.entry = { ...item.entry, value: clamp(next, 0, max) };
      paintRow(item);
      clearTimeout(timers.get(entry.day));
      timers.set(entry.day, setTimeout(() => commit(item), 350));
    });

    list.append(row);
  }

  const legend = h(
    "p",
    { class: "ed-note" },
    gym ? "The last seven days — change any one." : "The last seven days, in drinks. None counts as clean."
  );

  const stage = h("div", { class: "ed-stage" }, list, legend);

  function moveTo(item, event) {
    const box = item.rail.getBoundingClientRect();
    const ratio = clamp((event.clientX - box.left) / (box.width || 1), 0, 1);
    item.entry = { ...item.entry, value: Math.round(ratio * max) };
    paintRow(item);
  }

  function commit(item) {
    clearTimeout(timers.get(item.entry.day));
    timers.delete(item.entry.day);
    const next = item.entry.value ?? 0;
    timers.set(
      item.entry.day,
      setTimeout(async () => {
        await ctx.saveDay?.(item.entry.day, { [field]: next });
        onSaved?.();
      }, 60)
    );
  }

  function paintRow(item) {
    const value = item.entry.value;
    const known = typeof value === "number";
    item.valueEl.textContent = known ? formatNumber(value, 1, field) : "—";
    item.valueEl.dataset.empty = known ? "false" : "true";
    item.fill.style.width = `${known ? share(value) * 100 : 0}%`;
    item.knob.hidden = !known;
    if (known) item.knob.style.left = `${share(value) * 100}%`;
    item.rail.setAttribute("aria-valuenow", known ? String(value) : "");
  }

  function sync() {
    const fresh = ctx.tile?.() || tile;
    for (const entry of fresh.week_days || []) {
      const item = rows.get(entry.day);
      if (!item) continue;
      item.entry = entry;
      paintRow(item);
    }
    heroValue.textContent = fresh.display ?? "—";
    const count = Number(fresh.display);
    heroUnit.textContent = `${gym ? "session" : "day"}${count === 1 ? "" : "s"}`;
    heroUnit.hidden = fresh.display == null;
  }

  sync();
  return { hero, stage, sync };
}

/* ------------------------------------------------------- thirty clean days */

function cleanEditor(tile, ctx, onSaved) {
  const heroValue = h("span", { class: "ed-hero-value num" }, "—");
  const heroUnit = h("span", { class: "ed-hero-unit" }, "days");
  const hero = h("div", { class: "ed-hero" }, h("div", { class: "ed-hero-field" }, heroValue, heroUnit));

  const cells = new Map();
  const grid = h("div", { class: "ed-clean" });
  const days = () => (ctx.tile?.() || tile).days || tile.days || [];

  for (const entry of days()) {
    const cell = h(
      "button",
      {
        type: "button",
        class: "ed-cell",
        "aria-label": `${entry.day} — ${entry.clean ? "clean" : "not logged"}`,
        title: entry.day,
        onclick: async () => {
          const fresh = days().find((day) => day.day === entry.day) || entry;
          await ctx.saveDay?.(entry.day, { avoid_habit: !fresh.clean });
          onSaved?.();
        },
      },
      h("span", { class: "num" }, String(Number(entry.day.slice(8, 10))))
    );
    cells.set(entry.day, cell);
    grid.append(cell);
    if (entry.day === days()[days().length - 1]?.day) cell.dataset.autofocus = "";
  }

  const stage = h(
    "div",
    { class: "ed-stage" },
    grid,
    h("p", { class: "ed-note" }, "Every day is a button — today has the ring.")
  );

  function sync() {
    const fresh = ctx.tile?.() || tile;
    const all = fresh.days || [];
    for (const entry of all) {
      const cell = cells.get(entry.day);
      if (!cell) continue;
      cell.dataset.clean = entry.clean ? "true" : "false";
      cell.dataset.today = entry.day === all[all.length - 1]?.day ? "true" : "false";
      cell.setAttribute("aria-pressed", String(Boolean(entry.clean)));
    }
    heroValue.textContent = fresh.display ?? "—";
    heroUnit.textContent = Number(fresh.display) === 1 ? "day" : "days";
    heroUnit.hidden = fresh.display == null;
  }

  sync();
  return { hero, stage, sync };
}

/* ------------------------------------------------------------- in bed */

function bedEditor(tile, ctx, onSaved) {
  const START = 21 * 60;
  const SPAN = 5 * 60;
  const field = "bed_time";

  const read = () => numeric((ctx.tile?.() || tile).bed);
  let value = read();
  let timer = null;

  const share = (minutes) => {
    if (minutes == null) return null;
    const raw = (((minutes - START) % 1440) + 1440) % 1440;
    if (raw <= SPAN) return raw / SPAN;
    const toStart = Math.min(raw, 1440 - raw);
    const toEnd = Math.min(Math.abs(raw - SPAN), 1440 - Math.abs(raw - SPAN));
    return toStart <= toEnd ? 0 : 1;
  };
  const inWindow = (minutes) => {
    const raw = ((minutes % 1440) + 1440) % 1440;
    return raw >= START || raw <= START + SPAN - 1440;
  };

  const input = h("input", {
    class: "ed-hero-input num",
    type: "text",
    inputmode: "numeric",
    autocomplete: "off",
    spellcheck: "false",
    placeholder: "--:--",
    "aria-label": "Bed time",
  });
  const less = h(
    "button",
    { type: "button", class: "ed-bump", "aria-label": "Fifteen minutes earlier", onclick: () => nudge(-1) },
    "−"
  );
  const more = h(
    "button",
    { type: "button", class: "ed-bump", "aria-label": "Fifteen minutes later", onclick: () => nudge(1) },
    "+"
  );
  const hero = h(
    "div",
    { class: "ed-hero" },
    h("div", { class: "ed-hero-field" }, input),
    h("div", { class: "ed-bumps" }, less, more)
  );

  const band = h("span", { class: "ed-band" });
  const usual = h("span", { class: "ed-tick ed-tick--goal", title: "Your usual" });
  const yest = h("span", { class: "ed-tick ed-tick--yest", title: "Yesterday" });
  const knob = h("span", { class: "ed-knob" });
  const track = h(
    "div",
    {
      class: "ed-track",
      tabindex: 0,
      role: "slider",
      "aria-label": "Bed time",
      "aria-valuemin": "0",
      "aria-valuemax": "1439",
    },
    band,
    usual,
    yest,
    knob
  );

  const hours = h(
    "div",
    { class: "ed-hours" },
    ...["21:00", "22:00", "23:00", "00:00", "01:00", "02:00"].map((text) => h("span", {}, text))
  );

  const chips = h("div", { class: "ed-presets" });

  const stage = h(
    "div",
    { class: "ed-stage" },
    h("div", { class: "ed-rail ed-rail--bed" }, track, hours),
    chips
  );

  function paint() {
    if (document.activeElement !== input) input.value = value == null ? "" : clockOf(value);
    const shown = document.activeElement === input ? input.value : value == null ? "" : clockOf(value);
    input.style.width = `${Math.max(3, shown.length || 3) + 0.3}ch`;

    const fresh = ctx.tile?.() || tile;

    knob.hidden = value == null;
    if (value != null) knob.style.left = `${(share(value) ?? 0) * 100}%`;

    const usualMinutes = numeric(fresh.usual_bed);
    if (usualMinutes != null) {
      const lo = share(usualMinutes - 45);
      const hi = share(usualMinutes + 45);
      band.hidden = false;
      band.style.left = `${Math.min(lo, hi) * 100}%`;
      band.style.width = `${Math.max(2, Math.abs(hi - lo) * 100)}%`;
      usual.hidden = false;
      usual.style.left = `${(share(usualMinutes) ?? 0) * 100}%`;
    } else {
      band.hidden = true;
      usual.hidden = true;
    }

    const yesterday = numeric(fresh.yesterday_bed);
    if (yesterday != null) {
      yest.hidden = false;
      yest.style.left = `${(share(yesterday) ?? 0) * 100}%`;
    } else {
      yest.hidden = true;
    }

    track.setAttribute("aria-valuenow", value == null ? "" : String(value));
    track.setAttribute("aria-valuetext", value == null ? "not logged" : clockOf(value));
  }

  function paintChips() {
    const list = buildChips(ctx.tile?.() || tile);
    if (list.length) mount(chips, ...list);
    else chips.replaceChildren();
    chips.hidden = !list.length;
  }

  function buildChips(fresh) {
    const list = [];
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    if (inWindow(minutes)) {
      list.push(
        h(
          "button",
          { type: "button", class: "ed-preset", onclick: () => set(minutes, 0) },
          h("span", { class: "ed-preset-tag" }, "Now"),
          ` ${clockOf(minutes)}`
        )
      );
    }
    const usualMinutes = numeric(fresh.usual_bed);
    if (usualMinutes != null) {
      list.push(
        h(
          "button",
          { type: "button", class: "ed-preset", onclick: () => set(usualMinutes, 0) },
          h("span", { class: "ed-preset-tag" }, "Usual"),
          ` ${clockOf(usualMinutes)}`
        )
      );
    }
    const yesterday = numeric(fresh.yesterday_bed);
    if (yesterday != null) {
      list.push(
        h(
          "button",
          { type: "button", class: "ed-preset", onclick: () => set(yesterday, 0) },
          h("span", { class: "ed-preset-tag" }, "Yesterday"),
          ` ${clockOf(yesterday)}`
        )
      );
    }
    return list;
  }

  /* Typing, the chips and the steppers keep the exact minute; only a drag
     along the night, which cannot be finer than a few pixels, snaps. */
  function set(next, wait = 400, snap = false) {
    const minutes = snap ? Math.round(next / 15) * 15 : Math.round(next);
    value = ((minutes % 1440) + 1440) % 1440;
    paint();
    clearTimeout(timer);
    timer = setTimeout(async () => {
      await ctx.save?.({ [field]: clockOf(value) });
      onSaved?.();
    }, wait);
  }

  function nudge(direction) {
    set((value ?? 23 * 60) + direction * 15, 0);
  }

  input.addEventListener("focus", () => input.select());
  input.addEventListener("input", () => {
    const parsed = parseTime(input.value);
    if (parsed == null) {
      paint();
      return;
    }
    value = ((Math.round(parsed) % 1440) + 1440) % 1440;
    paint();
    clearTimeout(timer);
    timer = setTimeout(async () => {
      await ctx.save?.({ [field]: clockOf(value) });
      onSaved?.();
    }, 700);
  });
  input.addEventListener("blur", () => {
    const parsed = parseTime(input.value);
    if (parsed == null) {
      value = read();
      paint();
      return;
    }
    set(parsed, 0);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      input.blur();
    }
  });

  track.addEventListener("keydown", (event) => {
    const size = event.shiftKey ? 60 : 15;
    let next = value ?? 23 * 60;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next -= size;
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") next += size;
    else if (event.key === "Home") next = START;
    else if (event.key === "End") next = START + SPAN;
    else return;
    event.preventDefault();
    set(next, 350);
  });

  dragTrack(
    track,
    (event) => {
      const raw = START + shareFromEvent(track, event) * SPAN;
      value = ((Math.round(raw / 15) * 15) % 1440 + 1440) % 1440;
      paint();
    },
    () => set(value, 0)
  );

  paint();
  paintChips();
  return {
    hero,
    stage,
    sync: () => {
      value = read();
      paint();
      paintChips();
    },
  };
}

/* --------------------------------------------------------------- pointer */

/** Pointer drag on a horizontal rail, with the value clamped to the axis. */
function dragTrack(node, move, done) {
  node.addEventListener("pointerdown", (event) => {
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    node.setPointerCapture(event.pointerId);
    node.dataset.drag = "true";
    move(event);
    const follow = (next) => move(next);
    const finish = () => {
      delete node.dataset.drag;
      node.removeEventListener("pointermove", follow);
      node.removeEventListener("pointerup", finish);
      node.removeEventListener("pointercancel", finish);
      done();
    };
    node.addEventListener("pointermove", follow);
    node.addEventListener("pointerup", finish);
    node.addEventListener("pointercancel", finish);
  });
}

function shareFromEvent(node, event) {
  const box = node.getBoundingClientRect();
  return clamp((event.clientX - box.left) / (box.width || 1), 0, 1);
}
