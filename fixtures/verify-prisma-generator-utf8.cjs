'use strict'

// Lightweight contracts only. Never invokes `prisma generate`.
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')
const { fork } = require('node:child_process')
const { createRequire } = require('node:module')
const { PassThrough } = require('node:stream')

const root = path.resolve(process.argv[2] || process.cwd())
const wrapper = require('../scripts/prisma/generate.cjs')
const preloadFile = path.resolve(__dirname, '../scripts/prisma/generator-utf8-preload.cjs')
const preload = require(preloadFile)
const { cli, generator } = wrapper.installed(root)
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const cases = []
const verifyGenerated = process.argv.includes('--generated')
function check(label, fn) { fn(); cases.push(label) }

check('installed pinned implementation', () => {
  assert.equal(digest(cli), wrapper.CLI_SHA256)
  assert.equal(digest(generator), wrapper.GENERATOR_SHA256)
})
check('matching child only sets UTF-8 before actual generator evaluation', () => {
  const calls = []
  const input = { setEncoding(value) { calls.push(value) } }
  const child = { PRISMA_GENERATOR_INVOCATION: 'true', DOYA_PRISMA_GENERATOR_INVOCATION: 'true', DOYA_PRISMA_GENERATE_ROOT: root }
  assert.equal(preload.apply(child, [process.execPath, generator], input), true)
  assert.deepEqual(calls, ['utf8'])
  assert.equal(preload.apply({ DOYA_PRISMA_GENERATOR_INVOCATION: 'true', DOYA_PRISMA_GENERATE_ROOT: root }, [process.execPath, generator], input), false)
  assert.throws(() => preload.apply({ ...child, DOYA_PRISMA_GENERATOR_INVOCATION: 'false' }, [process.execPath, generator], input), /outside UTF-8 wrapper/)
  assert.throws(() => preload.apply(child, [process.execPath, cli], input), /Unexpected Prisma generator entry/)
  assert.deepEqual(calls, ['utf8'])
})
check('missing root and unexpected child fail closed', () => {
  const input = { setEncoding() { throw Error('should not reach stdin') } }
  assert.throws(() => preload.apply({ PRISMA_GENERATOR_INVOCATION: 'true', DOYA_PRISMA_GENERATOR_INVOCATION: 'true' }, [process.execPath, generator], input), /root missing/)
  const unexpected = path.join(path.dirname(generator), 'unknown.js')
  assert.throws(() => preload.apply({ PRISMA_GENERATOR_INVOCATION: 'true', DOYA_PRISMA_GENERATOR_INVOCATION: 'true', DOYA_PRISMA_GENERATE_ROOT: root }, [process.execPath, unexpected], input))
})
check('version and generator hash drift fail before stdin mutation', () => {
  const folders = []
  function fixture(version, generatorBytes) {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-identity-'))
    folders.push(folder)
    const client = path.join(folder, 'node_modules/@prisma/client')
    const generatorDir = path.join(client, 'generator-build')
    fs.mkdirSync(generatorDir, { recursive: true })
    fs.writeFileSync(path.join(folder, 'package.json'), '{}\n')
    fs.writeFileSync(path.join(client, 'package.json'), JSON.stringify({ name: '@prisma/client', version }))
    const entry = path.join(generatorDir, 'index.js')
    fs.writeFileSync(entry, generatorBytes)
    return { folder, entry }
  }
  try {
    let changed = false
    const input = { setEncoding() { changed = true } }
    const wrongVersion = fixture('0.0.0', fs.readFileSync(generator))
    const wrongHash = fixture(wrapper.VERSION, 'module.exports = {}\n')
    for (const item of [wrongVersion, wrongHash]) {
      const env = { PRISMA_GENERATOR_INVOCATION: 'true', DOYA_PRISMA_GENERATOR_INVOCATION: 'true', DOYA_PRISMA_GENERATE_ROOT: item.folder }
      assert.throws(() => preload.apply(env, [process.execPath, item.entry], input), /Unexpected Prisma generator entry/)
    }
    assert.equal(JSON.parse(fs.readFileSync(path.join(wrongVersion.folder, 'node_modules/@prisma/client/package.json'))).version, '0.0.0')
    assert.equal(digest(wrongVersion.entry), wrapper.GENERATOR_SHA256)
    assert.equal(JSON.parse(fs.readFileSync(path.join(wrongHash.folder, 'node_modules/@prisma/client/package.json'))).version, wrapper.VERSION)
    assert.notEqual(digest(wrongHash.entry), wrapper.GENERATOR_SHA256)
    assert.equal(changed, false)
  } finally { for (const folder of folders) fs.rmSync(folder, { recursive: true, force: true }) }
})
check('CLI implementation hash drift fails before generate subprocess', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-cli-identity-'))
  try {
    fs.writeFileSync(path.join(folder, 'package.json'), '{}\n')
    const prismaDir = path.join(folder, 'node_modules/prisma')
    const clientDir = path.join(folder, 'node_modules/@prisma/client')
    fs.mkdirSync(path.join(prismaDir, 'build'), { recursive: true })
    fs.mkdirSync(path.join(clientDir, 'generator-build'), { recursive: true })
    fs.writeFileSync(path.join(prismaDir, 'package.json'), JSON.stringify({ name: 'prisma', version: wrapper.VERSION }))
    fs.writeFileSync(path.join(clientDir, 'package.json'), JSON.stringify({ name: '@prisma/client', version: wrapper.VERSION }))
    const fakeCli = path.join(prismaDir, 'build/index.js')
    fs.writeFileSync(fakeCli, 'module.exports = {}\n')
    fs.symlinkSync(generator, path.join(clientDir, 'generator-build/index.js'))
    assert.notEqual(digest(fakeCli), wrapper.CLI_SHA256)
    assert.equal(digest(path.join(clientDir, 'generator-build/index.js')), wrapper.GENERATOR_SHA256)
    assert.throws(() => wrapper.installed(folder), /Unexpected Prisma generator or CLI implementation/)
  } finally { fs.rmSync(folder, { recursive: true, force: true }) }
})
check('wrapper preserves status, signal, inherited options, and fixed generate argv', () => {
  assert.equal(wrapper.nodeOptionRequire('C:\\path with spaces\\preload.cjs', 'win32'), '--require="C:/path with spaces/preload.cjs"')
  for (const expected of [{ status: 7, signal: null }, { status: null, signal: 'SIGTERM' }]) {
    let command
    const result = wrapper.run(root, { NODE_OPTIONS: '--trace-warnings', LANG: 'C' }, (exe, args, options) => {
      command = { exe, args, options }
      return expected
    })
    assert.deepEqual(result, expected)
    assert.equal(command.exe, process.execPath)
    assert.deepEqual(command.args, [cli, 'generate'])
    assert.equal(command.options.shell, false)
    assert.equal(command.options.env.DOYA_PRISMA_GENERATOR_INVOCATION, 'true')
    assert.match(command.options.env.NODE_OPTIONS, /^--trace-warnings --require=".*generator-utf8-preload.cjs"$/)
  }
  assert.equal(wrapper.propagate({ status: 7, signal: null }), 7)
  assert.equal(wrapper.propagate({ status: null, signal: null }), 1)
  const delivered = []
  assert.equal(wrapper.propagate({ status: null, signal: 'SIGTERM' }, (pid, signal) => delivered.push([pid, signal])), 1)
  assert.deepEqual(delivered, [[process.pid, 'SIGTERM']])
})

