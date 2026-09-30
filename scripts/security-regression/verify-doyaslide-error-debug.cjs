const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const file = 'src/lib/doyaslide/errors.ts'
const privateError = new Error('PRIVATE_DATABASE_DETAIL')
const production = load(file, {}, { process: { env: { NODE_ENV: 'production', DOYA_DEBUG: '1' } } })
assert.equal(production.isDoyaDebug(), false)
assert.equal(production.errorSuffix(privateError), '')

const development = load(file, {}, { process: { env: { NODE_ENV: 'development' } } })
assert.equal(development.isDoyaDebug(), true)
assert.ok(development.errorSuffix(privateError).includes('PRIVATE_DATABASE_DETAIL'))

console.log('PASS DoyaSlide production errors stay private even when the debug flag is set')
