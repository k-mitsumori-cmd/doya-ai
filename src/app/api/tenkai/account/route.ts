// ============================================
// DELETE /api/tenkai/account
// ============================================
// ユーザーの展開AI関連データをすべて削除

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    // 確認パラメータ（安全のため）
    const body = await req.json().catch(() => ({}))
    const { confirmDelete } = body as { confirmDelete?: boolean }
    if (!confirmDelete) {
      return NextResponse.json(
        { error: '削除を確認してください（confirmDelete: true が必要です）' },
        { status: 400 }
      )
    }

    // Prisma の onDelete: Cascade により、プロジェクト削除時に
    // 紐づくOutputsも自動削除される。各テーブルを個別に削除する。
    const [deletedOutputs, deletedProjects, deletedBrandVoices, deletedTemplates, deletedUsage, deletedApiKeys] =
      await prisma.$transaction([
        // 出力（プロジェクトのCascadeでも消えるが明示的に先に削除）
        prisma.tenkaiOutput.deleteMany({
          where: { project: { userId } },
        }),
        // プロジェクト
        prisma.tenkaiProject.deleteMany({
          where: { userId },
        }),
        // ブランドボイス
        prisma.tenkaiBrandVoice.deleteMany({
          where: { userId },
        }),
        // テンプレート
        prisma.tenkaiTemplate.deleteMany({
          where: { userId },
        }),
        // 利用状況
        prisma.tenkaiUsage.deleteMany({
          where: { userId },
        }),
        // APIキー
        prisma.tenkaiApiKey.deleteMany({
          where: { userId },
        }),
      ])

    return NextResponse.json({
      message: '展開AIのすべてのデータを削除しました',
      deleted: {
        outputs: deletedOutputs.count,
        projects: deletedProjects.count,
        brandVoices: deletedBrandVoices.count,
        templates: deletedTemplates.count,
        usageRecords: deletedUsage.count,
        apiKeys: deletedApiKeys.count,
      },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'アカウント削除に失敗しました'
    console.error('[tenkai] account delete error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
