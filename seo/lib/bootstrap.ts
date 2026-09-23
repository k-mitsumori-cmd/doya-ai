import { prisma } from '@/lib/prisma'
import { inspectSeoSchema } from './schema-readiness'

let checkPromise: Promise<void> | null = null
let checkedUntil = 0

/** Read-only readiness check. Schema changes must be applied before releasing code. */
export async function ensureSeoSchema(): Promise<void> {
  if (checkPromise) return checkPromise
  if (Date.now() < checkedUntil) return
  checkPromise = (async () => {
    try {
      const result = await inspectSeoSchema(prisma)
      if (!result.ready) throw new Error('Missing schema')
      checkedUntil = Date.now() + 60_000
    } catch {
      const error = new Error('記事サービスの準備を確認できませんでした。時間をおいて再試行してください。')
      Object.assign(error, { code: 'SEO_SCHEMA_NOT_READY' })
      throw error
    } finally {
      checkPromise = null
    }
  })()
  return checkPromise
}
