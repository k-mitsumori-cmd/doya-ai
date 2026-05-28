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

  // Try gBizINFO if we have corporate number
  if (company.corporateNumber) {
    const gbizData = await getGbizCompanyDetail(company.corporateNumber)
    if (gbizData) {
      if (!company.employeeCount && gbizData.employeeNumber) {
        updates.employeeCount = gbizData.employeeNumber
        updatedFields.push('employeeCount')
      }
      if (!company.capital && gbizData.capitalStock) {
        updates.capital = gbizData.capitalStock
        updatedFields.push('capital')
      }
      if (!company.representative && gbizData.representativeName) {
        updates.representative = gbizData.representativeName
        updatedFields.push('representative')
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
      if (!company.phone && scraped.phone) {
        updates.phone = scraped.phone
        updatedFields.push('phone')
      }
      if (!company.email && scraped.email) {
        updates.email = scraped.email
        updatedFields.push('email')
      }
      if (!company.industry && !updates.industry && scraped.industry) {
        updates.industry = scraped.industry
        updatedFields.push('industry')
      }
      if (!company.representative && !updates.representative && scraped.representative) {
        updates.representative = scraped.representative
        updatedFields.push('representative')
      }
    }
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
