const API_BASE = 'https://api.houjin-bangou.nta.go.jp/4'

interface CorporateNumberResult {
  corporateNumber: string
  name: string
  address: string
  prefectureName: string
  cityName: string
  postCode: string
  kind: string // 法人種別
  updateDate: string
}

interface SearchParams {
  keyword?: string
  prefecture?: string
  from?: number
  count?: number
}

export async function searchCorporateNumber(params: SearchParams): Promise<CorporateNumberResult[]> {
  const apiKey = process.env.CORPORATE_NUMBER_API_KEY
  if (!apiKey) {
    console.warn('CORPORATE_NUMBER_API_KEY not set, returning empty results')
    return []
  }

  const url = new URL(`${API_BASE}/name`)
  url.searchParams.set('id', apiKey)
  url.searchParams.set('type', '12') // JSON format
  url.searchParams.set('history', '0')
  if (params.keyword) url.searchParams.set('name', params.keyword)
  if (params.prefecture) url.searchParams.set('address', params.prefecture)
  if (params.from) url.searchParams.set('from', String(params.from))
  url.searchParams.set('count', String(params.count || 50))

  const response = await fetch(url.toString())
  if (!response.ok) {
    throw new Error(`Corporate number API error: ${response.status}`)
  }

  const data = await response.json()

  if (!data?.['hojin-infos']?.['hojin-info']) {
    return []
  }

  const results = Array.isArray(data['hojin-infos']['hojin-info'])
    ? data['hojin-infos']['hojin-info']
    : [data['hojin-infos']['hojin-info']]

  return results.map((item: any) => ({
    corporateNumber: item.corporate_number || '',
    name: item.name || '',
    address: [item.prefecture_name, item.city_name, item.street_number].filter(Boolean).join(''),
    prefectureName: item.prefecture_name || '',
    cityName: item.city_name || '',
    postCode: item.post_code || '',
    kind: item.kind || '',
    updateDate: item.update_date || '',
  }))
}
