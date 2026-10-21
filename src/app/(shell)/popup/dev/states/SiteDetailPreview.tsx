'use client'

import type { SiteDetail } from '@/lib/popup/popup-read'
import { SiteDetailView } from '../../sites/[id]/SiteDetailClient'

// Fixture-only preview: no production controller, session, router, network, or writes.
export default function SiteDetailPreview({ initial }: { initial: SiteDetail }) {
  return <div className="pd-page mx-auto max-w-6xl px-4 py-8 md:px-8"><SiteDetailView data={initial} days={30} /></div>
}
