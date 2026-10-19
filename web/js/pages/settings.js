/* Page entry: settings. */

import { mountChrome, errorPanel } from "../core/chrome.js";
import { renderSettings } from "../views/settings.js";
import { mount } from "../core/dom.js";

const app = document.querySelector("#app");
mountChrome({ active: "settings" });

async function load() {
  try {
    await renderSettings(app);
  } catch (error) {
    mount(app, errorPanel(error.message, load));
  }
}

load();
