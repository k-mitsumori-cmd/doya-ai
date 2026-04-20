import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureSeoStorage, readFileAsBuffer, saveBase64ToFile } from '@seo/lib/storage'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { geminiGenerateImagePng, GEMINI_IMAGE_MODEL_DEFAULT } from '@seo/lib/gemini'
import { getGuestIdFromRequest, isTrialActive, normalizeSeoPlan, canUseSeoImages } from '@/lib/seoAccess'

export const runtime = 'nodejs'

function stripNoTextStatements(raw: string): string {
  const s = String(raw || '')
  if (!s) return s
  const lines = s.replace(/\r\n/g, '\n').split('\n')
  const filtered = lines.filter((line) => {
    const t = line.trim()
    if (!t) return true
    // 「文字を入れない」「文字は入れない」「NO TEXT」系を含む行を除去
    if (/文字.*入れない/i.test(t)) return false
    if (/NO TEXT/i.test(t)) return false
    // 「ネガティブスペース」「余白を確保」を含む行を除去
    if (/ネガティブスペース/i.test(t)) return false
    if (/後から文字を載せ/i.test(t)) return false
    if (/余白.*確保/i.test(t)) return false
    // 「参考：後から載せる…」パターン
    if (/参考.*後から載せる.*コピー/i.test(t)) return false
    return true
  })
  return filtered.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  await ensureSeoSchema()
  const id = ctx.params.id
  const session = await getServerSession(authOptions)
  const user: any = session?.user || null
  const userId = String(user?.id || '')
  const guestId = !userId ? getGuestIdFromRequest(_req) : null

  const img = await (prisma as any).seoImage.findUnique({
    where: { id },
    include: { article: { select: { userId: true, guestId: true } } },
  })
  if (!img) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
  // 所有者チェック（ユーザー/ゲストで分離）
  if (userId) {
    if (String(img?.article?.userId || '') !== userId) {
      return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 })
    }
  } else {
    if (!guestId || String(img?.article?.guestId || '') !== guestId) {
      return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
    }
  }

  let buf: Buffer
  try {
    buf = await readFileAsBuffer(img.filePath)
  } catch (e: any) {
    // Vercel等サーバレスではファイル永続できない場合があるため、必要なら再生成して復元
    const code = String(e?.code || '')
    const msg = String(e?.message || '')
    const missing = code === 'ENOENT' || /no such file or directory/i.test(msg)
    const plan = normalizeSeoPlan(user?.seoPlan || user?.plan || (userId ? 'FREE' : 'GUEST'))
    const trial = isTrialActive(user?.firstLoginAt || null)
    const trialActive = !!userId && trial.active
    const kind = String(img.kind || '').toUpperCase()
    const imagesAllowed = canUseSeoImages({ isLoggedIn: !!userId, plan, trialActive })

    // バナーは「一覧サムネ必須」のため、所有者であれば復元を許可（図解はPRO/ENT or trial）
    const canRegenMissing = kind === 'BANNER' ? true : imagesAllowed

    if (!missing || !canRegenMissing) {
      return NextResponse.json(
        { success: false, error: missing ? '画像ファイルが見つかりません（再生成が必要です）' : msg || '画像の読み込みに失敗しました' },
        { status: 404 }
      )
    }

    await ensureSeoStorage()
    const aspectRatio = kind === 'BANNER' ? '16:9' : '1:1'
    const prompt = stripNoTextStatements(String(img.prompt || ''))
    const gen = await geminiGenerateImagePng({
      prompt,
      aspectRatio: aspectRatio as any,
      imageSize: '2K',
      model: GEMINI_IMAGE_MODEL_DEFAULT,
    })
    const filename = `seo_${String(img.articleId)}_${Date.now()}_${kind.toLowerCase()}.png`
    const saved = await saveBase64ToFile({ base64: gen.dataBase64, filename, subdir: 'images' })
    await (prisma as any).seoImage.update({
      where: { id },
      data: { filePath: saved.relativePath, mimeType: gen.mimeType || 'image/png', prompt },
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


