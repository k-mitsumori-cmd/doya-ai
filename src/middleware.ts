import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isAppAuthEnabled } from '@/lib/auth-link/app-auth-flag'
import { APP_REQUEST_HEADER, bearerToCookie, isAppAuthRoute } from '@/lib/auth-link/bearer-cookie'
import { isAppRequest } from '@/lib/app-mode/detect'
import { APP_UNAVAILABLE_PATH, classifyBlockedPath } from '@/lib/app-mode/blocked-routes'

/**
 * Host ベース rewrite middleware
 *
 * ⚠️ このファイルは **`src/` 配下に置くこと**。
 *    App Router が `src/app` にある構成では、Next.js はリポジトリ直下の
 *    `middleware.ts` を認識しない。2026-08-17 までここは直下にあり、
 *    **middleware が一度も実行されていなかった**（`next build` 後の
 *    `.next/server/middleware-manifest.json` が `"middleware": {}` になる。
 *    疑わしいときはここを見れば分かる）。
 *    そのため下のホスト振り分けは、書かれていただけで機能していなかった。
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
  // 旗 all のときのロゴ・マニフェスト・OGP（ドヤバディ）。別ドメインでも書き換えずに返す
  '/brand/',
  '/site-buddy.webmanifest',
  '/ogp/',
  '/ogp-buddy/',
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
  // アプリ表示モード（旗 APP_MODE_ENABLED が '1' のときだけ。オフなら、この中は一切動かない）
  // アプリ（ドヤバディ）の WebView からの要求（User-Agent の DoyaBuddyApp、または Cookie doya_app=1）で、課金・契約・価格の経路を止める。
  // 画面は /app-unavailable へ rewrite、API は 404。止める経路の一覧: src/lib/app-mode/blocked-routes.ts
  // 下の Bearer の置き換えより前に置く（置き換えで通り抜けさせないため）。
  // ===============================================
  if (isAppRequest(req.headers)) {
    const kind = classifyBlockedPath(pathname)
    if (kind === 'api') return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 })
    if (kind === 'page') {
      // クエリや末尾の / を引き継がない、固定の行き先
      return NextResponse.rewrite(new URL(APP_UNAVAILABLE_PATH, req.url))
    }
  }

  // ===============================================
  // アプリ版の認証（旗 APP_AUTH_ENABLED が '1' のときだけ。オフなら、この中は一切動かない）
  // x-doya-app: 1 が付いた、/api/ あての要求だけ（Cron・webhook・管理用など、Authorization を自分で読む既存の呼び出しは対象外）。Authorization: Bearer <値> を、next-auth のセッション Cookie に置き換える。
  // 既存の API は getServerSession をそのまま使える。仕組みと根拠: docs/architecture/2026-11-18-app/spike-middleware-bearer.md
  // /api/ は、下のホスト振り分けでも素通しなので、ここで返しても既存の動きは変わらない。
  // ===============================================
  if (isAppAuthEnabled() && pathname.startsWith('/api/') && !isAppAuthRoute(pathname)) {
    const r = bearerToCookie({
      appHeader: req.headers.get(APP_REQUEST_HEADER),
      authorization: req.headers.get('authorization'),
      cookie: req.headers.get('cookie'),
      nextauthUrl: process.env.NEXTAUTH_URL,
    })
    if (r.kind === 'invalid') {
      return NextResponse.json({ code: 'INVALID_TOKEN' }, { status: 401 })
    }
    if (r.kind === 'replace') {
      const headers = new Headers(req.headers)
      headers.set('cookie', r.cookie)
      headers.delete('authorization')
      headers.delete(APP_REQUEST_HEADER)
      return NextResponse.next({ request: { headers } })
    }
  }

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

    // 旧 /slide は廃止しドヤスライド（/doyaslide）へ統一。スライド専用ドメインも /doyaslide を配信
    if (pathname === '/doyaslide' || pathname.startsWith('/doyaslide/')) {
      return NextResponse.next()
    }

    const url = req.nextUrl.clone()
    url.pathname = pathname === '/' ? '/doyaslide' : `/doyaslide${pathname}`
    return NextResponse.rewrite(url)
  }

  // どのホストにもマッチしなければそのまま
  return NextResponse.next()
}

export const config = {
  // ⚠️ 静的アセットは除外する。middleware は matcher に当たる全リクエストで
  //    起動するため、含めるとビルド成果物や画像のたびに無駄に実行される。
  //    除外してもホスト振り分けには影響しない（元々 SHARED_SKIP_PREFIXES で
  //    素通ししていた対象）。
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
