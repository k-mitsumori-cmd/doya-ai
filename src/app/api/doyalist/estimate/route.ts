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

    // 最初のキーワードで totalCount を取得（厳密ではないがオーダー把握には十分）
    let totalEstimate = 0
    let detailNotice: string | null = null
    for (const kw of searchKeywords.slice(0, 2)) {
      const url = new URL(`${API_BASE}/hojin`)
      url.searchParams.set('name', kw)
      if (samplePrefCode) url.searchParams.set('prefecture', samplePrefCode)
      url.searchParams.set('limit', '1')
      url.searchParams.set('page', '1')

      try {
        const r = await fetch(url.toString(), {
          headers: { 'Accept': 'application/json', 'X-hojinInfo-api-token': apiToken },
        })
        if (r.status === 404) {
          // ヒット0
          continue
        }
        if (!r.ok) continue
        const data = await r.json()
        const count = Number(data?.totalCount || (data['hojin-infos'] || []).length || 0)
        totalEstimate += count
      } catch {
        // ignore
      }
    }

    // エリア指定だが単県のみで estimate した場合の補足
    if (region && region !== '全国' && prefCodes.length > 1) {
      detailNotice = `${prefCodes.length}県を順次検索します（実際の合計はさらに多い可能性）`
      // エリア全体の概算: 単県サンプル × 県数 の 70% (重複考慮)
      totalEstimate = Math.round(totalEstimate * prefCodes.length * 0.7)
    }

    return NextResponse.json({
      success: true,
      estimated: totalEstimate,
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
