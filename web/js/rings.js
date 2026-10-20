/* The ring composition — used full size, mini and micro. */

import { h, s, mount } from "./core/dom.js";
import { settle } from "./core/motion.js";
import { points } from "./core/format.js";

export const RING_ORDER = ["body", "mind", "attention"];

export const ACCENTS = {
  body: "var(--body)",
  mind: "var(--mind)",
  attention: "var(--attention)",
};

export const LABELS = {
  body: "Body",
  mind: "Mind",
  attention: "Attention",
};

const VIEW = 320;
const CENTRE = VIEW / 2;
const GEOMETRY = [
  { id: "body", radius: 132, width: 13 },
  { id: "mind", radius: 95, width: 13 },
  { id: "attention", radius: 58, width: 13 },
];

function arc(circle, offset) {
  circle.setAttribute("stroke-dashoffset", String(offset));
}

/**
 * Full composition: three rings, one score in the middle.
 * Returns { el, setScores, settleNow }.
 */
export function createRings({ caption = "", centre = true, className = "rings" } = {}) {
  const arcs = new Map();
  const groups = new Map();

  const circles = GEOMETRY.map((geometry) => {
    const circumference = 2 * Math.PI * geometry.radius;
    const progress = s("circle", {
      class: "ring-progress",
      cx: CENTRE,
      cy: CENTRE,
      r: geometry.radius,
      "stroke-width": geometry.width,
      "stroke-dasharray": `${circumference} ${circumference}`,
      "stroke-dashoffset": circumference,
      transform: `rotate(-90 ${CENTRE} ${CENTRE})`,
    });
    arcs.set(geometry.id, { node: progress, circumference });
    const group = s(
      "g",
      { class: "ring", "data-ring": geometry.id, style: { color: ACCENTS[geometry.id] } },
      s("circle", {
        class: "ring-track",
        cx: CENTRE,
        cy: CENTRE,
        r: geometry.radius,
        "stroke-width": geometry.width,
      }),
      progress
    );
    groups.set(geometry.id, group);
    return group;
  });

  /* A thin lit segment that travels around each ring once, for the moment a
     day closes every ring. It is decoration, not data: hidden at rest. */
  const sheens = GEOMETRY.map((geometry) =>
    s(
      "g",
      {
        class: "ring-sheen",
        style: { color: ACCENTS[geometry.id], transformOrigin: `${CENTRE}px ${CENTRE}px` },
      },
      s("circle", {
        cx: CENTRE,
        cy: CENTRE,
        r: geometry.radius,
        fill: "none",
        pathLength: 100,
        "stroke-width": geometry.width * 0.55,
        "stroke-linecap": "round",
        "stroke-dasharray": "13 87",
      })
    )
  );

  const svg = s(
    "svg",
    { viewBox: `0 0 ${VIEW} ${VIEW}`, "aria-hidden": "true", focusable: "false" },
    circles,
    sheens
  );

  const scoreNode = h("div", { class: "ring-score num", "data-empty": "true" }, "—");
  const captionNode = h("div", { class: "ring-caption" }, caption);
  const centreNode = centre ? h("div", { class: "rings-center" }, scoreNode, captionNode) : null;
  const wrapper = h("div", { class: className }, svg, centreNode);
  let perfectTimer = null;

  function setScores({ total, categories = {}, focus } = {}) {
    for (const [id, arcRef] of arcs) {
      const score = categories[id];
      const offset = score == null ? arcRef.circumference : arcRef.circumference * (1 - score);
      arc(arcRef.node, offset);
      const group = groups.get(id);
      group.dataset.focus = focus === id ? "true" : "false";
      group.dataset.empty = score == null ? "true" : "false";
      // The glow is the score, made visible: brighter in, quieter out.
      group.style.setProperty("--glow", `${(1.5 + (score ?? 0) * 6).toFixed(1)}px`);
    }
    const value = total == null ? null : Math.round(total * 100);
    scoreNode.dataset.empty = value == null ? "true" : "false";
    scoreNode.dataset.digits = value == null ? "0" : String(String(value).length);
    mount(scoreNode, value == null ? "—" : String(value));
  }

  function setCaption(text) {
    captionNode.textContent = text;
  }

  /** A closed day, once per day: the sweep, the swell, the pulse. After that
      the rings simply sit a little brighter for the rest of the day. */
  function celebrate(day, total) {
    const value = total == null ? null : Math.round(total * 100);
    if (value !== 100) {
      delete wrapper.dataset.perfect;
      clearTimeout(perfectTimer);
      return;
    }
    const key = `pulse:perfect:${day}`;
    let seen = false;
    try {
      seen = Boolean(window.localStorage.getItem(key));
    } catch {
      seen = false;
    }
    if (seen) {
      wrapper.dataset.perfect = "done";
      return;
    }
    try {
      window.localStorage.setItem(key, new Date().toISOString());
    } catch {
      /* private mode: the moment still happens, it just will not remember */
    }
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduced) {
      wrapper.dataset.perfect = "done";
      return;
    }
    wrapper.dataset.perfect = "true";
    clearTimeout(perfectTimer);
    perfectTimer = setTimeout(() => {
      wrapper.dataset.perfect = "done";
    }, 3000);
  }

  return { el: wrapper, svg, setScores, setCaption, celebrate, settleNow: () => settle(wrapper) };
}

