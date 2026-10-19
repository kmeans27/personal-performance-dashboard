/* The logging flow: one field per screen, rings filling as you go. */

import { h, mount } from "../core/dom.js";
import { api } from "../core/api.js";
import { catalogue } from "../core/catalogue.js";
import { createRings } from "../rings.js";
import { buildWidget } from "../log/widgets.js";
import { haptic } from "../core/motion.js";
import { fieldValue, points, relativeDay, today } from "../core/format.js";
import { toast } from "../core/chrome.js";

const DEFAULT_SUGGESTIONS = { alcohol: 0, gym: 0, avoid_habit: true };

export async function renderLog(app, { day } = {}) {
  document.body.dataset.flow = "true";
  const params = new URLSearchParams(window.location.search);
  const targetDay = day || params.get("day") || today();

  const [schema, prefill] = await Promise.all([catalogue(), api.prefill(targetDay)]);

  const state = {
    schema,
    day: targetDay,
    values: { ...(prefill.today || {}) },
    suggestions: buildSuggestions(schema, prefill),
    steps: [],
    index: 0,
    payload: null,
    saving: Promise.resolve(),
    live: null,
    timer: null,
  };
  state.steps = buildSteps(schema, state.values);

  const liveRings = createRings({ centre: false, className: "rings rings--flow" });
  const progressBar = h("span");
  const count = h("span", { class: "flow-count" });
  const stage = h("section", { class: "flow-stage" });
  const shell = h(
    "section",
    { class: "flow" },
    h(
      "header",
      { class: "flow-top" },
      liveRings.el,
      h("div", { class: "flow-bar", role: "progressbar" }, progressBar),
      count,
      h("button", { class: "btn btn--quiet", onclick: finish }, "Done")
    ),
    stage
  );

  mount(app, shell);
  paint();
  document.addEventListener("keydown", onKey);

  if (prefill.has_today) {
    // Adjusting a day that already has entries: start from the rings as they are.
    api
      .day(targetDay)
      .then((payload) => {
        state.payload = payload;
        updateLive(payload);
      })
      .catch(() => {});
  }

  // ------------------------------------------------------------- rendering

  function paint(direction = "next") {
    const step = state.steps[state.index];
    if (!step) return renderClosing();
    const { metric, category } = step;
    const suggestion = state.suggestions.get(metric.id) || {};
    const current = state.values[metric.id] ?? suggestion.value;
    const accent = state.schema.categories.find((c) => c.id === category)?.accent;
    document.documentElement.style.setProperty("--accent", accent);
    document.documentElement.style.setProperty("--accent-dim", `color-mix(in srgb, ${accent} 16%, transparent)`);

    const widget = buildWidget(metric, {
      value: current,
      onCommit: (answer) => settleAnswer(metric, answer),
      onLive: (answer) => queueSave(metric, answer),
    });

    const question = h("h1", { class: "step-question" }, metric.prompt || `How about ${metric.label.toLowerCase()}?`);
    const context = suggestionLine(metric, suggestion);
    const help = metric.help && metric.help !== context ? h("p", { class: "step-help" }, metric.help) : null;

    const article = h(
      "article",
      { class: "step", "data-category": category, "data-entry": direction },
      h(
        "div",
        { class: "stack", style: { gap: "var(--s-3)" } },
        h("span", { class: "chip" }, categoryLabel(category)),
        metric.weekly ? h("span", { class: "chip chip--muted" }, "weekly field") : null,
        question,
        context ? h("p", { class: "step-context" }, context) : null
      ),
      widget.el,
      help,
      h(
        "div",
        { class: "step-actions" },
        h(
          "button",
          {
            class: "btn btn--quiet",
            onclick: () => go(-1),
            disabled: state.index === 0,
            "aria-label": "Previous field",
          },
          "Back"
        ),
        h("span", { class: "spacer" }),
        h("button", { class: "btn btn--quiet", onclick: () => go(1) }, "Skip"),
        h("button", { class: "btn btn--primary", onclick: () => widget.commit() }, "Continue")
      )
    );

    mount(stage, article);
    widget.focus?.();
    requestAnimationFrame(() => (article.dataset.entry = ""));
    progressBar.style.width = `${(state.index / state.steps.length) * 100}%`;
    count.textContent = `${state.index + 1} / ${state.steps.length}`;
  }

  function categoryLabel(id) {
    return state.schema.categories.find((c) => c.id === id)?.label ?? id;
  }

  function suggestionLine(metric, suggestion) {
    if (!suggestion.source) return "No suggestion yet — answer it or skip.";
    const text = fieldValue(metric, suggestion.value);
    const words = {
      today: "Prefilled from what you already logged.",
      yesterday: `Yesterday: ${text}`,
      average: `Your recent average: ${text}`,
      usual: `Defaults to ${text.toLowerCase()}.`,
    };
    return words[suggestion.source] || null;
  }

  // ---------------------------------------------------------------- answers

  async function settleAnswer(metric, answer) {
    haptic(12);
    state.values[metric.id] = answer;
    syncConditionalSteps(metric, answer);
    await save(metric.id, answer);
    go(1);
  }

  function queueSave(metric, answer) {
    clearTimeout(state.timer);
    state.values[metric.id] = answer;
    state.timer = setTimeout(() => save(metric.id, answer), 550);
  }

  function save(metricId, answer) {
    state.saving = state.saving
      .then(() => api.saveDay(state.day, { [metricId]: answer }))
      .then((payload) => {
        state.payload = payload;
        updateLive(payload);
      })
      .catch((error) => toast(`Not saved: ${error.message}`, "attention"));
    return state.saving;
  }

  function updateLive(payload) {
    liveRings.setScores(payload.score);
    if (payload.focus) {
      document.documentElement.style.setProperty("--accent", payload.focus.accent);
    }
  }

  function syncConditionalSteps(metric, answer) {
    if (metric.id !== "learned") return;
    const follow = state.steps.findIndex((step) => step.metric.id === "learned_what");
    const wanted = answer === true;
    if (wanted && follow === -1) {
      const metricList = state.schema.metrics.find((m) => m.id === "learned_what");
      state.steps.splice(state.index + 1, 0, { metric: metricList, category: "mind" });
    }
    if (!wanted && follow > -1) state.steps.splice(follow, 1);
  }

  function go(direction) {
    const next = state.index + direction;
    if (next < 0) return;
    if (next >= state.steps.length) return finish();
    state.index = next;
    paint(direction > 0 ? "next" : "back");
  }

  function onKey(event) {
    if (event.target.matches("input, textarea")) return;
    if (event.key === "Escape") return finish();
    if (event.key === "ArrowLeft") return go(-1);
    if (event.key === "ArrowRight" || event.key === "Enter") {
      event.preventDefault();
      stage.querySelector(".step .btn--primary")?.click();
      return;
    }
    const step = state.steps[state.index];
    if (!step) return;
    const key = event.key.toLowerCase();
    if (step.metric.input === "toggle" && (key === "y" || key === "n")) {
      stage.querySelectorAll(".choice")[key === "y" ? 0 : 1]?.click();
    } else if (step.metric.input === "scale" && /^[1-5]$/.test(event.key)) {
      [...stage.querySelectorAll(".scale-option")]
        .find((option) => option.dataset.step === event.key)
        ?.click();
    }
  }

  // ---------------------------------------------------------------- closing

  async function finish() {
    clearTimeout(state.timer);
    await state.saving;
    document.removeEventListener("keydown", onKey);
    document.body.dataset.flow = "false";
    let payload = state.payload;
    try {
      payload = await api.day(state.day, { insight: true });
    } catch {
      /* keep the last payload */
    }
    renderClosing(payload);
  }

  function renderClosing(payload) {
    const rings = createRings({ caption: relativeDay(state.day), className: "rings rings--mini" });
    rings.setScores(payload.score);
    requestAnimationFrame(() => rings.settleNow());

    const lead = h("p", { class: "lead" }, payload.closing);
    const scores = h(
      "div",
      { class: "closing-scores" },
      payload.legend.map((item) =>
        h(
          "span",
          { style: { "--accent": item.accent } },
          h("span", { class: "dot", style: { display: "inline-block", "margin-right": "6px" } }),
          `${item.label} `,
          h("b", {}, points(item.score))
        )
      )
    );

    const closing = h(
      "section",
      { class: "closing" },
      rings.el,
      lead,
      payload.insight ? h("p", { class: "step-help", style: { "max-width": "40ch" } }, payload.insight.sentence) : null,
      scores,
      h(
        "div",
        { class: "close-actions" },
        h("a", { class: "btn btn--primary", href: "/" }, "Back to today"),
        h("button", { class: "btn btn--quiet", onclick: () => restart() }, "Adjust an answer"),
        h("a", { class: "btn btn--quiet", href: "/calendar" }, "Calendar")
      )
    );
    document.documentElement.style.setProperty("--accent", "var(--overall)");
    mount(stage, closing);
    progressBar.style.width = "100%";
    count.textContent = "done";
  }

  function restart() {
    state.index = 0;
    document.addEventListener("keydown", onKey);
    paint("back");
  }

  return { state };
}

