export function formatDocumentNumber(prefix: string, sequence: number, date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const seq = String(sequence).padStart(4, "0");
  return `${prefix}-${yyyy}${mm}${dd}-${seq}`;
}

export async function nextDailySequence(
  countFn: (prefix: string) => Promise<number>,
  prefix: string,
  date = new Date(),
) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const dayPrefix = `${prefix}-${yyyy}${mm}${dd}-`;
  const existing = await countFn(dayPrefix);
  return formatDocumentNumber(prefix, existing + 1, date);
}
