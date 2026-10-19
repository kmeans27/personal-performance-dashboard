/* One tile: one thing you log, drawn the way that thing reads best.
   Built once, then updated in place so the charts move when they fill.

   The chart is decided by the catalogue in `metrics.py`, never here: a tile
   only knows how to draw the shape it was handed. */

import { h, s } from "../core/dom.js";

const clamp01 = (value) => Math.max(0, Math.min(1, value));

/** "22:45" -> 1365 minutes past midnight. */
function parseClock(text) {
  if (typeof text !== "string") return null;
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return (hours % 24) * 60 + minutes;
}

function positionOn(value, lo, hi) {
  if (hi === lo) return 0;
  return clamp01((value - lo) / (hi - lo));
}

/* --------------------------------------------------------------- charts */

/** Paint a series into a 100×40 spark box; `toY` maps a value to a y. */
function paintSpark(line, area, mark, points, toY) {
  const span = Math.max(1, points.length - 1);
  const x = (index) => (points.length === 1 ? 50 : (index / span) * 100);
  const coords = points.map((value, index) => [x(index), toY(value)]);
  const path = coords.map(([cx, cy]) => `${cx.toFixed(2)},${cy.toFixed(2)}`).join(" ");

  line.setAttribute("points", path);
  if (coords.length > 1) {
    area.setAttribute("points", `0,40 ${path} 100,40`);
    area.style.opacity = "1";
  } else {
    // One reading is not a trend: show where you are, claim nothing.
    area.style.opacity = "0";
    line.setAttribute("points", `0,${coords[0][1].toFixed(2)} 100,${coords[0][1].toFixed(2)}`);
  }

  const [lastX, lastY] = coords[coords.length - 1];
  mark.setAttribute("x", String(Math.max(0, Math.min(98.6, lastX - 0.7))));
  mark.setAttribute("y", String(lastY - 4));
}

/** The nodes a spark line is made of, ready to be painted. */
function sparkNodes(extraClass) {
  const zone = s("rect", { class: "spark-zone", x: 0, y: 0, width: 100, height: 0 });
  const area = s("polygon", { class: "spark-area", points: "" });
  const line = s("polyline", { class: "spark-line", points: "" });
  const mark = s("rect", { class: "spark-mark", width: 1.4, height: 8, x: 0, y: 0 });
  const svg = s(
    "svg",
    {
      class: `spark${extraClass ? ` ${extraClass}` : ""}`,
      viewBox: "0 0 100 40",
      preserveAspectRatio: "none",
      "aria-hidden": "true",
      focusable: "false",
    },
    zone,
    area,
    line,
    mark
  );
  return { svg, zone, area, line, mark };
}

/** A value against a good zone: land inside it, or stay under it. */
function rangeChart(tile) {
  const [lo, hi] = tile.track || [0, 1];
  const zone = tile.zone;
  const unit = tile.unit || "";
  const week = sparkNodes("spark--mini");

  const zoneEl = h("span", { class: "range-zone" });
  const marker = h("span", { class: "range-marker" });
  const foot = h("div", { class: "range-foot" });
  const label = (value, className) =>
    h(
      "span",
      {
        class: className,
        style: { left: `${positionOn(value, lo, hi) * 100}%` },
      },
      `${Number.isInteger(value) ? value : value.toFixed(1)}${unit ? ` ${unit}` : ""}`
    );

  if (zone) {
    const from = positionOn(zone[0], lo, hi);
    const to = positionOn(zone[1], lo, hi);
    zoneEl.style.left = `${from * 100}%`;
    zoneEl.style.width = `${Math.max(0, to - from) * 100}%`;
    // The two ends of the axis, and the edge of the good zone between them.
    foot.append(label(lo, "edge edge--lo"), label(hi, "edge edge--hi"));
    if (zone[0] > lo) foot.append(label(zone[0], "edge edge--zone"));
    foot.append(label(zone[1], "edge edge--zone"));
  }

  const box = h(
    "div",
    { class: "tile-chart chart-range" },
    h(
      "div",
      { class: "range-gauge" },
      h("div", { class: "range-track" }, zoneEl, marker),
      zone ? foot : null
    ),
    week.svg
  );

  return {
    box,
    set: (next) => {
      const raw = next.values?.[next.fields[0]];
      const known = typeof raw === "number";
      box.dataset.known = known ? "true" : "false";
      marker.style.left = `${positionOn(known ? raw : lo, lo, hi) * 100}%`;
      box.dataset.inside = known && zone && raw >= zone[0] && raw <= zone[1] ? "true" : "false";
      box.dataset.beyond = known && zone && raw > zone[1] ? "true" : "false";

      // The last week sits under the gauge, on its own scale, with the good
      // zone drawn behind it — so a run of bad nights is visible at a glance.
      const series = (next.series || []).filter((value) => typeof value === "number");
      const enough = series.length > 1;
      box.dataset.history = enough ? "true" : "false";
      if (!enough) return;

      const held = zone ? [...series, zone[0], zone[1]] : series;
      const low = Math.min(...held);
      const high = Math.max(...held);
      const pad = Math.max(0.2, (high - low) * 0.16);
      const floor = low - pad;
      const roof = high + pad;
      const toY = (value) => 34 - ((value - floor) / (roof - floor || 1)) * 28;
      paintSpark(week.line, week.area, week.mark, series, toY);

      if (zone) {
        const top = Math.max(0, Math.min(40, toY(zone[1])));
        const bottom = Math.max(0, Math.min(40, toY(zone[0])));
        week.zone.setAttribute("y", String(top));
        week.zone.setAttribute("height", String(Math.max(0, bottom - top)));
        week.zone.style.opacity = "1";
      } else {
        week.zone.style.opacity = "0";
      }
    },
  };
}

