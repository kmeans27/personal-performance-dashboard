/* Insights: what moves mood and energy, with the evidence shown. */

import { h, mount } from "../core/dom.js";
import { api, demoApi } from "../core/api.js";
import { pageHeader, section } from "../components/section.js";
import { insightList, insightsEmpty } from "../components/insights.js";
import { loadingBlock } from "../core/chrome.js";

export async function renderInsights(app, { source = "api", compact = false, into = null } = {}) {
  const client = source === "demo" ? demoApi : api;
  const body = h("div");

  const explainer = h(
    "p",
    { class: "section-note", style: { "max-width": "64ch" } },
    "Every line here is a correlation in your own data, never a cause. The dashboard only speaks up when a pattern has at least seven days on both sides of it and moves the average by more than a third of a point."
  );

  if (!into) {
    mount(
      app,
      h(
        "div",
        {},
        pageHeader({
          title: "Insights",
          note: "What moves your mood and energy, once there is enough data to say anything at all.",
        }),
        body
      )
    );
  } else {
    mount(into, body);
  }

  mount(body, loadingBlock([140]));
  try {
    const data = await client.insights(90);
    const blocks = [];
    if (!into) blocks.push(section("How to read this", null, explainer));
    const list = compact ? data.insights.slice(0, 4) : data.insights;
    blocks.push(
      list.length
        ? section(
            "What the days say",
            `${data.days_logged} days logged.`,
            insightList(list)
          )
        : insightsEmpty({ ready: data.ready, daysLogged: data.days_logged })
    );
    mount(body, blocks);
  } catch (error) {
    mount(body, insightsEmpty({ ready: false, daysLogged: 0 }));
  }

  return {};
}
