export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/doyaslide/access'
import { canReadDoyaslidePath, doyaslidePathFromSegments } from '@/lib/doyaslide/file-urls'
import { downloadDoyaslideObject } from '@/lib/doyaslide/storage'

// ============================================
// GET /api/doyaslide/files/<パス> — ドヤスライドの画像の配信
// ============================================
// 画面は、保存した公開URLをこの URL に読み替えて <img> で表示する（file-urls.ts）。
// バケットを非公開にしても、ここがサービス権限で読み出すので表示は続く（SEC-062）。
// ⚠️ 利用者のファイル（<userId>/...）は本人だけに返す。スタイル見本（style-previews/）は誰でも見られる。
// ⚠️ 権限が無いときも、存在するかどうかが分からないよう 404 を返す。

type Ctx = { params: Promise<{ path: string[] }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { path: segments } = await ctx.params
  const path = Array.isArray(segments) ? doyaslidePathFromSegments(segments) : null
  if (!path) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

  const isStylePreview = path.startsWith('style-previews/')
  const userId = isStylePreview ? null : await getUserId()
  if (!canReadDoyaslidePath(path, userId)) {
    return NextResponse.json({ error: '見つかりません' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
  }

  try {
    const object = await downloadDoyaslideObject(path)
    if (!object || !object.contentType.startsWith('image/')) {
      return NextResponse.json({ error: '見つかりません' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
    }
    return new NextResponse(new Uint8Array(object.buffer), {
      status: 200,
      headers: {
        'Content-Type': object.contentType,
        'Content-Length': String(object.buffer.length),
        // 利用者の画像はパスごとに UUID で作るので、同じ URL の中身は変わらない。本人のブラウザーにだけ長めに残す。
        // スタイル見本は同じパスに上書きで焼き直すことがあるので、短めにする。
        'Cache-Control': isStylePreview ? 'public, max-age=3600' : 'private, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    console.error('[doyaslide/files] download failed')
    return NextResponse.json({ error: '画像を読み込めませんでした' }, { status: 502, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
