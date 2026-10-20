/* The detail editor: the same field, at the size a careful answer needs.

   The card is still the way in — its instrument answers in one gesture. This
   sheet is what opens when you click the card itself: a bigger control, the
   exact number, the presets, and for the weekly fields the whole week, so a
   forgotten Tuesday can be fixed where it is read.

   Everything saves live. There is no Save button to forget; Done just closes. */

import { h, mount } from "../core/dom.js";

const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const numeric = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);

function digitsFor(step) {
  if (!step || step >= 1) return 0;
  return step < 0.11 ? 1 : 2;
}

const roundTo = (value, step) => Math.round(value / (step || 1)) * (step || 1);

/** 7.5 -> "7.5", 11234 -> "11,234", with the unit the field counts in. */
export function formatNumber(value, step, id) {
  if (value == null) return "—";
  const number = Number(value);
  if (id === "steps") return Math.round(number).toLocaleString("en-US");
  const digits = digitsFor(step);
  const fixed = number.toFixed(digits);
  return digits ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayLabel(day) {
  const date = new Date(`${day}T12:00:00`);
  return WEEKDAYS[date.getDay()];
}

function clockOf(minutes) {
  const value = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

/** Pointer drag on a horizontal rail, with the value clamped to the axis. */
function onDrag(node, move, done) {
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
  }, 520);
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

  /* ------------------------------------------------------------- shell */
  const dot = h("span", { class: "ed-dot" });
  const kicker = h("span", { class: "ed-kicker" }, ctx.category || "");
  const title = h("h2", { class: "ed-title", id: "card-editor-title" }, tile.label);
  const pointsChip = h("span", { class: "ed-points num" });
  const closeBtn = h(
    "button",
    { type: "button", class: "ed-close", onclick: () => closeCardEditor() },
    "Close"
  );
  const prompt = h("p", { class: "ed-prompt" });
  const help = h("p", { class: "ed-help" });
  const body = h("div", { class: "ed-body" });
  const gap = h("p", { class: "ed-gap" });
  const targetHint = h("span", { class: "ed-target" });
  const foot = h("div", { class: "ed-foot" }, gap, targetHint);
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
    h(
      "header",
      { class: "ed-head" },
      dot,
      h("div", { class: "ed-heading" }, kicker, title),
      pointsChip,
      closeBtn
    ),
    prompt,
    body,
    help,
    foot,
    h("footer", { class: "ed-actions" }, clearBtn, doneBtn)
  );

  const backdrop = h("div", {
    class: "sheet-backdrop",
    "data-open": "false",
    onclick: () => closeCardEditor(),
  });

  document.body.append(backdrop, sheet);

  const widget = buildBody(tile, ctx, sync);
  body.append(widget.el);

  function sync() {
    tile = current();
    paintHead();
    widget.sync?.();
  }

  function paintHead() {
    prompt.textContent = tile.prompt || "";
    prompt.hidden = !tile.prompt;
    help.textContent = tile.help || "";
    help.hidden = !tile.help;
    // Say each thing once: the prompt is already above, and a widget that
    // counts for itself already said the number in the body.
    const repeats =
      tile.gap === tile.prompt || tile.gap === widget.summary?.() || widget.silentGap?.();
    gap.textContent = tile.gap || "";
    gap.hidden = !tile.gap || repeats;
    const wanted = tile.target_label && tile.target_label.startsWith("Target");
    targetHint.textContent = wanted && tile.target_label !== tile.gap ? tile.target_label : "";
    targetHint.hidden = !targetHint.textContent;
    foot.hidden = gap.hidden && targetHint.hidden;

    if (tile.weight == null) {
      pointsChip.dataset.chip = "true";
      pointsChip.textContent = tile.optional ? "Optional" : "Not in the score";
    } else if (tile.points == null) {
      pointsChip.dataset.chip = "true";
      pointsChip.textContent = "—";
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
    const first = sheet.querySelector("[data-autofocus]") || sheet.querySelector(".ed-track, input, button");
    first?.focus?.({ preventScroll: true });
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


/* --------------------------------------------------- a number on a rail */

function railEditor(tile, ctx, onSaved) {
  const field = tile.fields[0];
  const min = tile.min ?? 0;
  const max = tile.max ?? 100;
  const step = tile.step || 1;
  const settled = () => numeric((ctx.tile?.() || tile).values?.[field]);
  let value = settled();
  let timer = null;

  const zone = h("span", { class: "ed-zone" });
  const targetTick = h("span", { class: "ed-targettick" });
  const yesterday = h("span", { class: "ed-yest" });
  const mark = h("span", { class: "ed-mark" });
  const track = h("div", { class: "ed-track" }, zone, targetTick, yesterday, mark);

  const readout = h("output", { class: "ed-readout num" });
  const exact = h("input", {
    class: "ed-exact",
    type: "number",
    inputmode: "decimal",
    min,
    max,
    step,
    "aria-label": `Exact ${tile.label}`,
  });

  const less = h(
    "button",
    {
      type: "button",
      class: "ed-bump",
      "aria-label": `Less ${tile.label}`,
      onclick: () => nudge(-1),
    },
    "−"
  );
  const more = h(
    "button",
    {
      type: "button",
      class: "ed-bump",
      "aria-label": `More ${tile.label}`,
      onclick: () => nudge(1),
    },
    "+"
  );

  const presetRow = h(
    "div",
    { class: "ed-presets" },
    ...(tile.presets || []).map((preset) =>
      h(
        "button",
        { type: "button", class: "ed-preset", onclick: () => set(clamp(preset, min, max), 0) },
        presetText(tile, preset, step)
      )
    )
  );

  const el = h(
    "div",
    { class: "ed-number" },
    h(
      "div",
      { class: "ed-big" },
      less,
      readout,
      more,
      h("label", { class: "ed-exactwrap" }, h("span", {}, "Exact"), exact)
    ),
    h("div", { class: "ed-rail" }, track),
    presetRow,
    tile.id === "weight"
      ? h(
          "p",
          { class: "ed-note" },
          tile.sub || "No goal set — add one in Settings to see the distance."
        )
      : null
  );

  function presetText(next, amount, size) {
    const text = formatNumber(amount, size, tile.id);
    return tile.unit === "steps" ? text : `${text}${tile.unit ? ` ${tile.unit}` : ""}`;
  }

  const share = (next) => (max === min ? 0 : clamp((next - min) / (max - min), 0, 1));

  function paint() {
    const settledValue = value;
    mount(
      readout,
      formatNumber(settledValue, step, tile.id),
      tile.unit && settledValue != null ? h("small", {}, tile.unit) : null
    );
    if (document.activeElement !== exact) exact.value = settledValue == null ? "" : String(settledValue);
    if (value == null) {
      mark.hidden = true;
    } else {
      mark.hidden = false;
      mark.style.left = `${share(value) * 100}%`;
    }
    if (tile.zone) {
      zone.hidden = false;
      zone.style.left = `${share(tile.zone[0]) * 100}%`;
      zone.style.width = `${(share(tile.zone[1]) - share(tile.zone[0])) * 100}%`;
    } else {
      zone.hidden = true;
    }
    if (tile.chart === "bar" && tile.target != null) {
      targetTick.hidden = false;
      targetTick.style.left = `${share(tile.target) * 100}%`;
    } else {
      targetTick.hidden = true;
    }
    if (tile.yesterday != null) {
      yesterday.hidden = false;
      yesterday.style.left = `${share(tile.yesterday) * 100}%`;
    } else {
      yesterday.hidden = true;
    }
    track.setAttribute("aria-valuenow", String(value ?? ""));
    track.setAttribute("aria-valuetext", `${formatNumber(value, step, tile.id)} ${tile.unit || ""}`.trim());
    presetRow.querySelectorAll(".ed-preset").forEach((chip, index) => {
      chip.dataset.selected = value != null && Number((tile.presets || [])[index]) === value ? "true" : "false";
    });
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
    const base = value ?? 0;
    set(base + direction * step, 0);
  }

  track.tabIndex = 0;
  track.dataset.autofocus = "";
  track.setAttribute("role", "slider");
  track.setAttribute("aria-label", tile.label);
  track.setAttribute("aria-valuemin", String(min));
  track.setAttribute("aria-valuemax", String(max));
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

  onDrag(
    track,
    (event) => {
      const raw = min + shareFromEvent(track, event) * (max - min);
      set(raw, 10_000);
      clearTimeout(timer);
    },
    () => set(value, 0)
  );

  exact.addEventListener("change", () => {
    const next = Number(exact.value);
    if (Number.isFinite(next)) set(next, 0);
    else paint();
  });

  paint();
  return {
    el,
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

  const words =
    tile.id === "creatine" ? ["Taken", "Not today"] : ["Yes", "No"];

  const yes = h(
    "button",
    { type: "button", class: "ed-choice ed-choice--yes", onclick: () => choose(true) },
    h("b", {}, words[0])
  );
  const no = h(
    "button",
    { type: "button", class: "ed-choice ed-choice--no", onclick: () => choose(false) },
    h("b", {}, words[1])
  );

  /* Learned is the one switch that carries a sentence: choosing Yes opens the
     note underneath, and the note is part of the same answer. */
  let note = null;
  let noteTimer = null;
  if (tile.id === "learned") {
    note = h("textarea", {
      class: "ed-textarea",
      rows: 2,
      maxlength: 140,
      placeholder: "One line: what did you learn?",
      "aria-label": "What did you learn?",
      value: (ctx.tile?.() || tile).values?.learned_what || "",
    });
    note.addEventListener("input", () => {
      clearTimeout(noteTimer);
      noteTimer = setTimeout(async () => {
        await ctx.save?.({ learned_what: note.value || null });
        onSaved?.();
      }, 600);
    });
  }

  yes.dataset.autofocus = "";
  const el = h(
    "div",
    { class: "ed-togglewrap" },
    h("div", { class: "ed-choices" }, yes, no),
    note ? h("div", { class: "ed-learned" }, note) : null
  );

  function paint() {
    yes.dataset.on = value === true ? "true" : "false";
    no.dataset.on = value === false ? "true" : "false";
    yes.setAttribute("aria-pressed", String(value === true));
    no.setAttribute("aria-pressed", String(value === false));
    if (note) {
      note.hidden = value !== true;
      const wanted = (ctx.tile?.() || tile).values?.learned_what || "";
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

  paint();
  return {
    el,
    sync: () => {
      value = read() === true ? true : read() === false ? false : null;
      paint();
    },
  };
}

/* ------------------------------------------------------- a five-step word */

function scaleEditor(tile, ctx, onSaved) {
  const field = tile.fields[0];
  const words = tile.labels || [];
  const read = () => numeric((ctx.tile?.() || tile).values?.[field]);
  let value = read();
  const rows = [];

  const el = h(
    "div",
    { class: "ed-scale", role: "group", "aria-label": tile.label },
    ...words.map((word, index) => {
      const row = h(
        "button",
        { type: "button", class: "ed-scale-row", onclick: () => choose(index + 1) },
        h("span", { class: "ed-scale-num num" }, String(index + 1)),
        h("span", { class: "ed-scale-word" }, word)
      );
      rows.push(row);
      return row;
    })
  );

  rows[0]?.setAttribute("data-autofocus", "");

  function paint() {
    rows.forEach((row, index) => {
      row.dataset.on = value === index + 1 ? "true" : "false";
      row.setAttribute("aria-pressed", String(value === index + 1));
    });
  }

  async function choose(next) {
    value = next;
    paint();
    await ctx.save?.({ [field]: next });
    onSaved?.();
  }

  paint();
  return { el, sync: () => { value = read(); paint(); } };
}

/* --------------------------------------------------------- a few blocks */

function blocksEditor(tile, ctx, onSaved) {
  const field = tile.fields[0];
  const read = () => numeric((ctx.tile?.() || tile).values?.[field]);
  let value = read();
  const words = ["None", "One", "Two", "Three"];
  const rows = [];

  const el = h(
    "div",
    { class: "ed-blocks" },
    ...words.map((word, index) => {
      const row = h(
        "button",
        { type: "button", class: "ed-block", onclick: () => choose(index) },
        h("span", { class: "ed-block-bars" }, ...Array.from({ length: index }, () => h("i"))),
        h("span", { class: "ed-block-word" }, word)
      );
      rows.push(row);
      return row;
    })
  );

  rows[0]?.setAttribute("data-autofocus", "");

  function paint() {
    rows.forEach((row, index) => {
      row.dataset.on = value === index ? "true" : "false";
      row.setAttribute("aria-pressed", String(value === index));
    });
  }

  async function choose(next) {
    value = next;
    paint();
    await ctx.save?.({ [field]: next });
    onSaved?.();
  }

  paint();
  return { el, sync: () => { value = read(); paint(); } };
}

/* --------------------------------------------------------- the whole week */

function weekEditor(tile, ctx, onSaved) {
  const field = tile.fields[0];
  const gym = tile.id === "gym";
  const max = gym ? 3 : 10;
  const unit = gym ? "session" : "drink";
  const summary = h("p", { class: "ed-summary" });
  const rows = new Map();
  const timers = new Map();
  const list = h("div", { class: "ed-week" });

  const days = () => (ctx.tile?.() || tile).week_days || tile.week_days || [];

  for (const entry of days()) {
    const valueEl = h("span", { class: "ed-day-value num" });
    const less = h(
      "button",
      { type: "button", class: "ed-day-bump", "aria-label": `One less on ${entry.day}` },
      "−"
    );
    const more = h(
      "button",
      { type: "button", class: "ed-day-bump", "aria-label": `One more on ${entry.day}` },
      "+"
    );
    const row = h(
      "div",
      { class: "ed-day", "data-today": entry.today ? "true" : "false" },
      h(
        "span",
        { class: "ed-day-name" },
        dayLabel(entry.day),
        h("small", {}, String(Number(entry.day.slice(8, 10))))
      ),
      less,
      valueEl,
      more
    );
    const item = { entry, row, valueEl, less, more };
    rows.set(entry.day, item);
    less.addEventListener("click", () => step(entry.day, -1));
    more.addEventListener("click", () => step(entry.day, 1));
    list.append(row);
  }

  const legend = h(
    "p",
    { class: "ed-note" },
    gym
      ? "The last seven days. Change any day and the week follows."
      : "The last seven days, in drinks. A day with none is an alcohol-free day."
  );

  const el = h("div", { class: "ed-weekwrap" }, summary, list, legend);

  function step(day, direction) {
    const item = rows.get(day);
    if (!item || item.entry.future) return;
    const next = clamp((item.entry.value ?? 0) + direction, 0, max);
    item.entry = { ...item.entry, value: next };
    paintRow(item);
    clearTimeout(timers.get(day));
    timers.set(
      day,
      setTimeout(async () => {
        await ctx.saveDay?.(day, { [field]: next });
        sync();
        onSaved?.();
      }, 420)
    );
  }

  function paintRow(item) {
    const value = item.entry.value;
    item.valueEl.textContent = value == null ? "—" : formatNumber(value, 1, field);
    item.row.dataset.empty = value == null ? "true" : "false";
    item.row.dataset.future = item.entry.future ? "true" : "false";
    item.less.disabled = item.entry.future;
    item.more.disabled = item.entry.future;
  }

  function sync() {
    tile = ctx.tile?.() || tile;
    for (const entry of days()) {
      const item = rows.get(entry.day);
      if (!item) continue;
      item.entry = entry;
      paintRow(item);
    }
    const fresh = ctx.tile?.() || tile;
    if (gym) {
      const target = Math.round(fresh.target || 3);
      summary.textContent = `${fresh.filled ?? 0} of ${target} sessions this week`;
    } else {
      const week = days().filter((entry) => !entry.future);
      const drinks = week.reduce((total, entry) => total + (entry.value || 0), 0);
      const dry = week.filter((entry) => !entry.value).length;
      summary.textContent = drinks
        ? `${drinks} ${drinks === 1 ? "drink" : "drinks"} · ${dry} of ${week.length} days dry`
        : `No drinks · ${week.length} of ${week.length} days dry`;
    }
  }

  sync();
  return { el, sync };
}

/* ------------------------------------------------------- thirty clean days */

function cleanEditor(tile, ctx, onSaved) {
  const summary = h("p", { class: "ed-summary" });
  const cells = new Map();
  const grid = h("div", { class: "ed-clean" });

  const days = () => (ctx.tile?.() || tile).days || tile.days || [];

  for (const entry of days()) {
    const cell = h(
      "button",
      {
        type: "button",
        class: "ed-clean-day",
        "aria-label": `${entry.day} — ${entry.clean ? "clean" : "not logged"}`,
        onclick: async () => {
          const fresh = days().find((day) => day.day === entry.day) || entry;
          await ctx.saveDay?.(entry.day, { avoid_habit: !fresh.clean });
          sync();
          onSaved?.();
        },
      },
      h("span", {}, String(Number(entry.day.slice(8, 10))))
    );
    cells.set(entry.day, cell);
    grid.append(cell);
  }

  const el = h(
    "div",
    { class: "ed-cleanwrap" },
    summary,
    grid,
    h("p", { class: "ed-note" }, "Click any day to change it. Today is the one with the ring.")
  );

  function sync() {
    tile = ctx.tile?.() || tile;
    let clean = 0;
    const all = days();
    for (const entry of all) {
      if (entry.clean) clean += 1;
      const cell = cells.get(entry.day);
      if (!cell) continue;
      cell.dataset.clean = entry.clean ? "true" : "false";
      cell.dataset.today = entry.day === all[all.length - 1]?.day ? "true" : "false";
      cell.setAttribute("aria-pressed", String(Boolean(entry.clean)));
    }
    summary.textContent = `${clean} of ${all.length} days`;
  }

  sync();
  return { el, sync, summary: () => summary.textContent };
}

/* ------------------------------------------------------------- in bed */

function bedEditor(tile, ctx, onSaved) {
  const START = 21 * 60;
  const SPAN = 5 * 60;
  const field = "bed_time";

  const read = () => numeric((ctx.tile?.() || tile).bed);
  let value = read();
  let timer = null;

  const zone = h("span", { class: "ed-zone" });
  const usual = h("span", { class: "ed-targettick ed-targettick--usual" });
  const yesterday = h("span", { class: "ed-yest" });
  const mark = h("span", { class: "ed-mark" });
  const track = h("div", { class: "ed-track" }, zone, usual, yesterday, mark);
  const labels = h(
    "div",
    { class: "ed-hours" },
    ...["21:00", "22:00", "23:00", "00:00", "01:00", "02:00"].map((text) => h("span", {}, text))
  );

  const readout = h("output", { class: "ed-readout num" });
  const timeInput = h("input", {
    class: "ed-time",
    type: "time",
    step: 900,
    "aria-label": "Bed time",
  });
  const wakeLine = h("p", { class: "ed-wake" });

  const el = h(
    "div",
    { class: "ed-bed" },
    h("div", { class: "ed-big" }, readout, h("label", { class: "ed-exactwrap" }, h("span", {}, "Exact"), timeInput)),
    h("div", { class: "ed-rail ed-rail--bed" }, track, labels),
    wakeLine
  );

  const share = (minutes) => {
    if (minutes == null) return null;
    const raw = (((minutes - START) % 1440) + 1440) % 1440;
    if (raw <= SPAN) return raw / SPAN;
    const toStart = Math.min(raw, 1440 - raw);
    const toEnd = Math.min(Math.abs(raw - SPAN), 1440 - Math.abs(raw - SPAN));
    return toStart <= toEnd ? 0 : 1;
  };

  function paint() {
    const fresh = ctx.tile?.() || tile;
    mount(readout, value == null ? "—" : clockOf(value));
    if (document.activeElement !== timeInput) timeInput.value = value == null ? "" : clockOf(value);

    if (value == null) {
      mark.hidden = true;
    } else {
      mark.hidden = false;
      mark.style.left = `${(share(value) ?? 0) * 100}%`;
    }

    const usualMinutes = numeric(fresh.usual_bed);
    if (usualMinutes != null) {
      usual.hidden = false;
      usual.style.left = `${(share(usualMinutes) ?? 0) * 100}%`;
      const lo = share(usualMinutes - 45);
      const hi = share(usualMinutes + 45);
      zone.hidden = false;
      zone.style.left = `${Math.min(lo, hi) * 100}%`;
      zone.style.width = `${Math.abs(hi - lo) * 100}%`;
    } else {
      usual.hidden = true;
      zone.hidden = true;
    }

    const yesterdayMinutes = numeric(fresh.yesterday_bed);
    if (yesterdayMinutes != null) {
      yesterday.hidden = false;
      yesterday.style.left = `${(share(yesterdayMinutes) ?? 0) * 100}%`;
    } else {
      yesterday.hidden = true;
    }

    const wake = numeric(fresh.wake);
    if (value == null) {
      wakeLine.hidden = true;
    } else if (wake == null) {
      wakeLine.hidden = false;
      wakeLine.textContent = "Add your sleep and the hour you got up appears.";
    } else {
      wakeLine.hidden = false;
      wakeLine.textContent = `Up at ${clockOf(wake)} — ${fresh.gap?.replace(/^Up \S+ · /, "") || "from today's sleep"}.`;
    }

    track.setAttribute("aria-valuenow", String(value ?? ""));
    track.setAttribute("aria-valuetext", value == null ? "" : clockOf(value));
  }

  function set(next, wait = 400) {
    value = ((Math.round(next / 15) * 15) % 1440 + 1440) % 1440;
    paint();
    clearTimeout(timer);
    timer = setTimeout(async () => {
      await ctx.save?.({ [field]: clockOf(value) });
      onSaved?.();
      paint();
    }, wait);
  }

  track.tabIndex = 0;
  track.dataset.autofocus = "";
  track.setAttribute("role", "slider");
  track.setAttribute("aria-label", "Bed time");
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", "1439");
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

  onDrag(
    track,
    (event) => {
      const raw = START + shareFromEvent(track, event) * SPAN;
      value = ((Math.round(raw / 15) * 15) % 1440 + 1440) % 1440;
      paint();
    },
    () => set(value, 0)
  );

  timeInput.addEventListener("change", () => {
    const match = /^(\d{1,2}):(\d{2})/.exec(timeInput.value || "");
    if (!match) return;
    set(Number(match[1]) * 60 + Number(match[2]), 0);
  });

  paint();
  return {
    el,
    sync: () => {
      value = read();
      paint();
    },
    // The body owns the sentence for this card — the axis and the wake line
    // already say everything the footer could.
    silentGap: () => true,
  };
}
