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
import { uploadExportFile } from '@/lib/doyaslide/storage'
import { raceTimeout } from '@/lib/fetch-timeout'
import { errorSuffix } from '@/lib/doyaslide/errors'

// GET /api/doyaslide/export?projectId=xxx&format=pdf|zip
// 生成物(PDF/ZIP)はバイナリ直返しせず Supabase に保存し、ダウンロードURLをJSONで返す。
// 理由: Vercel Functions のレスポンス本文上限(約4.5MB)で大きな書き出しが失敗するため。
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const format = (searchParams.get('format') || 'pdf').toLowerCase() === 'zip' ? 'zip' : 'pdf'
    if (!projectId) return NextResponse.json({ error: 'projectIdは必須です' }, { status: 400 })

    const project = await prisma.doyaSlideProject.findFirst({
      where: { id: projectId, userId },
      include: { slides: { where: { imageUrl: { not: null } }, orderBy: { index: 'asc' } } },
    })
    if (!project) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
    if (project.slides.length === 0) {
      return NextResponse.json({ error: '書き出せるスライドがありません' }, { status: 400 })
    }

    const safeTitle = (project.title || 'doyaslide').replace(/[^\w\-ぁ-んァ-ヶ一-龠]/g, '_').slice(0, 40) || 'doyaslide'

    // 画像を取得しPNGへ正規化。1枚の取得失敗で全体を止めず、成功分だけで書き出す。
    const FETCH_TIMEOUT_MS = Number(process.env.DOYA_EXPORT_FETCH_TIMEOUT_MS) || 30000
    const results = await Promise.all(
      project.slides.map(async (s) => {
        try {
          const raw = await raceTimeout(`export-fetch-${s.index}`, FETCH_TIMEOUT_MS, fetchBuffer(s.imageUrl!))
          const buf = await sharp(raw).png().toBuffer()
          return { index: s.index, buf }
        } catch (e) {
          console.error(`[doyaslide/export] slide#${s.index} 取得失敗:`, (e as any)?.message)
          return null
        }
      })
    )
    const images = results.filter((x): x is { index: number; buf: Buffer } => x !== null)
    if (images.length === 0) {
      return NextResponse.json(
        { error: `画像の取得に失敗しました${errorSuffix('all slide image fetches failed')}` },
        { status: 502 }
      )
    }
    const skipped = project.slides.length - images.length

    let buffer: Buffer
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
      buffer = Buffer.from(doc!.output('arraybuffer'))
    } else {
      const archive = archiver('zip', { zlib: { level: 6 } })
      const chunks: Buffer[] = []
      archive.on('data', (c: Buffer) => chunks.push(c))
      const done = new Promise<void>((resolve, reject) => {
        archive.on('end', () => resolve())
        archive.on('error', (e) => reject(e))
      })
      for (const img of images) {
        archive.append(img.buf, { name: `slide-${String(img.index).padStart(2, '0')}.png` })
      }
      await archive.finalize()
      await done
      buffer = Buffer.concat(chunks)
    }

    const { url } = await uploadExportFile(userId, buffer, format, safeTitle)
    return NextResponse.json(
      { url, filename: `${safeTitle}.${format}`, skipped },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e: any) {
    console.error('[doyaslide/export]', e?.message)
    return NextResponse.json({ error: `エクスポートに失敗しました${errorSuffix(e)}` }, { status: 500 })
  }
}
