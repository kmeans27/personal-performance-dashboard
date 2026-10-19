/* Trends: this window against the previous one, in sentences. */

import { h, mount } from "../core/dom.js";
import { api, demoApi } from "../core/api.js";
import { pageHeader, section, segmented, empty } from "../components/section.js";
import { trendList, ringTrends, signalTrends } from "../components/trends.js";
import { loadingBlock } from "../core/chrome.js";

export async function renderTrends(app, { source = "api", compact = false, into = null } = {}) {
  const client = source === "demo" ? demoApi : api;
  const state = { window: 30 };

  const body = h("div");

  if (!into) {
    mount(
      app,
      h(
        "div",
        {},
        pageHeader({
          title: "Trends",
          note: "Plain sentences, with the shape of the data behind them. This window against the one before it.",
          actions: segmented(
            [
              { value: 30, label: "30 days" },
              { value: 90, label: "90 days" },
            ],
            state.window,
            (value) => {
              state.window = value;
              load();
            }
          ),
        }),
        body
      )
    );
  } else {
    mount(into, body);
  }

  async function load() {
    if (!into) {
      // re-render the switcher state
      const tabs = app.querySelectorAll(".tab");
      tabs.forEach((tab) => {
        tab.setAttribute("aria-current", tab.textContent.includes(String(state.window)) ? "page" : "false");
      });
    }
    mount(body, loadingBlock([120, 120]));
    try {
      const data = await client.trends(state.window);
      const rings = ringTrends(data.trends);
      const signals = signalTrends(data.trends);
      if (!data.trends.length) {
        mount(
          body,
          empty(
            "Not enough days yet",
            "Trends need a fortnight on each side of the line. Log a few more days and this page fills itself."
          )
        );
        return;
      }
      const blocks = [
        rings.length ? section("The four rings", `Compared with the ${state.window} days before.`, trendList(rings)) : null,
        signals.length
          ? section("The signals", "The fields that move the rings most.", trendList(compact ? signals.slice(0, 4) : signals))
          : null,
      ];
      mount(body, blocks.filter(Boolean));
    } catch (error) {
      mount(body, empty("Trends unavailable", error.message));
    }
  }

  await load();
  return state;
}
