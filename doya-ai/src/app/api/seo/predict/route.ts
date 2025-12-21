import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { predictSeoBriefFromTitle } from '@seo/lib/predict'

const BodySchema = z.object({
  title: z.string().min(3).max(300),
  seedKeywords: z.array(z.string()).optional().default([]),
  tone: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = BodySchema.parse(await req.json())
    const predicted = await predictSeoBriefFromTitle({
      title: body.title,
      seedKeywords: body.seedKeywords,
      tone: body.tone,
    })
    return NextResponse.json({ success: true, predicted })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 400 })
  }
}




