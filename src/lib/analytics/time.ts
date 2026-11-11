/**
 * Business dates use Asia/Kolkata. India has no daylight saving, so a fixed
 * +05:30 offset matches the timezone without a date library.
 * Range ends are exclusive.
 */

export const BUSINESS_TIMEZONE = "Asia/Kolkata";

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

export const ANALYTICS_PRESETS = [
  "today",
  "yesterday",
  "last_7_days",
  "last_30_days",
  "this_month",
  "last_month",
  "this_year",
  "custom",
] as const;

export type AnalyticsPreset = (typeof ANALYTICS_PRESETS)[number];

export const ANALYTICS_GRAINS = ["hour", "day", "week", "month"] as const;

export type AnalyticsGrain = (typeof ANALYTICS_GRAINS)[number];

export type ResolvedRange = {
  preset: AnalyticsPreset;
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
  label: string;
  previousLabel: string;
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function istParts(date: Date) {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
  };
}

/** Midnight at the start of an IST civil date. Month and day may overflow. */
export function istDate(year: number, month: number, day: number, hour = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, 0, 0, 0) - IST_OFFSET_MS);
}

export function startOfIstDay(date: Date) {
  const parts = istParts(date);
  return istDate(parts.year, parts.month, parts.day);
}

export function addIstDays(date: Date, days: number) {
  const parts = istParts(startOfIstDay(date));
  return istDate(parts.year, parts.month, parts.day + days);
}

export function startOfIstMonth(date: Date) {
  const parts = istParts(date);
  return istDate(parts.year, parts.month, 1);
}

export function addIstMonths(date: Date, months: number) {
  const parts = istParts(startOfIstMonth(date));
  return istDate(parts.year, parts.month + months, 1);
}

export function startOfIstYear(date: Date) {
  const parts = istParts(date);
  return istDate(parts.year, 1, 1);
}

export function formatIstDay(date: Date) {
  const parts = istParts(date);
  return `${parts.day} ${MONTHS[parts.month - 1]} ${parts.year}`;
}

export function formatRangeLabel(from: Date, toExclusive: Date) {
  const start = formatIstDay(from);
  const end = formatIstDay(new Date(toExclusive.getTime() - 1));
  return start === end ? start : `${start} – ${end}`;
}

export function parseIstDay(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = istDate(year, month, day);
  const parts = istParts(date);
  if (parts.year !== year || parts.month !== month || parts.day !== day) {
    return null;
  }
  return date;
}

export function defaultGrain(from: Date, to: Date): AnalyticsGrain {
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  if (days <= 1.01) return "hour";
  if (days <= 62) return "day";
  if (days <= 180) return "week";
  return "month";
}

export function grainFits(from: Date, to: Date, grain: AnalyticsGrain) {
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  if (grain === "hour" && days > 14) return false;
  if (grain === "day" && days > 400) return false;
  return true;
}

