const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.resolve(__dirname, '../..')
const source = fs.readFileSync(path.join(root, 'src/lib/services.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText
const moduleExports = {}
vm.runInNewContext(compiled, {
  exports: moduleExports,
  process: { env: {} },
  require(name) {
    if (name === './unified-plan') return { UNIFIED_PRO_PRICE: 9980 }
    throw new Error(`Unexpected services dependency: ${name}`)
  },
})

const services = moduleExports.getActiveServices()
assert(services.length > 0, 'No active services were loaded')
assert.equal(new Set(services.map(service => service.id)).size, services.length, 'Duplicate active service ID')

const links = new Set()
for (const service of services) {
  for (const field of ['href', 'dashboardHref', 'pricingHref', 'guideHref']) {
    const href = service[field]
    assert.match(href, /^\/[a-z0-9/-]+$/, `${service.id}.${field} must be a local path`)
    assert(!href.includes('//') && !href.includes('..'), `${service.id}.${field} contains an unsafe path`)
    links.add(href)
    const dir = path.join(root, 'src/app', href.slice(1))
    assert(
      ['page.tsx', 'page.ts', 'page.jsx', 'page.js'].some(file => fs.existsSync(path.join(dir, file))),
      `${service.id}.${field} points to a missing page: ${href}`,
    )
  }
}

console.log(`PASS ${services.length} active services, ${links.size} distinct navigation pages exist`)
