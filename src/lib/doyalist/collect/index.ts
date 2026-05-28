import { searchCorporateNumber } from './corporate-number'
import { searchGbizInfo, getGbizCompanyDetailsBatch } from './gbizinfo'
import { AREA_TO_PREFECTURES, PREFECTURE_TO_CODE } from './prefecture-codes'
import type { TargetCriteria } from '../types'

export interface CollectedCompany {
  companyName: string
  corporateNumber?: string
  address?: string
  prefecture?: string
  phone?: string
  email?: string
  website?: string
  industry?: string
  employeeCount?: string
  capital?: string
  foundedYear?: number
  representative?: string
  businessSummary?: string
  source: string
  rawData?: Record<string, any>
}

interface CollectOptions {
  criteria: TargetCriteria
  maxResults?: number
  sources?: ('corporate_number' | 'gbizinfo' | 'web')[]
  /** 詳細API取得を有効化（代表者・従業員数・資本金・URL・事業概要を埋める） */
  enrich?: boolean
  /** 詳細取得の最大件数（コスト/時間制限） */
  enrichLimit?: number
}

export interface CollectResult {
  companies: CollectedCompany[]
  /** いずれの検索でもAPIが200を返したか（false なら API障害の可能性） */
  apiOk: boolean
  /** ヒット数が0だったか（filterが厳しすぎる可能性） */
  zeroHits: boolean
}

export async function collectCompanies(options: CollectOptions): Promise<CollectedCompany[]> {
  const result = await collectCompaniesDetailed(options)
  return result.companies
}

/**
 * gBizINFO + 法人番号API から企業データを収集（拡張版）
 * - エリア指定（関東等）は複数都道府県に展開して順次検索
 * - 詳細取得（enrich=true）で代表者・従業員数・資本金等を埋める
 */
