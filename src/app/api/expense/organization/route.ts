export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getOwnCompany } from '@/lib/shell/company.server'
import { audit, createOrganization, readJson, resolveUserId, withExpense } from '@/lib/expense/access'
import { WITHHOLDING_MODES } from '@/lib/expense/constants'
import { syncWithholding, retryOnConflict } from '@/lib/expense/sync'
import { oneOf, slackWebhook, str } from '@/lib/expense/validate'

// POST /api/expense/organization — 初回の組織作成
export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId()
    if (!userId) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    const body = await req.json().catch(() => null)
    // 1アカウント＝1会社（2026-10-24）: fromAccountCompany のときは、組織名をアカウントの会社（account_companies）から、
    // 氏名をアカウントの名前から、サーバーで決める（クライアントの名前は使わない）。会社が未登録なら 409
    if (body?.fromAccountCompany === true) {
      const company = await getOwnCompany(userId)
      const companyName = company?.name?.trim().slice(0, 120) || ''
      if (!companyName) return NextResponse.json({ error: '会社が登録されていません。先に会社を登録してください。', code: 'COMPANY_REQUIRED' }, { status: 409 })
      const session = await getServerSession(authOptions).catch(() => null)
      const memberName = (session?.user?.name?.trim() || session?.user?.email?.split('@')[0] || companyName).slice(0, 80)
      const org = await createOrganization(userId, companyName, memberName)
      return NextResponse.json({ organization: { id: org.id, name: org.name, slug: org.slug } })
    }
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : ''
    const memberName = typeof body?.memberName === 'string' ? body.memberName.trim().slice(0, 80) : ''
    if (!name || !memberName) return NextResponse.json({ error: '組織名と氏名は必須です' }, { status: 400 })
    const org = await createOrganization(userId, name, memberName)
    return NextResponse.json({ organization: { id: org.id, name: org.name, slug: org.slug } })
  } catch {
    console.error('[expense/organization] create failed')
    return NextResponse.json({ error: '組織の作成に失敗しました' }, { status: 500 })
  }
}

// GET /api/expense/organization?org= — 組織の設定
export async function GET(req: NextRequest) {
  return withExpense(req, 'member', async (ctx) => {
    const org = await prisma.expenseOrganization.findUniqueOrThrow({ where: { id: ctx.organizationId } })
    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        withholdingMode: org.withholdingMode,
        // Webhook URL は秘密なので admin 以上にだけ返す
        slackWebhookUrl: ['owner', 'admin'].includes(ctx.role) ? org.slackWebhookUrl : null,
        hasSlack: !!org.slackWebhookUrl,
      },
      role: ctx.role,
    })
  })
}

// PATCH /api/expense/organization?org= — 組織名・源泉税の納付方法・Slack 通知先（admin 以上）
export async function PATCH(req: NextRequest) {
  return withExpense(req, 'admin', async (ctx) => {
    const body = await readJson(req)
    const data: { name?: string; withholdingMode?: string; slackWebhookUrl?: string | null } = {}
    if ('name' in body) data.name = str(body.name, '組織名', 120)!
    if ('withholdingMode' in body) data.withholdingMode = oneOf(body.withholdingMode, WITHHOLDING_MODES, '源泉税の納付方法')
    if ('slackWebhookUrl' in body) data.slackWebhookUrl = slackWebhook(body.slackWebhookUrl)
    await retryOnConflict(() => prisma.$transaction(async (tx) => {
      await tx.expenseOrganization.update({ where: { id: ctx.organizationId }, data })
      if (data.withholdingMode) await syncWithholding(tx, ctx.organizationId)
      await audit(tx, ctx, 'organization.update', 'organization', ctx.organizationId, { fields: Object.keys(data) })
    }))
    return NextResponse.json({ ok: true })
  })
}
