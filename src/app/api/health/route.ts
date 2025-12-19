import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  // 本番環境ではシンプルなヘルスチェックのみ
  const isProduction = process.env.NODE_ENV === 'production'
  
  const result: Record<string, any> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  }

  // データベース接続テスト
  try {
    await prisma.$queryRaw`SELECT 1`
    result.database = 'connected'
  } catch (error: any) {
    result.database = 'error'
    result.status = 'degraded'
    
    // 本番環境以外ではエラー詳細を表示
    if (!isProduction) {
      result.databaseError = error.message
    }
  }

  // 本番環境以外では追加情報を表示
  if (!isProduction) {
    result.environment = process.env.NODE_ENV
    result.envCheck = {
      DATABASE_URL: process.env.DATABASE_URL ? '✅ Set' : '❌ Missing',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ? '✅ Set' : '❌ Missing',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? '✅ Set' : '❌ Missing',
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Missing',
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? '✅ Set' : '❌ Missing',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing',
    }
  }

  return NextResponse.json(result, { 
    status: result.status === 'ok' ? 200 : 503 
  })
}
