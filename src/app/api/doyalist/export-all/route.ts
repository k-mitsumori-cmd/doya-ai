export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildDoyalistCsv } from '@/lib/doyalist/export-csv'
import archiver from 'archiver'
import { PassThrough, Readable } from 'node:stream'

function safeName(value: string): string {
  return value.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim().slice(0, 60) || 'project'
}

/** One verified ZIP response avoids browsers silently blocking many downloads. */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

  try {
    const projects = await prisma.doyalistProject.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    if (!projects.length) return NextResponse.json({ error: 'エクスポートするプロジェクトがありません' }, { status: 404 })

    const archive = archiver('zip', { zlib: { level: 6 } })
    const output = new PassThrough()
    archive.on('error', error => output.destroy(error))
    archive.pipe(output)
    const cancel = () => { archive.abort(); output.destroy(new Error('Export cancelled')) }
    req.signal.addEventListener('abort', cancel, { once: true })
    output.once('close', () => req.signal.removeEventListener('abort', cancel))

    void (async () => {
      for (const [index, project] of projects.entries()) {
        if (output.destroyed) return
        const [companies, approaches] = await Promise.all([
          prisma.doyalistCompany.findMany({ where: { projectId: project.id }, orderBy: [{ score: 'desc' }, { createdAt: 'desc' }] }),
          prisma.doyalistApproach.findMany({ where: { projectId: project.id }, orderBy: { createdAt: 'desc' } }),
        ])
        const name = `${String(index + 1).padStart(4, '0')}_${safeName(project.name)}_${safeName(project.id)}.csv`
        archive.append(buildDoyalistCsv(companies, approaches), { name })
      }
      await archive.finalize()
    })().catch(error => { archive.abort(); output.destroy(error) })

    return new NextResponse(Readable.toWeb(output) as ReadableStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="doyalist-all-projects.zip"',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: 'エクスポートを準備できませんでした。時間をおいて再試行してください。' }, { status: 500 })
  }
}
