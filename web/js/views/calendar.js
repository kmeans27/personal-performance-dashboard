/* Calendar: every day a mini ring set, tap for the full sheet. */

import { h, mount } from "../core/dom.js";
import { microRings } from "../rings.js";
import { api } from "../core/api.js";
import { openDaySheet } from "../components/daySheet.js";
import { addDays, longDay, parseDay, points, toDay, today } from "../core/format.js";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export async function renderCalendar(app) {
  const state = { anchor: firstOfMonth(today()), days: new Map() };
  const grid = h("div", { class: "cal-grid" });
  const monthLabel = h("h1", { class: "cal-month" });
  const summary = h("dl", { class: "cal-summary" });

  const prev = h("button", { class: "cal-icon", "aria-label": "Previous month", onclick: () => shift(-1) }, "‹");
  const next = h("button", { class: "cal-icon", "aria-label": "Next month", onclick: () => shift(1) }, "›");

  mount(
    app,
    h(
      "section",
      { class: "stack", style: { gap: "var(--s-5)" } },
      h(
        "div",
        { class: "cal-head" },
        monthLabel,
        h(
          "div",
          { class: "cal-nav" },
          h("button", { class: "btn btn--quiet", onclick: () => go(today()) }, "Today"),
          prev,
          next
        )
      ),
      h(
        "div",
        { class: "cal-board" },
        h("div", { class: "cal-grid" }, WEEKDAYS.map((day) => h("span", { class: "cal-weekday" }, day))),
        grid
      ),
      summary
    )
  );

  function go(day) {
    state.anchor = firstOfMonth(day);
    load();
  }

  function shift(months) {
    const date = parseDay(state.anchor);
    date.setMonth(date.getMonth() + months);
    go(toDay(date));
  }

  async function load() {
    const first = firstOfMonth(state.anchor);
    const last = lastOfMonth(state.anchor);
    const gridStart = mondayOnOrBefore(first);
    const weeks = Math.ceil((dayOffset(gridStart, last) + 1) / 7);
    const gridEnd = addDays(gridStart, weeks * 7 - 1);
    monthLabel.textContent = "";
    monthLabel.append(
      MONTHS[parseDay(first).getMonth()],
      h("span", {}, String(parseDay(first).getFullYear()))
    );
    next.disabled = first >= firstOfMonth(today());
    prev.disabled = false;
    mount(grid, h("div", { class: "skeleton", style: { height: "260px", "grid-column": "1 / -1" } }));

    const data = await api.rangeBetween(gridStart, gridEnd > last ? gridEnd : last);
    state.days = new Map(data.days.map((day) => [day.day, day]));
    paint(gridStart, gridEnd);
    paintSummary(last);
  }

  function paint(gridStart, gridEnd) {
    const cells = [];
    const total = dayOffset(gridStart, gridEnd) + 1;
    for (let offset = 0; offset < total; offset += 1) {
      const day = addDays(gridStart, offset);
      const entry = state.days.get(day);
      const inside = day >= firstOfMonth(state.anchor) && day <= lastOfMonth(state.anchor);
      cells.push(
        h(
          "button",
          {
            class: "cal-day",
            "data-outside": inside ? "false" : "true",
            "data-today": day === today() ? "true" : "false",
            "data-future": day > today() ? "true" : "false",
            title: `${longDay(day)} — ${entry?.total != null ? points(entry.total) : "no entry"}`,
            onclick: () => openDaySheet(day),
          },
          microRings(entry?.categories ?? {}, { size: 44, stroke: 3 }),
          h("span", { class: "cal-date" }, String(Number(day.slice(8))))
        )
      );
    }
    mount(grid, cells);
  }

  function paintSummary(last) {
    const monthDays = [...state.days.values()].filter(
      (day) => day.day >= firstOfMonth(state.anchor) && day.day <= last && day.total != null
    );
    const average = monthDays.length
      ? monthDays.reduce((total, day) => total + day.total, 0) / monthDays.length
      : null;
    const best = monthDays.reduce((top, day) => (top == null || day.total > top.total ? day : top), null);
    const stat = (label, value) =>
      h("div", { class: "cal-stat" }, h("dt", {}, label), h("dd", {}, value));
    mount(
      summary,
      stat("Days logged", `${monthDays.length}`),
      stat("Average score", average == null ? "—" : points(average)),
      stat("Best day", best ? `${points(best.total)}` : "—"),
      h(
        "div",
        { class: "cal-stat" },
        h("dt", {}, "Best day was"),
        h("dd", { style: { "font-size": "var(--fs-md)" } }, best ? longDay(best.day) : "—")
      )
    );
  }

  await load();
  return state;
}

function firstOfMonth(day) {
  return `${day.slice(0, 7)}-01`;
}

function lastOfMonth(day) {
  const date = parseDay(firstOfMonth(day));
  date.setMonth(date.getMonth() + 1);
  date.setDate(0);
  return toDay(date);
}

function mondayOnOrBefore(day) {
  const date = parseDay(day);
  const weekday = (date.getDay() + 6) % 7; // 0 = Monday
  return addDays(day, -weekday);
}

function dayOffset(from, to) {
  return Math.round((parseDay(to) - parseDay(from)) / 86400000);
}
