import { NextRequest, NextResponse } from 'next/server'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { z } from 'zod'

export const runtime = 'nodejs'

const BodySchema = z.object({
  query: z.string().min(2).max(200),
  count: z.number().int().min(5).max(60).default(10),
  region: z.enum(['JP', 'GLOBAL']).default('JP'),
  exclude: z.array(z.string().min(1).max(50)).max(50).optional().default([]),
  tags: z.array(z.string().min(1).max(30)).max(20).optional().default([]),
  requireOfficial: z.boolean().default(true),
  includeThirdParty: z.boolean().default(true),
})

type Candidate = {
  name: string
  websiteUrl?: string
  confidence?: 'high' | 'medium' | 'low'
  notes?: string
  source?: string
}

function uniqByName(items: Candidate[]): Candidate[] {
  const seen = new Set<string>()
  const out: Candidate[] = []
  for (const it of items) {
    const key = String(it.name || '').trim().toLowerCase()
    if (!key) continue
    if (seen.has(key)) continue
    seen.add(key)
    out.push(it)
  }
  return out
}

export async function POST(req: NextRequest) {
  try {
    await ensureSeoSchema()
    const body = BodySchema.parse(await req.json())

    // NOTE:
    // - 本番は SerpAPI 等の検索APIを利用する想定（キーを入れるだけで差し替え可能な設計にする）
    // - 現段階では「プロダクト機能としての枠組み」を先に提供し、候補は手動追加でも成立するようにする
    const apiKey = process.env.SEO_SERPAPI_KEY || process.env.SERPAPI_API_KEY || ''

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          code: 'SEARCH_PROVIDER_NOT_CONFIGURED',
          error: '候補の自動収集には検索APIキーが必要です（例：SEO_SERPAPI_KEY）。手動で候補を追加してください。',
          candidates: [] as Candidate[],
        },
        { status: 503 }
      )
    }

    // 検索API実装は後で差し替え（ここではインターフェースだけ固定）
    // TODO: SerpAPI実装（Google / Bing）+ ドメイン正規化 + 公式URL推定 + 重複排除
    const candidates: Candidate[] = uniqByName([]).slice(0, body.count)

    return NextResponse.json({
      success: true,
      candidates,
      provider: 'serpapi',
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 400 })
  }
}


