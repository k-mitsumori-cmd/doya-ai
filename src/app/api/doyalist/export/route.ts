export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { privateApiJson } from '@/lib/private-api-response'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Readable } from 'node:stream'
import { createDoyalistXlsxStream } from '@/lib/doyalist/export-xlsx'
import {
  encodeDoyalistExport,
  iterateDoyalistCsv,
  preflightDoyalistExport,
} from '@/lib/doyalist/export-stream'

/**
 * GET /api/doyalist/export?projectId=xxx&format=csv|excel
 * 企業＋アプローチをCSV(UTF-8 BOM)またはXLSXでエクスポート
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return privateApiJson({ error: 'ログインが必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const format = (searchParams.get('format') || 'csv').toLowerCase()

    if (!projectId) {
      return privateApiJson({ error: 'projectIdは必須です' }, { status: 400 })
    }
    if (format !== 'csv' && format !== 'excel') {
      return privateApiJson(
        { error: 'formatはcsvまたはexcelを指定してください' },
        { status: 400 }
      )
    }

    const project = await prisma.doyalistProject.findUnique({
      where: { id: projectId },
    })
    if (!project) {
      return privateApiJson({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    }
    if (project.userId !== userId) {
      return privateApiJson({ error: 'アクセス権がありません' }, { status: 403 })
    }

    // Fail with a normal 500 response if the database is already unavailable.
    const firstPage = await preflightDoyalistExport(projectId)
    const safeName = (project.name || 'doyalist').replace(/[\\/:*?"<>|]/g, '_')

    if (format === 'csv') {
      const body = Readable.toWeb(Readable.from(encodeDoyalistExport(iterateDoyalistCsv(projectId, firstPage)))) as ReadableStream
      return new NextResponse(body, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Cache-Control': 'private, no-store',
          Vary: 'Cookie',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(
            safeName
          )}.csv`,
        },
      })
    }

    const body = Readable.toWeb(createDoyalistXlsxStream(project.name, projectId, firstPage, req.signal), {
      strategy: { highWaterMark: 65536, size: (chunk: Uint8Array) => chunk.byteLength },
    }) as ReadableStream
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Cache-Control': 'private, no-store',
          Vary: 'Cookie',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(
          safeName
        )}.xlsx`,
      },
    })
  } catch {
    console.error('[doyalist/export][GET] failed')
    return privateApiJson(
      { error: 'エクスポートに失敗しました' },
      { status: 500 }
    )
  }
}
