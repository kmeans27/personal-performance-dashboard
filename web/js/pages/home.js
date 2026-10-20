/* Page entry: the board. Today, every field, one screen. */

import { mountChrome, errorPanel, loadingBlock } from "../core/chrome.js";
import { api } from "../core/api.js";
import { catalogue } from "../core/catalogue.js";
import { boardView } from "../views/board.js";
import { mount } from "../core/dom.js";

const app = document.querySelector("#app");
mountChrome({ active: "today" });
document.body.dataset.board = "true";

async function load() {
  mount(app, loadingBlock([320, 200, 200]));
  try {
    const [schema, payload] = await Promise.all([catalogue(), api.today()]);
    mount(app, boardView({ payload, schema }).el);
  } catch (error) {
    mount(app, errorPanel(error.message, load));
  }
}

load();
