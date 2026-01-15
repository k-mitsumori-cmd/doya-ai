import { spawnSync } from 'node:child_process'
import { existsSync } from 'fs'
import { join } from 'path'

function run(cmd, args, options = {}) {
  console.log(`[db-push] Executing: ${cmd} ${args.join(' ')}`)
  const r = spawnSync(cmd, args, {
    stdio: 'pipe',
    shell: true,
    env: process.env,
    encoding: 'utf8',
    ...options,
  })

  if (r.status !== 0) {
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

    // 非無視エラーのときだけ詳細を表示（Vercelログのノイズ抑制）
    if (r.stdout) console.log(stdout.toString())
    if (r.stderr) console.error(stderr.toString())

    console.error(`[db-push] ❌ Command failed: ${cmd} ${args.join(' ')}`)
    console.error(`[db-push] Exit code: ${r.status}`)
    if (r.error) console.error('[db-push] Error:', r.error)
    return false
  }
  // 成功時は出力を表示（デバッグ用）
  if (r.stdout) console.log(r.stdout.toString())
  if (r.stderr) console.error(r.stderr.toString())
  return true
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

const success = run(prismaCmd, args)
process.exit(success ? 0 : 1)




