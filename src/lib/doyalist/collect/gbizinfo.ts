import { resolvePrefectureCodes } from './prefecture-codes'

const API_BASE = 'https://info.gbiz.go.jp/hojin/v1'

export interface GbizCompanyInfo {
  corporateNumber: string
  name: string
  nameKana?: string
  postalCode?: string
  address?: string
  representativeName?: string
  capitalStock?: string
  employeeNumber?: string
  foundingYear?: string
  businessSummary?: string
  companyUrl?: string
  status?: string
  industry?: string
  dateOfEstablishment?: string
  updateDate?: string
  certifications?: string[]
}

interface SearchParams {
  keyword?: string
  /** 漢字名/コード/エリア名のいずれかを受ける */
  prefecture?: string
  industry?: string
  minEmployees?: number
  maxEmployees?: number
  page?: number
  limit?: number
}

function mapHojinItem(item: any): GbizCompanyInfo {
  return {
    corporateNumber: item.corporate_number || '',
    name: item.name || '',
    nameKana: item.kana || item.name_kana || undefined,
    postalCode: item.postal_code || undefined,
    address: item.location || undefined,
    representativeName: item.representative_name || undefined,
    capitalStock: item.capital_stock != null ? String(item.capital_stock) : undefined,
    employeeNumber: item.employee_number != null ? String(item.employee_number) : undefined,
    foundingYear: item.founding_year ? String(item.founding_year) : undefined,
    businessSummary: item.business_summary || undefined,
    companyUrl: item.company_url || undefined,
    status: item.status || undefined,
    industry: Array.isArray(item.business_items)
      ? item.business_items[0]
      : item.business_items || undefined,
    dateOfEstablishment: item.date_of_establishment || undefined,
    updateDate: item.update_date || undefined,
    certifications: item.certification || [],
  }
}

/**
 * gBizINFO 検索（基本情報のみ）
 * 注意: prefecture は内部で漢字→2桁コードに変換
 */
export async function searchGbizInfo(params: SearchParams): Promise<{ companies: GbizCompanyInfo[]; totalCount: number; status: number }> {
  const apiToken = process.env.GBIZINFO_API_TOKEN
  if (!apiToken) {
    console.warn('GBIZINFO_API_TOKEN not set, returning empty results')
    return { companies: [], totalCount: 0, status: 0 }
  }

  const url = new URL(`${API_BASE}/hojin`)
  if (params.keyword) url.searchParams.set('name', params.keyword)

  // 都道府県コードへ変換（漢字でも数字でもOK）
  if (params.prefecture) {
    const codes = resolvePrefectureCodes(params.prefecture)
    if (codes.length === 1) url.searchParams.set('prefecture', codes[0])
    // 複数（エリア）の場合は上位の collect 側で各県ごとに呼び出すので、ここでは未指定
  }

  if (params.industry) url.searchParams.set('business_items', params.industry)
  if (params.minEmployees) url.searchParams.set('employee_number_from', String(params.minEmployees))
  if (params.maxEmployees) url.searchParams.set('employee_number_to', String(params.maxEmployees))
  url.searchParams.set('page', String(params.page || 1))
  // gBizINFO の limit は最大 5000 (それ以上は400)。ページは10まで。
  // 大きい limit を使うと少ないAPI呼び出しで大量取得可能。
  url.searchParams.set('limit', String(Math.min(params.limit || 1000, 5000)))

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X-hojinInfo-api-token': apiToken,
    },
  })

  // 404 = 検索結果なし（API仕様上、ヒットゼロでも404）→ 空配列を返す
  if (response.status === 404) {
    return { companies: [], totalCount: 0, status: 404 }
  }
  if (!response.ok) {
    console.error(`gBizINFO API error: ${response.status} ${url.toString()}`)
    return { companies: [], totalCount: 0, status: response.status }
  }

  const data = await response.json()
  const companies: GbizCompanyInfo[] = (data['hojin-infos'] || []).map(mapHojinItem)
  return {
    companies,
    totalCount: data.totalCount || companies.length,
    status: 200,
  }
}

/**
 * gBizINFO 詳細（フル情報: 代表者・従業員数・資本金・URL・事業概要等）
 */
export async function getGbizCompanyDetail(corporateNumber: string): Promise<GbizCompanyInfo | null> {
  const apiToken = process.env.GBIZINFO_API_TOKEN
  if (!apiToken) return null
  if (!corporateNumber || !/^\d{13}$/.test(corporateNumber)) return null

  try {
    const response = await fetch(`${API_BASE}/hojin/${corporateNumber}`, {
      headers: {
        'Accept': 'application/json',
        'X-hojinInfo-api-token': apiToken,
      },
    })
    if (!response.ok) return null
    const data = await response.json()
    const item = data['hojin-infos']?.[0]
    if (!item) return null
    return mapHojinItem(item)
  } catch (e) {
    console.error(`[gbizinfo] detail fetch failed for ${corporateNumber}`, e)
    return null
  }
}

/**
 * 複数法人の詳細を並列バッチ取得（同時実行数を制限）
 * - wall-clock 予算でVercel 300秒制限の handle 内に収める
 * - 各リクエストにタイムアウト
 */
export async function getGbizCompanyDetailsBatch(
  corporateNumbers: string[],
  options: { concurrency?: number; signal?: AbortSignal; budgetMs?: number } = {}
): Promise<Map<string, GbizCompanyInfo>> {
  const concurrency = Math.max(1, Math.min(20, options.concurrency || 12))
  const budgetMs = options.budgetMs || 240000 // デフォルト 4分
  const startTime = Date.now()
  const result = new Map<string, GbizCompanyInfo>()
  const queue = [...new Set(corporateNumbers.filter(Boolean))]
  let processed = 0
  let exhausted = false

  async function worker() {
    while (queue.length > 0) {
      if (options.signal?.aborted) return
      // wall-clock 予算チェック
      if (Date.now() - startTime > budgetMs) {
        exhausted = true
        return
      }
      const num = queue.shift()
      if (!num) continue
      const detail = await getGbizCompanyDetail(num)
      if (detail) result.set(num, detail)
      processed++
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker))
  if (exhausted) {
    console.warn(`[gbizinfo] detail batch exhausted budget. processed=${processed}/${corporateNumbers.length}, hit=${result.size}`)
  } else {
    console.log(`[gbizinfo] detail batch done. processed=${processed}, hit=${result.size}`)
  }
  return result
}
