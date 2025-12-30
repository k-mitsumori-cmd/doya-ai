import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

/**
 * SlashSlide を「別ドメイン」で公開したい場合のための optional middleware。
 *
 * - 既存サービスへの影響を避けるため、デフォルトでは何もしません。
 * - 環境変数 `SLASHSLIDE_HOSTS`（カンマ区切り）に host を登録した場合のみ有効化します。
 *   例: "slashslide.example.com,slashslide.vercel.app"
 *
 * 期待する運用:
 * - 同一デプロイに複数ドメインを割り当て
 * - SlashSlide ドメインでは / を /slashslide に、/create を /slashslide/create に rewrite
 */
export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') || '').toLowerCase()
  const configured = (process.env.SLASHSLIDE_HOSTS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  // 未設定なら完全に無効（既存サービスに影響させない）
  if (configured.length === 0) return NextResponse.next()

  const enabled = configured.some((h) => host === h || host.endsWith(`.${h}`))
  if (!enabled) return NextResponse.next()

  const { pathname } = req.nextUrl

  // Next.js内部 / 静的 / API は触らない
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icon') ||
    pathname.startsWith('/apple-icon') ||
    pathname.startsWith('/robots') ||
    pathname.startsWith('/sitemap') ||
    pathname.startsWith('/site.webmanifest')
  ) {
    return NextResponse.next()
  }

  // すでに /slashslide 配下ならそのまま
  if (pathname === '/slashslide' || pathname.startsWith('/slashslide/')) {
    return NextResponse.next()
  }

  // / -> /slashslide, /create -> /slashslide/create など
  const url = req.nextUrl.clone()
  url.pathname = pathname === '/' ? '/slashslide' : `/slashslide${pathname}`
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: '/:path*',
}



