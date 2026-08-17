import { NextRequest, NextResponse } from 'next/server'
import { spawnSync } from 'child_process'
import { join } from 'path'

/**
 * 本番環境でPrismaマイグレーションを実行するAPI
 * セキュリティ: 本番環境では環境変数で保護することを推奨
 */
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    // セキュリティチェック（本番環境では環境変数で保護）
    const authHeader = request.headers.get('authorization')
    // ⚠️ 既定値を置かないこと。ここは本番DBに対して
    //    `prisma db push --accept-data-loss` を実行する。'dev-token' のような
    //    フォールバックがあると、env の設定漏れや削除事故の瞬間に、
    //    誰でも列削除・データ破壊を起こせる状態になる。未設定なら動かさない。
    const expectedToken = process.env.ADMIN_MIGRATE_TOKEN
    if (!expectedToken) {
      return NextResponse.json(
        { error: 'ADMIN_MIGRATE_TOKEN が設定されていないため実行できません' },
        { status: 503 }
      )
    }

    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL is not set' },
        { status: 500 }
      )
    }

    console.log('[admin/migrate] Running prisma db push...')

    // prisma db push を実行
    const result = spawnSync('npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'pipe',
      encoding: 'utf8',
    })

    const stdout = result.stdout?.toString() || ''
    const stderr = result.stderr?.toString() || ''

    if (result.status !== 0) {
      console.error('[admin/migrate] Migration failed:', stderr)
      return NextResponse.json(
        { 
          error: 'Migration failed',
          details: stderr || stdout,
        },
        { status: 500 }
      )
    }

    console.log('[admin/migrate] Migration completed successfully')
    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      output: stdout,
    })
  } catch (error: any) {
    console.error('[admin/migrate] Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
