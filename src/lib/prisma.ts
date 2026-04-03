import { PrismaClient } from '@prisma/client'

/**
 * Prismaクライアントのシングルトンインスタンス
 *
 * Vercelのサーバーレス環境では、各リクエストで新しいインスタンスが作成される可能性があるため、
 * グローバルシングルトンパターンを使用して接続を再利用し、接続プールの枯渇を防ぐ
 *
 * Supabase Pooler (PgBouncer) 対応:
 * - connection_limit=5: サーバーレス環境でもcron等の同時リクエストに対応
 * - pgbouncer=true: PgBouncerモードを有効化
 * - connect_timeout=30: コールドスタート対策で30秒に設定
 * - pool_timeout=30: プール取得タイムアウト設定
 *
 * 接続断リトライ:
 * - Proxy経由でアクセスすることで、resetPrismaClient() 後も全モジュールが新クライアントを使用
 * - withRetry() で接続エラー時に最大2回リトライ（1秒→2秒間隔）
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
      url.searchParams.set('connection_limit', '5')
    }
    if (!url.searchParams.has('connect_timeout')) {
      url.searchParams.set('connect_timeout', '30')
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', '30')
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

// グローバルシングルトンを初期化
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = createPrismaClient()
}

/**
 * Proxy経由でPrismaClientを公開
 *
 * 全モジュールがこのProxyを import するため、resetPrismaClient() で
 * globalForPrisma.prisma を差し替えると、以降の全アクセスが自動的に
 * 新しいクライアントを使用する。
 *
 * 通常時のオーバーヘッドはほぼゼロ（プロパティアクセス1段のみ）。
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = globalForPrisma.prisma!
    const value = (client as any)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  },
})

// ============================================
// 接続エラー検出 & リトライ
// ============================================

function isConnectionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = (error as { name?: string }).name
  const message = (error as { message?: string }).message || ''
  return (
    name === 'PrismaClientInitializationError' ||
    message.includes("Can't reach database server") ||
    message.includes('Connection refused') ||
    message.includes('Connection timed out') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ETIMEDOUT')
  )
}

/**
 * 壊れたクライアントを破棄し、新しいクライアントを作成して
 * globalForPrisma.prisma に差し替える。
 * Proxy経由で全モジュールが自動的に新クライアントを参照する。
 */
async function resetPrismaClient(): Promise<void> {
  console.warn('[Prisma] Connection error detected, recreating client...')
  try {
    await globalForPrisma.prisma?.$disconnect().catch(() => {})
  } catch {
    // disconnect失敗は無視
  }
  globalForPrisma.prisma = createPrismaClient()
}

/**
 * DB操作をリトライ付きで実行するヘルパー
 *
 * 接続エラー（PrismaClientInitializationError等）の場合のみリトライする。
 * アプリケーションロジックのエラー（バリデーション、一意制約違反等）はリトライしない。
 *
 * リトライ時はクライアントを再作成するため、Proxy経由で全モジュールが
 * 新しいクライアントを使用する。
 *
 * @example
 * const users = await withRetry(() => prisma.user.findMany())
 * await withRetry(() => sendDailySummary()) // 内部でprismaを使う関数もOK
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 2,
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt < maxRetries && isConnectionError(error)) {
        const delay = 1000 * (attempt + 1)
        console.warn(
          `[Prisma] Connection error on attempt ${attempt + 1}, retrying in ${delay}ms...`,
          (error as { message?: string }).message,
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
        await resetPrismaClient()
      } else {
        throw error
      }
    }
  }
  throw lastError
}

export default prisma