export async function collectCompaniesDetailed(options: CollectOptions): Promise<CollectResult> {
  const { criteria, maxResults = 100, sources = ['corporate_number', 'gbizinfo'], enrich = true, enrichLimit = 300 } = options

  const allCompanies: CollectedCompany[] = []
  let anyApiSuccess = false

  // エリア/都道府県の展開
  const rawArea = criteria.areas?.[0]
  let targetPrefectures: (string | undefined)[] = [undefined] // undefined = 都道府県絞り込みなし
  if (rawArea && rawArea !== '全国') {
    if (AREA_TO_PREFECTURES[rawArea]) {
      // エリア名 → 含まれる都道府県を展開
      targetPrefectures = AREA_TO_PREFECTURES[rawArea]
    } else if (PREFECTURE_TO_CODE[rawArea]) {
      // 単一都道府県名
      targetPrefectures = [rawArea]
    } else {
      // 不明な値はそのまま渡す（gbizinfo.ts側で解決）
      targetPrefectures = [rawArea]
    }
  }

  // Source 1: 法人番号API（国税庁）
  if (sources.includes('corporate_number')) {
    for (const keyword of (criteria.keywords || []).slice(0, 3)) {
      if (!keyword) continue
      try {
        const results = await searchCorporateNumber({
          keyword,
          prefecture: targetPrefectures[0] && targetPrefectures.length === 1 ? targetPrefectures[0] : undefined,
          count: Math.min(50, maxResults),
        })
        anyApiSuccess = true
        for (const r of results) {
          allCompanies.push({
            companyName: r.name,
            corporateNumber: r.corporateNumber,
            address: r.address,
            prefecture: r.prefectureName,
            source: 'corporate_number',
            rawData: r as any,
          })
        }
      } catch (e) {
        console.error('[collect] Corporate number API error:', e)
      }
    }
  }

  // Source 2: gBizINFO（経済産業省）
  if (sources.includes('gbizinfo')) {
    const GBIZ_PAGE_SIZE = 50
    const FULL_EXTRACT_THRESHOLD = 500
    const isFullExtract = maxResults >= FULL_EXTRACT_THRESHOLD
    const OVERSAMPLE_RATIO = isFullExtract ? 1 : 4
    // 大量抽出時は requested 件数までフル取得（上限は 12,000 - APIタイムアウト保護）
    const targetPoolSize = isFullExtract
      ? Math.min(maxResults, 12000)
      : Math.min(maxResults * OVERSAMPLE_RATIO, 5000)

    const keywords = (criteria.keywords || []).slice(0, 3)
    const keywordList = keywords.length > 0 ? keywords : ['企業']

    const tempPool: CollectedCompany[] = []

    // (キーワード × 都道府県) の組み合わせで検索
    outer: for (const keyword of keywordList) {
      if (!keyword) continue
      for (const pref of targetPrefectures) {
        if (tempPool.length >= targetPoolSize) break outer

        const remaining = targetPoolSize - tempPool.length
        // 都道府県ごとに均等にページを割り振る（多すぎないよう調整）
        const pagesPerPref = Math.max(1, Math.ceil(remaining / GBIZ_PAGE_SIZE / Math.max(1, targetPrefectures.length)))
        const startPage = isFullExtract ? 1 : Math.floor(Math.random() * 5) + 1

        for (let p = 0; p < pagesPerPref; p++) {
          if (tempPool.length >= targetPoolSize) break outer
          const page = startPage + p
          try {
            const { companies, status } = await searchGbizInfo({
              keyword,
              prefecture: pref,
              // industry はパラメータ仕様が業種コード必須のため、ここでは検索条件から外す
              // 業種絞り込みはユーザーキーワード/AIタグで実現する
              minEmployees: criteria.companySize?.minEmployees,
              maxEmployees: criteria.companySize?.maxEmployees,
              page,
              limit: GBIZ_PAGE_SIZE,
            })

            if (status === 200 || status === 404) anyApiSuccess = true
            if (companies.length === 0) break // この組み合わせでは打ち切り

            for (const c of companies) {
              tempPool.push({
                companyName: c.name,
                corporateNumber: c.corporateNumber,
                address: c.address,
                prefecture: c.address?.match(/^(.+?[都道府県])/)?.[1] || pref,
                website: c.companyUrl,
                industry: c.industry,
                employeeCount: c.employeeNumber,
                capital: c.capitalStock,
                foundedYear: c.foundingYear ? parseInt(c.foundingYear) : undefined,
                representative: c.representativeName,
                businessSummary: c.businessSummary,
                source: 'gbizinfo',
                rawData: c as any,
              })
            }
            await new Promise((r) => setTimeout(r, 80))
          } catch (e) {
            console.error('[collect] gBizINFO API error (page', page, ', pref', pref, '):', e)
            break
          }
        }
      }
    }

    // ランダム抽出
    if (!isFullExtract && tempPool.length > maxResults) {
      for (let i = tempPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[tempPool[i], tempPool[j]] = [tempPool[j], tempPool[i]]
      }
    }
    allCompanies.push(...tempPool.slice(0, maxResults))
  }

  // 重複排除
  const deduplicated = deduplicateCompanies(allCompanies).slice(0, maxResults)

  // 詳細情報のエンリッチ（代表者・従業員数・資本金・URL・事業概要）
  if (enrich) {
    const needsDetail = deduplicated.filter(
      (c) =>
        c.corporateNumber &&
        // 既に主要フィールドが揃っているものはスキップ
        (!c.representative || !c.employeeCount || !c.capital || !c.website || !c.businessSummary)
    )
    const targetForDetail = needsDetail.slice(0, enrichLimit)
    if (targetForDetail.length > 0) {
      const details = await getGbizCompanyDetailsBatch(
        targetForDetail.map((c) => c.corporateNumber!),
        { concurrency: 12 }
      )
      for (const c of deduplicated) {
        if (!c.corporateNumber) continue
        const d = details.get(c.corporateNumber)
        if (!d) continue
        c.representative = c.representative || d.representativeName
        c.employeeCount = c.employeeCount || d.employeeNumber
        c.capital = c.capital || d.capitalStock
        c.website = c.website || d.companyUrl
        c.businessSummary = c.businessSummary || d.businessSummary
        c.industry = c.industry || d.industry
        c.foundedYear = c.foundedYear || (d.foundingYear ? parseInt(d.foundingYear) : undefined)
        c.address = c.address || d.address
        c.rawData = { ...c.rawData, ...d }
      }
    }
  }

  return {
    companies: deduplicated,
    apiOk: anyApiSuccess,
    zeroHits: deduplicated.length === 0,
  }
}

function deduplicateCompanies(companies: CollectedCompany[]): CollectedCompany[] {
  const seen = new Map<string, CollectedCompany>()
  for (const company of companies) {
    if (company.corporateNumber) {
      const existing = seen.get(company.corporateNumber)
      if (existing) {
        seen.set(company.corporateNumber, mergeCompanyData(existing, company))
      } else {
        seen.set(company.corporateNumber, company)
      }
    } else {
      const nameKey = company.companyName.replace(/[\s株式会社有限会社合同会社]/g, '')
      if (!seen.has(nameKey)) {
        seen.set(nameKey, company)
      } else {
        seen.set(nameKey, mergeCompanyData(seen.get(nameKey)!, company))
      }
    }
  }
  return Array.from(seen.values())
}

function mergeCompanyData(a: CollectedCompany, b: CollectedCompany): CollectedCompany {
  return {
    companyName: a.companyName || b.companyName,
    corporateNumber: a.corporateNumber || b.corporateNumber,
    address: a.address || b.address,
    prefecture: a.prefecture || b.prefecture,
    phone: a.phone || b.phone,
    email: a.email || b.email,
    website: a.website || b.website,
    industry: a.industry || b.industry,
    employeeCount: a.employeeCount || b.employeeCount,
    capital: a.capital || b.capital,
    foundedYear: a.foundedYear || b.foundedYear,
    representative: a.representative || b.representative,
    businessSummary: a.businessSummary || b.businessSummary,
    source: `${a.source}+${b.source}`,
    rawData: { ...a.rawData, ...b.rawData },
  }
}
