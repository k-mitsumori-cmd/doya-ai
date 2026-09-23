import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const [serviceId, status, reason = '', rawFile = '', eventsFile = '', finalFile = '', qaFile = ''] = process.argv.slice(2)
if (!serviceId || !status) throw new Error('usage: serviceId status [reason] [rawFile] [eventsFile] [finalFile] [qaFile]')
const statePath = path.join(process.cwd(), 'reference/generated-assets/2026-09-01-doyamarke-real-usage-focus-recordings/run-state.json')
const state = JSON.parse(await readFile(statePath, 'utf8'))
const entry = state.services[serviceId]
if (!entry) throw new Error(`unknown service: ${serviceId}`)
entry.status = status
entry.reason = reason || null
entry.rawFile = rawFile || entry.rawFile
entry.eventsFile = eventsFile || entry.eventsFile
entry.finalFile = finalFile || entry.finalFile
entry.qaFile = qaFile || entry.qaFile
if (status === 'RECORDING') entry.attempts += 1
entry.updatedAt = new Date().toISOString()
state.updatedAt = entry.updatedAt
const values = Object.values(state.services)
if (values.every(item => ['PASS', 'BLOCKED'].includes(item.status))) state.status = 'COMPLETE'
await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`)
process.stdout.write(`${serviceId}: ${status} (attempt ${entry.attempts})\n`)
