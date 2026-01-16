import { PrismaClient } from '@prisma/client'

function ensureDatabaseUrlEnv() {
  // Vercel Postgres などで DATABASE_URL が用意されていない場合に備えてフォールバック
  // Prisma schema は env("DATABASE_URL") 前提なので、ここで補完する。
  // 接続プールURLを優先的に使用（セッションモードの接続プール上限エラーを回避）
  if (process.env.DATABASE_URL) {
    // 既に設定されている場合は、接続プールURLを優先
    const poolUrl = process.env.POSTGRES_PRISMA_URL
    if (poolUrl && !process.env.DATABASE_URL.includes('pooler')) {
      // 接続プールURLが利用可能で、現在のURLがプーラーを使用していない場合は置き換え
      process.env.DATABASE_URL = poolUrl
    }
    return
  }

  // 接続プールURLを優先的に使用
  const candidate =
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRESQL_URL

  if (candidate) {
    process.env.DATABASE_URL = candidate
  }
}

ensureDatabaseUrlEnv()

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error', 'warn'], // 本番環境でもwarnを有効化
    // 接続プールの設定を最適化
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
