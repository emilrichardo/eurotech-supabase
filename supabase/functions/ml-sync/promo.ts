export interface MLPriceEntry {
  amount?: number | null;
  conditions?: {
    end_time?: string | null;
    start_time?: string | null;
  } | null;
  currency_id?: string;
  id?: string;
  metadata?: unknown;
  regular_amount?: number | null;
  type?: string;
}

export interface MLPricesResponse {
  id?: string;
  prices?: MLPriceEntry[];
}

function isPromotionActiveAt(entry: MLPriceEntry, now = Date.now()) {
  const startTime = entry.conditions?.start_time
    ? Date.parse(entry.conditions.start_time)
    : null;
  const endTime = entry.conditions?.end_time
    ? Date.parse(entry.conditions.end_time)
    : null;

  if (startTime !== null && Number.isFinite(startTime) && startTime > now) {
    return false;
  }

  if (endTime !== null && Number.isFinite(endTime) && endTime <= now) {
    return false;
  }

  return true;
}

/** Returns only a currently active Mercado Libre promotion. */
export function extractPromoAmount(
  prices: MLPricesResponse | null,
  now = Date.now(),
): number | null {
  const list = Array.isArray(prices?.prices) ? prices.prices : [];
  const promos = list.filter((entry) => {
    if (
      typeof entry.amount !== "number" ||
      entry.amount <= 0 ||
      !isPromotionActiveAt(entry, now)
    ) {
      return false;
    }

    const isPromoType =
      typeof entry.type === "string" && /promo|deal|campaign/i.test(entry.type);
    const isDiscounted =
      typeof entry.regular_amount === "number" && entry.regular_amount > entry.amount;
    return isPromoType || isDiscounted;
  });

  return promos.reduce<number | null>(
    (lowest, entry) =>
      lowest === null || (entry.amount as number) < lowest
        ? (entry.amount as number)
        : lowest,
    null,
  );
}
