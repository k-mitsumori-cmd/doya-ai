import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureSeoStorage, readFileAsBuffer, saveBase64ToFile } from '@seo/lib/storage'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { geminiGenerateImagePng, GEMINI_IMAGE_MODEL_DEFAULT } from '@seo/lib/gemini'

export const runtime = 'nodejs'

type PlanCode = 'GUEST' | 'FREE' | 'PRO' | 'ENTERPRISE' | 'UNKNOWN'
function normalizePlan(raw: any): PlanCode {
  const s = String(raw || '').toUpperCase().trim()
  if (s === 'PRO') return 'PRO'
  if (s === 'ENTERPRISE') return 'ENTERPRISE'
  if (s === 'FREE') return 'FREE'
  if (s === 'GUEST') return 'GUEST'
  return 'UNKNOWN'
}
function isPaid(plan: PlanCode) {
  return plan === 'PRO' || plan === 'ENTERPRISE'
}

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  await ensureSeoSchema()
  const id = ctx.params.id
  const session = await getServerSession(authOptions)
  const user: any = session?.user || null
  const userId = String(user?.id || '')

  const img = await (prisma as any).seoImage.findUnique({
    where: { id },
    include: { article: { select: { userId: true } } },
  })
  if (!img) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
  if (!userId) return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
  if (String(img?.article?.userId || '') !== userId) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 })
  }

  let buf: Buffer
  try {
    buf = await readFileAsBuffer(img.filePath)
  } catch (e: any) {
    // Vercel等サーバレスではファイル永続できない場合があるため、必要なら再生成して復元
    const code = String(e?.code || '')
    const msg = String(e?.message || '')
    const missing = code === 'ENOENT' || /no such file or directory/i.test(msg)
    const plan = normalizePlan(user?.seoPlan || user?.plan || (userId ? 'FREE' : 'GUEST'))
    if (!missing || !isPaid(plan)) {
      return NextResponse.json(
        { success: false, error: missing ? '画像ファイルが見つかりません（再生成が必要です）' : msg || '画像の読み込みに失敗しました' },
        { status: 404 }
      )
    }

    await ensureSeoStorage()
    const kind = String(img.kind || '').toUpperCase()
    const aspectRatio = kind === 'BANNER' ? '16:9' : '1:1'
    const gen = await geminiGenerateImagePng({
      prompt: String(img.prompt || ''),
      aspectRatio: aspectRatio as any,
      imageSize: '2K',
      model: GEMINI_IMAGE_MODEL_DEFAULT,
    })
    const filename = `seo_${String(img.articleId)}_${Date.now()}_${kind.toLowerCase()}.png`
    const saved = await saveBase64ToFile({ base64: gen.dataBase64, filename, subdir: 'images' })
    await (prisma as any).seoImage.update({
      where: { id },
      data: { filePath: saved.relativePath, mimeType: gen.mimeType || 'image/png' },
    })
    buf = Buffer.from(gen.dataBase64, 'base64')
  }
  // BufferをUint8Arrayに変換してBodyInitとして渡す
  const body = new Uint8Array(buf)
  return new NextResponse(body, {
    headers: {
      'Content-Type': img.mimeType || 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}


