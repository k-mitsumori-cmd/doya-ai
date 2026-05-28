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
  prefecture?: string
  industry?: string
  minEmployees?: number
  maxEmployees?: number
  page?: number
  limit?: number
}

export async function searchGbizInfo(params: SearchParams): Promise<{ companies: GbizCompanyInfo[]; totalCount: number }> {
  const apiToken = process.env.GBIZINFO_API_TOKEN
  if (!apiToken) {
    console.warn('GBIZINFO_API_TOKEN not set, returning empty results')
    return { companies: [], totalCount: 0 }
  }

  const url = new URL(`${API_BASE}/hojin`)
  if (params.keyword) url.searchParams.set('name', params.keyword)
  if (params.prefecture) url.searchParams.set('prefecture', params.prefecture)
  if (params.industry) url.searchParams.set('business_items', params.industry)
  if (params.minEmployees) url.searchParams.set('employee_number_from', String(params.minEmployees))
  if (params.maxEmployees) url.searchParams.set('employee_number_to', String(params.maxEmployees))
  url.searchParams.set('page', String(params.page || 1))
  url.searchParams.set('limit', String(params.limit || 50))

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X-hojinInfo-api-token': apiToken,
    },
  })

  if (!response.ok) {
    console.error(`gBizINFO API error: ${response.status}`)
    return { companies: [], totalCount: 0 }
  }

  const data = await response.json()

  const companies: GbizCompanyInfo[] = (data['hojin-infos'] || []).map((item: any) => ({
    corporateNumber: item.corporate_number || '',
    name: item.name || '',
    nameKana: item.name_kana || undefined,
    postalCode: item.postal_code || undefined,
    address: item.location || undefined,
    representativeName: item.representative_name || undefined,
    capitalStock: item.capital_stock ? String(item.capital_stock) : undefined,
    employeeNumber: item.employee_number ? String(item.employee_number) : undefined,
    foundingYear: item.founding_year ? String(item.founding_year) : undefined,
    businessSummary: item.business_summary || undefined,
    companyUrl: item.company_url || undefined,
    status: item.status || undefined,
    industry: item.business_items?.[0] || undefined,
    dateOfEstablishment: item.date_of_establishment || undefined,
    updateDate: item.update_date || undefined,
    certifications: item.certification || [],
  }))

  return {
    companies,
    totalCount: data.totalCount || companies.length,
  }
}

export async function getGbizCompanyDetail(corporateNumber: string): Promise<GbizCompanyInfo | null> {
  const apiToken = process.env.GBIZINFO_API_TOKEN
  if (!apiToken) return null

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

  return {
    corporateNumber: item.corporate_number || corporateNumber,
    name: item.name || '',
    nameKana: item.name_kana || undefined,
    postalCode: item.postal_code || undefined,
    address: item.location || undefined,
    representativeName: item.representative_name || undefined,
    capitalStock: item.capital_stock ? String(item.capital_stock) : undefined,
    employeeNumber: item.employee_number ? String(item.employee_number) : undefined,
    foundingYear: item.founding_year ? String(item.founding_year) : undefined,
    businessSummary: item.business_summary || undefined,
    companyUrl: item.company_url || undefined,
    status: item.status || undefined,
    industry: item.business_items?.[0] || undefined,
    dateOfEstablishment: item.date_of_establishment || undefined,
    updateDate: item.update_date || undefined,
    certifications: item.certification || [],
  }
}
