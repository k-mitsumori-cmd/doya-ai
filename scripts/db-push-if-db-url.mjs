import { spawnSync } from 'node:child_process'
import { existsSync } from 'fs'
import { join } from 'path'

// Vercel本番ビルドではdb pushをスキップ（スキーマは手動で管理）
if (process.env.VERCEL === '1' || process.env.SKIP_DB_PUSH === '1') {
  console.log('[db-push] Skipping db push on Vercel/CI build. Schema is managed manually.')
  process.exit(0)
}

// リトライ可能なエラーパターン（接続プール制限など）
const RETRYABLE_ERRORS = [
  'MaxClientsInSessionMode',
  'max clients reached',
  'too many connections',
  'connection refused',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'Schema engine error',
  'FATAL:',
  'statement timeout',
  'canceling statement',
]

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function runWithRetry(cmd, args, options = {}, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[db-push] Attempt ${attempt}/${maxRetries}: ${cmd} ${args.join(' ')}`)
    
  const r = spawnSync(cmd, args, {
    stdio: 'pipe',
    shell: true,
    env: process.env,
    encoding: 'utf8',
    ...options,
  })

    if (r.status === 0) {
      // 成功時は出力を表示（デバッグ用）
      if (r.stdout) console.log(r.stdout.toString())
      if (r.stderr) console.error(r.stderr.toString())
      return true
    }

    const stderr = r.stderr ? r.stderr.toString() : ''
    const stdout = r.stdout ? r.stdout.toString() : ''
    const allOutput = stderr + stdout

    // 既存のインデックスや制約に関するエラーは無視（既に存在する場合は問題なし）
    const ignorableErrors = ['already exists', 'relation.*already exists', 'duplicate key', 'constraint.*already exists']
    const isIgnorable = ignorableErrors.some((pattern) => new RegExp(pattern, 'i').test(allOutput))

    if (isIgnorable) {
      console.warn(
        `[db-push] ⚠️  Warning: ${
          allOutput.split('\n').find((line) => line.includes('Error:') || line.includes('ERROR:')) ||
          'Some database objects already exist'
        }`
      )
      console.warn('[db-push] ⚠️  This is usually safe to ignore if the objects already exist.')
      console.warn('[db-push] ⚠️  Continuing build...')
      return true
    }

    // リトライ可能なエラーかチェック
    const isRetryable = RETRYABLE_ERRORS.some((pattern) => allOutput.includes(pattern))

    if (isRetryable && attempt < maxRetries) {
      const waitTime = attempt * 5000 // 5秒、10秒、15秒と増加
      console.warn(`[db-push] ⚠️  Retryable error detected: ${allOutput.split('\n').find((line) => line.includes('Error:') || line.includes('FATAL:')) || 'Connection issue'}`)
      console.warn(`[db-push] ⚠️  Waiting ${waitTime / 1000} seconds before retry...`)
      await sleep(waitTime)
      continue
    }

    // リトライ可能なエラーで最大リトライ回数に達した場合は警告して続行
    if (isRetryable) {
      console.warn(`[db-push] ⚠️  Max retries reached for retryable error. Continuing build without db push.`)
      console.warn(`[db-push] ⚠️  The database schema may need to be updated manually.`)
      return true // ビルドを続行
    }

    // 非無視エラーのときだけ詳細を表示（Vercelログのノイズ抑制）
    if (r.stdout) console.log(stdout.toString())
    if (r.stderr) console.error(stderr.toString())

    console.error(`[db-push] ❌ Command failed: ${cmd} ${args.join(' ')}`)
    console.error(`[db-push] Exit code: ${r.status}`)
    if (r.error) console.error('[db-push] Error:', r.error)
    return false
  }
  return false
}

// Vercel本番でDBが設定されている時だけ、スキーマ反映を自動化
// （ローカルやDB未設定環境ではスキップしてbuildを通す）
if (!process.env.DATABASE_URL) {
  console.log('[db-push] DATABASE_URL is not set. Skip prisma db push.')
  process.exit(0)
}

console.log('[db-push] DATABASE_URL is set. Running prisma db push...')

// Prisma CLIのパスを確認
const prismaPath = './node_modules/.bin/prisma'
const prismaPathAlt = join(process.cwd(), 'node_modules', '.bin', 'prisma')
let prismaCmd = 'npx'
let args = ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss']

if (existsSync(prismaPath)) {
  prismaCmd = prismaPath
  args = ['db', 'push', '--skip-generate', '--accept-data-loss']
} else if (existsSync(prismaPathAlt)) {
  prismaCmd = prismaPathAlt
  args = ['db', 'push', '--skip-generate', '--accept-data-loss']
}

// 非同期関数でリトライ付き実行
async function main() {
  const success = await runWithRetry(prismaCmd, args, {}, 3)
  if (!success) {
    console.warn('[db-push] ⚠️  db push failed, but continuing build.')
    console.warn('[db-push] ⚠️  Database schema may need manual update.')
  }
  // 常にビルドを続行（DBスキーマは本番環境で既に設定されている想定）
  process.exit(0)
}

main().catch((err) => {
  console.error('[db-push] Unexpected error:', err)
  // 予期せぬエラーでもビルドを続行（DBスキーマは手動で更新が必要な場合あり）
  console.warn('[db-push] ⚠️  Continuing build despite error.')
  process.exit(0)
})




