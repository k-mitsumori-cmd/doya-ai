import { NextResponse } from 'next/server'

/** Personalized API responses must never be stored in browser or shared caches. */
export function privateApiJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set('Cache-Control', 'private, no-store')
  const vary = (headers.get('Vary') || '').split(',').map(value => value.trim()).filter(Boolean)
  if (!vary.some(value => value.toLowerCase() === 'cookie')) vary.push('Cookie')
  headers.set('Vary', vary.join(', '))
  return NextResponse.json(body, { ...init, headers })
}
