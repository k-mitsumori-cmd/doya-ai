import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { privateApiJson } from '@/lib/private-api-response'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { recoverSeoArticleCreation, seoArticleOperationId, SeoArticleOperationError } from '@/lib/seo-article-admission'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
async function handle(req: NextRequest, cancel: boolean) {
  try {
    const session = await getServerSession(authOptions)
    const userId = String(session?.user?.id || '').trim()
    if (!userId) return privateApiJson({ success: false, error: 'ログイン状態を確認してください。' }, { status: 401 })
    const values = new URL(req.url).searchParams.getAll('operationId')
    const operationId = values.length === 1 ? seoArticleOperationId(values[0]) : undefined
    if (!operationId) return privateApiJson({ success: false, error: '操作情報を確認できません。' }, { status: 400 })
    await ensureSeoSchema()
    const result = await recoverSeoArticleCreation(userId, operationId, cancel)
    return privateApiJson({ success: true, operationId, ...result })
  } catch (error) {
    if (error instanceof SeoArticleOperationError) return privateApiJson({ success: false, ...(error.status === 429 ? { code: 'SEO_CREATION_RECOVERY_LIMIT' } : {}), error: error.message }, { status: error.status })
    return privateApiJson({ success: false, error: '作成結果を確認できません。時間をおいて再確認してください。' }, { status: 503 })
  }
}
export async function GET(req: NextRequest) { return handle(req, false) }
export async function DELETE(req: NextRequest) { return handle(req, true) }
