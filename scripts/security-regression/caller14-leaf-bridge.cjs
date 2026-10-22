// Load the actual newly imported pure UI/state leaves. Only DS rendering is synthetic.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module')
module.exports = function createLeafBridge(root, React, ts) {
  const primitive = ({ children, href, onClick, disabled, ...props }) => React.createElement(href ? 'a' : 'button', { href, onClick, disabled, ...props }, children)
  const ds = { Button: primitive, EmptyState: primitive, ErrorNotice: ({ what, how, onRetry, retryLabel }) => React.createElement('div', { role: 'alert' }, what, how, onRetry ? React.createElement('button', { onClick: onRetry }, retryLabel) : null), Skeleton: primitive, ToolHero: primitive, FirstSteps: primitive, StatTile: primitive }
  const cache = new Map()
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative).exports
    const filename = path.join(root, relative), mod = new Module(filename)
    cache.set(relative, mod)
    mod.require = id => {
      if (id === 'react') return React
      if (id === 'react/jsx-runtime') return require(path.join(root, 'node_modules/react/jsx-runtime'))
      if (id === '@/components/ds') return ds
      throw Error('Unmocked actual leaf dependency ' + id)
    }
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename)
    return mod.exports
  }
  return { ds, mensetsuStates: () => load('src/components/mensetsu/states.tsx'), aishodanFailure: () => load('src/components/aishodan/failure.tsx') }
}
