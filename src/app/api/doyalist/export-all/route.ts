export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encodeDoyalistExport, iterateDoyalistCsv } from '@/lib/doyalist/export-stream'
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
    const PAGE_SIZE = 100
    const firstProjects = await prisma.doyalistProject.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: PAGE_SIZE,
    })
    if (!firstProjects.length) return NextResponse.json({ error: 'エクスポートするプロジェクトがありません' }, { status: 404 })

    const archive = archiver('zip', { zlib: { level: 6 } })
    const output = new PassThrough()
    archive.on('error', error => output.destroy(error))
    archive.pipe(output)
    const cancel = () => { archive.abort(); output.destroy(new Error('Export cancelled')) }
    req.signal.addEventListener('abort', cancel, { once: true })
    output.once('close', () => req.signal.removeEventListener('abort', cancel))

    void (async () => {
      let projects = firstProjects
      let index = 0
      while (projects.length) {
        for (const project of projects) {
          if (output.destroyed) return
          index++
          const name = `${String(index).padStart(4, '0')}_${safeName(project.name)}_${safeName(project.id)}.csv`
          const input = Readable.from(encodeDoyalistExport(iterateDoyalistCsv(project.id)))
          input.on('error', error => { archive.abort(); output.destroy(error) })
          archive.append(input, { name })
        }
        if (projects.length < PAGE_SIZE || output.destroyed) break
        projects = await prisma.doyalistProject.findMany({
          where: { userId },
          select: { id: true, name: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: PAGE_SIZE,
          cursor: { id: projects[projects.length - 1].id },
          skip: 1,
        })
      }
      if (output.destroyed) return
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
