const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const mode = process.argv[2]
if (!['check', 'apply'].includes(mode)) throw new Error('Invalid mode')

const repo = path.resolve(__dirname, '../..')
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'doya-promane-rate-'))
try {
  fs.chmodSync(temp, 0o700)
  fs.mkdirSync(path.join(temp, '.vercel'))
  fs.copyFileSync(path.join(repo, '.vercel/project.json'), path.join(temp, '.vercel/project.json'))
  const env = {}
  for (const key of ['PATH', 'HOME', 'USER', 'TMPDIR', 'LANG', 'TERM']) {
    if (process.env[key]) env[key] = process.env[key]
  }
  const script = path.join(__dirname, 'promane-hourly-rate-snapshot.cjs')
  const result = spawnSync('vercel', [
    'env', 'run', '-e', 'production', '--scope', 'surisutas-projects', '--', process.execPath, script, mode,
  ], { cwd: temp, env, stdio: 'inherit', timeout: 120000 })
  process.exitCode = result.status === 0 ? 0 : 1
} finally {
  fs.rmSync(temp, { recursive: true, force: true })
}
