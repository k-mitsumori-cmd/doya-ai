const { load } = require('./load-typescript.cjs')
const { Prisma } = require('@prisma/client')
const crypto = require('node:crypto')

// Import bridge only: actual lifecycle modules, no bypasses, seeded owners or synthetic guards.
// Read fixtures never invoke writes; operation fixtures retain their own actual database transaction.
function shodanCoreImports() {
  const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': crypto })
  const store = load('src/lib/account-lifecycle/store.ts', { 'node:crypto': crypto, '@prisma/client': { Prisma }, './state': state })
  return { '@/lib/account-lifecycle/state': state, '@/lib/account-lifecycle/store': store }
}
module.exports = { shodanCoreImports }
