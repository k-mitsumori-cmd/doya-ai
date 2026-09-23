import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'

const root = process.cwd()
const outputRoot = path.join(root, 'reference/generated-assets/2026-09-01-doyamarke-real-usage-focus-recordings')
const config = JSON.parse(await readFile(path.join(root, 'scripts/recordings/doyamarke-services.json'), 'utf8'))
const statePath = path.join(outputRoot, 'run-state.json')
const state = JSON.parse(await readFile(statePath, 'utf8'))
const incomplete = config.services.filter(service => !['PASS', 'BLOCKED'].includes(state.services[service.id]?.status))
if (incomplete.length) throw new Error(`unprocessed services: ${incomplete.map(item => item.id).join(', ')}`)

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('close', code => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr)))
  })
}

const lines = []
for (const service of config.services) {
  const entry = state.services[service.id]
  if (entry.status !== 'PASS' || !entry.finalFile) continue
  const absolute = path.join(outputRoot, entry.finalFile)
  lines.push(`${createHash('sha256').update(await readFile(absolute)).digest('hex')}  ${entry.finalFile}`)
}
await writeFile(path.join(outputRoot, 'SHA256SUMS.txt'), `${lines.join('\n')}\n`)

for (const tier of ['public', 'internal-review']) {
  const files = config.services
    .filter(service => service.tier === tier && state.services[service.id].status === 'PASS')
    .map(service => state.services[service.id].finalFile)
  if (!files.length) continue
  const zipPath = path.join(outputRoot, `doyamarke-real-usage-focus-${tier}.zip`)
  await run('/usr/bin/zip', ['-q', zipPath, ...files], { cwd: outputRoot })
}

const summary = config.services.map(service => ({
  order: service.order,
  id: service.id,
  name: service.name,
  tier: service.tier,
  status: state.services[service.id].status,
  attempts: state.services[service.id].attempts,
  reason: state.services[service.id].reason,
  video: state.services[service.id].finalFile
}))
await writeFile(path.join(outputRoot, 'final-summary.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), services: summary }, null, 2)}\n`)
await writeFile(path.join(outputRoot, 'README.md'), `# ドヤマーケ17サービス 実操作・フォーカスズーム動画\n\n静止画スライドではなく、実ブラウザ操作を連続収録した素材です。公開13サービスと内部確認4サービスを分離しています。個別のQA結果は各サービスの qa/qa.json、進行状態は run-state.json、整合性は SHA256SUMS.txt を参照してください。\n`)
state.status = 'COMPLETE'
state.completedAt = new Date().toISOString()
state.updatedAt = state.completedAt
await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`)
process.stdout.write(`COMPLETE ${summary.filter(item => item.status === 'PASS').length} PASS / ${summary.filter(item => item.status === 'BLOCKED').length} BLOCKED\n`)
