const { load } = require('./load-typescript.cjs')
const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': require('node:crypto') })
const Prisma = { sql(strings, ...values) { return Object.assign([...strings], { values }) }, join(values) { return values } }
function actualMembership(prisma, witness = []) {
  return load('src/lib/hr/membership-write.ts', {
    '@prisma/client': { Prisma },
    '@/lib/prisma': { prisma },
    '@/lib/account-lifecycle/store': {
      lockLifecycleUsers: async (_tx, ids) => { witness.push({ kind: 'users', ids: [...ids] }) },
      assertRetirementMembershipWritable: async (_tx, ids) => { witness.push({ kind: 'retirement-fence', ids: [...ids] }) },
    },
  })
}
module.exports = { actualMembership, state, Prisma }
