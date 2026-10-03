const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, deps = {}) {
  const exports = {}
  const source = fs.readFileSync(path.join(__dirname, '../../', file), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { exports, require: name => {
    assert(name in deps, `Unexpected import: ${name}`)
    return deps[name]
  } })
  return exports
}

const constants = load('src/lib/doyalist/constants.ts')
const preferences = load('src/lib/doyalist/preferences.ts', { './constants': constants })
let saved = null
const storage = { getItem: () => saved, setItem: (_, value) => { saved = value } }

assert.equal(preferences.readDoyalistPreferences(storage).defaultIndustry, '')
assert.equal(preferences.readDoyalistPreferences(storage).defaultRegion, '')
preferences.saveDoyalistPreferences(storage, { defaultIndustry: '医療・介護', defaultRegion: '関東' })
assert.equal(preferences.readDoyalistPreferences(storage).defaultIndustry, '医療・介護')
assert.equal(preferences.readDoyalistPreferences(storage).defaultRegion, '関東')
saved = JSON.stringify({ defaultIndustry: '無効な業種', defaultRegion: '火星', emailNotifications: false, density: 'compact' })
assert.equal(preferences.readDoyalistPreferences(storage).defaultIndustry, '')
assert.equal(preferences.readDoyalistPreferences(storage).defaultRegion, '')
saved = '{broken'
assert.equal(preferences.readDoyalistPreferences(storage).defaultIndustry, '')
assert.equal(preferences.readDoyalistPreferences({ getItem: () => { throw Error('storage blocked') } }).defaultIndustry, '')
assert.equal(preferences.readDoyalistPreferences().defaultIndustry, '')
assert.throws(() => preferences.saveDoyalistPreferences({ setItem: () => { throw Error('storage full') } }, { defaultIndustry: '', defaultRegion: '' }))
console.log('PASS Doyalist preferences apply only valid saved extraction defaults and report storage failures')
