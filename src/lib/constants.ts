export const PRODUCT_UNITS = [
  "piece",
  "kg",
  "gram",
  "litre",
  "ml",
  "box",
  "packet",
  "dozen",
  "metre",
] as const;

export type ProductUnit = (typeof PRODUCT_UNITS)[number];