/** Progress toward a target you are chasing. */
function barChart() {
  const fill = h("span", { class: "bar-fill" });
  const box = h("div", { class: "tile-chart chart-bar" }, h("div", { class: "bar-track" }, fill));
  return {
    box,
    set: (next) => {
      fill.style.width = `${clamp01(next.progress ?? 0) * 100}%`;
    },
  };
}

/** A small count you tick off — one cell each. */
function segmentsChart(tile) {
  const cells = [];
  for (let index = 0; index < (tile.cells || 3); index += 1) {
    cells.push(h("span", { class: "cell" }));
  }
  const box = h("div", { class: "tile-chart chart-segments" }, h("div", { class: "cells" }, cells));
  return {
    box,
    set: (next) => {
      cells.forEach((cell, index) => {
        cell.dataset.filled = index < (next.filled || 0) ? "true" : "false";
      });
    },
  };
}

/** A big count you stack up — one block each. */
function blocksChart(tile) {
  const blocks = [];
  for (let index = 0; index < (tile.cells || 3); index += 1) {
    blocks.push(h("span", { class: "block" }));
  }
  const box = h("div", { class: "tile-chart chart-blocks" }, h("div", { class: "blocks" }, blocks));
  return {
    box,
    set: (next) => {
      blocks.forEach((block, index) => {
        block.dataset.filled = index < (next.filled || 0) ? "true" : "false";
      });
    },
  };
}

/** A yes/no that must look unmistakably answered. */
function switchChart() {
  const pill = h("span", { class: "pill" }, h("i", { class: "pill-knob" }));
  const box = h("div", { class: "tile-chart chart-switch" }, pill);
  return {
    box,
    set: (next) => {
      pill.dataset.on = next.state === "done" ? "true" : "false";
      pill.dataset.known = next.settled ? "true" : "false";
    },
  };
}

/** A felt 1–5, one bar per step. */
function scaleChart(tile) {
  const bars = [];
  const steps = (tile.cells || 5) || 5;
  for (let step = 1; step <= steps; step += 1) {
    bars.push(h("i", { style: { height: `${38 + (step - 1) * 15}%` } }));
  }
  const box = h("div", { class: "tile-chart chart-scale" }, h("div", { class: "scale" }, bars));
  return {
    box,
    set: (next) => {
      const value = Number(next.values?.[next.fields[0]]);
      const filled = Number.isFinite(value) ? Math.round(value) : 0;
      bars.forEach((bar, index) => {
        bar.dataset.filled = index < filled ? "true" : "false";
      });
    },
  };
}

