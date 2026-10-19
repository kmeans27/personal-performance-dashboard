/* Page entry: trends. */

import { mountChrome } from "../core/chrome.js";
import { renderTrends } from "../views/trends.js";

mountChrome({ active: "trends" });
renderTrends(document.querySelector("#app"));
