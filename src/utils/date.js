import { CONFIG } from "../config";

const pad = (n) => String(n).padStart(2, "0");

/** Today's date as YYYY-MM-DD in the configured timezone. */
export function todayStr(tz = CONFIG.TIMEZONE, now = new Date()) {
  // 'en-CA' formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Current time as minutes since midnight in the configured timezone. */
export function nowMinutes(tz = CONFIG.TIMEZONE, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour").value) % 24;
  const m = Number(parts.find((p) => p.type === "minute").value);
  return h * 60 + m;
}

/** Parse YYYY-MM-DD into a UTC-midnight Date (no timezone drift). */
export function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDate(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function addDays(str, n) {
  const d = parseDate(str);
  d.setUTCDate(d.getUTCDate() + n);
  return formatDate(d);
}

/** Whole days from a to b (b - a). Negative if b is earlier. */
export function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000);
}

/** 0 = Sunday ... 6 = Saturday */
export function weekdayIndex(str) {
  return parseDate(str).getUTCDay();
}

/** Start of week containing `str`. weekStartsOn: 0 = Sun, 1 = Mon. */
export function startOfWeek(str, weekStartsOn = 1) {
  const diff = (weekdayIndex(str) - weekStartsOn + 7) % 7;
  return addDays(str, -diff);
}

export function startOfMonth(str) {
  return `${str.slice(0, 7)}-01`;
}

export function endOfMonth(str) {
  const d = parseDate(startOfMonth(str));
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return formatDate(d);
}

/** Inclusive list of dates from `from` to `to`. */
export function dateRange(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function formatLongDate(str) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(parseDate(str));
}

export function greeting(minutes = nowMinutes()) {
  if (minutes < 12 * 60) return "Good morning";
  if (minutes < 17 * 60) return "Good afternoon";
  return "Good evening";
}

/** Add whole months, clamping the day (Jan 31 + 1 month = Feb 28/29). Mirrors the server. */
export function addMonths(str, n) {
  const [y, m, d] = str.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return formatDate(new Date(Date.UTC(ny, nm, Math.min(d, last))));
}

export function formatShortDate(str) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(parseDate(str));
}

export function formatWeekdayShort(str) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    weekday: "short",
  }).format(parseDate(str));
}

export function formatMonthYear(str) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(parseDate(str));
}

export function formatMonthShort(month) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', month: 'short' })
    .format(new Date(Date.UTC(2000, month - 1, 1)));
}