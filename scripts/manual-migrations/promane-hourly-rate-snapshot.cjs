const path = require('node:path')
const { spawnSync } = require('node:child_process')

const mode = process.argv[2]
if (!['check', 'apply'].includes(mode) || !process.env.DATABASE_URL) {
  console.error('Usage: run with the reviewed production environment and check|apply')
  process.exit(1)
}

const url = new URL(process.env.DATABASE_URL)
const env = {
  PATH: process.env.PATH,
  PGHOST: url.hostname,
  PGPORT: url.port || '5432',
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
  PGSSLMODE: url.searchParams.get('sslmode') || 'require',
  PGCONNECT_TIMEOUT: '10',
}
const psql = '/opt/homebrew/opt/postgresql@17/bin/psql'
const sqlFile = path.resolve(__dirname, '../../prisma/manual-migrations/2026-10-04-promane-hourly-rate-snapshot.sql')
const baseArgs = ['-X', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t']

function run(args) {
  const result = spawnSync(psql, [...baseArgs, ...args], { env, encoding: 'utf8', timeout: 90000 })
  if (result.error || result.status !== 0) {
    console.error(`Promane rate snapshot ${mode} failed; database details withheld`)
    process.exit(1)
  }
  return result.stdout.trim()
}

const before = run(['-c', `SELECT COUNT(*)::text || ' entries, column=' || EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = current_schema() AND table_name = 'promane_time_entries'
    AND column_name = 'hourlyRateSnapshot'
)::text FROM "promane_time_entries"`])
console.log(`Before: ${before}`)
if (mode === 'apply') {
  run(['-f', sqlFile])
  const after = run(['-c', 'SELECT COUNT(*)::text || \' entries without snapshot\' FROM "promane_time_entries" WHERE "hourlyRateSnapshot" IS NULL'])
  console.log(`After: ${after}`)
  if (!after.startsWith('0 entries')) process.exitCode = 1
}
