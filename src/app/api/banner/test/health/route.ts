import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireBannerAdmin } from '@/lib/banner-admin-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const denied = requireBannerAdmin(request)
  if (denied) return denied
  const checks: Record<string, any> = {
    timestamp: new Date().toISOString(),
    prismaImport: 'ok',
    dbConnection: 'pending',
    bannerTemplateTable: 'pending',
    templateCount: 0,
  }

  try {
    // Prismaの接続テスト
    await prisma.$connect()
    checks.dbConnection = 'ok'
  } catch (err: any) {
    console.error('[Banner health] Database connection failed:', err)
    checks.dbConnection = 'error'
    return NextResponse.json(checks, { status: 500 })
  }

  try {
    // BannerTemplateテーブルの存在確認
    const count = await prisma.bannerTemplate.count()
    checks.bannerTemplateTable = 'ok'
    checks.templateCount = count
  } catch (err: any) {
    console.error('[Banner health] Template count failed:', err)
    checks.bannerTemplateTable = 'error'
  }

  return NextResponse.json(checks)
}
