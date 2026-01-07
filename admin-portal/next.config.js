/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // 環境変数
  env: {
    KANTAN_DOYA_API_URL: process.env.KANTAN_DOYA_API_URL || 'http://localhost:3000',
    DOYA_BANNER_API_URL: process.env.DOYA_BANNER_API_URL || 'http://localhost:3001',
  },
}

module.exports = nextConfig

