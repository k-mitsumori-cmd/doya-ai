import { PrismaClient } from '@prisma/client'

/**
 * Prismaクライアントのシングルトンインスタンス
 * 
 * Vercelのサーバーレス環境では、各リクエストで新しいインスタンスが作成される可能性があるため、
 * グローバルシングルトンパターンを使用して接続を再利用し、接続プールの枯渇を防ぐ
 * 
 * Supabase Pooler (PgBouncer) 対応:
 * - connection_limit=1: サーバーレス環境では各インスタンスで1接続に制限
 * - pgbouncer=true: PgBouncerモードを有効化
 * - connect_timeout: 接続タイムアウト設定
 * - pool_timeout: プール取得タイムアウト設定
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * DATABASE_URLにPgBouncer用パラメータを追加
 */
function getDatabaseUrl(): string {
  const baseUrl = process.env.DATABASE_URL || ''
  
  if (!baseUrl || !baseUrl.startsWith('postgres')) {
    return baseUrl
  }
  
  try {
    const url = new URL(baseUrl)
    
    // PgBouncer用パラメータを追加（既存のパラメータを上書きしない）
    if (!url.searchParams.has('pgbouncer')) {
      url.searchParams.set('pgbouncer', 'true')
    }
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', '1')
    }
    if (!url.searchParams.has('connect_timeout')) {
      url.searchParams.set('connect_timeout', '10')
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', '10')
    }
    
    return url.toString()
  } catch (e) {
    // URL解析に失敗した場合は元のURLを返す
    console.warn('[Prisma] Failed to parse DATABASE_URL, using as-is:', e)
    return baseUrl
  }
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = getDatabaseUrl()
  
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn']
      : ['error'],
    datasources: databaseUrl ? {
      db: {
        url: databaseUrl,
      },
    } : undefined,
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

// 開発環境・本番環境両方でグローバルシングルトンを使用
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma
}

export default prisma
