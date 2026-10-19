/* One widget per field type. Each returns { el, value(), focus() }.
   Answering is a single tap wherever the data allows it. */

import { h } from "../core/dom.js";
import { round } from "../core/format.js";
import { haptic } from "../core/motion.js";

const TOGGLE_WORDS = {
  avoid_habit: ["Stayed clean", "Slipped"],
  creatine: ["Taken", "Not today"],
  default: ["Yes", "No"],
};

function digitsFor(metric) {
  if (!metric.step || metric.step >= 1) return 0;
  return metric.step < 0.11 ? 1 : 2;
}

export function displayNumber(metric, value) {
  if (value == null) return "—";
  const digits = digitsFor(metric);
  const number = round(Number(value), digits);
  return metric.id === "steps" ? Number(number).toLocaleString("en-US") : String(number);
}

export function presetLabel(metric, preset) {
  if (metric.id === "deep_blocks") return `${preset} block${preset > 1 ? "s" : ""}`;
  if (metric.id === "connect") return `${preset} ${preset > 1 ? "people" : "person"}`;
  if (metric.id === "gym") return `1 session`;
  if (metric.unit === "h") return `${preset} h`;
  if (metric.unit === "min") return `${preset} min`;
  if (metric.unit === "steps") return Number(preset).toLocaleString("en-US");
  return String(preset);
}

function presetRow(metric, onPick) {
  if (!metric.presets?.length) return null;
  return h(
    "div",
    { class: "preset-row" },
    metric.presets.map((preset) =>
      h(
        "button",
        {
          type: "button",
          class: "preset",
          onclick: () => {
            haptic(10);
            onPick(Number(preset));
          },
        },
        presetLabel(metric, preset)
      )
    )
  );
}

/** Slider for anything with a sensible range. */
export function numberWidget(metric, { value, onCommit }) {
  let current = value;
  let touched = value != null;

  const readout = h(
    "div",
    { class: "readout", "data-empty": touched ? "false" : "true" },
    h("strong", { class: "num" }, displayNumber(metric, value)),
    metric.unit ? h("span", {}, metric.unit === "steps" ? "steps" : metric.unit) : null
  );

  const slider = h("input", {
    class: "slider",
    type: "range",
    min: metric.min ?? 0,
    max: metric.max ?? 10,
    step: metric.step || 1,
    value: value ?? ((metric.min ?? 0) + (metric.max ?? 10)) / 2,
    "aria-label": metric.label,
    oninput: (event) => {
      touched = true;
      current = Number(event.target.value);
      readout.dataset.empty = "false";
      readout.firstChild.textContent = displayNumber(metric, current);
    },
    onchange: () => haptic(6),
  });

  return {
    el: h(
      "div",
      { class: "stack", style: { gap: "var(--s-4)" } },
      readout,
      slider,
      presetRow(metric, (preset) => commit(preset))
    ),
    value: () => (touched ? current : null),
    setValue: (next) => {
      touched = next != null;
      current = next;
      readout.firstChild.textContent = displayNumber(metric, next);
      readout.dataset.empty = touched ? "false" : "true";
      if (next != null) slider.value = next;
    },
    focus: () => {},
    commit,
  };

  function commit(preset) {
    if (preset != null) {
      current = preset;
      touched = true;
      slider.value = preset;
      readout.firstChild.textContent = displayNumber(metric, current);
      readout.dataset.empty = "false";
    }
    onCommit(touched ? current : null);
  }
}

