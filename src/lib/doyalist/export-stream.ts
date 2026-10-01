import { prisma } from '@/lib/prisma'
import {
  DOYALIST_APPROACH_HEADERS,
  DOYALIST_COMPANY_HEADERS,
  doyalistApproachCsvRow,
  doyalistCompanyCsvRow,
  doyalistCsvHeader,
} from '@/lib/doyalist/export-csv'

export const DOYALIST_EXPORT_PAGE_SIZE = 200

const companyOrder = [{ score: 'desc' as const }, { createdAt: 'desc' as const }, { id: 'desc' as const }]
const approachOrder = [{ createdAt: 'desc' as const }, { id: 'desc' as const }]

export async function preflightDoyalistExport(projectId: string) {
  const [companies, approaches] = await Promise.all([
    prisma.doyalistCompany.findMany({ where: { projectId }, orderBy: companyOrder, take: DOYALIST_EXPORT_PAGE_SIZE }),
    prisma.doyalistApproach.findMany({ where: { projectId }, orderBy: approachOrder, take: DOYALIST_EXPORT_PAGE_SIZE }),
  ])
  return { companies, approaches }
}

export type DoyalistExportFirstPage = Awaited<ReturnType<typeof preflightDoyalistExport>>

/** Read a project in bounded pages so historical exports do not load every row at once. */
export async function* iterateDoyalistCompanies(projectId: string, firstPage?: DoyalistExportFirstPage['companies']) {
  let cursor: string | undefined
  let prefetched = firstPage
  while (true) {
    const rows = prefetched ?? await prisma.doyalistCompany.findMany({
      where: { projectId },
      orderBy: companyOrder,
      take: DOYALIST_EXPORT_PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    prefetched = undefined
    for (const row of rows) yield row
    if (rows.length < DOYALIST_EXPORT_PAGE_SIZE) return
    cursor = rows[rows.length - 1].id
  }
}

export async function* iterateDoyalistApproaches(projectId: string, firstPage?: DoyalistExportFirstPage['approaches']) {
  let cursor: string | undefined
  let prefetched = firstPage
  while (true) {
    const rows = prefetched ?? await prisma.doyalistApproach.findMany({
      where: { projectId },
      orderBy: approachOrder,
      take: DOYALIST_EXPORT_PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    prefetched = undefined
    for (const row of rows) yield row
    if (rows.length < DOYALIST_EXPORT_PAGE_SIZE) return
    cursor = rows[rows.length - 1].id
  }
}

export async function* iterateDoyalistCsv(projectId: string, firstPage?: DoyalistExportFirstPage): AsyncGenerator<string> {
  yield `\uFEFF# 企業一覧\r\n${doyalistCsvHeader(DOYALIST_COMPANY_HEADERS)}`
  for await (const company of iterateDoyalistCompanies(projectId, firstPage?.companies)) {
    yield `\r\n${doyalistCompanyCsvRow(company)}`
  }
  yield `\r\n\r\n# アプローチ一覧\r\n${doyalistCsvHeader(DOYALIST_APPROACH_HEADERS)}`
  for await (const approach of iterateDoyalistApproaches(projectId, firstPage?.approaches)) {
    yield `\r\n${doyalistApproachCsvRow(approach)}`
  }
}

export async function* encodeDoyalistExport(chunks: AsyncIterable<string>): AsyncGenerator<Buffer> {
  for await (const chunk of chunks) yield Buffer.from(chunk, 'utf8')
}
