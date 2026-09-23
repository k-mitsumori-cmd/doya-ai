import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const [serviceId] = process.argv.slice(2)
if (!serviceId) throw new Error('usage: node finalize-doyamarke-service.mjs <serviceId>')
const root = process.cwd()
const outputRoot = path.join(root, 'reference/generated-assets/2026-09-01-doyamarke-real-usage-focus-recordings')
const config = JSON.parse(await readFile(path.join(root, 'scripts/recordings/doyamarke-services.json'), 'utf8'))
const service = config.services.find(item => item.id === serviceId)
if (!service) throw new Error(`unknown service: ${serviceId}`)
const statePath = path.join(outputRoot, 'run-state.json')
const state = JSON.parse(await readFile(statePath, 'utf8'))
const qaRelative = `${service.tier}/${service.id}/qa/qa.json`
const finalRelative = `${service.tier}/${service.id}/${service.id}-actual-operation-focus-16x9.mp4`
const qa = JSON.parse(await readFile(path.join(outputRoot, qaRelative), 'utf8'))
const entry = state.services[service.id]
entry.status = qa.status === 'PASS' ? 'PASS' : 'BLOCKED'
entry.reason = qa.status === 'PASS' ? null : 'post-processing QA failed'
entry.finalFile = finalRelative
entry.qaFile = qaRelative
entry.updatedAt = new Date().toISOString()
state.updatedAt = entry.updatedAt
await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`)
process.stdout.write(`${entry.status} ${service.id}\n`)
