/**
 * Fetches the current USD → UYU exchange rate from open.er-api.com (free, no key needed).
 * Returns null if the fetch fails.
 */
export async function fetchUsdToUyu(): Promise<number | null> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 3600 }, // cache for 1 hour in Next.js
    })
    if (!res.ok) return null
    const data = await res.json()
    return (data.rates?.UYU as number) ?? null
  } catch {
    return null
  }
}

/**
 * Converts a USD amount to UYU using the given rate.
 * Returns the original amount if rate is null.
 */
export function convertUsdToUyu(usdAmount: number, rate: number): number {
  return Math.round(usdAmount * rate)
}
