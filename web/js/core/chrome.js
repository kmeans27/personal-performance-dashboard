/* Page chrome: the top bar, the footer and the one toast. */

import { h, s, mount } from "./dom.js";

export const NAV = [
  { href: "/", label: "Today", key: "today" },
  { href: "/log", label: "Log", key: "log" },
  { href: "/calendar", label: "Calendar", key: "calendar" },
  { href: "/trends", label: "Trends", key: "trends" },
  { href: "/insights", label: "Insights", key: "insights" },
  { href: "/demo", label: "Demo", key: "demo" },
  { href: "/settings", label: "Settings", key: "settings" },
];

/** Three arcs, drawn from the product itself rather than a metaphor. */
export function brandMark(size = 18) {
  const radii = [7.6, 5.1, 2.6];
  const accents = ["var(--body)", "var(--mind)", "var(--attention)"];
  const centre = size / 2;
  return s(
    "svg",
    { class: "brand-mark", viewBox: `0 0 ${size} ${size}`, "aria-hidden": "true", width: size, height: size },
    radii.map((radius) => {
      const circumference = 2 * Math.PI * radius;
      return s("circle", {
        cx: centre,
        cy: centre,
        r: radius,
        fill: "none",
        stroke: accents[radii.indexOf(radius)],
        "stroke-width": 1.6,
        "stroke-linecap": "round",
        "stroke-dasharray": `${circumference * 0.72} ${circumference}`,
        transform: `rotate(-90 ${centre} ${centre})`,
        opacity: 0.9,
      });
    })
  );
}

export function mountChrome({ active } = {}) {
  const topbar = h(
    "header",
    { class: "topbar" },
    h("a", { class: "brand", href: "/" }, brandMark(), h("span", {}, "Pulse")),
    h(
      "nav",
      { class: "tabs", "aria-label": "Sections" },
      NAV.map((item) =>
        h(
          "a",
          {
            class: "tab",
            href: item.href,
            "aria-current": active === item.key ? "page" : null,
          },
          item.label
        )
      )
    )
  );
  document.body.prepend(topbar);

  const page = document.querySelector(".page");
  if (page) {
    page.append(
      h(
        "footer",
        { class: "footnote" },
        h("span", {}, "Pulse · self-hosted · your data stays in this folder"),
        h("span", { class: "num" }, "v2.1.2")
      )
    );
  }
  return { topbar, page };
}

let toastNode = null;
let toastTimer = null;

export function toast(message, accent = "overall") {
  if (!toastNode) {
    toastNode = h("div", { class: "toast", role: "status", "aria-live": "polite" });
    document.body.append(toastNode);
  }
  toastNode.dataset.accent = accent;
  toastNode.textContent = message;
  mount(toastNode, message);
  toastNode.dataset.show = "true";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastNode.dataset.show = "false";
  }, 2400);
}

export function errorPanel(message, onRetry) {
  return h(
    "div",
    { class: "empty" },
    h("strong", {}, "That did not load"),
    h("p", {}, message),
    onRetry ? h("button", { class: "btn btn--quiet", onclick: onRetry }, "Try again") : null
  );
}

export function loadingBlock(rows = [220, 120, 120]) {
  return h(
    "div",
    { class: "loading" },
    rows.map((height) => h("div", { class: "skeleton", style: { height: `${height}px` } }))
  );
}
