/* The composition shared by Today and Demo. */

import { h } from "../core/dom.js";
import { createRings, microRings, LABELS } from "../rings.js";
import { legend } from "../components/legend.js";
import { weeklyCards } from "../components/weekly.js";
import { openDaySheet } from "../components/daySheet.js";
import { longDay, points, isToday } from "../core/format.js";
import { countUp } from "../core/motion.js";
import { api, demoApi } from "../core/api.js";

export function headline({ score, focus, logged }) {
  if (!logged || score.total == null) {
    return "Nothing logged for today yet. Thirty seconds and the rings come alive.";
  }
  const total = score.total;
  const strongest = strongestRing(score.categories);
  if (total >= 0.85) return `A day like this is the goal — ${strongest} carried it.`;
  if (total >= 0.7) return `A solid day, held up by ${strongest}.`;
  if (total >= 0.55) return focus ? `A mixed day. ${focus.category_label} is where the room is.` : "A mixed day, with room in a few places.";
  return focus ? `A light day. Not a verdict — ${focus.category_label} is simply the next thing.` : "A light day. Information, not a verdict.";
}

function strongestRing(categories = {}) {
  const entries = Object.entries(categories).filter(([, value]) => value != null);
  if (!entries.length) return "everything";
  const [id] = entries.sort((a, b) => b[1] - a[1])[0];
  return LABELS[id] || id;
}

export function dashboardView({ payload, strip = [], demo = false, onSelectDay }) {
  const rings = createRings({ caption: demo ? "Demo day" : isToday(payload.day) ? "Today" : longDay(payload.day) });
  rings.setScores(payload.score);
  requestAnimationFrame(() => rings.settleNow());

  const fetchDay = demo ? (day) => demoApi.day(day) : (day) => api.day(day);

  const openDay = (day) => {
    openDaySheet(day, { fetchDay });
    onSelectDay?.(day);
  };

  const hero = h(
    "section",
    { class: "hero" },
    rings.el,
    h(
      "div",
      { class: "hero-read" },
      h("p", { class: "eyebrow" }, demo ? "Demo · logged day" : longDay(payload.day)),
      h("h1", { class: "hero-title" }, headline(payload)),
      h(
        "div",
        { class: "hero-meta" },
        payload.logged
          ? h("span", { class: "chip", style: { "--accent": "var(--overall)" } }, `${points(payload.score.total)} / 100`)
          : h("span", { class: "chip chip--muted" }, "no entry"),
        !demo && payload.consistency
          ? h(
              "span",
              { class: "hero-sub num" },
              `${payload.consistency.days_logged_30} of the last 30 days logged`
            )
          : null
      ),
      payload.focus
        ? h(
            "p",
            { class: "focus", style: { "--accent": payload.focus.accent } },
            h("span", { class: "dot" }),
            h("span", {}, h("strong", {}, `${payload.focus.category_label}. `), payload.focus.line)
          )
        : null,
      actions({ payload, demo })
    )
  );

  const ringSection = h(
    "section",
    { class: "section" },
    h(
      "div",
      { class: "section-head" },
      h("h2", { class: "section-title" }, "The four rings"),
      h("p", { class: "section-note" }, "Each one caps at 100%, so one strong area can never hide a neglected one.")
    ),
    legend(payload.legend, { focus: payload.focus?.category })
  );

  const weeklySection = h(
    "section",
    { class: "section" },
    h(
      "div",
      { class: "section-head" },
      h("h2", { class: "section-title" }, "The week in progress"),
      h("p", { class: "section-note" }, "Weekly fields show progress toward a target, not a daily zero.")
    ),
    weeklyCards(payload.weekly)
  );

  const stripSection = strip.length
    ? h(
        "section",
        { class: "section" },
        h(
          "div",
          { class: "section-head" },
          h("h2", { class: "section-title" }, "The last fortnight"),
          h("p", { class: "section-note" }, "Tap a day for its full sheet.")
        ),
        h(
          "div",
          { class: "strip" },
          strip.map((day) =>
            h(
              "button",
              {
                class: "day-cell",
                "data-today": day.day === payload.day ? "true" : "false",
                "data-empty": day.total == null ? "true" : "false",
                onclick: () => openDay(day.day),
                title: `${longDay(day.day)} — ${points(day.total)}`,
              },
              microRings(day.categories),
              h("span", { class: "day-cell-label num" }, day.day.slice(8))
            )
          )
        )
      )
    : null;

  return h("div", {}, hero, ringSection, weeklySection, stripSection);
}

function actions({ payload, demo }) {
  if (demo) {
    return h(
      "div",
      { class: "hero-actions" },
      h("a", { class: "btn btn--primary", href: "/log" }, "Try the logging flow"),
      h("a", { class: "btn btn--quiet", href: "/demo" }, "How the story is built")
    );
  }
  if (!payload.logged) {
    return h(
      "div",
      { class: "hero-actions" },
      h("a", { class: "btn btn--primary", href: "/log" }, "Log today"),
      h("a", { class: "btn btn--quiet", href: "/calendar" }, "Browse the calendar")
    );
  }
  return h(
    "div",
    { class: "hero-actions" },
    h("a", { class: "btn btn--quiet", href: "/log" }, "Adjust today"),
    h("a", { class: "btn btn--quiet", href: "/trends" }, "See the trends")
  );
}

export function animateScore(node, payload) {
  if (payload?.score?.total != null) countUp(node, payload.score.total * 100, { duration: 900 });
}
