// Keep the shared TypeScript fixture loader byte-identical to the pinned Promane
// before-source closure. Only these changed quota modules need the actual pure
// organization selection dependency in synthetic route/classifier fixtures.
const base = require('./load-typescript.cjs')
const selection = base.load('src/lib/organization-workspace-selection.ts')

const scopedRoutes = new Set([
  'src/app/api/quote/documents/route.ts',
  'src/app/api/quote/products/route.ts',
  'src/app/api/mensetsu/sessions/route.ts',
  'src/app/api/mensetsu/templates/route.ts',
  'src/app/api/aishodan/products/route.ts',
])

function load(file, mocks = {}, globals = {}) {
  const importName = file === 'src/lib/service-limit-ui.ts'
    ? './organization-workspace-selection'
    : scopedRoutes.has(file)
      ? '@/lib/organization-workspace-selection'
      : null
  return base.load(file, importName ? { [importName]: selection, ...mocks } : mocks, globals)
}

module.exports = { ...base, load }
