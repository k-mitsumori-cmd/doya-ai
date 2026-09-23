import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const configPath = path.join(root, 'scripts/recordings/doyamarke-services.json')
const outputRoot = path.join(root, 'reference/generated-assets/2026-09-01-doyamarke-real-usage-focus-recordings')
const config = JSON.parse(await readFile(configPath, 'utf8'))

await mkdir(outputRoot, { recursive: true })
for (const service of config.services) {
  await mkdir(path.join(outputRoot, service.tier, service.id, 'raw'), { recursive: true })
  await mkdir(path.join(outputRoot, service.tier, service.id, 'qa'), { recursive: true })
}

const statePath = path.join(outputRoot, 'run-state.json')
let state
try {
  state = JSON.parse(await readFile(statePath, 'utf8'))
} catch {
  state = {
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'RUNNING',
    services: Object.fromEntries(config.services.map(service => [service.id, {
      status: 'PENDING',
      attempts: 0,
      reason: null,
      rawFile: null,
      finalFile: null,
      eventsFile: null,
      qaFile: null
    }]))
  }
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`)
}

await writeFile(path.join(outputRoot, 'manifest.json'), `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  captureType: 'continuous macOS display recording of actual browser interaction',
  simulatedOrSlideshow: false,
  config,
  disclosure: 'public contains 13 public services; internal-review contains 4 pre-release services.'
}, null, 2)}\n`)

process.stdout.write(`${outputRoot}\n${statePath}\n${Object.keys(state.services).length} services initialized\n`)
