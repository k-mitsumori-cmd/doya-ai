// =============================================================================
// POST /api/slide/generate
// GeminiでスライドJSON構成を生成
// =============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateSlideSpec } from '@/lib/slide/gemini'
import type { SlideGenerateRequest } from '@/lib/slide/types'

const bodySchema = z.object({
  topic: z.string().min(1),
  slidePurpose: z.enum(['proposal', 'meeting', 'sales', 'recruit', 'seminar', 'other']).default('proposal'),
  slideCount: z.number().int().min(3).max(30).default(8),
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#1E40AF'),
  referenceText: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const input: SlideGenerateRequest = {
      topic: parsed.data.topic,
      slidePurpose: parsed.data.slidePurpose as any,
      slideCount: parsed.data.slideCount,
      themeColor: parsed.data.themeColor,
      referenceText: parsed.data.referenceText,
    }

    const slideSpec = await generateSlideSpec(input)
    return NextResponse.json({ ok: true, slideSpec })
  } catch (err: any) {
    console.error('[slide/generate] error:', err)
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 })
  }
}

