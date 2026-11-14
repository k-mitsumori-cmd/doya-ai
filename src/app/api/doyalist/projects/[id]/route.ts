export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import type { NextRequest } from 'next/server'
import { privateApiJson, privateApiResponse } from '@/lib/private-api-response'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { streamDoyalistJsonIterable } from '@/lib/doyalist/stream-json'
import { iterateDoyalistCompanies, readFirstDoyalistCompanyPage } from '@/lib/doyalist/export-stream'
import { OperationalBodyError, readOperationalJson } from '@/lib/operational-json'
import { MAX_DOYALIST_PROJECT_BODY_BYTES, parseDoyalistProjectInput } from '@/lib/doyalist/project-input'

type Ctx = { params: Promise<{ id: string }> }

async function resolveId(ctx: Ctx): Promise<string> {
  const p = await ctx.params
  return p.id
}

async function requireOwnedProject(userId: string, projectId: string) {
  const project = await prisma.doyalistProject.findUnique({
    where: { id: projectId },
  })
  if (!project) return { error: 'プロジェクトが見つかりません', status: 404 as const }
  if (project.userId !== userId) {
    return { error: 'アクセス権がありません', status: 403 as const }
  }
  return { project }
}

/**
 * GET /api/doyalist/projects/[id]
 * プロジェクト詳細 + 企業一覧 + アプローチサマリ
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return privateApiJson({ error: 'ログインが必要です' }, { status: 401 })
    }

    const id = await resolveId(ctx)
    const guard = await requireOwnedProject(userId, id)
    if ('error' in guard) {
      return privateApiJson({ error: guard.error }, { status: guard.status })
    }

    const [firstCompanies, statusGroups, approaches, approachCount] = await Promise.all([
      readFirstDoyalistCompanyPage(id),
      prisma.doyalistCompany.groupBy({
        by: ['status'],
        where: { projectId: id },
        _count: { _all: true },
      }),
      prisma.doyalistApproach.findMany({
        where: { projectId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.doyalistApproach.count({ where: { projectId: id } }),
    ])

    const statusCounts = Object.fromEntries(statusGroups.map((group) => [group.status, group._count._all]))
    const companyCount = statusGroups.reduce((sum, group) => sum + group._count._all, 0)

    return privateApiResponse(streamDoyalistJsonIterable({
      success: true,
      project: guard.project,
      approaches,
      summary: {
        companyCount,
        approachCount,
        statusCounts,
      },
    }, 'companies', iterateDoyalistCompanies(id, firstCompanies)))
  } catch {
    console.error('[doyalist/projects/[id]][GET] failed')
    return privateApiJson(
      { error: 'プロジェクトの取得に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/doyalist/projects/[id]
 * プロジェクト更新
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return privateApiJson({ error: 'ログインが必要です' }, { status: 401 })
    }

    const id = await resolveId(ctx)
    const guard = await requireOwnedProject(userId, id)
    if ('error' in guard) {
      return privateApiJson({ error: guard.error }, { status: guard.status })
    }

    let body: Record<string, unknown>
    try {
      body = await readOperationalJson(req, MAX_DOYALIST_PROJECT_BODY_BYTES)
    } catch (error) {
      if (error instanceof OperationalBodyError) {
        return privateApiJson({ error: '入力形式またはサイズを確認してください' }, { status: error.status })
      }
      throw error
    }
    const input = parseDoyalistProjectInput(body, 'update')
    if (!input.ok) return privateApiJson({ error: input.error }, { status: 400 })

    const project = await prisma.doyalistProject.update({
      where: { id },
      data: input.data,
    })

    return privateApiJson({ success: true, project })
  } catch {
    console.error('[doyalist/projects/[id]][PATCH] failed')
    return privateApiJson(
      { error: 'プロジェクトの更新に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/doyalist/projects/[id]
 * ソフト削除（status='archived'）
 */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return privateApiJson({ error: 'ログインが必要です' }, { status: 401 })
    }

    const id = await resolveId(ctx)
    const guard = await requireOwnedProject(userId, id)
    if ('error' in guard) {
      return privateApiJson({ error: guard.error }, { status: guard.status })
    }

    await prisma.doyalistProject.update({
      where: { id },
      data: { status: 'archived' },
    })

    return privateApiJson({ success: true })
  } catch {
    console.error('[doyalist/projects/[id]][DELETE] failed')
    return privateApiJson(
      { error: 'プロジェクトの削除に失敗しました' },
      { status: 500 }
    )
  }
}
