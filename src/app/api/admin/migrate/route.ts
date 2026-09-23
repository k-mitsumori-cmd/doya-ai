import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Schema changes must use reviewed deployment SQL, never a runtime HTTP request. */
export async function POST() {
  return NextResponse.json({
    success: false,
    code: 'MIGRATION_ENDPOINT_RETIRED',
    error: 'このAPIによるDB更新は廃止しました。レビュー済みSQLを使用したDB反映手順を確認してください。',
  }, { status: 410, headers: { 'Cache-Control': 'no-store' } })
}
