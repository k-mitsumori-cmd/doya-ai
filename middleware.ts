import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

/**
 * Host ベース rewrite middleware
 *
 * 複数のサブドメインを同一 Next.js デプロイに相乗りさせるためのルータ。
 * - ドヤスライドを別ドメインで公開する `SLIDE_HOSTS`
 * - 三ツ星アプリ（toCシリーズ）を別サブドメインで公開する `MITSUBOSHI_HOSTS`
 *
 * どちらも env 未設定なら完全 no-op。既存サービスへの影響を避ける。
 *
 * 想定運用:
 * - MITSUBOSHI_HOSTS="mitsuboshi.surisuta.jp"
 *   → mitsuboshi.surisuta.jp/ を /nagusame に
 *   → mitsuboshi.surisuta.jp/pricing を /nagusame/pricing に
 *   → mitsuboshi.surisuta.jp/business を /nagusame/business に rewrite
 */

const SHARED_SKIP_PREFIXES = [
  '/_next',
  '/api',
  '/favicon',
  '/icon',
  '/apple-icon',
  '/robots',
  '/sitemap',
  '/site.webmanifest',
]

function shouldSkip(pathname: string): boolean {
  return SHARED_SKIP_PREFIXES.some((p) => pathname.startsWith(p))
}

function parseHosts(envValue: string | undefined): string[] {
  return (envValue || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

function matchHost(host: string, configured: string[]): boolean {
  return configured.some((h) => host === h || host.endsWith(`.${h}`))
}

export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') || '').toLowerCase()
  const { pathname } = req.nextUrl

  // ===============================================
  // 三ツ星アプリ（toCシリーズ） — サブドメイン運用
  // ===============================================
  // URL 設計:
  //   mitsuboshi.surisuta.jp/             → /nagusame に redirect（Vol.01 への入口）
  //   mitsuboshi.surisuta.jp/nagusame     → そのままサーブ
  //   mitsuboshi.surisuta.jp/nagusame/*   → そのままサーブ
  //   mitsuboshi.surisuta.jp/api/*        → そのままサーブ
  //   mitsuboshi.surisuta.jp/その他       → /nagusame に redirect
  //
  // Vol.02 が出たら MITSUBOSHI_ALLOWED_PREFIXES に新しいパスを追加する。
  const mitsuboshiHosts = parseHosts(process.env.MITSUBOSHI_HOSTS)
  const isMitsuboshiHost =
    mitsuboshiHosts.length > 0 && matchHost(host, mitsuboshiHosts)

  // mitsuboshi 配下で許可するアプリパスの prefix 一覧
  const MITSUBOSHI_ALLOWED_PREFIXES = ['/nagusame']

  if (isMitsuboshiHost) {
    if (shouldSkip(pathname)) return NextResponse.next()

    const isAllowedAppPath = MITSUBOSHI_ALLOWED_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    )

    if (isAllowedAppPath) {
      return NextResponse.next()
    }

    // それ以外（/, /about, /home 等）→ Vol.01 ナグサメへ redirect
    const url = req.nextUrl.clone()
    url.pathname = '/nagusame'
    return NextResponse.redirect(url, 308)
  }

  // ===============================================
  // 主ドメイン側の /nagusame/* は三ツ星サブドメインへ恒久リダイレクト
  // - MITSUBOSHI_HOSTS が設定されていて、かつ現在が三ツ星ホストでない場合
  // - 旧パスからのSEO流入・ブックマークを正しい新URLへ集約する
  // - パス構造はそのまま保持（/nagusame/pricing → mitsuboshi.../nagusame/pricing）
  // ===============================================
  if (
    mitsuboshiHosts.length > 0 &&
    !isMitsuboshiHost &&
    !shouldSkip(pathname) &&
    (pathname === '/nagusame' || pathname.startsWith('/nagusame/'))
  ) {
    const target = mitsuboshiHosts[0]
    const redirectUrl = new URL(`https://${target}${pathname}`)
    redirectUrl.search = req.nextUrl.search
    return NextResponse.redirect(redirectUrl, 308)
  }

  // ===============================================
  // ドヤスライド — 別ドメイン運用
  // ===============================================
  const slideHosts = parseHosts(process.env.SLIDE_HOSTS)
  if (slideHosts.length > 0 && matchHost(host, slideHosts)) {
    if (shouldSkip(pathname)) return NextResponse.next()

    if (pathname === '/slide' || pathname.startsWith('/slide/')) {
      return NextResponse.next()
    }

    const url = req.nextUrl.clone()
    url.pathname = pathname === '/' ? '/slide' : `/slide${pathname}`
    return NextResponse.rewrite(url)
  }

  // どのホストにもマッチしなければそのまま
  return NextResponse.next()
}

export const config = {
  matcher: '/:path*',
}
