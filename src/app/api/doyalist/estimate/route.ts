export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { resolvePrefectureCodes } from '@/lib/doyalist/collect/prefecture-codes'
import { resolveDoyalistSearchKeywords } from '@/lib/doyalist/search-keywords'
import { fetchCollectionJson } from '@/lib/doyalist/collect/provider-json'
import { OperationalBodyError, readOperationalJson } from '@/lib/operational-json'

const API_BASE = 'https://info.gbiz.go.jp/hojin/v1'
const MAX_REQUEST_BYTES = 8 * 1024
const MAX_PROVIDER_BYTES = 4 * 1024 * 1024

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

    let body: Record<string, unknown>
    try {
      body = await readOperationalJson(req, MAX_REQUEST_BYTES)
    } catch (error) {
      if (error instanceof OperationalBodyError) {
        return NextResponse.json({ error: '入力形式またはサイズを確認してください' }, { status: error.status })
      }
      throw error
    }
    const { industry, region, keywords } = body as {
      industry?: string
      region?: string
      keywords?: string[]
    }
    if ((industry != null && (typeof industry !== 'string' || industry.length > 100))
      || (region != null && (typeof region !== 'string' || region.length > 100))
      || (keywords != null && (!Array.isArray(keywords) || keywords.length > 8
        || keywords.some((keyword) => typeof keyword !== 'string' || keyword.length > 100)))) {
      return NextResponse.json({ error: '検索条件の入力形式を確認してください' }, { status: 400 })
    }
    const apiToken = process.env.GBIZINFO_API_TOKEN
    if (!apiToken) {
      return NextResponse.json({ success: true, estimated: null, note: 'APIキー未設定' })
    }

    const searchKeywords = resolveDoyalistSearchKeywords(industry || '', keywords?.join(',') || '')

    // 都道府県コード解決（エリア指定の場合は最初の県だけサンプリング）
    const prefCodes = region && region !== '全国' ? resolvePrefectureCodes(region) : []
    if (region && region !== '全国' && prefCodes.length === 0) {
      return NextResponse.json({ success: true, estimated: null, note: '地域を判定できませんでした' })
    }
    const samplePrefCode = prefCodes[0]

    // gBizINFO のキーワード検索ヒット数をサンプリングする。
    // 業種・規模など収集時の絞り込み後の件数を保証するものではない。
    const SAMPLE_LIMIT = 1000
    const MAX_PAGE = 10
    const sampledKeywords = [...new Set(searchKeywords)].slice(0, 2)

    async function fetchPage(kw: string, page: number): Promise<number | null> {
      const u = new URL(`${API_BASE}/hojin`)
      u.searchParams.set('name', kw)
      if (samplePrefCode) u.searchParams.set('prefecture', samplePrefCode)
      u.searchParams.set('limit', String(SAMPLE_LIMIT))
      u.searchParams.set('page', String(page))
      try {
        const response = await fetchCollectionJson(u.toString(), {
          headers: { 'Accept': 'application/json', 'X-hojinInfo-api-token': apiToken! },
        }, {
          timeoutMs: 12000,
          maxBytes: MAX_PROVIDER_BYTES,
        })
        if (response.status === 404) return 0  // ヒット0件
        if (!response.ok) {
          console.warn(`[estimate] gBizINFO HTTP ${response.status} page=${page}`)
          return null  // エラー
        }
        const rows = response.data?.['hojin-infos']
        if (!Array.isArray(rows) || rows.length > SAMPLE_LIMIT) {
          console.warn(`[estimate] gBizINFO invalid response page=${page}`)
          return null
        }
        return rows.length
      } catch {
        console.warn(`[estimate] gBizINFO request failed page=${page}`)
        return null
      }
    }

    // 並列に取得し、2キーワード×2ページでも30秒の関数期限内に収める。
    const firstPages = await Promise.all(sampledKeywords.map((kw) => fetchPage(kw, 1)))
    const lastPages = await Promise.all(sampledKeywords.map((kw, index) =>
      firstPages[index] === SAMPLE_LIMIT ? fetchPage(kw, MAX_PAGE) : Promise.resolve(null)))
    if (firstPages.some((count) => count === null)
      || firstPages.some((count, index) => count === SAMPLE_LIMIT && lastPages[index] === null)) {
      return NextResponse.json({
        success: true,
        estimated: null,
        note: 'gBizINFO API応答なし',
      })
    }

    // キーワード同士の重複は不明。合算せず、確実に確認できた最大値を下限とする。
    // 10ページ目が空のときも、未確認の中間ページを推測で補わない。
    const lowerBounds = firstPages.map((first, index) => {
      if (first !== SAMPLE_LIMIT) return first!
      const last = lastPages[index]!
      return last > 0 ? (MAX_PAGE - 1) * SAMPLE_LIMIT + last : SAMPLE_LIMIT
    })
    const estimated = Math.max(0, ...lowerBounds)
    const isApprox = sampledKeywords.length > 1 || searchKeywords.length > sampledKeywords.length
      || prefCodes.length > 1 || firstPages.some((count) => count === SAMPLE_LIMIT)

    return NextResponse.json({
      success: true,
      estimated,
      isApprox,
      note: isApprox
        ? 'キーワード検索で確認した下限です。業種・規模などで絞り込んだ実際の取得数とは異なります'
        : 'キーワード検索のヒット数です。業種・規模などで絞り込んだ実際の取得数とは異なります',
    })
  } catch {
    console.error('[doyalist/estimate] failed')
    return NextResponse.json(
      { success: false, estimated: null, error: '推定に失敗しました' },
      { status: 500 }
    )
  }
}
