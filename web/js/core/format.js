/* Dates, numbers and field values, phrased the way a person would say them. */

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function parseDay(day) {
  const [y, m, d] = String(day).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toDay(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function today() {
  return toDay(new Date());
}

export function addDays(day, amount) {
  const date = parseDay(day);
  date.setDate(date.getDate() + amount);
  return toDay(date);
}

export function longDay(day) {
  const date = parseDay(day);
  return `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function shortDay(day) {
  const date = parseDay(day);
  return `${DAYS_SHORT[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)}`;
}

export function isToday(day) {
  return day === today();
}

export function relativeDay(day) {
  const diff = Math.round((parseDay(today()) - parseDay(day)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff === -1) return "Tomorrow";
  if (diff > 1 && diff < 7) return `${diff} days ago`;
  return shortDay(day);
}

/** A 0..1 score as the whole number people actually read. */
export function points(score) {
  if (score == null) return "—";
  return String(Math.round(score * 100));
}

export function round(value, digits = 0) {
  if (value == null) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function compactNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  if (Math.abs(number) >= 10000) return `${round(number / 1000, 1)}k`;
  return String(round(number, number % 1 === 0 ? 0 : 1));
}

export function clock(value) {
  if (typeof value !== "string" || !value.includes(":")) return null;
  const [hours, minutes] = value.split(":");
  return `${hours}:${minutes}`;
}

export function signedPercent(value) {
  const rounded = Math.round(value);
  if (rounded === 0) return "0%";
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

/** One field value, written the way it should read on screen. */
export function fieldValue(metric, raw) {
  if (raw == null || raw === "") return null;
  switch (metric.input) {
    case "toggle":
      return raw ? "Yes" : "No";
    case "time":
      return clock(raw);
    case "text":
      return String(raw);
    case "scale": {
      const index = Math.round(Number(raw)) - 1;
      return metric.labels?.[index] ? `${metric.labels[index]} (${raw})` : String(raw);
    }
    case "counter":
      if (metric.unit) {
        const count = Number(raw);
        return count === 1 ? `1 ${metric.unit}` : `${compactNumber(count)} ${metric.unit}`;
      }
      return compactNumber(raw);
    default: {
      const number = Number(raw);
      if (!Number.isFinite(number)) return String(raw);
      const digits = metric.step && metric.step < 1 ? (metric.step < 0.11 ? 1 : 2) : 0;
      const text = round(number, digits);
      if (!metric.unit) return String(text);
      if (metric.unit === "steps") return `${compactNumber(text)} steps`;
      return `${text}${metric.unit === "min" ? " min" : ` ${metric.unit}`}`;
    }
  }
}
