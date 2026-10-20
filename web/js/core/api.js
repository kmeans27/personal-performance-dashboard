/* The only place that talks to the server. */

async function request(base, path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    headers: { "content-type": "application/json" },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const payload = await response.json();
      if (payload?.detail) detail = payload.detail;
    } catch {
      /* keep the status line */
    }
    throw new Error(detail);
  }
  return response.status === 204 ? null : response.json();
}

export function createApi(base = "/api") {
  return {
    base,
    schema: () => request(base, "/schema"),
    settings: () => request(base, "/settings"),
    saveSettings: (patch) => request(base, "/settings", { method: "PATCH", body: patch }),
    stats: () => request(base, "/stats"),
    sources: () => request(base, "/sources"),
    today: () => request(base, "/today"),
    day: (day, { insight = false } = {}) => request(base, `/day/${day}${insight ? "?insight=true" : ""}`),
    saveDay: (day, values, source = "manual") =>
      request(base, `/day/${day}`, { method: "PUT", body: { values, source } }),
    prefill: (day) => request(base, `/prefill?day=${day}`),
    range: (days = 90) => request(base, `/range?days=${days}`),
    rangeBetween: (start, end) => request(base, `/range?start=${start}&end=${end}`),
    trends: (days = 30) => request(base, `/trends?days=${days}`),
    insights: (days = 90) => request(base, `/insights?days=${days}`),
  };
}

export function createDemoApi(base = "/api/demo") {
  return {
    base,
    summary: () => request(base, "/summary"),
    range: (days = 90) => request(base, `/range?days=${days}`),
    trends: (days = 30) => request(base, `/trends?days=${days}`),
    insights: (days = 90) => request(base, `/insights?days=${days}`),
    day: (day) => request(base, `/day/${day}`),
  };
}

export const api = createApi();
export const demoApi = createDemoApi();
