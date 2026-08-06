// ログイン後のアプリ画面（検索結果に出す必要がないURL）。
// LP（/{service}）・料金（/{service}/pricing）・ガイド（/{service}/guide）は含めない。
const APP_ONLY_PREFIXES = [
  '/auth',
  '/seo/articles', '/seo/create', '/seo/dashboard', '/seo/images',
  '/seo/jobs', '/seo/new', '/seo/settings', '/seo/swipe', '/seo/template',
  '/banner/dashboard', '/banner/gallery', '/banner/test', '/banner/url',
  '/adbanner/dashboard',
  '/persona/history',
  '/interview/projects', '/interview/recipes', '/interview/settings',
  '/interview/skills', '/interview/templates',
  '/doyalist/history', '/doyalist/settings', '/doyalist/tools',
  '/doyaslide/new', '/doyaslide/projects',
  '/cunning/company', '/cunning/history', '/cunning/knowledge', '/cunning/live',
  '/hr/dashboard', '/hr/employees', '/hr/evaluations', '/hr/one-on-one',
  '/hr/org-chart', '/hr/settings', '/hr/invite',
  '/kintai/admin', '/kintai/approvals', '/kintai/attendance', '/kintai/clock',
  '/kintai/dashboard', '/kintai/departments', '/kintai/employees',
  '/kintai/requests', '/kintai/settings', '/kintai/invite',
  '/opening/dashboard',
  '/tenkai/projects',
  '/aio/invite', '/sfa/invite', '/shodan/invite', '/promane/invite',
  '/admin',
]

// 「そのパス自身」と「配下すべて」の両方を対象にする
const APP_ONLY_PATHS = APP_ONLY_PREFIXES.flatMap((p) => [p, `${p}/:path*`])

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ビルド時のコミットハッシュを環境変数に注入 (UIで表示してキャッシュ確認用)
  env: {
    NEXT_PUBLIC_BUILD_VERSION: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
      || process.env.GIT_COMMIT_SHA?.slice(0, 7)
      || 'dev',
  },
  // NOTE:
  // outputFileTracing を無効化すると、Vercel のServerless同梱で
  // App Router の `page_client-reference-manifest.js` 等が欠落し、実行時に 500 になり得る。
  // そのため tracing は有効（デフォルト）で運用する。
  // （過去に collect-build-traces のスタックオーバーフローが出た場合は Next.js の更新で対応する）
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'oaidalleapiprodscus.blob.core.windows.net',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
      },
    ],
  },
  
  // 本番環境でのビルド設定
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // セキュリティヘッダー
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
      // ------------------------------------------------------------------
      // ログイン後のアプリ画面を検索結果から外す（X-Robots-Tag）
      // ------------------------------------------------------------------
      // 実測（GSC 90日）で「ドヤバナーAI」の指名検索に /banner/dashboard/settings や
      // /banner/pricing が出てしまい、LP（/banner）が受け皿になっていなかった。
      // アプリ画面は noindex（リンク評価は follow で流す）にして、
      // サービス名の受け皿を各LPに一本化する。
      // ※ LP・料金・ガイドは対象外（indexさせる）
      ...APP_ONLY_PATHS.map((source) => ({
        source,
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, follow' }],
      })),
    ]
  },
  
  // リダイレクト設定
  async redirects() {
    return [
      // ダッシュボードへの直接アクセスをSEOへ
      {
        source: '/dashboard',
        destination: '/seo',
        permanent: false,
      },
      // /kantan は迷いやすいので、ドヤライティングAI（/seo）へ集約
      {
        source: '/kantan',
        destination: '/seo',
        permanent: false,
      },
      {
        source: '/kantan/:path*',
        destination: '/seo',
        permanent: false,
      },
      // 旧スライド（Gemini→Googleスライド型）は廃止し、ドヤスライド（/doyaslide）に統一
      // 廃止済みブランドなので 308（恒久）。307 のままだと旧URLがインデックスに残り、
      // 「ドヤスライド」の指名検索が旧URLと /doyaslide に分散する
      {
        source: '/slide/create',
        destination: '/doyaslide/new',
        permanent: true,
      },
      {
        source: '/slide',
        destination: '/doyaslide',
        permanent: true,
      },
      {
        source: '/slide/:path*',
        destination: '/doyaslide',
        permanent: true,
      },
      // SlashSlide（別ブランドの旧スライド）もドヤスライド（/doyaslide）に統一
      {
        source: '/slashslide/create',
        destination: '/doyaslide/new',
        permanent: true,
      },
      {
        source: '/slashslide',
        destination: '/doyaslide',
        permanent: true,
      },
      {
        source: '/slashslide/:path*',
        destination: '/doyaslide',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig
