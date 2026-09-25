const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { check } = require('./load-typescript.cjs')

const root = path.resolve(__dirname, '../../src/app/api/seo')

function routes(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => {
    const name = path.join(dir, item.name)
    return item.isDirectory() ? routes(name) : item.name === 'route.ts' ? [name] : []
  })
}

function property(object, name) {
  return object?.properties?.find(item => ts.isPropertyAssignment(item) && item.name.getText() === name)
}

;(async () => {
  await check('SEO 5xx JSON responses never echo raw exception messages', async () => {
    let checked = 0
    for (const file of routes(root)) {
      const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
      function visit(node) {
        if (ts.isCallExpression(node) && node.expression.getText(source) === 'NextResponse.json' && node.arguments.length >= 2) {
          const body = node.arguments[0]
          const options = node.arguments[1]
          if (ts.isObjectLiteralExpression(body) && ts.isObjectLiteralExpression(options)) {
            const status = property(options, 'status')?.initializer.getText(source)
            if (/^5\d\d$/.test(status || '')) {
              checked++
              const error = property(body, 'error')?.initializer.getText(source) || ''
              assert(!/(?:\b(?:e|err|error)\s*\??\.\s*(?:message|stack)\b|\bmsg\b|String\s*\(\s*(?:e|err|error)\s*\))/.test(error), `${file}: ${error}`)
            }
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
    assert(checked >= 40, `Expected broad SEO 5xx coverage, got ${checked}`)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
