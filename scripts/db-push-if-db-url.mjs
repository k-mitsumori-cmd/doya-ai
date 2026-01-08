import { spawnSync } from 'node:child_process'
import { existsSync } from 'fs'
import { join } from 'path'

function run(cmd, args, options = {}) {
  console.log(`[db-push] Executing: ${cmd} ${args.join(' ')}`)
  const r = spawnSync(cmd, args, { 
    stdio: 'inherit',
    shell: true,
    env: process.env,
    ...options 
  })
  if (r.status !== 0) {
    console.error(`[db-push] ❌ Command failed: ${cmd} ${args.join(' ')}`)
    console.error(`[db-push] Exit code: ${r.status}`)
    if (r.error) {
      console.error(`[db-push] Error:`, r.error)
    }
    if (r.stderr) {
      console.error(`[db-push] Stderr:`, r.stderr.toString())
    }
    if (r.stdout) {
      console.error(`[db-push] Stdout:`, r.stdout.toString())
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

console.log(`[db-push] Checking Prisma CLI path...`)
console.log(`[db-push] Current working directory: ${process.cwd()}`)
console.log(`[db-push] Prisma path (relative): ${prismaPath}, exists: ${existsSync(prismaPath)}`)
console.log(`[db-push] Prisma path (absolute): ${prismaPathAlt}, exists: ${existsSync(prismaPathAlt)}`)

let prismaCmd = 'npx'
let args = ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss']

if (existsSync(prismaPath)) {
  prismaCmd = prismaPath
  args = ['db', 'push', '--skip-generate', '--accept-data-loss']
} else if (existsSync(prismaPathAlt)) {
  prismaCmd = prismaPathAlt
  args = ['db', 'push', '--skip-generate', '--accept-data-loss']
}

console.log(`[db-push] Using command: ${prismaCmd}`)
console.log(`[db-push] Arguments: ${args.join(' ')}`)
console.log(`[db-push] DATABASE_URL is set: ${!!process.env.DATABASE_URL}`)

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




