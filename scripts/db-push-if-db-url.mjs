import { spawnSync } from 'node:child_process'

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit' })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

// Vercel本番でDBが設定されている時だけ、スキーマ反映を自動化
// （ローカルやDB未設定環境ではスキップしてbuildを通す）
if (!process.env.DATABASE_URL) {
  console.log('[db-push] DATABASE_URL is not set. Skip prisma db push.')
  process.exit(0)
}

console.log('[db-push] DATABASE_URL is set. Running prisma db push...')
run('./node_modules/.bin/prisma', ['db', 'push', '--skip-generate'])