/** A window across the day: when you slept, and how long for. */
function nightChart() {
  const evening = h("span", { class: "night-window" });
  const morning = h("span", { class: "night-window" });
  const track = h("div", { class: "night-track" }, evening, morning);
  const hours = h(
    "div",
    { class: "night-hours" },
    ["00", "06", "12", "18", "24"].map((mark) => h("span", {}, mark))
  );
  const box = h("div", { class: "tile-chart chart-night" }, track, hours);

  return {
    box,
    set: (next) => {
      const bed = parseClock(next.values?.bed_time);
      const wake = parseClock(next.values?.wake_time);
      const known = bed != null && wake != null;
      box.dataset.known = known ? "true" : "false";
      if (!known) return;

      const day = 1440;
      const from = (bed / day) * 100;
      const to = (wake / day) * 100;
      if (bed <= wake) {
        // A nap or a very early night: one continuous band.
        evening.style.left = `${from}%`;
        evening.style.width = `${Math.max(0.6, to - from)}%`;
        morning.dataset.hidden = "true";
      } else {
        // The usual night: it starts before midnight and ends after it.
        evening.style.left = `${from}%`;
        evening.style.width = `${Math.max(0.6, 100 - from)}%`;
        morning.style.left = "0%";
        morning.style.width = `${Math.max(0.6, to)}%`;
        morning.dataset.hidden = "false";
      }
    },
  };
}

/** A number against its own history. */
function trendChart(tile) {
  const spark = sparkNodes();
  const goal = s("line", { class: "spark-goal", x1: 0, x2: 100, y1: 0, y2: 0 });
  spark.svg.prepend(goal);
  const box = h("div", { class: "tile-chart chart-trend" }, spark.svg);

  return {
    box,
    set: (next) => {
      const series = (next.series || []).filter((value) => typeof value === "number");
      const goalValue = typeof next.goal === "number" ? next.goal : null;
      const current = next.values?.[next.fields[0]];
      const points = series.length ? [...series] : typeof current === "number" ? [current] : [];
      box.dataset.known = points.length ? "true" : "false";
      if (!points.length) {
        goal.style.opacity = "0";
        return;
      }

      const values = goalValue == null ? points : [...points, goalValue];
      let low = Math.min(...values);
      let high = Math.max(...values);
      const pad = Math.max(0.6, (high - low) * 0.25);
      low -= pad;
      high += pad;
      const toY = (value) => 36 - ((value - low) / (high - low || 1)) * 32;
      paintSpark(spark.line, spark.area, spark.mark, points, toY);

      if (goalValue == null) {
        goal.style.opacity = "0";
      } else {
        goal.style.opacity = "1";
        goal.setAttribute("y1", String(toY(goalValue)));
        goal.setAttribute("y2", String(toY(goalValue)));
      }
    },
  };
}

function chartNode(tile) {
  switch (tile.chart) {
    case "range":
      return rangeChart(tile);
    case "segments":
      return segmentsChart(tile);
    case "blocks":
      return blocksChart(tile);
    case "switch":
      return switchChart();
    case "scale":
      return scaleChart(tile);
    case "night":
      return nightChart();
    case "trend":
      return trendChart(tile);
    case "bar":
    default:
      return barChart();
  }
}

export function createTile(tile, { accent, onOpen } = {}) {
  const chart = chartNode(tile);
  const label = h("span", { class: "tile-label" }, tile.label);
  const value = h("span", { class: "tile-value num" });
  const caption = h("span", { class: "tile-caption" });

  const el = h(
    "button",
    {
      type: "button",
      class: `tile tile--${tile.chart}`,
      "data-tile": tile.id,
      style: { "--accent": accent },
      onclick: () => onOpen?.(),
    },
    h("span", { class: "tile-top" }, label, value),
    chart.box,
    caption
  );

  function setValue(text, unit) {
    value.textContent = text == null ? "—" : text;
    if (unit && text != null) value.append(h("small", { class: "tile-unit" }, unit));
  }

  function update(next) {
    const wasEmpty = el.dataset.state === "empty";
    el.dataset.state = next.state;
    el.dataset.size = String(next.size);
    el.dataset.optional = next.optional ? "true" : "false";
    el.setAttribute(
      "aria-label",
      `${next.label}: ${next.display ?? "not logged"}${next.unit ? ` ${next.unit}` : ""}. ${next.caption}`
    );

    label.textContent = next.label;
    setValue(next.display, next.unit);
    chart.set(next);

    const note = Boolean(next.sub);
    caption.dataset.note = note ? "true" : "false";
    caption.textContent = next.sub || next.caption;

    if (wasEmpty && next.display != null) {
      el.dataset.landed = "true";
      setTimeout(() => delete el.dataset.landed, 520);
    }
  }

  update(tile);
  return { el, update, id: tile.id };
}