/** Three arcs in a 40px square — a day, at calendar size. */
export function microRings(categories = {}, { size = 44, stroke = 3 } = {}) {
  const centre = size / 2;
  const outer = size / 2 - stroke / 2 - 1;
  const gap = stroke * 1.7;
  const radii = [outer, outer - gap, outer - gap * 2];
  const children = RING_ORDER.map((id, index) => {
    const radius = radii[index];
    const circumference = 2 * Math.PI * radius;
    const score = categories[id];
    return s("circle", {
      class: "ring-progress ring-progress--instant",
      cx: centre,
      cy: centre,
      r: radius,
      fill: "none",
      style: { stroke: ACCENTS[id] },
      "stroke-width": stroke,
      "stroke-linecap": "round",
      opacity: score == null ? 0.16 : 1,
      "stroke-dasharray": `${circumference} ${circumference}`,
      "stroke-dashoffset": score == null ? circumference : circumference * (1 - score),
      transform: `rotate(-90 ${centre} ${centre})`,
    });
  });
  return s("svg", { viewBox: `0 0 ${size} ${size}`, width: size, height: size, "aria-hidden": "true" }, children);
}

/** Single ring: the total score, for the day sheet header. */
export function totalRing(total, { size = 92, stroke = 8 } = {}) {
  const centre = size / 2;
  const radius = centre - stroke / 2 - 1;
  const circumference = 2 * Math.PI * radius;
  const value = total ?? 0;
  return s(
    "svg",
    { viewBox: `0 0 ${size} ${size}`, width: size, height: size, "aria-hidden": "true", class: "total-ring" },
    s("circle", {
      cx: centre,
      cy: centre,
      r: radius,
      fill: "none",
      stroke: "rgba(255,255,255,0.08)",
      "stroke-width": stroke,
    }),
    s("circle", {
      cx: centre,
      cy: centre,
      r: radius,
      fill: "none",
      style: { stroke: "var(--overall)" },
      "stroke-width": stroke,
      "stroke-linecap": "round",
      "stroke-dasharray": `${circumference} ${circumference}`,
      "stroke-dashoffset": circumference * (1 - value),
      transform: `rotate(-90 ${centre} ${centre})`,
    }),
    s(
      "text",
      {
        x: centre,
        y: centre + 1,
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        fill: "var(--ink)",
        "font-size": size * 0.3,
        "font-weight": 550,
        "font-variant-numeric": "tabular-nums",
      },
      points(total)
    )
  );
}
