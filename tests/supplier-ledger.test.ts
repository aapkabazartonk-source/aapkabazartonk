import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeRunningBalances,
  paymentStatusFromAmounts,
} from "../src/lib/supplier-ledger.ts";

describe("supplier ledger helpers", () => {
  it("computes running balances with debit/credit convention", () => {
    const balances = computeRunningBalances([
      { debit: 1000, credit: 0 },
      { debit: 500, credit: 0 },
      { debit: 0, credit: 400 },
      { debit: 0, credit: 1100 },
    ]);
    assert.deepEqual(balances, [1000, 1500, 1100, 0]);
  });

  it("maps payment status from amounts", () => {
    assert.equal(paymentStatusFromAmounts(100, 0), "UNPAID");
    assert.equal(paymentStatusFromAmounts(100, 40), "PARTIAL");
    assert.equal(paymentStatusFromAmounts(100, 100), "PAID");
  });
});
