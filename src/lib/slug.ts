export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function generateSku(name: string): string {
  const base = slugify(name)
    .replace(/-/g, "")
    .slice(0, 8)
    .toUpperCase();
  const suffix = Date.now().toString(36).toUpperCase().slice(-5);
  return `${base || "PRD"}${suffix}`;
}
