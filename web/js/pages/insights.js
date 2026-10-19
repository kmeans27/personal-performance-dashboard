/* Page entry: insights. */

import { mountChrome } from "../core/chrome.js";
import { renderInsights } from "../views/insights.js";

mountChrome({ active: "insights" });
renderInsights(document.querySelector("#app"));