/** Tap counter for things you accumulate through the day. */
export function counterWidget(metric, { value, onCommit }) {
  let current = Number(value ?? 0);
  let touched = value != null;

  const readout = h(
    "div",
    { class: "readout", "data-empty": touched ? "false" : "true" },
    h("strong", { class: "num" }, touched ? displayNumber(metric, current) : "—"),
    metric.unit ? h("span", {}, metric.unit === "steps" ? "steps" : metric.unit) : null
  );

  const plus = h(
    "button",
    {
      type: "button",
      class: "counter-plus",
      "aria-label": `Add one ${metric.label}`,
      onclick: () => {
        current = Math.min(current + 1, metric.max ?? 99);
        touched = true;
        haptic(12);
        readout.dataset.empty = "false";
        readout.firstChild.textContent = displayNumber(metric, current);
        plus.dataset.tapped = "true";
        setTimeout(() => (plus.dataset.tapped = "false"), 140);
      },
    },
    "+"
  );

  const minus = h(
    "button",
    {
      type: "button",
      class: "counter-minus",
      "aria-label": "One less",
      onclick: () => {
        current = Math.max(current - 1, metric.min ?? 0);
        touched = true;
        readout.dataset.empty = "false";
        readout.firstChild.textContent = displayNumber(metric, current);
      },
    },
    "−"
  );

  return {
    el: h(
      "div",
      { class: "stack", style: { gap: "var(--s-4)" } },
      h("div", { class: "counter" }, plus, readout, minus),
      presetRow(metric, (preset) => onCommit(preset))
    ),
    value: () => (touched ? current : null),
    focus: () => plus.focus({ preventScroll: true }),
    commit: () => onCommit(touched ? current : null),
  };
}

/** Two big answers. One tap moves on. */
export function toggleWidget(metric, { value, onCommit }) {
  const [yesWord, noWord] = TOGGLE_WORDS[metric.id] || TOGGLE_WORDS.default;
  let current = value;

  const build = (answer, word) =>
    h(
      "button",
      {
        type: "button",
        class: "choice",
        "data-selected": value === answer ? "true" : "false",
        onclick: () => {
          current = answer;
          haptic(10);
          onCommit(answer);
        },
      },
      word
    );

  return {
    el: h("div", { class: "choice-row" }, build(true, yesWord), build(false, noWord)),
    value: () => current,
    focus: () => {},
    commit: () => onCommit(current),
  };
}

/** Five bars, one felt answer. */
export function scaleWidget(metric, { value, onCommit }) {
  let current = value ?? null;
  const options = [];

  const bars = [];
  for (let step = metric.min ?? 1; step <= (metric.max ?? 5); step += 1) {
    const bar = h("button", {
      type: "button",
      class: "scale-bar",
      style: { height: `${34 + (step - (metric.min ?? 1)) * 16}px` },
      "aria-label": `${metric.label} ${step}`,
      onclick: () => {
        current = step;
        options.forEach((option) => (option.dataset.selected = option.dataset.step === String(step) ? "true" : "false"));
        haptic(10);
        onCommit(step);
      },
    });
    const option = h(
      "div",
      {
        class: "scale-option",
        "data-step": step,
        "data-selected": value === step ? "true" : "false",
      },
      bar,
      h("span", { class: "scale-label" }, metric.labels?.[step - (metric.min ?? 1)] ?? String(step))
    );
    options.push(option);
    bars.push(option);
  }

  return {
    el: h("div", { class: "scale-row" }, bars),
    value: () => current,
    focus: () => {},
    commit: () => onCommit(current),
  };
}

/** A clock field. */
export function timeWidget(metric, { value, onCommit }) {
  const input = h("input", {
    class: "time-input",
    type: "time",
    value: value ?? "",
    "aria-label": metric.label,
  });
  return {
    el: input,
    value: () => input.value || null,
    focus: () => input.focus({ preventScroll: true }),
    commit: () => onCommit(input.value || null),
  };
}

/** Free text, used for the "what did you learn" follow-up. */
export function textWidget(metric, { value, onCommit }) {
  const input = h("textarea", {
    class: "text-input",
    rows: 3,
    placeholder: "One line is enough.",
    "aria-label": metric.label,
  });
  input.value = value ?? "";
  const save = () => onCommit(input.value.trim() || null);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      save();
    }
  });
  return {
    el: input,
    value: () => input.value.trim() || null,
    focus: () => input.focus({ preventScroll: true }),
    commit: save,
  };
}

export function buildWidget(metric, options) {
  switch (metric.input) {
    case "toggle":
      return toggleWidget(metric, options);
    case "scale":
      return scaleWidget(metric, options);
    case "counter":
      return counterWidget(metric, options);
    case "time":
      return timeWidget(metric, options);
    case "text":
      return textWidget(metric, options);
    default:
      return numberWidget(metric, options);
  }
}