async function actualBylineControls() {
  const source = fs.readFileSync(generator, 'utf8')
  const begin = source.indexOf('// ../generator-helper/src/byline.ts')
  const end = source.indexOf('// ../generator-helper/src/generatorHandler.ts', begin)
  assert(begin >= 0 && end > begin)
  const context = { require, __toESM: value => ({ default: value }), Buffer, setImmediate }
  vm.createContext(context)
  vm.runInContext(source.slice(begin, end) + '\nglobalThis.actualByline=byline;', context)
  const text = '/// 0-100。⚠️ 参考値であり、最終判断は人が行う'
  const message = Buffer.from(JSON.stringify({ method: 'generate', params: { datamodel: text } }) + '\n')
  const at = message.indexOf(Buffer.from('最'))
  assert(at > 0)
  async function read(parts, repaired) {
    const input = new PassThrough()
    if (repaired) preload.apply({ PRISMA_GENERATOR_INVOCATION: 'true', DOYA_PRISMA_GENERATOR_INVOCATION: 'true', DOYA_PRISMA_GENERATE_ROOT: root }, [process.execPath, generator], input)
    const stream = context.actualByline(input)
    const rows = []
    const done = new Promise((resolve, reject) => { stream.on('data', value => rows.push(String(value))); stream.on('error', reject); stream.on('end', resolve) })
    for (const part of parts) input.write(part)
    input.end()
    await done
    return JSON.parse(rows.join('\n')).params.datamodel
  }
  for (const split of [1, 2]) {
    const parts = [message.subarray(0, at + split), message.subarray(at + split)]
    assert.notEqual(await read(parts, false), text)
    assert.equal(await read(parts, true), text)
    cases.push('actual byline split ' + split)
  }
  assert.equal(await read([message], false), text)
  assert.equal(await read([message], true), text)
  cases.push('actual byline unsplit control')
}

