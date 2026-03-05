import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 1x1 透明PNG（プレースホルダー）
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
)

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const comma = dataUrl.indexOf(',')
  if (comma === -1) return null
  try {
    return Buffer.from(dataUrl.slice(comma + 1), 'base64')
  } catch {
    return null
  }
}

// sharpは動的にインポート（Vercel環境での互換性向上）
async function resizeImage(input: Buffer, w: number): Promise<Buffer> {
  try {
    const sharp = (await import('sharp')).default
    return await sharp(input)
      .resize({ width: w, height: w, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 30 })
      .toBuffer()
  } catch (e) {
    console.error('[thumb] sharp resize failed:', e)
    // sharpが失敗したら元の画像をそのまま返す（サイズは大きいがエラーより良い）
    return input
  }
}

// LQIP（Low Quality Image Placeholder）を生成してmetadataに保存
async function ensureLqip(id: string, input: Buffer, meta: Record<string, any>): Promise<void> {
  if (meta?.lqip) return // 既に生成済み
  try {
    const sharp = (await import('sharp')).default
    const lqipBuf = await sharp(input)
      .resize(20, 20, { fit: 'inside' })
      .webp({ quality: 10 })
      .toBuffer()
    const lqip = `data:image/webp;base64,${lqipBuf.toString('base64')}`
    await prisma.generation.update({
      where: { id },
      data: { metadata: { ...meta, lqip } },
    })
  } catch {
    // LQIP保存失敗は無視（メイン処理に影響させない）
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id') || ''
    const w = Math.min(Math.max(Number(searchParams.get('w')) || 320, 40), 640)
    if (!id) {
      return new NextResponse(PLACEHOLDER_PNG, {
        status: 200,
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=60' },
      })
    }

    const g = await prisma.generation.findUnique({
      where: { id },
      select: { output: true, metadata: true },
    })
    const meta: any = g?.metadata || {}
    const isShared = meta?.shared === true
    if (!g || !isShared) {
      return new NextResponse(PLACEHOLDER_PNG, {
        status: 200,
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=60' },
      })
    }

    const out = typeof g.output === 'string' ? g.output : ''
    if (!out) {
      return new NextResponse(PLACEHOLDER_PNG, {
        status: 200,
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=60' },
      })
    }

    // もし既にURLならそのままリダイレクト（環境によっては data: ではなくURL保存の可能性がある）
    if (!out.startsWith('data:image/')) {
      if (/^https?:\/\//.test(out)) return NextResponse.redirect(out)
      return new NextResponse(PLACEHOLDER_PNG, {
        status: 200,
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=60' },
      })
    }

    const input = dataUrlToBuffer(out)
    if (!input) {
      return new NextResponse(PLACEHOLDER_PNG, {
        status: 200,
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=60' },
      })
    }

    // LQIP を生成・保存（Vercelサーバーレスでは await 必須）
    await ensureLqip(id, input, meta)

    const buf = await resizeImage(input, w)

    const etag = `W/"thumb-${id}-${w}"`
    if (req.headers.get('if-none-match') === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      })
    }

    // sharpで変換成功したらWebP、失敗してそのままなら元形式
    const contentType = buf === input ? 'image/png' : 'image/webp'

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        ETag: etag,
      },
    })
  } catch (e: any) {
    console.error('[banner thumb] failed:', e)
    // エラーでもプレースホルダー画像を返す（imgタグが壊れないように）
    return new NextResponse(PLACEHOLDER_PNG, {
      status: 200,
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=60' },
    })
  }
}


