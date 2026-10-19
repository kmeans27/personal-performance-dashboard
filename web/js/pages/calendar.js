/* Page entry: calendar. */

import { mountChrome, errorPanel, loadingBlock } from "../core/chrome.js";
import { renderCalendar } from "../views/calendar.js";
import { mount } from "../core/dom.js";

const app = document.querySelector("#app");
mountChrome({ active: "calendar" });

async function load() {
  mount(app, loadingBlock([60, 320]));
  try {
    await renderCalendar(app);
  } catch (error) {
    mount(app, errorPanel(error.message, load));
  }
}

load();
