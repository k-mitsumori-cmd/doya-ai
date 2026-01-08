import { spawnSync } from 'node:child_process'

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit' })
  if (r.status !== 0) {
    console.error(`[db-push] Command failed: ${cmd} ${args.join(' ')}`)
    console.error(`[db-push] Exit code: ${r.status}`)
    process.exit(r.status ?? 1)
  }
}

// Vercel本番でDBが設定されている時だけ、スキーマ反映を自動化
// （ローカルやDB未設定環境ではスキップしてbuildを通す）
if (!process.env.DATABASE_URL) {
  console.log('[db-push] DATABASE_URL is not set. Skip prisma db push.')
  process.exit(0)
}

console.log('[db-push] DATABASE_URL is set. Running prisma db push...')
console.log('[db-push] This will sync the Prisma schema to the database...')

try {
  run('./node_modules/.bin/prisma', ['db', 'push', '--skip-generate', '--accept-data-loss'])
  console.log('[db-push] Database schema sync completed successfully.')
} catch (error) {
  console.error('[db-push] Failed to push database schema:', error)
  // ビルドを続行する（エラーを無視しない）
  process.exit(1)
}




