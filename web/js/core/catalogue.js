/* The field catalogue, fetched once and reused by every view. */

import { api } from "./api.js";

let cached = null;

export async function catalogue() {
  if (!cached) {
    const [schema, settings] = await Promise.all([api.schema(), api.settings().catch(() => ({}))]);
    applySettings(schema, settings);
    schema.settings = settings;
    cached = schema;
  }
  return cached;
}

/** Some names belong to the person, not to us. */
function applySettings(schema, settings = {}) {
  if (!settings.avoid_habit_name) return;
  const metric = schema.metrics.find((entry) => entry.id === "avoid_habit");
  if (metric) metric.label = settings.avoid_habit_name;
}

export function metricMap(schema) {
  const map = new Map();
  for (const metric of schema.metrics) map.set(metric.id, metric);
  return map;
}

export function byCategory(schema) {
  const grouped = new Map(schema.categories.map((category) => [category.id, []]));
  for (const metric of schema.metrics) {
    if (metric.archived) continue;
    grouped.get(metric.category)?.push(metric);
  }
  return grouped;
}

export function categoryMap(schema) {
  return new Map(schema.categories.map((category) => [category.id, category]));
}

/** Metrics that belong in the logging flow, in catalogue order. */
export function flowMetrics(schema) {
  return schema.metrics.filter((metric) => !metric.archived);
}
