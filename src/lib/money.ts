/** Round to 2 decimal places using banker's-safe epsilon for INR-style money. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function multiplyMoney(quantity: number, unitPrice: number): number {
  return roundMoney(quantity * unitPrice);
}

export function sumMoney(values: number[]): number {
  return roundMoney(values.reduce((sum, value) => sum + value, 0));
}
