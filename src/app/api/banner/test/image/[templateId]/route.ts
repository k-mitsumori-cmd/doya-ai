import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import sharp from 'sharp'

export const runtime = 'nodejs'
// force-dynamic を削除 → Vercel CDN が s-maxage に従いキャッシュする

// サーバーサイドメモリキャッシュ（同一インスタンス内でDBアクセスを削減）
// キーに w/fmt を含めてバリエーション別にキャッシュ
const IMAGE_CACHE = new Map<string, { buffer: Buffer; contentType: string; ts: number }>()
const MEMORY_CACHE_TTL = 6 * 60 * 60 * 1000 // 6時間（cold start 軽減）
const MEMORY_CACHE_MAX = 2000

// 静的フォールバック画像（生成中プレースホルダー）
// ⚠️ 実体のあるファイルを指すこと。generating-placeholder.svg は存在せず 404 だった。
const FALLBACK_IMAGE = '/banner-samples/cat-other.webp'


// Storage に置いた事前生成サムネイルのURLを組み立てる。
// 例: .../beauty-cosme-01.webp + w=300 → .../beauty-cosme-01-w300.webp
// 用意していない幅（0=原寸、1280超）は原寸を返す。
const STORAGE_VARIANT_WIDTHS = [300, 600, 1280]

// -wNNN.webp を実際に置いてある置き場だけ。
// ⚠️ ここに載っていないURLを書き換えると、存在しないファイルへ飛ばして
//    画像が出ないまま終わる（/templates/add は任意のURLを受け付けるため、
//    外部URLのテンプレートが1件でもあると壊れる）。
//    投入スクリプトで PREFIX を増やしたら、ここにも足すこと。
const VARIANT_READY_PREFIXES = ['/banner-templates/v2-2026-08-23/', '/banner-templates/legacy-2026-08-24/']

function storageVariantUrl(imageUrl: string, resizeWidth: number): string {
  if (!resizeWidth) return imageUrl
  if (!VARIANT_READY_PREFIXES.some((p) => imageUrl.includes(p))) return imageUrl
  const width = STORAGE_VARIANT_WIDTHS.find((w) => resizeWidth <= w)
  if (!width) return imageUrl
  return imageUrl.replace(/\.webp(\?.*)?$/i, `-w${width}.webp$1`)
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ templateId: string }> | { templateId: string } }
) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const { templateId } = p

  if (!templateId) {
    return NextResponse.json({ error: 'templateId is required' }, { status: 400 })
  }

  // クエリパラメータ: w=リサイズ幅, fmt=出力形式(webp|png)
  const { searchParams } = new URL(request.url)
  const wParam = Number(searchParams.get('w') || '0')
  const resizeWidth = wParam > 0 && wParam <= 1920 ? Math.floor(wParam) : 0
  const fmt = searchParams.get('fmt') === 'webp' ? 'webp' : ''

  // メモリキャッシュキー（バリエーション別）
  const cacheKey = `${templateId}:w${resizeWidth}:${fmt || 'orig'}`

  // メモリキャッシュチェック
  const cached = IMAGE_CACHE.get(cacheKey)
  if (cached && Date.now() - cached.ts < MEMORY_CACHE_TTL) {
    return new NextResponse(new Uint8Array(cached.buffer), {
      headers: {
        'Content-Type': cached.contentType,
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
        'X-Cache': 'HIT',
      },
    })
  }

  const staticFallbackUrl = FALLBACK_IMAGE

  // 差し替え用プレースホルダーへの逃げ道。
  // ⚠️ 必ず no-store を付ける。DBが一時的に落ちている間の応答をCDNが掴むと、
  //    DBが復旧した後も見本の代わりに同じ絵が並び続ける（2026-08-24に実際に発生）。
  const fallback = () => {
    const res = NextResponse.redirect(new URL(staticFallbackUrl, request.url))
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    return res
  }

  try {
    // DBから画像を取得
    const template = await prisma.bannerTemplate.findUnique({
      where: { templateId },
      select: { imageUrl: true },
    })

    // DBに画像がない場合またはエラープレースホルダーの場合
    const imageUrl = template?.imageUrl
    const needsFallback = !imageUrl ||
      (imageUrl.includes('placehold.co') && imageUrl.includes('Error'))

    if (needsFallback) {
      return fallback()
    }

    // base64画像の場合
    if (imageUrl.startsWith('data:image/')) {
      const matches = imageUrl.match(/^data:image\/(\w+);base64,(.+)$/)
      if (!matches) {
        return fallback()
      }

      const [, , base64Data] = matches
      let buffer: Buffer<ArrayBuffer> = Buffer.from(base64Data, 'base64')
      let contentType: string

      // リサイズ + フォーマット変換
      if (resizeWidth || fmt === 'webp') {
        let pipeline = sharp(buffer)
        if (resizeWidth) {
          pipeline = pipeline.resize({ width: resizeWidth, withoutEnlargement: true })
        }
        // 軽い鮮鋭化（元画像 1280px の拡大表示時のぼやけ感を抑制、処理コスト ~5ms）
        // sigma=0.7 / m1=1.0 / m2=2.0 は自然な仕上がりのバランス
        pipeline = pipeline.sharpen({ sigma: 0.7, m1: 1.0, m2: 2.0 })
        if (fmt === 'webp') {
          pipeline = pipeline.webp({ quality: 82 })
          contentType = 'image/webp'
        } else {
          pipeline = pipeline.png({ compressionLevel: 9 })
          contentType = 'image/png'
        }
        buffer = await pipeline.toBuffer() as Buffer<ArrayBuffer>
      } else {
        // オリジナルそのまま
        contentType = `image/${matches[1]}`
      }

      // メモリキャッシュに保存
      IMAGE_CACHE.set(cacheKey, { buffer, contentType, ts: Date.now() })
      // キャッシュサイズ制限
      if (IMAGE_CACHE.size > MEMORY_CACHE_MAX) {
        const oldest = IMAGE_CACHE.keys().next().value
        if (oldest) IMAGE_CACHE.delete(oldest)
      }

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
          'Vary': 'Accept',
        },
      })
    }

    // 外部URL（Supabase Storage）の場合はリダイレクト。
    // ⚠️ base64 と違いここでは sharp を通さない。投入時に w=300/600/1280 の
    //    WebP を作って一緒に置いてあるので、要求幅に一番近いものへ振り分ける。
    //    実行時変換が無くなり、CDNがそのまま返せる。
    if (imageUrl.startsWith('https://') || imageUrl.startsWith('http://')) {
      const target = storageVariantUrl(imageUrl, resizeWidth)
      const res = NextResponse.redirect(target)
      // リダイレクト自体もCDNに載せる（載せないと毎回Vercelまで往復する）。
      // ⚠️ ただし immutable にはしない。飛ばし先は可変のDB列（imageUrl）から作っており、
      //    Storageへの移行や置き場の変更でURLが変わる。1年不変で焼くと、
      //    変えた後もCDNとブラウザが古い場所を指し続ける。
      res.headers.set('Cache-Control', 'public, max-age=600, s-maxage=86400, stale-while-revalidate=604800')
      return res
    }

    // ローカルパスの場合はリダイレクト
    if (imageUrl.startsWith('/')) {
      return NextResponse.redirect(new URL(imageUrl, request.url))
    }

    return fallback()
  } catch (err: any) {
    console.error(`[Image API] Error for ${templateId}:`, err.message)
    return fallback()
  }
}
