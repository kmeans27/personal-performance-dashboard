/* One tile: one thing you log, drawn the way that thing reads best.
   Built once, then updated in place so the charts animate when they fill. */

import { h, s } from "../core/dom.js";

const VIEW = 100;
const RADIUS = 34;
const STROKE = 6;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** A tile's chart, chosen by the catalogue, never by the caller. */
function chartNode(chart, cells) {
  if (chart === "gauge") {
    const progress = s("circle", {
      class: "gauge-progress",
      cx: VIEW / 2,
      cy: VIEW / 2,
      r: RADIUS,
      "stroke-width": STROKE,
      "stroke-dasharray": `${CIRCUMFERENCE} ${CIRCUMFERENCE}`,
      "stroke-dashoffset": CIRCUMFERENCE,
      transform: `rotate(-90 ${VIEW / 2} ${VIEW / 2})`,
    });
    const value = h("span", { class: "gauge-value num" });
    const gauge = h(
      "div",
      { class: "gauge" },
      s(
        "svg",
        { viewBox: `0 0 ${VIEW} ${VIEW}`, "aria-hidden": "true", focusable: "false" },
        s("circle", {
          class: "gauge-track",
          cx: VIEW / 2,
          cy: VIEW / 2,
          r: RADIUS,
          "stroke-width": STROKE,
        }),
        progress
      ),
      value
    );
    return { node: gauge, value, progress, box: h("div", { class: "tile-chart" }, gauge) };
  }

  if (chart === "bar") {
    const fill = h("span", { class: "bar-fill" });
    return {
      node: null,
      box: h("div", { class: "tile-chart" }, h("div", { class: "bar-track" }, fill)),
      fill,
    };
  }

  if (chart === "segments") {
    const blocks = [];
    for (let index = 0; index < (cells || 3); index += 1) {
      blocks.push(h("span", { class: "cell", "data-filled": "false" }));
    }
    return { node: null, box: h("div", { class: "tile-chart" }, h("div", { class: "cells" }, blocks)), blocks };
  }

  if (chart === "scale") {
    const bars = [];
    for (let step = 1; step <= 5; step += 1) {
      bars.push(h("i", { "data-filled": "false", style: { height: `${34 + step * 13}%` } }));
    }
    return { node: null, box: h("div", { class: "tile-chart" }, h("div", { class: "scale" }, bars)), bars };
  }

  if (chart === "switch") {
    const readout = h("span", { class: "tile-value num" });
    return {
      node: null,
      box: h("div", { class: "tile-chart" }, h("div", { class: "switch" }, h("i"), readout)),
      readout,
    };
  }

  if (chart === "clock") {
    const readout = h("span", { class: "clock-read tile-value" });
    return { node: null, box: h("div", { class: "tile-chart" }, readout), readout };
  }

  return { node: null, box: null };
}

export function createTile(tile, { accent, onOpen } = {}) {
  const chart = chartNode(tile.chart, tile.cells);
  const label = h("span", { class: "tile-label" }, tile.label);
  const caption = h("span", { class: "tile-caption" });

  // A gauge carries its own number, so the top row stays a label.
  const valueInTop = !["gauge", "switch", "clock"].includes(tile.chart);
  const value = valueInTop ? h("span", { class: "tile-value num" }) : null;

  const el = h(
    "button",
    {
      type: "button",
      class: `tile tile--${tile.chart}`,
      style: { "--accent": accent },
      onclick: () => onOpen?.(),
    },
    h("span", { class: "tile-top" }, label, value),
    chart.box,
    caption
  );

  function setValue(text, unit) {
    const target = chart.value || chart.readout || value;
    if (!target) return;
    const shown = text == null ? "—" : text;
    target.textContent = shown;
    if (unit && text != null) target.append(h("small", {}, unit));
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

    const progress = next.progress ?? 0;
    if (chart.progress) {
      chart.progress.setAttribute("stroke-dashoffset", String(CIRCUMFERENCE * (1 - progress)));
    }
    if (chart.fill) chart.fill.style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
    if (chart.blocks) {
      chart.blocks.forEach((block, index) => {
        block.dataset.filled = index < next.filled ? "true" : "false";
      });
    }
    if (chart.bars) {
      const filled = next.progress == null ? 0 : Math.round(next.progress * 4) + 1;
      chart.bars.forEach((bar, index) => {
        bar.dataset.filled = index < filled ? "true" : "false";
      });
    }
    const marker = el.querySelector(".switch i");
    if (marker) marker.dataset.on = next.state === "done" ? "true" : "false";

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
