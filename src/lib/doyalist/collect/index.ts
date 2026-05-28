import { searchCorporateNumber } from './corporate-number'
import { searchGbizInfo } from './gbizinfo'
import { scrapeCompanyWebsite } from './web-scraper'
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
  source: string
  rawData?: Record<string, any>
}

interface CollectOptions {
  criteria: TargetCriteria
  maxResults?: number
  sources?: ('corporate_number' | 'gbizinfo' | 'web')[]
}

export async function collectCompanies(options: CollectOptions): Promise<CollectedCompany[]> {
  const { criteria, maxResults = 100, sources = ['corporate_number', 'gbizinfo'] } = options
  const allCompanies: CollectedCompany[] = []

  // Source 1: National Tax Agency Corporate Number API
  if (sources.includes('corporate_number')) {
    for (const keyword of (criteria.keywords || []).slice(0, 3)) {
      if (!keyword) continue
      try {
        const results = await searchCorporateNumber({
          keyword,
          prefecture: criteria.areas?.[0],
          count: Math.min(50, maxResults),
        })
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
        console.error('Corporate number API error:', e)
      }
    }
  }

  // Source 2: gBizINFO API
  if (sources.includes('gbizinfo')) {
    for (const keyword of (criteria.keywords || []).slice(0, 3)) {
      if (!keyword) continue
      try {
        const { companies } = await searchGbizInfo({
          keyword,
          prefecture: criteria.areas?.[0],
          industry: criteria.industries?.[0],
          minEmployees: criteria.companySize?.minEmployees,
          maxEmployees: criteria.companySize?.maxEmployees,
          limit: Math.min(50, maxResults),
        })
        for (const c of companies) {
          allCompanies.push({
            companyName: c.name,
            corporateNumber: c.corporateNumber,
            address: c.address,
            prefecture: c.address?.match(/^(.+?[都道府県])/)?.[1],
            phone: undefined,
            email: undefined,
            website: c.companyUrl,
            industry: c.industry,
            employeeCount: c.employeeNumber,
            capital: c.capitalStock,
            foundedYear: c.foundingYear ? parseInt(c.foundingYear) : undefined,
            representative: c.representativeName,
            source: 'gbizinfo',
            rawData: c as any,
          })
        }
      } catch (e) {
        console.error('gBizINFO API error:', e)
      }
    }
  }

  // Deduplicate by corporate number, then by name similarity
  const deduplicated = deduplicateCompanies(allCompanies)

  return deduplicated.slice(0, maxResults)
}

function deduplicateCompanies(companies: CollectedCompany[]): CollectedCompany[] {
  const seen = new Map<string, CollectedCompany>()

  for (const company of companies) {
    // Deduplicate by corporate number
    if (company.corporateNumber) {
      const existing = seen.get(company.corporateNumber)
      if (existing) {
        // Merge: prefer non-null fields
        seen.set(company.corporateNumber, mergeCompanyData(existing, company))
      } else {
        seen.set(company.corporateNumber, company)
      }
    } else {
      // Deduplicate by name (exact match)
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
    source: `${a.source}+${b.source}`,
    rawData: { ...a.rawData, ...b.rawData },
  }
}
