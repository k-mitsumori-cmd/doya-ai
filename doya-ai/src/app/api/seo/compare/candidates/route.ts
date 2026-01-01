import { NextRequest, NextResponse } from 'next/server'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { z } from 'zod'
import { serpapiSearchGoogle } from '@seo/lib/serpapi'

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

function pickNameFromTitle(title: string): string {
  const t = String(title || '').trim()
  if (!t) return ''
  // 区切り記号で左側を優先（ブランド/サービス名であることが多い）
  const parts = t.split(/[\|\｜\-–—]/).map((s) => s.trim()).filter(Boolean)
  const head = parts[0] || t
  // よくある語尾を軽く削る
  return head
    .replace(/(料金|価格|評判|口コミ|比較|おすすめ|とは|まとめ|ランキング).*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
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

    // SerpAPIで検索 → 上位結果から候補を抽出（完全自動のため精度は100%ではない）
    // NOTE:
    // - 1回の検索で取れる件数が少ないため、startでページングして必要数（最大60）を集める
    // - 最終的にはUIで確認・編集してもらう想定
    const desired = Math.max(5, Math.min(60, Number(body.count || 10)))
    const gl = body.region === 'JP' ? 'jp' : 'us'
    const hl = body.region === 'JP' ? 'ja' : 'en'

    const queries = [
      `${body.query} 比較`,
      `${body.query} おすすめ`,
      `${body.query} 料金`,
    ]

    const raw: Candidate[] = []
    for (const q of queries) {
      // 5ページ分（最大50件）まで。uniq後に desired を満たしたら終了
      for (let start = 0; start < 50 && uniqByName(raw).length < desired; start += 10) {
        const found = await serpapiSearchGoogle({ query: q, gl, hl, num: 10, start })
        if (!found.organic.length) break
        for (const r of found.organic) {
          const name = pickNameFromTitle(r.title) || body.query
          raw.push({
            name,
            websiteUrl: r.url,
            confidence: 'medium',
            notes: r.snippet ? r.snippet.slice(0, 140) : undefined,
            source: 'serpapi',
          })
        }
        // 追加が無ければ次ページを打ち切り
        if (uniqByName(raw).length >= desired) break
      }
      if (uniqByName(raw).length >= desired) break
    }

    // exclude は名前に含まれていたら除外
    const excluded = (body.exclude || []).map((x) => String(x || '').trim()).filter(Boolean)
    const filtered = raw.filter((c) => {
      if (!excluded.length) return true
      const n = String(c.name || '')
      return !excluded.some((ex) => ex && n.includes(ex))
    })

    const candidates: Candidate[] = uniqByName(filtered).slice(0, desired)

    return NextResponse.json({
      success: true,
      candidates,
      provider: 'serpapi',
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 400 })
  }
}


