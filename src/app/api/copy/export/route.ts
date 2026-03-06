// ============================================
// POST /api/copy/export
// ============================================
// コピーをCSV形式でエクスポート

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isCopyProPlan } from '@/lib/pricing'

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function buildCsvRow(values: string[]): string {
  return values.map(escapeCsv).join(',')
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id

    const { projectId, format, copyIds } = await req.json() as {
      projectId: string
      format?: 'google' | 'yahoo' | 'generic'
      copyIds?: string[]
    }

    if (!projectId) {
      return NextResponse.json({ error: 'projectIdは必須です' }, { status: 400 })
    }

    // ===== エクスポートはProプラン以上限定 =====
    if (userId) {
      const planUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true },
      })
      if (!isCopyProPlan(planUser?.plan)) {
        return NextResponse.json(
          { error: 'CSV/Excelエクスポートはプロプラン以上で利用可能です', upgradePath: '/copy/pricing' },
          { status: 403 }
        )
      }
    } else {
      // ゲスト（未ログイン）は利用不可
      return NextResponse.json(
        { error: 'CSV/Excelエクスポートはプロプラン以上で利用可能です', upgradePath: '/copy/pricing' },
        { status: 403 }
      )
    }

    const project = await prisma.copyProject.findUnique({
      where: { id: projectId },
      include: {
        copies: {
          where: copyIds ? { id: { in: copyIds } } : {},
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    if (project.userId && project.userId !== userId) {
      return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 })
    }

    const exportFormat = format || 'generic'
    let csvContent = ''
    const BOM = '\uFEFF'

    if (exportFormat === 'google') {
      // Google広告インポート形式
      const headers = ['キャンペーン', '広告グループ', '見出し1', '見出し2', '見出し3', '説明文1', '説明文2', 'ファイナルURL']
      csvContent = BOM + headers.join(',') + '\n'
      for (const copy of project.copies) {
        // 説明文2: description + cta を結合（90文字以内）して情報量を確保
        const desc2 = copy.cta ? `${copy.catchcopy || ''} ${copy.cta}`.trim() : (copy.catchcopy || '')
        const row = buildCsvRow([
          project.name,
          copy.writerType || '広告グループ1',
          copy.headline || '',
          copy.catchcopy || '',
          copy.cta || '',
          copy.description || '',
          desc2.slice(0, 90),
          project.productUrl || '',
        ])
        csvContent += row + '\n'
      }
    } else if (exportFormat === 'yahoo') {
      // Yahoo!広告インポート形式
      const headers = ['キャンペーン名', '広告グループ名', 'タイトル', '説明文', '表示URL', 'リンク先URL']
      csvContent = BOM + headers.join(',') + '\n'
      for (const copy of project.copies) {
        const row = buildCsvRow([
          project.name,
          copy.writerType || '広告グループ1',
          copy.headline || '',
          copy.description || '',
          '',
          project.productUrl || '',
        ])
        csvContent += row + '\n'
      }
    } else {
      // 汎用CSV
      const headers = ['ID', 'ライタータイプ', '訴求軸', 'ヘッドライン', '説明文', 'キャッチコピー', 'CTA', '広告タイプ', 'プラットフォーム', 'お気に入り', '作成日']
      csvContent = BOM + headers.join(',') + '\n'
      for (const copy of project.copies) {
        const row = buildCsvRow([
          copy.id,
          copy.writerType || '',
          copy.appealAxis || '',
          copy.headline || '',
          copy.description || '',
          copy.catchcopy || '',
          copy.cta || '',
          copy.type || 'display',
          copy.platform || '',
          copy.isFavorite ? '★' : '',
          new Date(copy.createdAt).toLocaleDateString('ja-JP'),
        ])
        csvContent += row + '\n'
      }
    }

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(project.name)}_copies.csv"`,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Copy export error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
