/* Page entry: the board. One screen, every field, today. */

import { mountChrome, errorPanel, loadingBlock } from "../core/chrome.js";
import { api } from "../core/api.js";
import { catalogue } from "../core/catalogue.js";
import { boardView } from "../views/board.js";
import { buildSuggestions } from "../views/log.js";
import { today } from "../core/format.js";
import { mount } from "../core/dom.js";

const app = document.querySelector("#app");
mountChrome({ active: "today" });
document.body.dataset.board = "true";

async function load() {
  mount(app, loadingBlock([320, 200, 200]));
  try {
    const [schema, payload, prefill] = await Promise.all([
      catalogue(),
      api.today(),
      api.prefill(today()),
    ]);
    mount(app, boardView({
      payload,
      schema,
      suggestion: buildSuggestions(schema, prefill),
    }).el);
  } catch (error) {
    mount(app, errorPanel(error.message, load));
  }
}

load();
