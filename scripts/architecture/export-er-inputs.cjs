#!/usr/bin/env node
'use strict'
// Source-only ER input export. No PrismaClient instantiation, DB or environment file reads.
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const crypto = require('node:crypto')
const cp = require('node:child_process')
const os = require('node:os')
const { createRequire } = require('node:module')

const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
function args(argv) {
  const result = {}
  for (let i = 0; i < argv.length; i += 2) {
    if (!['--root', '--out-dir', '--date'].includes(argv[i]) || !argv[i + 1] || Object.hasOwn(result, argv[i].slice(2))) throw Error('Expected --root, --out-dir, --date exactly once')
    result[argv[i].slice(2)] = argv[i + 1]
  }
  if (Object.keys(result).length !== 3 || !/^\d{4}-\d{2}-\d{2}$/.test(result.date)) throw Error('Missing/invalid arguments')
  return result
}
function git(root, ...argv) { return cp.execFileSync('git', ['-C', root, ...argv], { encoding: 'utf8' }).trim() }
function committedBytes(root, name) {
  try { return cp.execFileSync('git', ['-C', root, 'show', 'HEAD:' + name], { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024 }) }
  catch { throw Error('Source closure is not present in HEAD: ' + name) }
}
function inside(root, file) { return file === root || file.startsWith(root + path.sep) }
function readClosure(root, ts) {
  root = fs.realpathSync(root)
  const cache = new Map(), closure = new Map()
  function load(file) {
    file = fs.realpathSync(file)
    if (!inside(path.join(root, 'src', 'lib'), file) || !file.endsWith('.ts')) throw Error('Unexpected service import ' + file)
    if (cache.has(file)) return cache.get(file)
    const bytes = fs.readFileSync(file), output = {}
    cache.set(file, output); closure.set(path.relative(root, file), digest(bytes))
    const javascript = ts.transpileModule(bytes.toString('utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    vm.runInNewContext(javascript, {
      exports: output,
      require: spec => {
        if (!/^\.\.?\/[A-Za-z0-9/_-]+$/.test(spec)) throw Error('Unknown/external service import ' + spec)
        return load(path.resolve(path.dirname(file), spec + '.ts'))
      },
      process: { env: Object.freeze({}) },
      console: Object.freeze({ log() { throw Error('Service import attempted console output') } })
    }, { filename: file, timeout: 1000 })
    return output
  }
  const services = load(path.join(root, 'src', 'lib', 'services.ts'))
  if (!Array.isArray(services.SERVICES) || typeof services.getPublicServices !== 'function' || !(services.RETIRED_SERVICE_IDS instanceof Set) && Object.prototype.toString.call(services.RETIRED_SERVICE_IDS) !== '[object Set]') throw Error('Service registry shape unavailable')
  const publicIds = new Set(services.getPublicServices().map(x => x.id))
  const registry = services.SERVICES.map(x => ({ id: x.id, name: x.name, status: x.status, href: x.href, public: publicIds.has(x.id), retired: services.RETIRED_SERVICE_IDS.has(x.id) }))
  if (new Set(registry.map(x => x.id)).size !== registry.length || publicIds.size !== services.getPublicServices().length || [...publicIds].some(id => !registry.some(x => x.id === id))) throw Error('Service registry identity mismatch')
  return { registry, closure: Object.fromEntries([...closure].sort(([a], [b]) => a.localeCompare(b))) }
}
function clientSource(root) {
  const requireFromRoot = createRequire(path.join(root, 'package.json'))
  const entry = fs.realpathSync(requireFromRoot.resolve('@prisma/client'))
  const wrapper = fs.readFileSync(entry, 'utf8')
  if (!/require\(['"]\.prisma\/client\/default['"]\)/.test(wrapper)) throw Error('Prisma client wrapper identity unknown')
  const generatedEntry = fs.realpathSync(createRequire(entry).resolve('.prisma/client/default'))
  const generatedDir = path.dirname(generatedEntry)
  if (!inside(path.join(root, 'node_modules'), generatedEntry)) throw Error('Generated Prisma client is outside checkout')
  if (!/require\(['"]\.['"]\)/.test(fs.readFileSync(generatedEntry, 'utf8'))) throw Error('Generated Prisma entry identity unknown')
  const generatedIndex = fs.realpathSync(path.join(generatedDir, 'index.js'))
  if (!inside(path.join(root, 'node_modules'), generatedIndex)) throw Error('Generated Prisma implementation is outside checkout')
  const generatedSchema = path.join(generatedDir, 'schema.prisma')
  if (!fs.existsSync(generatedSchema) || !fs.statSync(generatedSchema).isFile()) throw Error('Generated Prisma schema missing')
  const client = requireFromRoot('@prisma/client')
  if (!client.Prisma?.dmmf?.datamodel?.models || !client.Prisma?.dmmf?.datamodel?.enums) throw Error('Generated Prisma DMMF unavailable')
  const clientVersion = requireFromRoot('@prisma/client/package.json').version
  const formatterEntry = path.join(root, 'node_modules/prisma/build/index.js')
  const formatterPackage = path.join(root, 'node_modules/prisma/package.json')
  if (fs.realpathSync(formatterEntry) !== fs.realpathSync(requireFromRoot.resolve('prisma/build/index.js')) ||
      fs.realpathSync(formatterPackage) !== fs.realpathSync(requireFromRoot.resolve('prisma/package.json')) ||
      requireFromRoot('prisma/package.json').version !== clientVersion) throw Error('Pinned Prisma formatter and client identity mismatch')
  return { entry, generatedEntry, generatedIndex, generatedSchema, formatterEntry, formatterPackage, datamodel: client.Prisma.dmmf.datamodel, clientVersion }
}
function formattedSchemaHashes(sourceBytes, generatedBytes, formatterEntry) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'doya-er-format-'))
  try {
    const source = path.join(temp, 'source.prisma'), generated = path.join(temp, 'generated.prisma')
    fs.writeFileSync(source, sourceBytes, { mode: 0o600 })
    fs.writeFileSync(generated, generatedBytes, { mode: 0o600 })
    const env = { PATH: process.env.PATH || '', HOME: temp, PRISMA_HIDE_UPDATE_MESSAGE: '1', NO_COLOR: '1' }
    for (const file of [source, generated]) {
      try {
        cp.execFileSync(process.execPath, [formatterEntry, 'format', '--schema', file], {
          cwd: temp, env, timeout: 15000, maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']
        })
      } catch { throw Error('Pinned Prisma schema formatter failed') }
    }
    return { source: digest(fs.readFileSync(source)), generated: digest(fs.readFileSync(generated)) }
  } finally { fs.rmSync(temp, { recursive: true, force: true }) }
}
function run(argv) {
  const parsed = args(argv), root = fs.realpathSync(parsed.root), requestedOut = path.resolve(parsed['out-dir'])
  const out = path.join(fs.realpathSync(path.dirname(requestedOut)), path.basename(requestedOut))
  if (inside(root, out) || fs.existsSync(out)) throw Error('ER output must be a new directory outside source checkout')
  const statusBefore = git(root, 'status', '--porcelain', '--untracked-files=no')
  if (statusBefore) throw Error('Tracked source is dirty before ER export')
  const head = git(root, 'rev-parse', 'HEAD'), tree = git(root, 'rev-parse', 'HEAD^{tree}')
  const schemaPath = path.join(root, 'prisma/schema.prisma'), schemaBytes = fs.readFileSync(schemaPath)
  const sourceSchemaHash = digest(schemaBytes)
  if (!/^generator client\s*\{[\s\S]*?provider\s*=\s*"prisma-client-js"[\s\S]*?\}/m.test(schemaBytes.toString('utf8'))) throw Error('Unsupported Prisma generator')
  const client = clientSource(root), generatedHash = digest(fs.readFileSync(client.generatedSchema))
  const formatted = formattedSchemaHashes(schemaBytes, fs.readFileSync(client.generatedSchema), client.formatterEntry)
  if (formatted.source !== formatted.generated) throw Error('Generated client formatted schema does not match repository formatted schema')
  const requireFromRoot = createRequire(path.join(root, 'package.json'))
  const ts = requireFromRoot('typescript')
  const { registry, closure } = readClosure(root, ts)
  const closureInputs = {
    'prisma/schema.prisma': sourceSchemaHash,
    'package.json': digest(fs.readFileSync(path.join(root, 'package.json'))),
    'package-lock.json': digest(fs.readFileSync(path.join(root, 'package-lock.json'))),
    [path.relative(root, client.entry)]: digest(fs.readFileSync(client.entry)),
    [path.relative(root, client.generatedEntry)]: digest(fs.readFileSync(client.generatedEntry)),
    [path.relative(root, client.generatedIndex)]: digest(fs.readFileSync(client.generatedIndex)),
    [path.relative(root, client.generatedSchema)]: generatedHash,
    [path.relative(root, client.formatterEntry)]: digest(fs.readFileSync(client.formatterEntry)),
    [path.relative(root, client.formatterPackage)]: digest(fs.readFileSync(client.formatterPackage)),
    ...closure
  }
  const exporterFile = fs.realpathSync(__filename)
  if (inside(root, exporterFile)) closureInputs[path.relative(root, exporterFile)] = digest(fs.readFileSync(exporterFile))
  for (const [name, expected] of Object.entries(closureInputs)) {
    if (digest(fs.readFileSync(path.join(root, name))) !== expected) throw Error('Source changed during export: ' + name)
    if (name !== 'node_modules' && !name.startsWith('node_modules/')) {
      if (digest(committedBytes(root, name)) !== expected) throw Error('Source closure differs from HEAD: ' + name)
    }
  }
  if (git(root, 'status', '--porcelain', '--untracked-files=no') !== statusBefore || git(root, 'rev-parse', 'HEAD') !== head || git(root, 'rev-parse', 'HEAD^{tree}') !== tree) throw Error('Checkout changed during export')
  const dmmf = JSON.stringify(client.datamodel, null, 2) + '\n'
  const services = JSON.stringify(registry, null, 2) + '\n'
  const result = { passed: true, modelCount: client.datamodel.models.length, enumCount: client.datamodel.enums.length, serviceCount: registry.length, publicServiceCount: registry.filter(x => x.public).length, sourceSchemaHash, generatedSchemaHash: generatedHash, formattedSourceSchemaHash: formatted.source, formattedGeneratedSchemaHash: formatted.generated }
  const resultBytes = JSON.stringify(result, null, 2) + '\n'
  const manifest = {
    date: parsed.date, sourceCommit: head, sourceTree: tree, sourceStatus: statusBefore,
    schemaSha256: sourceSchemaHash, generatedClientSchemaSha256: generatedHash,
    formattedSourceSchemaSha256: formatted.source, formattedGeneratedClientSchemaSha256: formatted.generated,
    client: { entry: path.relative(root, client.entry), generatedEntry: path.relative(root, client.generatedEntry), generatedIndex: path.relative(root, client.generatedIndex), generatedSchema: path.relative(root, client.generatedSchema), version: client.clientVersion },
    formatter: { entry: path.relative(root, client.formatterEntry), package: path.relative(root, client.formatterPackage), version: client.clientVersion },
    closureSha256: Object.fromEntries(Object.entries(closureInputs).sort(([a], [b]) => a.localeCompare(b))),
    filesSha256: { 'schema.prisma': sourceSchemaHash, 'dmmf.json': digest(Buffer.from(dmmf)), 'service-registry.json': digest(Buffer.from(services)), 'validation.json': digest(Buffer.from(resultBytes)) },
    counts: { models: result.modelCount, enums: result.enumCount, services: result.serviceCount, publicServices: result.publicServiceCount },
    scope: 'Source-only Prisma DMMF and service registry. No DB record, provider, production schema, or rendering assertion.'
  }
  fs.mkdirSync(out, { recursive: false, mode: 0o700 })
  fs.writeFileSync(path.join(out, 'schema.prisma'), schemaBytes)
  fs.writeFileSync(path.join(out, 'dmmf.json'), dmmf)
  fs.writeFileSync(path.join(out, 'service-registry.json'), services)
  fs.writeFileSync(path.join(out, 'validation.json'), resultBytes)
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(JSON.stringify({ passed: true, out, sourceCommit: head, sourceTree: tree, models: result.modelCount }))
}
if (require.main === module) { try { run(process.argv.slice(2)) } catch (error) { console.error(error.message); process.exitCode = 1 } }
module.exports = { args, readClosure, clientSource, run }
