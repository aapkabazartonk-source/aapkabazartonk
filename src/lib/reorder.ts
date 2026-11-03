/**
 * Suggested reorder quantity.
 *
 * Business rule:
 * - Target on-hand = minStockLevel × reorderMultiple (Business.reorderMultiple, default 2).
 * - Low stock: currentStock > 0 and currentStock <= minStockLevel.
 *   Suggested quantity = max(target - currentStock, minStockLevel).
 * - Out of stock: currentStock === 0.
 *   Suggested quantity = max(target, minStockLevel, 1) so a zero minimum still suggests 1 unit.
 * - In stock: currentStock > minStockLevel. Suggested quantity is 0.
 *
 * Example: minimum 5, multiple 2, on-hand 3 → target 10 → reorder 7.
 * Example: minimum 5, multiple 2, on-hand 0 → reorder 10.
 */
export function suggestedReorderQuantity(
  currentStock: number,
  minStockLevel: number,
  reorderMultiple = 2,
) {
  const multiple = Number.isFinite(reorderMultiple) && reorderMultiple >= 1
    ? reorderMultiple
    : 2;
  const min = Math.max(0, minStockLevel);
  const onHand = Math.max(0, currentStock);
  const target = min * multiple;

  if (onHand <= 0) {
    return Math.max(target, min, 1);
  }

  if (onHand <= min) {
    return Math.max(target - onHand, min);
  }

  return 0;
}

export function reorderRuleSummary(reorderMultiple: number) {
  const multiple = Number.isFinite(reorderMultiple) ? reorderMultiple : 2;
  return `Suggested reorder fills stock up to ${multiple}× the minimum level. Low stock is above zero and at or below the minimum. Out of stock means on-hand is zero.`;
}
