export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/adimage/placements — 対応している配置の一覧
import { NextResponse } from 'next/server'
import { DEFAULT_PLACEMENT_KEYS, PLACEMENTS, UNSUPPORTED_PLACEMENTS } from '@/lib/adimage/placements'
import { REFINE_CHIPS } from '@/lib/adimage/feedback'

export async function GET() {
  return NextResponse.json({
    placements: PLACEMENTS.map((p) => ({
      key: p.key, media: p.media, name: p.name,
      size: `${p.w}×${p.h}`, genSize: `${p.genW}×${p.genH}`, note: p.note ?? null,
    })),
    defaults: DEFAULT_PLACEMENT_KEYS,
    unsupported: UNSUPPORTED_PLACEMENTS,
    chips: REFINE_CHIPS.map((c) => ({ key: c.key, label: c.label })),
  })
}
