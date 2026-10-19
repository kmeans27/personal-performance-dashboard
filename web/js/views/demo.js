/* Demo: ninety days of believable data, patterns included. */

import { h, mount } from "../core/dom.js";
import { demoApi } from "../core/api.js";
import { dashboardView } from "./dashboard.js";
import { renderTrends } from "./trends.js";
import { renderInsights } from "./insights.js";
import { pageHeader, section } from "../components/section.js";
import { loadingBlock } from "../core/chrome.js";

export async function renderDemo(app) {
  mount(app, loadingBlock([320, 180, 180]));

  const [summary, range] = await Promise.all([demoApi.summary(), demoApi.range(90)]);
  const trendsHost = h("div");
  const insightsHost = h("div");

  mount(
    app,
    h(
      "div",
      {},
      pageHeader({
        title: "A dashboard that has already been lived in",
        note:
          "Ninety days of believable data: weekend dips, a three-week good streak, one rough week, and a slow drift upward. Nothing here is yours — it is what a full picture looks like.",
      }),
      h(
        "div",
        { class: "stat-row", style: { "margin-top": "var(--s-6)" } },
        h("div", { class: "stat" }, h("p", { class: "stat-label" }, "Days"), h("p", { class: "stat-value" }, "90")),
        h("div", { class: "stat" }, h("p", { class: "stat-label" }, "Story"), h("p", { class: "stat-value", style: { "font-size": "var(--fs-md)" } }, "Weekend dips, one rough week")),
        h("div", { class: "stat" }, h("p", { class: "stat-label" }, "Direction"), h("p", { class: "stat-value", style: { "font-size": "var(--fs-md)" } }, "Slowly up")),
        h("div", { class: "stat" }, h("p", { class: "stat-label" }, "Logging flow"), h("p", { class: "stat-value", style: { "font-size": "var(--fs-md)" } }, "Under 30 seconds"))
      ),
      h("div", { class: "section" }, dashboardView({ payload: summary, strip: range.days.slice(-14), demo: true })),
      trendsHost,
      insightsHost
    )
  );

  await Promise.all([
    renderTrends(app, { source: "demo", compact: true, into: trendsHost }),
    renderInsights(app, { source: "demo", compact: true, into: insightsHost }),
  ]);

  mount(
    insightsHost,
    insightsHost.firstChild,
    h(
      "div",
      { style: { "margin-top": "var(--s-5)" } },
      h(
        "p",
        { class: "section-note" },
        "The pattern is real in this dataset: sleep and deep work move mood, screen time moves it the other way. Labelled as correlation because that is all a dashboard can honestly claim."
      )
    )
  );

  return { summary };
}
