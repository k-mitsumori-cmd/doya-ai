// Catch moved source inputs before running the isolated database regressions.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const workflow = '.github/workflows/ci.yml'
const scriptRefs = text => [...text.matchAll(/(?:docs|scripts)\/[\w./-]+\.(?:py|cjs|mjs)/g)].map(match => match[0])
const pending = scriptRefs(fs.readFileSync(workflow, 'utf8'))
const scripts = new Set()
const references = []
const path = require('node:path')
while (pending.length) {
  const file = pending.pop()
  if (scripts.has(file)) continue
  scripts.add(file)
  assert(fs.existsSync(file), 'CI regression script moved or missing: ' + file)
  const source = fs.readFileSync(file, 'utf8')
  pending.push(...scriptRefs(source))
  // Supervisors also construct probe paths from their directory and a basename.
  for (const match of source.matchAll(/["']([\w.-]+\.(?:py|cjs|mjs))["']/g)) {
    const sibling = path.posix.join(path.posix.dirname(file), match[1])
    if (fs.existsSync(sibling)) pending.push(sibling)
  }
  for (const match of source.matchAll(/["'](src\/[^"'\n]+\.(?:ts|tsx))["']/g)) {
    const input = match[1]
    assert(fs.existsSync(input) && fs.statSync(input).isFile(), `${file}: source input moved or missing: ${input}`)
    references.push({ file, input })
  }
}
assert(scripts.size > 0 && references.length > 0, 'Expected actual CI scripts and source inputs')
console.log(JSON.stringify({ passed: true, scripts: scripts.size, sourceReferences: references.length, databaseCalls: 0, providerCalls: 0 }))
