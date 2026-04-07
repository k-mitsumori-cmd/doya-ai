// ============================================
// GET /api/mitsuboshi/nagusame/healthcheck
// ============================================
// 三ツ星アプリ ナグサメの死活確認エンドポイント。
// - DB に到達できるか
// - ANTHROPIC_API_KEY が設定されているか
// - サブドメイン rewrite が正しく効いているか（host ヘッダを返す）
//
// 監視ツール（UptimeRobot 等）からは GET でアクセス。
// 200 が返れば最低限のサブシステムは生きている。

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { MITSUBOSHI_BRAND, MITSUBOSHI_CLAUDE_MODEL } from '@/lib/mitsuboshi/_shared/constants'

export async function GET(req: NextRequest) {
  const checks: Record<string, { ok: boolean; detail?: string }> = {}

  // 1. DB 到達確認（軽いクエリで Supabase まで往復できるか確認）
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = { ok: true }
  } catch (err) {
    checks.database = {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    }
  }

  // 2. Anthropic API キー設定確認（実 API は叩かない）
  checks.anthropic = {
    ok: Boolean(process.env.ANTHROPIC_API_KEY),
    detail: process.env.ANTHROPIC_API_KEY ? undefined : 'ANTHROPIC_API_KEY 未設定',
  }

  // 3. サブドメイン rewrite チェック（middleware が走った形跡を host ヘッダで返す）
  const host = req.headers.get('host') || ''
  const mitsuboshiHosts = (process.env.MITSUBOSHI_HOSTS || '').split(',').map((s) => s.trim()).filter(Boolean)
  checks.subdomain = {
    ok: mitsuboshiHosts.length === 0 || mitsuboshiHosts.some((h) => host === h || host.endsWith(`.${h}`)),
    detail: `host=${host} configured=${mitsuboshiHosts.join(',') || 'none'}`,
  }

  const allOk = Object.values(checks).every((c) => c.ok)

  return NextResponse.json(
    {
      service: 'mitsuboshi-nagusame',
      brand: MITSUBOSHI_BRAND.seriesName,
      version: MITSUBOSHI_BRAND.currentVolume,
      model: MITSUBOSHI_CLAUDE_MODEL,
      timestamp: new Date().toISOString(),
      ok: allOk,
      checks,
    },
    { status: allOk ? 200 : 503 }
  )
}
