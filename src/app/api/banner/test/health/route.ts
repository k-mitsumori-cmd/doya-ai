import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
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
    checks.dbConnection = `error: ${err.message}`
    return NextResponse.json(checks, { status: 500 })
  }

  try {
    // BannerTemplateテーブルの存在確認
    const count = await prisma.bannerTemplate.count()
    checks.bannerTemplateTable = 'ok'
    checks.templateCount = count
  } catch (err: any) {
    checks.bannerTemplateTable = `error: ${err.message}`
  }

  return NextResponse.json(checks)
}
