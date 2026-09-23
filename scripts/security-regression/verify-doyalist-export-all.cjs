const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
const JSZip = require('jszip')
const { NextResponse } = require('next/server')
const { load, check } = require('./load-typescript.cjs')

const csv = load('src/lib/doyalist/export-csv.ts')
const projects = [{ id: 'archive', name: 'Archive', status: 'archived' }, { id: 'empty', name: 'Empty', status: 'active' }]
let owner = 'owner', failData = false
const prisma = {
  doyalistProject: { findMany: async q => { assert.equal(q.where.userId, 'owner'); assert.equal(q.where.status, undefined); return projects } },
  doyalistCompany: { findMany: async q => { if (failData) throw Error('synthetic DB failure'); return q.where.projectId === 'archive' ? [{ name: '=formula', createdAt: new Date('2026-09-23'), enrichedData: {} }] : [] } },
  doyalistApproach: { findMany: async () => [] },
}
const route = load('src/app/api/doyalist/export-all/route.ts', {
  'next/server': { NextResponse }, 'next-auth': { getServerSession: async () => owner ? { user: { id: owner } } : null },
  '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma }, '@/lib/doyalist/export-csv': csv,
  archiver: require('archiver'), 'node:stream': require('node:stream'),
})

;(async () => {
  await check('archive and empty project both appear in one valid ZIP', async () => {
    const response = await route.GET(new Request('https://local.invalid/api/doyalist/export-all'))
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'application/zip')
    const zip = await JSZip.loadAsync(Buffer.from(await response.arrayBuffer()))
    const names = Object.keys(zip.files)
    assert.equal(names.length, 2)
    assert(names.some(name => name.includes('archive')))
    assert(names.some(name => name.includes('empty')))
    const archive = await zip.file(names.find(name => name.includes('archive'))).async('string')
    const empty = await zip.file(names.find(name => name.includes('empty'))).async('string')
    assert(archive.includes("'=formula"))
    assert(empty.includes('企業一覧'))
  })
  await check('unauthenticated export rejected before data access', async () => {
    owner = null
    const response = await route.GET(new Request('https://local.invalid/api/doyalist/export-all'))
    assert.equal(response.status, 401)
    owner = 'owner'
  })
  await check('stream data failure rejects the downloaded response', async () => {
    failData = true
    const response = await route.GET(new Request('https://local.invalid/api/doyalist/export-all'))
    await assert.rejects(response.arrayBuffer())
    failData = false
  })

  const source = fs.readFileSync('src/app/doyalist/settings/page.tsx', 'utf8')
  const ast = ts.createSourceFile('settings.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let declaration
  function walk(node) {
    if (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(ast) === 'handleExportAll')) declaration = node.getText(ast)
    ts.forEachChild(node, walk)
  }
  walk(ast)
  assert(declaration)
  await check('settings never claims success for failed or malformed downloads', async () => {
    for (const kind of ['http', 'malformed']) {
      const messages = [], exportingRef = { current: false }, response = kind === 'http'
        ? { ok: false, json: async () => ({ error: 'blocked' }) }
        : { ok: true, headers: { get: () => 'application/zip' }, blob: async () => new Blob(['broken']) }
      const exports = {}
      vm.runInNewContext(ts.transpileModule(declaration + ';exports.handle=handleExportAll;', { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
        { exports, exportingRef, setExporting: () => {}, toast: { loading: () => 'id', success: () => messages.push('success'), error: () => messages.push('error') }, fetch: async () => response, AbortController, setTimeout, clearTimeout, Blob, Uint8Array, URL })
      await exports.handle()
      assert.deepEqual(messages, ['error'])
      assert.equal(exportingRef.current, false)
    }
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
