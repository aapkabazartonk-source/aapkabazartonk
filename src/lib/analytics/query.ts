import { z } from "zod";
import {
  ANALYTICS_GRAINS,
  ANALYTICS_PRESETS,
  defaultGrain,
  grainFits,
  resolveRange,
  type AnalyticsGrain,
  type ResolvedRange,
} from "@/lib/analytics/time";

export class AnalyticsError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AnalyticsError";
    this.status = status;
  }
}

export const PRODUCT_VIEWS = [
  "top_qty",
  "top_revenue",
  "top_profit",
  "slow",
  "no_sales",
] as const;

export type ProductView = (typeof PRODUCT_VIEWS)[number];

const emptyToUndefined = (value: unknown) =>
  value === null || value === undefined || value === "" ? undefined : value;

const schema = z.object({
  preset: z.enum(ANALYTICS_PRESETS).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid start date.")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid end date.")
    .optional(),
  grain: z.enum(ANALYTICS_GRAINS).optional(),
  slowDays: z.enum(["30", "60", "90"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  view: z.enum(PRODUCT_VIEWS).optional(),
  format: z.enum(["csv", "pdf"]).optional(),
});

export type AnalyticsQuery = {
  preset: (typeof ANALYTICS_PRESETS)[number];
  grain: AnalyticsGrain;
  slowDays: 30 | 60 | 90;
  page: number;
  limit: number;
  view: ProductView;
  format?: "csv" | "pdf";
  range: ResolvedRange;
  now: Date;
};

export function parseAnalyticsQuery(
  searchParams: URLSearchParams,
  now = new Date(),
): AnalyticsQuery {
  const raw: Record<string, string> = {};
  for (const key of [
    "preset",
    "from",
    "to",
    "grain",
    "slowDays",
    "page",
    "limit",
    "view",
    "format",
  ]) {
    const value = emptyToUndefined(searchParams.get(key));
    if (typeof value === "string") raw[key] = value;
  }

  const parsed = schema.parse(raw);
  const preset = parsed.preset ?? "last_30_days";
  if (preset === "custom" && (!parsed.from || !parsed.to)) {
    throw new AnalyticsError("Choose a start and end date.");
  }

  let range: ResolvedRange;
  try {
    range = resolveRange({
      preset,
      now,
      from: parsed.from,
      to: parsed.to,
    });
  } catch (error) {
    throw new AnalyticsError(
      error instanceof Error ? error.message : "Enter a valid date range.",
    );
  }

  const grain = parsed.grain ?? defaultGrain(range.from, range.to);
  if (!grainFits(range.from, range.to, grain)) {
    throw new AnalyticsError(
      grain === "hour"
        ? "Hourly view is available for ranges up to 14 days."
        : "Daily view is available for ranges up to 400 days. Choose weekly or monthly.",
    );
  }

  const slowDays = Number(parsed.slowDays ?? "30") as 30 | 60 | 90;

  return {
    preset,
    grain,
    slowDays,
    page: parsed.page ?? 1,
    limit: parsed.limit ?? 10,
    view: parsed.view ?? "top_revenue",
    format: parsed.format,
    range,
    now,
  };
}
