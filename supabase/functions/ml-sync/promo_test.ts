import { extractPromoAmount } from "./promo.ts";

function expectEqual(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}

const now = Date.parse("2026-07-16T12:00:00.000Z");

Deno.test("does not persist a standard price as an offer", () => {
  expectEqual(
    extractPromoAmount({
      prices: [{ amount: 2400, conditions: { end_time: null, start_time: null }, type: "standard" }],
    }, now),
    null,
  );
});

Deno.test("keeps an active discounted price", () => {
  expectEqual(
    extractPromoAmount({
      prices: [{ amount: 2180, conditions: { end_time: "2026-07-20T00:00:00.000Z" }, regular_amount: 2400, type: "promotion" }],
    }, now),
    2180,
  );
});

Deno.test("uses the current prices endpoint promotion instead of an older item offer", () => {
  expectEqual(
    extractPromoAmount({
      prices: [
        { amount: 415, conditions: { end_time: null, start_time: null }, type: "standard" },
        {
          amount: 394.25,
          conditions: { end_time: "2026-07-31T02:59:59.000Z", start_time: "2026-06-30T03:00:00.000Z" },
          regular_amount: 415,
          type: "promotion",
        },
      ],
    }, now),
    394.25,
  );
});

Deno.test("ignores expired and future promotions", () => {
  expectEqual(
    extractPromoAmount({
      prices: [
        { amount: 2000, conditions: { end_time: "2026-07-15T23:59:59.000Z" }, regular_amount: 2400, type: "promotion" },
        { amount: 2100, conditions: { start_time: "2026-07-17T00:00:00.000Z" }, regular_amount: 2400, type: "promotion" },
      ],
    }, now),
    null,
  );
});
