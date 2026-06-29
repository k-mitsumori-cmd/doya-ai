export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { resolvePrefectureCodes } from '@/lib/doyalist/collect/prefecture-codes'

const API_BASE = 'https://info.gbiz.go.jp/hojin/v1'

/**
 * POST /api/doyalist/estimate
 * フィルタ条件で実際に何社ヒットしそうかを gBizINFO に問い合わせて返す
 * Body: { industry, region, keywords?: string[], size?: '指定なし' | ... }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const apiToken = process.env.GBIZINFO_API_TOKEN
    if (!apiToken) {
      return NextResponse.json({ success: true, estimated: null, note: 'APIキー未設定' })
    }

    const body = await req.json().catch(() => ({}))
    const { industry, region, keywords } = (body || {}) as {
      industry?: string
      region?: string
      keywords?: string[]
    }

    // 検索キーワードの決定: ユーザータグ > 業種代表語
    const INDUSTRY_KEYWORDS: Record<string, string[]> = {
      'IT・ソフトウェア': ['システム', 'ソフトウェア'],
      '製造業': ['製造', '工業'],
      '小売・EC': ['販売', '商事'],
      '医療・介護': ['医療', '介護'],
      '教育': ['教育', '学習'],
      '金融・保険': ['金融', '保険'],
      '不動産': ['不動産', '住宅'],
      '飲食': ['食品', '飲食'],
      '物流': ['物流', '運輸'],
      '建設': ['建設', '建築'],
      'コンサル': ['コンサルティング'],
      '広告・マーケ': ['広告', 'マーケティング'],
      '人材': ['人材', 'スタッフ'],
      'その他': ['株式会社'],
    }
    const searchKeywords = (keywords && keywords.length > 0)
      ? keywords.slice(0, 3)
      : (industry && INDUSTRY_KEYWORDS[industry]) || ['株式会社']

    // 都道府県コード解決（エリア指定の場合は最初の県だけサンプリング）
    const prefCodes = region && region !== '全国' ? resolvePrefectureCodes(region) : []
    const samplePrefCode = prefCodes[0]

    // gBizINFO API は totalCount を返さないので、実際にデータを取得して件数測定
    // 軽量化: limit=1000 (約100KB) で page=1, page=10 を確認
    // - page1<1000 → 実数
    // - page1==1000 → page10で総数推定 (10000+ / 中間値)
    const SAMPLE_LIMIT = 1000
    const MAX_PAGE = 10
    let totalEstimate = 0
    let isApprox = false
    let detailNotice: string | null = null
    let anyError = false

    async function fetchPage(kw: string, page: number): Promise<number | null> {
      const u = new URL(`${API_BASE}/hojin`)
      u.searchParams.set('name', kw)
      if (samplePrefCode) u.searchParams.set('prefecture', samplePrefCode)
      u.searchParams.set('limit', String(SAMPLE_LIMIT))
      u.searchParams.set('page', String(page))
      try {
        const r = await fetch(u.toString(), {
          headers: { 'Accept': 'application/json', 'X-hojinInfo-api-token': apiToken! },
          signal: AbortSignal.timeout(12000),
        })
        if (r.status === 404) return 0  // ヒット0件
        if (!r.ok) {
          console.warn(`[estimate] gBizINFO ${r.status} for "${kw}" page=${page}`)
          return null  // エラー
        }
        const data = await r.json()
        return (data['hojin-infos'] || []).length
      } catch (e: any) {
        console.warn(`[estimate] fetch error for "${kw}" page=${page}:`, e?.message || e)
        return null
      }
    }

    for (const kw of searchKeywords.slice(0, 2)) {
      const c1 = await fetchPage(kw, 1)
      if (c1 === null) { anyError = true; continue }
      if (c1 < SAMPLE_LIMIT) {
        // 実数
        totalEstimate += c1
        continue
      }
      // 1000満タン → 10ページ目で「10,000+」かチェック
      isApprox = true
      const cMax = await fetchPage(kw, MAX_PAGE)
      if (cMax === null) {
        totalEstimate += SAMPLE_LIMIT // 取得失敗時は 1000+ 扱い
      } else if (cMax >= SAMPLE_LIMIT) {
        totalEstimate += SAMPLE_LIMIT * MAX_PAGE // 10000+
      } else if (cMax > 0) {
        // 中間値: (MAX_PAGE-1)*1000 + cMax
        totalEstimate += (MAX_PAGE - 1) * SAMPLE_LIMIT + cMax
      } else {
        // page10で0件 → 最後のページを二分探索的に推定
        // 簡略化: 1000+ (実態は1000-10000のどこか)
        totalEstimate += SAMPLE_LIMIT * 5
      }
    }

    if (totalEstimate === 0 && anyError) {
      return NextResponse.json({
        success: true,
        estimated: null,
        note: 'gBizINFO API応答なし',
      })
    }

    // エリア指定だが複数県の場合の補足
    if (region && region !== '全国' && prefCodes.length > 1) {
      detailNotice = `${prefCodes.length}県を順次検索します`
      // エリア全体の概算: 単県サンプル × 県数 の 70% (重複考慮)
      totalEstimate = Math.round(totalEstimate * prefCodes.length * 0.7)
      isApprox = true
    }

    return NextResponse.json({
      success: true,
      estimated: totalEstimate,
      isApprox,
      note: detailNotice,
    })
  } catch (e: any) {
    console.error('[doyalist/estimate]', e)
    return NextResponse.json(
      { success: false, estimated: null, error: e?.message || '推定に失敗しました' },
      { status: 200 }
    )
  }
}
