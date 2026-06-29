import { prisma } from '@/lib/prisma'
import { scrapeCompanyWebsite } from './collect/web-scraper'
import { getGbizCompanyDetail } from './collect/gbizinfo'

interface EnrichResult {
  companyId: string
  enriched: boolean
  fields: string[]
}

export async function enrichCompany(companyId: string): Promise<EnrichResult> {
  const company = await prisma.doyalistCompany.findUnique({ where: { id: companyId } })
  if (!company) throw new Error('Company not found')

  const updatedFields: string[] = []
  const updates: Record<string, any> = {}
  // DoyalistCompany に corporateNumber/employeeCount/capital の専用カラムは無いため、
  // 構造化エンリッチ値は enrichedData(JSON) に集約する。連絡先は contactPerson/contactPhone/contactEmail カラムを使う。
  const existingEnriched: Record<string, any> =
    company.enrichedData && typeof company.enrichedData === 'object' && !Array.isArray(company.enrichedData)
      ? (company.enrichedData as Record<string, any>)
      : {}
  const enriched: Record<string, any> = { ...existingEnriched }

  // Try gBizINFO if we have corporate number（法人番号は enrichedData に保持）
  const corporateNumber = typeof existingEnriched.corporateNumber === 'string' ? existingEnriched.corporateNumber : ''
  if (corporateNumber) {
    const gbizData = await getGbizCompanyDetail(corporateNumber)
    if (gbizData) {
      if (!enriched.employeeCount && gbizData.employeeNumber) {
        enriched.employeeCount = gbizData.employeeNumber
        updatedFields.push('employeeCount')
      }
      if (!enriched.capital && gbizData.capitalStock) {
        enriched.capital = gbizData.capitalStock
        updatedFields.push('capital')
      }
      if (!company.contactPerson && gbizData.representativeName) {
        updates.contactPerson = gbizData.representativeName
        updatedFields.push('contactPerson')
      }
      if (!company.website && gbizData.companyUrl) {
        updates.website = gbizData.companyUrl
        updatedFields.push('website')
      }
      if (!company.industry && gbizData.industry) {
        updates.industry = gbizData.industry
        updatedFields.push('industry')
      }
    }
  }

  // Try web scraping if we have a website URL
  const websiteUrl = company.website || updates.website
  if (websiteUrl) {
    const scraped = await scrapeCompanyWebsite(websiteUrl)
    if (scraped) {
      if (!company.contactPhone && scraped.phone) {
        updates.contactPhone = scraped.phone
        updatedFields.push('contactPhone')
      }
      if (!company.contactEmail && scraped.email) {
        updates.contactEmail = scraped.email
        updatedFields.push('contactEmail')
      }
      if (!company.industry && !updates.industry && scraped.industry) {
        updates.industry = scraped.industry
        updatedFields.push('industry')
      }
      if (!company.contactPerson && !updates.contactPerson && scraped.representative) {
        updates.contactPerson = scraped.representative
        updatedFields.push('contactPerson')
      }
    }
  }

  // enrichedData(JSON) に変化があれば更新対象に含める
  if (JSON.stringify(enriched) !== JSON.stringify(existingEnriched)) {
    updates.enrichedData = enriched
  }

  if (Object.keys(updates).length > 0) {
    await prisma.doyalistCompany.update({
      where: { id: companyId },
      data: updates,
    })
  }

  return {
    companyId,
    enriched: updatedFields.length > 0,
    fields: updatedFields,
  }
}

export async function enrichProjectCompanies(
  projectId: string,
  options: { concurrency?: number } = {}
): Promise<{ total: number; enriched: number; results: EnrichResult[] }> {
  const { concurrency = 3 } = options

  const companies = await prisma.doyalistCompany.findMany({
    where: { projectId },
    select: { id: true },
  })

  const results: EnrichResult[] = []
  let enrichedCount = 0

  for (let i = 0; i < companies.length; i += concurrency) {
    const batch = companies.slice(i, i + concurrency)
    const batchResults = await Promise.allSettled(
      batch.map((c) => enrichCompany(c.id))
    )
    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        results.push(r.value)
        if (r.value.enriched) enrichedCount++
      }
    }
  }

  return {
    total: companies.length,
    enriched: enrichedCount,
    results,
  }
}
