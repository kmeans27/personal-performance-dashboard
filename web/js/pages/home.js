/* Page entry: Today. */

import { mountChrome, errorPanel, loadingBlock } from "../core/chrome.js";
import { api } from "../core/api.js";
import { dashboardView } from "../views/dashboard.js";
import { h, mount } from "../core/dom.js";

const app = document.querySelector("#app");
mountChrome({ active: "today" });

async function load() {
  mount(app, loadingBlock([320, 160, 160]));
  try {
    const [payload, recent] = await Promise.all([api.today(), api.range(14)]);
    mount(app, dashboardView({ payload, strip: recent.days }));
  } catch (error) {
    mount(app, errorPanel(error.message, load));
  }
}

load();
