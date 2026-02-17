// ============================================
// GET /api/tenkai/health
// ============================================
// ヘルスチェックエンドポイント（ロードバランサー・監視用）

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const start = Date.now()
  const checks: Record<string, { status: string; latency?: number }> = {}

  // DB接続チェック
  try {
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    checks.database = { status: 'ok', latency: Date.now() - dbStart }
  } catch {
    checks.database = { status: 'error' }
  }

  // 必須環境変数チェック
  const requiredEnvVars = ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY']
  const missingVars = requiredEnvVars.filter((v) => !process.env[v])
  checks.config = {
    status: missingVars.length === 0 ? 'ok' : 'error',
  }

  const totalLatency = Date.now() - start
  const allOk = Object.values(checks).every((c) => c.status === 'ok')

  return NextResponse.json(
    {
      status: allOk ? 'healthy' : 'degraded',
      latency: totalLatency,
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 }
  )
}
