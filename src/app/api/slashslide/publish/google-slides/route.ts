// =============================================================================
// POST /api/slashslide/publish/google-slides
// SlideSpec を Google Slides に変換して共有URLを返す
// =============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createGoogleSlideFromSpec } from '@/lib/slashslide/googleSlides'
import type { SlideSpec } from '@/lib/slashslide/types'

const bodySchema = z.object({
  title: z.string().min(1),
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#1E40AF'),
  recipientEmail: z.string().email(),
  slides: z.array(
    z.object({
      title: z.string(),
      elements: z.array(
        z.union([
          z.object({ type: z.literal('text'), content: z.string() }),
          z.object({ type: z.literal('bullets'), items: z.array(z.string()) }),
          z.object({ type: z.literal('image'), placeholder: z.string().optional() }),
        ])
      ),
    })
  ),
})

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { title, themeColor, recipientEmail, slides } = parsed.data
    const result = await createGoogleSlideFromSpec(
      title,
      slides as SlideSpec[],
      themeColor,
      recipientEmail
    )

    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('[slashslide/publish/google-slides] error:', err)
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 })
  }
}




