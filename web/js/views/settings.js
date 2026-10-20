/* Settings: the few names and targets that belong to the person, and the full
   instructions for the two sources that can post data on their own. */

import { h, mount } from "../core/dom.js";
import { api } from "../core/api.js";
import { pageHeader, section } from "../components/section.js";
import { toast, loadingBlock } from "../core/chrome.js";
import { longDay } from "../core/format.js";

function syncedClock(iso) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat([], {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

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

  const [settings, stats, sourceData] = await Promise.all([
    api.settings(),
    api.stats(),
    api.sources(),
  ]);
  const sources = sourceData.sources || [];

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

  /* ---- sources: the honest version of "connect an app" ------------------ */

  const snippet = `curl -X POST http://localhost:8765/api/import \\
  -H 'content-type: application/json' \\
  -d '{"days":[{"day":"2026-10-18","values":{"steps":9412,"sleep_hours":7.5},"source":"apple-health"}]}'`;

  function sourceGuide(source, steps, note) {
    const status = source?.recent
      ? `Last import ${syncedClock(source.received_at)}`
      : source?.received_at
        ? `Last import ${longDay(source.received_at.slice(0, 10))} — more than 36 h ago`
        : "No import yet";
    return h(
      "div",
      { class: "source-guide", "data-synced": String(Boolean(source?.recent)) },
      h(
        "div",
        { class: "source-guide-head" },
        h("h3", {}, source?.label || ""),
        h("span", { class: "source-status num" }, status)
      ),
      h("p", { class: "section-note" }, note),
      h(
        "ol",
        { class: "source-steps" },
        steps.map((step) => h("li", {}, step))
      )
    );
  }

  const setup = h(
    "div",
    { class: "source-setup-grid" },
    sourceGuide(
      sources.find((entry) => entry.id === "apple-health"),
      [
        "In Shortcuts, make a personal automation (or a shortcut you run yourself) at a time you choose.",
        "Add Get Health Sample for Steps and Sleep Analysis, grouped by day.",
        "Add Get Contents of URL: POST to http://<this-machine>:8765/api/import with the JSON below.",
        "Run it once. Today becomes a quiet “synced HH:MM”; the fields stay editable by hand.",
      ],
      "Apple Health does not connect with one tap. An iOS Shortcut is the supported path, and it posts to the same import endpoint anything else would."
    ),
    sourceGuide(
      sources.find((entry) => entry.id === "screen-time"),
      [
        "Apple has no official Screen Time export. Use a Shortcut from a third-party app that exports it, or type the two numbers in.",
        "Post screen_hours and pickups with source “screen-time” to the same endpoint.",
        "The card on Today takes either: the import fills it, or you tap the track and save it.",
      ],
      "Screen Time is the one number the phone will not hand over on its own. The fields stay editable by hand, so the card never depends on an app."
    )
  );

  const showAgain = h(
    "button",
    {
      type: "button",
      class: "btn btn--quiet",
      onclick: async () => {
        try {
          await api.saveSettings({ sources_dismissed: false });
          showAgain.remove();
          toast("The Sources card is back on Today");
        } catch (error) {
          toast(`Not saved: ${error.message}`, "attention");
        }
      },
    },
    "Show the Sources card on Today again"
  );
  if (!settings.sources_dismissed) showAgain.remove();

  const sourcesSection = section(
    "Sources",
    "Two things can post themselves. Nothing here is required — every field still takes a tap.",
    h(
      "div",
      { class: "stack", style: { gap: "var(--s-5)" } },
      setup,
      h(
        "div",
        { class: "card" },
        h(
          "p",
          { class: "section-note", style: { "margin-bottom": "var(--s-4)" } },
          "Anything that can post JSON can feed the dashboard. The import merges into the day, so a later manual edit is never lost."
        ),
        h(
          "pre",
          { class: "text-input", style: { overflow: "auto", "font-size": "var(--fs-xs)", "line-height": 1.6 } },
          snippet
        )
      ),
      showAgain
    )
  );
  sourcesSection.id = "sources";

  mount(
    body,
    section("Yours to name", null, form),
    sourcesSection,
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

  if (location.hash === "#sources") {
    requestAnimationFrame(() => {
      document.getElementById("sources")?.scrollIntoView({ block: "start" });
    });
  }

  return { settings };
}