function isoWeekKey(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const isoYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function bucketKey(date: Date, grain: AnalyticsGrain) {
  const parts = istParts(date);
  if (grain === "hour") {
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}`;
  }
  if (grain === "day") {
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
  }
  if (grain === "month") return `${parts.year}-${pad(parts.month)}`;
  return isoWeekKey(parts.year, parts.month, parts.day);
}

export function bucketLabel(key: string, grain: AnalyticsGrain) {
  if (grain === "hour") return `${key.slice(11, 13)}:00`;
  if (grain === "day") {
    const [, month, day] = key.split("-");
    return `${Number(day)} ${MONTHS[Number(month) - 1]}`;
  }
  if (grain === "week") return key.slice(5);
  const [year, month] = key.split("-");
  return `${MONTHS[Number(month) - 1]} ${year}`;
}

/** Stop charts at the current bucket when the official range end is still in the future. */
export function chartExclusiveEnd(to: Date, grain: AnalyticsGrain, now: Date) {
  if (to.getTime() <= now.getTime()) return to;
  if (grain === "hour") {
    const parts = istParts(now);
    return istDate(parts.year, parts.month, parts.day, parts.hour + 1);
  }
  if (grain === "month") return addIstMonths(startOfIstMonth(now), 1);
  return addIstDays(startOfIstDay(now), 1);
}

export function enumerateBuckets(
  from: Date,
  to: Date,
  grain: AnalyticsGrain,
  now = new Date(),
) {
  const end = chartExclusiveEnd(to, grain, now);
  const keys: string[] = [];
  if (from.getTime() >= end.getTime()) return keys;

  if (grain === "month") {
    let cursor = startOfIstMonth(from);
    while (cursor.getTime() < end.getTime() && keys.length < 120) {
      keys.push(bucketKey(cursor, "month"));
      cursor = addIstMonths(cursor, 1);
    }
    return keys;
  }

  if (grain === "week") {
    let cursor = startOfIstDay(from);
    const seen = new Set<string>();
    while (cursor.getTime() < end.getTime() && keys.length < 200) {
      const key = bucketKey(cursor, "week");
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
      cursor = addIstDays(cursor, 1);
    }
    return keys;
  }

  const parts = istParts(from);
  let cursor =
    grain === "hour"
      ? istDate(parts.year, parts.month, parts.day, parts.hour)
      : startOfIstDay(from);
  const guard = grain === "hour" ? 24 * 14 : 400;
  while (cursor.getTime() < end.getTime() && keys.length < guard) {
    keys.push(bucketKey(cursor, grain));
    cursor =
      grain === "hour"
        ? new Date(cursor.getTime() + 3_600_000)
        : addIstDays(cursor, 1);
  }
  return keys;
}

export function resolveRange(input: {
  preset: AnalyticsPreset;
  now?: Date;
  from?: string;
  to?: string;
}): ResolvedRange {
  const now = input.now ?? new Date();
  const today = startOfIstDay(now);
  const tomorrow = addIstDays(today, 1);

  let from: Date;
  let to: Date;
  let previousFrom: Date;
  let previousTo: Date;

  switch (input.preset) {
    case "today":
      from = today;
      to = tomorrow;
      previousFrom = addIstDays(today, -1);
      previousTo = today;
      break;
    case "yesterday":
      from = addIstDays(today, -1);
      to = today;
      previousFrom = addIstDays(today, -2);
      previousTo = from;
      break;
    case "last_7_days":
      from = addIstDays(today, -6);
      to = tomorrow;
      previousFrom = addIstDays(from, -7);
      previousTo = from;
      break;
    case "last_30_days":
      from = addIstDays(today, -29);
      to = tomorrow;
      previousFrom = addIstDays(from, -30);
      previousTo = from;
      break;
    case "this_month":
      from = startOfIstMonth(now);
      to = tomorrow;
      previousFrom = addIstMonths(from, -1);
      previousTo = from;
      break;
    case "last_month":
      to = startOfIstMonth(now);
      from = addIstMonths(to, -1);
      previousTo = from;
      previousFrom = addIstMonths(from, -1);
      break;
    case "this_year":
      from = startOfIstYear(now);
      to = tomorrow;
      previousFrom = istDate(istParts(now).year - 1, 1, 1);
      previousTo = from;
      break;
    case "custom": {
      const start = input.from ? parseIstDay(input.from) : null;
      const endDay = input.to ? parseIstDay(input.to) : null;
      if (!start || !endDay) {
        throw new RangeError("Enter a valid start and end date.");
      }
      if (start.getTime() > endDay.getTime()) {
        throw new RangeError("The start date must be on or before the end date.");
      }
      from = start;
      to = addIstDays(endDay, 1);
      const length = to.getTime() - from.getTime();
      if (length > 366 * 3 * 86_400_000) {
        throw new RangeError("Choose a range of 3 years or less.");
      }
      previousTo = from;
      previousFrom = new Date(from.getTime() - length);
      break;
    }
    default:
      throw new RangeError("Choose a valid date range.");
  }

  return {
    preset: input.preset,
    from,
    to,
    previousFrom,
    previousTo,
    label: formatRangeLabel(from, to),
    previousLabel: formatRangeLabel(previousFrom, previousTo),
  };
}

export function slowWindow(now: Date, slowDays: 30 | 60 | 90) {
  const tomorrow = addIstDays(startOfIstDay(now), 1);
  return {
    from: addIstDays(startOfIstDay(now), -(slowDays - 1)),
    to: tomorrow,
  };
}

export function istDayDiff(earlier: Date, later: Date) {
  const from = startOfIstDay(earlier).getTime();
  const to = startOfIstDay(later).getTime();
  return Math.max(0, Math.round((to - from) / 86_400_000));
}
