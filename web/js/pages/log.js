/* Page entry: the logging flow. */

import { mountChrome, errorPanel } from "../core/chrome.js";
import { renderLog } from "../views/log.js";
import { h, mount } from "../core/dom.js";

const app = document.querySelector("#app");

async function start() {
  try {
    await renderLog(app);
  } catch (error) {
    mount(app, errorPanel(error.message, start));
  }
}

mountChrome({ active: "log" });
start();
