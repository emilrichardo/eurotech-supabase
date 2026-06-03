export function normalizeSku(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

export function skuKey(value: string | null | undefined): string | null {
  const normalized = normalizeSku(value)
  return normalized ? `sku:${normalized}` : null
}

