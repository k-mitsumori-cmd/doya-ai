import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// DATABASE_URLをマスクして表示（パスワード部分を隠す）
function maskDatabaseUrl(url: string | undefined): string {
  if (!url) return '❌ Not set'
  try {
    // postgresql://user:password@host:port/db の形式からパスワードをマスク
    const masked = url.replace(/(:)([^:@]+)(@)/, '$1****$3')
    return masked
  } catch {
    return '✅ Set (parse error)'
  }
}

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL
  const postgresUrl = process.env.POSTGRES_URL
  const postgresPassword = process.env.POSTGRES_PASSWORD

  const checks: Record<string, any> = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database: 'checking...',
    envVars: {
      DATABASE_URL: maskDatabaseUrl(databaseUrl),
      POSTGRES_URL: postgresUrl ? '✅ Set (Supabase integration)' : '❌ Not set',
      POSTGRES_PASSWORD: postgresPassword ? '✅ Set' : '❌ Not set',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || '❌ Missing',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? '✅ Set' : '❌ Missing',
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Missing',
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? '✅ Set' : '❌ Missing',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing',
    },
    debug: {
      usingUrl: databaseUrl ? 'DATABASE_URL' : (postgresUrl ? 'POSTGRES_URL' : 'None'),
      hostFromUrl: databaseUrl ? databaseUrl.split('@')[1]?.split('/')[0] : 'N/A',
    }
  }

  // データベース接続テスト
  try {
    await prisma.$connect()
    const userCount = await prisma.user.count()
    
    // テーブルの存在確認
    const tables = {
      User: false,
      Account: false,
      Session: false,
      VerificationToken: false,
    }
    
    try {
      await prisma.user.findFirst()
      tables.User = true
    } catch {}
    
    try {
      await prisma.$queryRaw`SELECT 1 FROM "Account" LIMIT 1`
      tables.Account = true
    } catch {}
    
    try {
      await prisma.$queryRaw`SELECT 1 FROM "Session" LIMIT 1`
      tables.Session = true
    } catch {}
    
    try {
      await prisma.$queryRaw`SELECT 1 FROM "VerificationToken" LIMIT 1`
      tables.VerificationToken = true
    } catch {}
    
    checks.database = {
      status: '✅ Connected',
      userCount,
      tables,
    }
  } catch (error: any) {
    checks.database = {
      status: '❌ Connection Failed',
      error: error.message,
      code: error.code,
    }
  } finally {
    await prisma.$disconnect()
  }

  return NextResponse.json(checks, { status: 200 })
}

