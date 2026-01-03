import { PrismaClient } from '@prisma/client'

function ensureDatabaseUrlEnv() {
  // Vercel Postgres などで DATABASE_URL が用意されていない場合に備えてフォールバック
  // Prisma schema は env("DATABASE_URL") 前提なので、ここで補完する。
  if (process.env.DATABASE_URL) return

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
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
