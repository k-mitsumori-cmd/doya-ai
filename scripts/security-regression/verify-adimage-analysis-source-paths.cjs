const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const file = 'docs/audits/2026-10-06-all-services-recheck/verify-adimage-analysis-postgres.cjs'
const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
let manifest
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'files' && node.initializer && ts.isArrayLiteralExpression(node.initializer)) manifest = node.initializer.elements.map(e => { assert(ts.isStringLiteral(e)); return e.text })
  ts.forEachChild(node, visit)
}
visit(ast)
assert.equal(manifest?.length, 10, 'All ten existing evidence inputs must remain in the private regression')
assert.equal(new Set(manifest).size, 10)
for (const input of manifest) {
  assert.match(input, /^src\//)
  assert(fs.existsSync(input) && fs.statSync(input).isFile(), 'CI evidence input moved or missing: ' + input)
}
assert(manifest.includes('src/app/(shell)/adimage/Tool.tsx'))
console.log(JSON.stringify({ passed: 10, scope: 'Actual private analysis regression source-hash manifest; file existence only, no DB/provider calls' }))