// ------------------------------------------------------------------ helpers

export function buildSteps(schema, values) {
  const byId = new Map(schema.metrics.map((metric) => [metric.id, metric]));
  const steps = [];
  for (const categoryId of schema.ring_order) {
    for (const metric of schema.metrics) {
      if (metric.category !== categoryId || metric.archived || metric.id === "learned_what") continue;
      steps.push({ metric, category: categoryId });
      if (metric.id === "learned" && values.learned) steps.push({ metric: byId.get("learned_what"), category: "mind" });
    }
  }
  return steps.filter((step) => step.metric);
}

export function buildSuggestions(schema, prefill) {
  const suggestions = new Map();
  const has = (bucket, id) => Object.prototype.hasOwnProperty.call(bucket || {}, id);
  for (const metric of schema.metrics) {
    if (metric.archived) continue;
    if (has(prefill.today, metric.id)) {
      suggestions.set(metric.id, { value: prefill.today[metric.id], source: "today" });
    } else if (has(prefill.yesterday, metric.id)) {
      suggestions.set(metric.id, { value: prefill.yesterday[metric.id], source: "yesterday" });
    } else if (has(prefill.averages, metric.id)) {
      suggestions.set(metric.id, { value: prefill.averages[metric.id], source: "average" });
    } else if (metric.id in DEFAULT_SUGGESTIONS) {
      suggestions.set(metric.id, { value: DEFAULT_SUGGESTIONS[metric.id], source: "usual" });
    } else {
      suggestions.set(metric.id, { value: null, source: null });
    }
  }
  return suggestions;
}
