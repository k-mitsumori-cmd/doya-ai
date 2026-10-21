const { load } = require('./load-typescript.cjs')
const { Prisma } = require('@prisma/client')
const crypto = require('node:crypto')

/** Load the real lifecycle implementation for native private-Postgres suites. */
function aioLifecycleImports() {
  const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': crypto })
  const store = load('src/lib/account-lifecycle/store.ts', { 'node:crypto': crypto, '@prisma/client': { Prisma }, './state': state })
  const fence = load('src/lib/account-lifecycle/organization-fence.ts', { '@prisma/client': { Prisma }, './state': state, './store': store })
  return { '@/lib/account-lifecycle/state': state, '@/lib/account-lifecycle/store': store, '@/lib/account-lifecycle/organization-fence': fence }
}

/** Legacy offline fixture bridge only: actual state/store/fence, synthetic rows and empty KV. */
function shodanLifecycleFixture(prisma, options = {}) {
  const service = options.service || 'shodan'
  if (!['shodan', 'aio'].includes(service)) throw Error('Unsupported lifecycle fixture service')
  const globals = options.globals || {}, userId = options.userId || 'user', memberId = options.memberId || 'actor', orgId = options.organizationId || 'org'
  const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': crypto }, globals)
  const store = load('src/lib/account-lifecycle/store.ts', { 'node:crypto': crypto, '@prisma/client': { Prisma }, './state': state }, globals)
  const fence = load('src/lib/account-lifecycle/organization-fence.ts', { '@prisma/client': { Prisma }, './state': state, './store': store }, globals)
  if (!Array.isArray(options.userIds) || (options.mode !== 'creation' && typeof options.authorityRows !== 'function')) throw Error('Explicit normal User and authority fixture seeds required')
  const userIds = new Set(options.userIds)
  const originalTransaction = prisma.$transaction.bind(prisma), baseUser = options.user || prisma.user
  const readUser = async args => {
    if (args?.where?.id && !userIds.has(args.where.id)) return null
    const row = baseUser?.findUnique ? await baseUser.findUnique(args) : { email: options.email || 'synthetic@example.invalid' }
    return row ? { id: args?.where?.id || userId, ...row } : null
  }
  if (!prisma.user) prisma.user = { findUnique: readUser }
  const rows = async tx => {
    if (options.mode === 'claim') {
      const row = await options.target(tx)
      const owners = options.authorityRows()
      if (!row || row.organizationId !== orgId) return owners
      return [...owners, { id: row.id, userId: row.userId ?? null, role: row.role, status: row.status, pendingEmail: row.inviteEmail ?? null, inviteToken: row.inviteToken ?? null }].sort((a, b) => a.id.localeCompare(b.id))
    }
    const role = typeof options.role === 'function' ? options.role() : options.role
    const actor = { id: memberId, userId, role, status: 'ACTIVE', pendingEmail: null, inviteToken: null }
    return [actor, ...options.authorityRows()].sort((a, b) => a.id.localeCompare(b.id))
  }
  prisma.$transaction = (work, config) => originalTransaction(async tx => {
    const previousRaw = tx.$queryRaw?.bind(tx)
    return work({ ...tx,
      user: { ...tx.user, findUnique: readUser, findMany: async args => {
        if (args.where?.id?.in) return args.where.id.in.filter(id => userIds.has(id)).map(id => ({ id }))
        const row = await readUser({ where: { id: userId } })
        return row ? [row] : []
      } },
      systemSetting: tx.systemSetting || { findUnique: async () => null },
      $queryRaw: async (sql, ...values) => {
        const text = (Array.isArray(sql) ? sql.join('?') : sql.sql).replaceAll('"', '')
        const parameters = Array.isArray(sql) ? values : sql.values
        if (text.includes('FROM User')) return [...new Set(parameters)].filter(id => userIds.has(id)).sort().map(id => ({ id }))
        if (text.includes(`FROM ${service}_organizations`)) {
          if (text.includes('FOR UPDATE') && previousRaw) await previousRaw(Array.isArray(sql) ? sql : sql.strings, ...parameters)
          return [{ id: orgId }]
        }
        if (text.includes(`FROM ${service}_members`)) {
          if (/SELECT role FROM/.test(text)) return previousRaw(Array.isArray(sql) ? sql : sql.strings, ...parameters)
          return rows(tx)
        }
        throw Error(`Unexpected ${service} fixture SQL`)
      },
    })
  }, config)
  return { '@/lib/account-lifecycle/state': state, '@/lib/account-lifecycle/store': store, '@/lib/account-lifecycle/organization-fence': fence }
}
module.exports = { shodanLifecycleFixture, aioLifecycleImports }
