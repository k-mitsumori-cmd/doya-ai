const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

const { getOrganizationQuotaUsage, recordOrganizationQuotaUsage } = load(
  'src/lib/organization-quota-ledger.ts',
  { 'node:crypto': require('node:crypto') },
)

function fixture() {
  const values = new Map()
  const db = {
    systemSetting: {
      findUnique: async ({ where }) => values.has(where.key) ? { value: values.get(where.key) } : null,
      upsert: async ({ where, create, update }) => {
        values.set(where.key, values.has(where.key) ? update.value : create.value)
      },
    },
  }
  return { db, values }
}

;(async () => {
  await check('deleted sessions cannot restore a consumed lifetime or monthly quota', async () => {
    const { db } = fixture()
    const september = new Date('2026-09-30T14:59:00.000Z')
    const lifetime = await getOrganizationQuotaUsage(db, 'aishodanSessions', 'org', 'lifetime', async () => 2, september)
    const monthly = await getOrganizationQuotaUsage(db, 'aishodanSessions', 'org', 'monthly', async () => 2, september)
    await recordOrganizationQuotaUsage(db, 'aishodanSessions', 'org', lifetime, monthly, september)
    assert.equal(await getOrganizationQuotaUsage(db, 'aishodanSessions', 'org', 'lifetime', async () => 0, september), 3)
    assert.equal(await getOrganizationQuotaUsage(db, 'aishodanSessions', 'org', 'monthly', async () => 0, september), 3)
    const october = new Date('2026-09-30T15:01:00.000Z')
    assert.equal(await getOrganizationQuotaUsage(db, 'aishodanSessions', 'org', 'monthly', async () => 0, october), 0)
    assert.equal(await getOrganizationQuotaUsage(db, 'aishodanSessions', 'org', 'lifetime', async () => 0, october), 3)
  })
  await check('existing rows backfill the ledger and organizations remain separate', async () => {
    const { db } = fixture()
    const used = await getOrganizationQuotaUsage(db, 'aishodanSessions', 'org-a', 'lifetime', async () => 5)
    await recordOrganizationQuotaUsage(db, 'aishodanSessions', 'org-a', used, 0)
    assert.equal(await getOrganizationQuotaUsage(db, 'aishodanSessions', 'org-a', 'lifetime', async () => 0), 6)
    assert.equal(await getOrganizationQuotaUsage(db, 'aishodanSessions', 'org-b', 'lifetime', async () => 0), 0)
  })
  await check('invalid ledger fails closed', async () => {
    const { db, values } = fixture()
    await recordOrganizationQuotaUsage(db, 'quoteDocuments', 'org', 0, 0)
    for (const key of values.keys()) values.set(key, 'corrupt')
    await assert.rejects(() => getOrganizationQuotaUsage(db, 'quoteDocuments', 'org', 'lifetime', async () => 0))
  })
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 })
