import { NextResponse } from 'next/server'

function privateHeaders(initial?: HeadersInit) {
  const headers = new Headers(initial)
  headers.set('Cache-Control', 'private, no-store')
  const vary = (headers.get('Vary') || '').split(',').map(value => value.trim()).filter(Boolean)
  if (!vary.some(value => value.toLowerCase() === 'cookie')) vary.push('Cookie')
  headers.set('Vary', vary.join(', '))
  return headers
}

/** Personalized API responses must never be stored in browser or shared caches. */
export function privateApiJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, { ...init, headers: privateHeaders(init?.headers) })
}

/** Keep streamed/download responses and existing metadata while applying the same privacy policy. */
export function privateApiResponse(response: Response): Response {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: privateHeaders(response.headers),
  })
}
