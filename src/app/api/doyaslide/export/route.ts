export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import archiver from 'archiver'
import { jsPDF } from 'jspdf'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/doyaslide/access'
import { fetchBuffer } from '@/lib/doyaslide/logo'

// GET /api/doyaslide/export?projectId=xxx&format=pdf|zip|png
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const format = (searchParams.get('format') || 'pdf').toLowerCase()
    if (!projectId) return NextResponse.json({ error: 'projectIdは必須です' }, { status: 400 })

    const project = await prisma.doyaSlideProject.findFirst({
      where: { id: projectId, userId },
      include: { slides: { where: { imageUrl: { not: null } }, orderBy: { index: 'asc' } } },
    })
    if (!project) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
    if (project.slides.length === 0) {
      return NextResponse.json({ error: '書き出せるスライドがありません' }, { status: 400 })
    }

    const safeTitle = (project.title || 'doyaslide').replace(/[^\w\-ぁ-んァ-ヶ一-龠]/g, '_').slice(0, 40)

    // 画像を取得し、PNGに正規化（jpg/webpが混在してもjsPDF/zipが壊れないように）
    const images = await Promise.all(
      project.slides.map(async (s) => {
        const raw = await fetchBuffer(s.imageUrl!)
        const buf = await sharp(raw).png().toBuffer()
        return { index: s.index, buf }
      })
    )

    // ===== PDF =====
    if (format === 'pdf') {
      let doc: jsPDF | null = null
      for (const img of images) {
        const meta = await sharp(img.buf).metadata()
        const w = meta.width || 1536
        const h = meta.height || 1024
        const orientation = w >= h ? 'landscape' : 'portrait'
        if (!doc) {
          doc = new jsPDF({ orientation, unit: 'px', format: [w, h], compress: true })
        } else {
          doc.addPage([w, h], orientation)
        }
        const dataUrl = `data:image/png;base64,${img.buf.toString('base64')}`
        doc.addImage(dataUrl, 'PNG', 0, 0, w, h)
      }
      const ab = doc!.output('arraybuffer')
      return new NextResponse(new Uint8Array(ab), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${safeTitle}.pdf"`,
        },
      })
    }

    // ===== ZIP（PNG束）=====
    const archive = archiver('zip', { zlib: { level: 6 } })
    const chunks: Buffer[] = []
    archive.on('data', (c: Buffer) => chunks.push(c))
    const done = new Promise<void>((resolve, reject) => {
      archive.on('end', () => resolve())
      archive.on('error', (e) => reject(e))
    })
    for (const img of images) {
      const name = `slide-${String(img.index).padStart(2, '0')}.png`
      archive.append(img.buf, { name })
    }
    await archive.finalize()
    await done
    const zipBuf = Buffer.concat(chunks)

    return new NextResponse(new Uint8Array(zipBuf), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${safeTitle}.zip"`,
      },
    })
  } catch (e: any) {
    console.error('[doyaslide/export]', e?.message)
    return NextResponse.json({ error: 'エクスポートに失敗しました' }, { status: 500 })
  }
}
