// Source-only compatibility guard for the historical Promane before fixtures.
// The old schema is inert evidence; every SQL operation uses the current client.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const crypto = require('node:crypto')
const path = require('node:path')

const ROOT = process.cwd()
const PREFIX = 'scripts/security-regression/fixtures/promane-schema-compat/'
const contractPath = path.join(ROOT, PREFIX, 'model-contract.json')
const oldSchemaPath = path.join(ROOT, PREFIX, 'legacy-schema.prisma.txt')
const hash = value => crypto.createHash('sha256').update(value).digest('hex')

function assertPromaneSchemaCompatibility(Prisma) {
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'))
  assert.equal(contract.oldSourceCommit, '46a9e4fc4a93f49fa3cd2157252aa6cf5ee69006')
  assert.equal(contract.currentSourceCommit, 'e7f18942bbdcd764f8f52723a19351130fbd1be2')
  assert.equal(contract.oldDmmfArtifactSha256, '1729195833587b6f1b8c931e53106ea68d056a59ed0ec23bdc1ab6c0872de633')
  assert.equal(contract.currentDmmfArtifactSha256, 'c61fee84da920e6f67bc2cc04a5fb4bb02769c0138bdc8f24de2930b24dce6d4')
  assert.equal(contract.oldDmmfModelCount, 246)
  assert.equal(contract.currentDmmfModelCount, 249)
  assert.equal(contract.currentSchemaSha256, '12e8a7da80d07b572d2e2c52c1efc52fe9a424e9f8befbb6a21f11bf86609f49')
  assert.equal(hash(fs.readFileSync(oldSchemaPath)), contract.oldSchemaSha256)
  assert.equal(hash(fs.readFileSync(path.join(ROOT, 'prisma/schema.prisma'))), contract.currentSchemaSha256)
  const models = Prisma?.dmmf?.datamodel?.models
  assert(Array.isArray(models), 'Actual generated Prisma DMMF is required')
  assert.equal(models.length, contract.currentDmmfModelCount, 'Current generated Prisma model count must be 249')
  assert.equal(Object.keys(contract.models).length, 33)
  assert.equal(new Set(models.map(model => model.name)).size, models.length, 'Duplicate generated model names')
  for (const [name, expected] of Object.entries(contract.models)) {
    const actual = models.find(model => model.name === name)
    assert(actual, 'Missing current generated Prisma model: ' + name)
    // Complete DMMF model, including ordered fields, relation metadata,
    // defaults, unique keys and updatedAt. No field projection is discarded.
    assert.deepStrictEqual(JSON.parse(JSON.stringify(actual)), expected, 'Promane current-client model drift: ' + name)
  }
  return { oldSchemaSha256: contract.oldSchemaSha256,
    currentSchemaSha256: contract.currentSchemaSha256,
    compatibleModels: Object.keys(contract.models).length,
    contractSha256: hash(fs.readFileSync(contractPath)) }
}

module.exports = { assertPromaneSchemaCompatibility }
if (require.main === module) {
  console.log(JSON.stringify(assertPromaneSchemaCompatibility(require('@prisma/client').Prisma)))
}
