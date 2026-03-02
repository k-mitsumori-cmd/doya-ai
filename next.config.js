/** @type {import('next').NextConfig} */
const nextConfig = {
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
    ]
  },
}

module.exports = nextConfig
