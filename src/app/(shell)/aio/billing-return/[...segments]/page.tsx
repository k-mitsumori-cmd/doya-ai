import { AioBillingReturn } from '@/components/aio/AioBillingReturn'
import { validAioNavigationId, validAioSessionId } from '@/lib/aio/billing-navigation'
import { aioDedicatedReturnMarkerValid, aioUnknownReturnPath } from '@/lib/aio/billing-return-route'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export default async function AioBillingReturnPage({ params, searchParams }: {
  params: Promise<{ segments: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const segments = (await params).segments
  const kind = segments.length === 2 && segments[0] === 'checkout' && validAioSessionId(segments[1]) ? 'checkout' :
    segments.length === 2 && segments[0] === 'portal' && validAioNavigationId(segments[1]) ? 'portal' :
      segments.length === 1 && segments[0] === 'cancelled' ? 'cancelled' : 'unknown'
  const marker = await searchParams
  if (!aioDedicatedReturnMarkerValid(kind, kind === 'checkout' || kind === 'portal' ? segments[1] : null,
    marker)) redirect(aioUnknownReturnPath(marker, `/aio/billing-return/${segments.map(encodeURIComponent).join('/')}`))
  return <Suspense fallback={<p role="status">戻り先を確認しています…</p>}>
    <AioBillingReturn kind={kind} referenceId={kind === 'checkout' || kind === 'portal' ? segments[1] : null} />
  </Suspense>
}
