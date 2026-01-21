import { PrismaClient } from '@prisma/client'

/**
 * Prismaクライアントのシングルトンインスタンス
 * 
 * Vercelのサーバーレス環境では、各リクエストで新しいインスタンスが作成される可能性があるため、
 * グローバルシングルトンパターンを使用して接続を再利用し、接続プールの枯渇を防ぐ
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn']
      : ['error'],
  })

// 開発環境・本番環境両方でグローバルシングルトンを使用
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma
}

export default prisma
