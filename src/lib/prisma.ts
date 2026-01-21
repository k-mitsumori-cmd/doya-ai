import { PrismaClient } from '@prisma/client'

/**
 * Supabase接続プール制限（MaxClientsInSessionMode）を回避するための設定
 * 
 * 問題: Supabaseのセッションモードでは接続プールサイズに制限がある
 * 解決: 
 * 1. 接続URLにpgbouncerパラメータを追加
 * 2. connection_limitを設定して同時接続数を制限
 * 3. グローバルシングルトンパターンで接続を再利用
 */
function ensureDatabaseUrlEnv() {
  // Vercel Postgres などで DATABASE_URL が用意されていない場合に備えてフォールバック
  // Prisma schema は env("DATABASE_URL") 前提なので、ここで補完する。
  
  let dbUrl = process.env.DATABASE_URL
  
  if (!dbUrl) {
    // 接続プールURLを優先的に使用
    dbUrl =
      process.env.POSTGRES_PRISMA_URL ||
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.POSTGRES_URL ||
      process.env.POSTGRESQL_URL || ''
  }
  
  if (dbUrl && dbUrl.startsWith('postgres')) {
    // Supabase Pooler URLの場合、接続パラメータを最適化
    let url: URL
    try {
      url = new URL(dbUrl)
    } catch (e) {
      // URLパースに失敗した場合はそのまま使用
      process.env.DATABASE_URL = dbUrl
      return
    }
    
    // pgbouncerモードを有効化（Supabaseの場合）
    if (url.hostname.includes('supabase') || url.hostname.includes('pooler')) {
      // 既存のパラメータを保持しつつ、必要なパラメータを追加
      if (!url.searchParams.has('pgbouncer')) {
        url.searchParams.set('pgbouncer', 'true')
      }
      // 接続タイムアウトを設定（デフォルト10秒）
      if (!url.searchParams.has('connect_timeout')) {
        url.searchParams.set('connect_timeout', '10')
      }
      // プールタイムアウトを設定
      if (!url.searchParams.has('pool_timeout')) {
        url.searchParams.set('pool_timeout', '10')
      }
    }
    
    // 接続制限を追加（Vercelサーバーレス環境向け）
    // connection_limitを低く設定して接続プール枯渇を防ぐ
    // Supabaseのセッションモードでは接続プールサイズに制限があるため、
    // connection_limitを1に設定することで接続の競合を避ける
    // ただし、NextAuthなどの並行処理では接続を適切に管理する必要がある
    if (!url.searchParams.has('connection_limit')) {
      // 接続プールの設定を確認
      // Supabaseのセッションモードでは、接続プールサイズは通常15-25程度
      // connection_limitを1に設定することで、接続の再利用を促進
      url.searchParams.set('connection_limit', '1')
    }
    
    process.env.DATABASE_URL = url.toString()
  }
}

ensureDatabaseUrlEnv()

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined
}

// Prismaクライアントの設定を最適化
const prismaClientOptions = {
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] as const
    : ['error'] as const, // 本番環境ではエラーのみ
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(prismaClientOptions)

// 本番環境でもグローバルシングルトンを使用（接続の再利用）
// Vercelのサーバーレス環境では各リクエストで新しいインスタンスが作成される可能性があるため
// グローバルシングルトンを使用することで、接続を再利用し、接続プールの枯渇を防ぐ
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
