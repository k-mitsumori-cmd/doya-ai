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
    const expectedToken = process.env.ADMIN_MIGRATE_TOKEN || 'dev-token'
    
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
