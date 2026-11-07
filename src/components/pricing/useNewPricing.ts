'use client'
// null means the pricing status is unresolved or unavailable. Never interpret it as legacy pricing.
import { useEffect, useState } from 'react'

const cached = new Map<string, Promise<boolean | null>>()

function load(identityKey: string): Promise<boolean | null> {
  const existing = cached.get(identityKey)
  if (existing) return existing
  const request = fetch('/api/pricing/status', { cache: 'no-store' })
    .then(async (response): Promise<boolean | null> => {
      if (!response.ok) return null
      const data: unknown = await response.json()
      if (!data || typeof data !== 'object' || !('newPricing' in data) || typeof data.newPricing !== 'boolean') return null
      return data.newPricing
    })
    .catch(() => null)
  cached.set(identityKey, request)
  void request.then((value) => {
    if (value === null && cached.get(identityKey) === request) cached.delete(identityKey)
  })
  return request
}

export function useNewPricing(identityKey: string): boolean | null {
  const [result, setResult] = useState<{ identityKey: string; value: boolean | null } | null>(null)
  useEffect(() => {
    let alive = true
    void load(identityKey).then((value) => { if (alive) setResult({ identityKey, value }) })
    return () => { alive = false }
  }, [identityKey])
  return result?.identityKey === identityKey ? result.value : null
}
