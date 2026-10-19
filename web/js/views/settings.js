/* Settings: the few names and targets that belong to the person. */

import { h, mount } from "../core/dom.js";
import { api } from "../core/api.js";
import { pageHeader, section } from "../components/section.js";
import { toast, loadingBlock } from "../core/chrome.js";
import { longDay } from "../core/format.js";

export async function renderSettings(app) {
  const body = h("div");
  mount(
    app,
    h(
      "div",
      {},
      pageHeader({
        title: "Settings",
        note: "A small surface. Everything else the dashboard works out for itself.",
      }),
      body
    )
  );
  mount(body, loadingBlock([220, 160]));

  const [settings, stats] = await Promise.all([api.settings(), api.stats()]);

  const fields = [
    {
      key: "avoid_habit_name",
      label: "The habit you are avoiding",
      hint: "Shown in the logging flow and on the day sheet. It stays on this machine.",
      type: "text",
      value: settings.avoid_habit_name ?? "",
    },
    {
      key: "gym_target",
      label: "Gym sessions per week",
      hint: "How many sessions close the Body ring. Two or three is the usual range.",
      type: "number",
      step: 0.5,
      min: 1,
      max: 7,
      value: settings.gym_target ?? 2.5,
    },
    {
      key: "weight_goal",
      label: "Weight goal (kg)",
      hint: "Optional. Tracked as a 7-day average and never scored.",
      type: "number",
      step: 0.1,
      value: settings.weight_goal ?? "",
    },
  ];

  const inputs = new Map();
  const form = h(
    "form",
    {
      class: "stack",
      style: { gap: "var(--s-5)", "max-width": "520px" },
      onsubmit: (event) => {
        event.preventDefault();
        save();
      },
    },
    fields.map((field) => {
      const input = h("input", {
        class: "text-input",
        type: field.type,
        value: field.value,
        step: field.step,
        min: field.min,
        max: field.max,
        id: `field-${field.key}`,
      });
      inputs.set(field.key, { input, field });
      return h(
        "label",
        { class: "stack", style: { gap: "var(--s-2)" } },
        h("span", { class: "eyebrow" }, field.label),
        input,
        h("span", { class: "step-help" }, field.hint)
      );
    }),
    h("button", { class: "btn btn--primary", type: "submit" }, "Save")
  );

  async function save() {
    const patch = {};
    for (const [key, { input, field }] of inputs) {
      const raw = input.value.trim();
      if (field.type === "number") {
        patch[key] = raw === "" ? null : Number(raw);
      } else {
        patch[key] = raw;
      }
    }
    try {
      await api.saveSettings(patch);
      toast("Saved");
    } catch (error) {
      toast(`Not saved: ${error.message}`, "attention");
    }
  }

  const snippet = `curl -X POST http://localhost:8765/api/import \\
  -H 'content-type: application/json' \\
  -d '{"days":[{"day":"2026-10-18","values":{"steps":9412,"sleep_hours":7.5},"source":"apple-health"}]}'`;

  mount(
    body,
    section("Yours to name", null, form),
    section(
      "What can be automated",
      "Anything that can post JSON can feed the dashboard.",
      h(
        "div",
        { class: "card" },
        h(
          "p",
          { class: "section-note", style: { "margin-bottom": "var(--s-4)" } },
          "Sleep, steps, screen time and pickups are marked as auto-import fields. Log them by hand on any day the phone did not."
        ),
        h("pre", { class: "text-input", style: { overflow: "auto", "font-size": "var(--fs-xs)", "line-height": 1.6 } }, snippet)
      )
    ),
    section(
      "This machine",
      null,
      h(
        "div",
        { class: "stat-row" },
        h("div", { class: "stat" }, h("p", { class: "stat-label" }, "Days logged"), h("p", { class: "stat-value" }, String(stats.days ?? 0))),
        h(
          "div",
          { class: "stat" },
          h("p", { class: "stat-label" }, "First entry"),
          h("p", { class: "stat-value", style: { "font-size": "var(--fs-md)" } }, stats.first_day ? longDay(stats.first_day) : "—")
        ),
        h(
          "div",
          { class: "stat" },
          h("p", { class: "stat-label" }, "Latest entry"),
          h("p", { class: "stat-value", style: { "font-size": "var(--fs-md)" } }, stats.last_day ? longDay(stats.last_day) : "—")
        ),
        h(
          "div",
          { class: "stat" },
          h("p", { class: "stat-label" }, "Where it lives"),
          h("p", { class: "stat-value", style: { "font-size": "var(--fs-md)" } }, ".data/pulse.db")
        )
      )
    )
  );

  return { settings };
}
