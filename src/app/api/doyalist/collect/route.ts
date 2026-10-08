export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { collectCompaniesDetailed } from '@/lib/doyalist/collect'
import { beginDoyalistExtraction, completeDoyalistExtraction, recoverDoyalistExtraction, failDoyalistExtraction, DoyalistExtractionError } from '@/lib/doyalist/extraction-operation'
import { doyalistOperationResponse } from '@/lib/doyalist/extraction-response'
import { OperationalBodyError, readOperationalJson } from '@/lib/operational-json'
import { resolveDoyalistSearchKeywords } from '@/lib/doyalist/search-keywords'
import {
  getUserDoyalistLimits,
} from '@/lib/doyalist/limits'

/**
 * POST /api/doyalist/collect
 * gBizINFO（経済産業省）+ 法人番号API（国税庁）から実企業を抽出し、
 * DoyalistCompany レコードを作成
 * Body: { projectId: string, count: number }
 */
export async function POST(req: NextRequest) {
  let worker: { userId: string; operationId: string } | undefined
  let cancel: (() => void) | undefined
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    let body: Record<string, unknown>
    try {
      body = await readOperationalJson(req, 8 * 1024)
    } catch (error) {
      if (error instanceof OperationalBodyError) {
        return NextResponse.json({ error: '入力形式またはサイズを確認してください' }, { status: error.status })
      }
      throw error
    }
    const { projectId, operationId } = body
    if (typeof operationId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(operationId)) {
      return NextResponse.json({ error: '画面を更新して、保存結果を確認してから操作してください。', code: 'OPERATION_REQUIRED' }, { status: 409 })
    }
    const requestedCount = body.count === undefined ? 10 : body.count
    if (typeof projectId !== 'string' || !projectId.trim() || projectId.length > 128
      || typeof requestedCount !== 'number' || !Number.isSafeInteger(requestedCount) || requestedCount < 1) {
      return NextResponse.json({ error: 'プロジェクトと件数の入力形式を確認してください' }, { status: 400 })
    }
    const MAX_COUNT_PER_REQUEST = 10000 // 1回最大10,000社（Vercel maxDuration=300s以内）
    const count = Math.min(MAX_COUNT_PER_REQUEST, requestedCount)
    const wasClamped = requestedCount > MAX_COUNT_PER_REQUEST

    // プロジェクト所有権確認
    const project = await prisma.doyalistProject.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    }
    if (project.userId !== userId) {
      return NextResponse.json({ error: 'アクセス権がありません' }, { status: 403 })
    }

    // プラン上限チェック
    const limits = await getUserDoyalistLimits(userId)
    const quotaAction = limits.tier === 'FREE' || limits.tier === 'GUEST'
      ? { upgradeUrl: '/doyalist/pricing' }
      : { contactUrl: 'https://doyamarke.surisuta.jp/contact' }
    const identity = { userId, operationId }
    const admission = await beginDoyalistExtraction({ ...identity, projectId, count, selection: project })
    if (admission.state === 'busy') return NextResponse.json({ success: false, operationId: admission.operationId, projectId, state: 'busy', count, generated: 0 }, { status: 202, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
    if (admission.state !== 'started') return await doyalistOperationResponse(identity, quotaAction)
    worker = identity
    cancel = () => { void recoverDoyalistExtraction(identity, true).catch(() => { console.error('[doyalist/collect] Cancellation acknowledgement failed') }) }
    req.signal.addEventListener('abort', cancel, { once: true })
    if (req.signal.aborted) {
      await recoverDoyalistExtraction(identity, true)
      await failDoyalistExtraction(identity)
      return await doyalistOperationResponse(identity, quotaAction)
    }

    const industry = project.industry || ''
    const region = project.region || ''
    const searchKeywords = resolveDoyalistSearchKeywords(industry, project.keywords || '')

    let collectedResult: Awaited<ReturnType<typeof collectCompaniesDetailed>>
    try {
      collectedResult = await collectCompaniesDetailed({
        criteria: {
          keywords: searchKeywords,
          areas: region && region !== '全国' ? [region] : undefined,
          industries: industry ? [industry] : undefined,
        } as any,
        maxResults: count,
        sources: ['gbizinfo', 'corporate_number'],
        enrich: true,
        // 全件 enrich してすべてソート可能にする（Vercel 300秒制限内に収まる範囲）
        // 1万社で 約3分（並列12 × 200ms × 833ラウンド）
        enrichLimit: Math.min(count, 10000),
      })
    } catch {
      await failDoyalistExtraction(identity, undefined, undefined, 'api_error')
      console.error('[doyalist/collect] Collection provider failed')
      return await doyalistOperationResponse(identity, quotaAction)
    }

    const collected = collectedResult.companies
    if (collected.length === 0) {
      await failDoyalistExtraction(identity, undefined, undefined,
        collectedResult.budgetExhausted ? 'collection_timeout' : !collectedResult.apiOk ? 'api_error' : 'no_hits')
      return await doyalistOperationResponse(identity, quotaAction)
    }

    // 業種名のサニタイズ: 数字のみ・空・"指定なし"はAPIの実態にないので無効扱い
    const sanitizeIndustry = (v: string | null | undefined): string | null => {
      if (!v) return null
      const s = String(v).trim()
      if (!s || s === '指定なし' || /^\d+$/.test(s)) return null
      return s
    }
    const sanitizeEmployees = (v: string | null | undefined): string | null => {
      if (!v) return null
      const s = String(v).trim()
      if (!s || s === '指定なし' || s === '0' || s === '−' || s === '-') return null
      return s
    }

    // DB保存（実企業データ）
    const rows = collected.slice(0, count).map((c) => {
      const industryClean = sanitizeIndustry(c.industry) || sanitizeIndustry(project.industry)
      const employeesClean = sanitizeEmployees(c.employeeCount)
      return {
        projectId,
        name: c.companyName.slice(0, 200),
        website: c.website || null,
        industry: industryClean,
        region: c.prefecture || (project.region && project.region !== '全国' ? project.region : null),
        size: employeesClean, // gBizINFO 未取得の場合は null（"指定なし"を入れない）
        description: c.businessSummary || null,
        contactPerson: c.representative || null,
        enrichedData: {
          corporateNumber: c.corporateNumber || null,
          address: c.address || null,
          prefecture: c.prefecture || null,
          representative: c.representative || null,
          capital: c.capital || null,
          employeeCount: employeesClean,
          foundedYear: c.foundedYear || null,
          businessSummary: c.businessSummary || null,
          industry: industryClean,
        },
        score: null,
        status: 'new',
        source: c.source,
      }
    })
    await completeDoyalistExtraction(identity, async (tx, ownedProjectId, allowed) => {
      const created = await tx.doyalistCompany.createManyAndReturn({ data: rows.slice(0, allowed).map(row => ({ ...row, projectId: ownedProjectId })) })
      const warnings = [
        wasClamped ? `1回のリクエストでは最大${MAX_COUNT_PER_REQUEST}社まで生成可能です。${requestedCount}社のリクエストを${count}社に調整しました。` : null,
        collectedResult.budgetExhausted ? `取得に時間がかかったため、取得できた${created.length}社を保存しました。再収集の前に保存済みの一覧をご確認ください。` : null,
      ].filter(Boolean).join(' ')
      return { ids: created.map(row => row.id), warning: warnings || undefined }
    })
    return await doyalistOperationResponse(identity, quotaAction)
  } catch (error) {
    if (worker) {
      try { await failDoyalistExtraction(worker) } catch { console.error('[doyalist/collect] Worker acknowledgement failed') }
    }
    if (error instanceof DoyalistExtractionError) return NextResponse.json({ error: '抽出の保存状況を確認できません。新しく抽出せず、保存結果を確認してください。', code: error.code }, { status: error.status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
    console.error('[doyalist/collect][POST] failed')
    return NextResponse.json(
      { error: '企業生成に失敗しました' },
      { status: 500 }
    )
  } finally {
    if (cancel) req.signal.removeEventListener('abort', cancel)
  }
}