async function forkPropagation() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma utf8 path with spaces '))
  try {
    const target = path.join(folder, 'preload.cjs')
    fs.copyFileSync(preloadFile, target)
    const childFile = path.join(folder, 'child.cjs')
    fs.writeFileSync(childFile, "process.send({loaded:!!require.cache[process.env.PRELOAD_FILE],encoding:process.stdin.readableEncoding||null,})\n")
    const env = wrapper.childEnvironment(root, target, { ...process.env, PRELOAD_FILE: fs.realpathSync(target) })
    async function probe(environment) {
      const child = fork(childFile, [], { execArgv: [], env: environment, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] })
      let timer
      try {
        const answer = await new Promise((resolve, reject) => {
          timer = setTimeout(() => { child.kill('SIGKILL'); reject(Error('fork preload timed out')) }, 3000)
          child.once('message', resolve)
          child.once('error', reject)
          child.once('exit', (code, signal) => reject(Error(`fork exited before message: ${code || signal}`)))
        })
        if (child.exitCode === null && child.signalCode === null) {
          await new Promise((resolve, reject) => {
            const exitTimer = setTimeout(() => { child.kill('SIGKILL'); reject(Error('fork did not exit after message')) }, 3000)
            child.once('exit', () => { clearTimeout(exitTimer); resolve() })
          })
        }
        return answer
      } finally { clearTimeout(timer); if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL') }
    }
    const answer = await probe(env)
    assert.deepEqual(answer, { loaded: true, encoding: null })
    await assert.rejects(probe({ ...env, PRISMA_GENERATOR_INVOCATION: 'true' }), /fork exited before message/)
    cases.push('quoted path and NODE_OPTIONS survive fork execArgv override')
    cases.push('unexpected official generator entry exits before any child message')
  } finally { fs.rmSync(folder, { recursive: true, force: true }) }
}

function generatedDocumentation() {
  if (!verifyGenerated) return null
  const expected = '/// 0-100。⚠️ 参考値であり、最終判断は人が行う'
  const source = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8')
  const generated = fs.readFileSync(path.join(root, 'node_modules/.prisma/client/schema.prisma'), 'utf8')
  const field = /model AishodanOutcome\s*\{[^}]*?\/\/\/ 0-100。⚠️ 参考値であり、最終判断は人が行う\s+fitScore\s+Int/s
  assert.match(source, field)
  assert.match(generated, field)
  assert.equal(source.split(expected).length, 2)
  assert.equal(generated.split(expected).length, 2)
  const client = createRequire(path.join(root, 'package.json'))('@prisma/client')
  const model = client.Prisma.dmmf.datamodel.models.find(item => item.name === 'AishodanOutcome')
  const fitScore = model?.fields.find(item => item.name === 'fitScore')
  assert(fitScore)
  if (fitScore.documentation !== undefined) assert.equal(fitScore.documentation, expected.slice(4))
  cases.push('generated schema Aishodan fitScore documentation exact')
  return { dmmfFieldPresent: true, dmmfDocumentationPresent: fitScore.documentation !== undefined }
}

actualBylineControls().then(forkPropagation).then(() => {
  const documentation = generatedDocumentation()
  console.log(JSON.stringify({ passed: true, cases, generatorSha256: digest(generator), documentation, scope: verifyGenerated ? 'Generated schema and DMMF read only after wrapper generation; no DB.' : 'Actual installed byline and synthetic split/fork; no Prisma generation or DMMF.' }, null, 2))
}).catch(error => { console.error(error); process.exitCode = 1 })
