import { spawnSync } from 'node:child_process'
import { existsSync } from 'fs'
import { join } from 'path'

function run(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, { 
    stdio: 'inherit',
    shell: true,
    ...options 
  })
  if (r.status !== 0) {
    console.error(`[db-push] Command failed: ${cmd} ${args.join(' ')}`)
    console.error(`[db-push] Exit code: ${r.status}`)
    if (r.error) {
      console.error(`[db-push] Error:`, r.error)
    }
    return false
  }
  return true
}

// Vercel本番でDBが設定されている時だけ、スキーマ反映を自動化
// （ローカルやDB未設定環境ではスキップしてbuildを通す）
if (!process.env.DATABASE_URL) {
  console.log('[db-push] DATABASE_URL is not set. Skip prisma db push.')
  process.exit(0)
}

console.log('[db-push] DATABASE_URL is set. Running prisma db push...')
console.log('[db-push] This will sync the Prisma schema to the database...')

// Prisma CLIのパスを確認
const prismaPath = './node_modules/.bin/prisma'
const prismaPathAlt = join(process.cwd(), 'node_modules', '.bin', 'prisma')

let prismaCmd = prismaPath
if (!existsSync(prismaPath) && existsSync(prismaPathAlt)) {
  prismaCmd = prismaPathAlt
} else if (!existsSync(prismaPath) && !existsSync(prismaPathAlt)) {
  // npxを使用
  prismaCmd = 'npx'
}

const args = prismaCmd === 'npx' 
  ? ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss']
  : ['db', 'push', '--skip-generate', '--accept-data-loss']

console.log(`[db-push] Running: ${prismaCmd} ${args.join(' ')}`)

const success = run(prismaCmd, args)

if (success) {
  console.log('[db-push] ✅ Database schema sync completed successfully.')
  process.exit(0)
} else {
  console.error('[db-push] ❌ Failed to push database schema.')
  console.error('[db-push] The build will continue, but database tables may not exist.')
  console.error('[db-push] Please check the database connection and run "prisma db push" manually if needed.')
  // ビルドを続行する（エラーを無視しないが、警告として扱う）
  // 本番環境ではテーブルが存在しないとエラーになるため、ビルドを失敗させる
  process.exit(1)
}




