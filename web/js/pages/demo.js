/* Page entry: demo. */

import { mountChrome, errorPanel } from "../core/chrome.js";
import { renderDemo } from "../views/demo.js";
import { mount } from "../core/dom.js";

const app = document.querySelector("#app");
mountChrome({ active: "demo" });

async function load() {
  try {
    await renderDemo(app);
  } catch (error) {
    mount(app, errorPanel(error.message, load));
  }
}

load();
