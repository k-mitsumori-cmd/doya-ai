import bcrypt from 'bcryptjs'
import type { AdminAccount, AdminAccountPublic, AdminRole } from './types'

type AccountsStore = {
  version: 1
  accounts: AdminAccount[]
}

declare global {
  // eslint-disable-next-line no-var
  var __DOYA_ADMIN_ACCOUNTS__: AccountsStore | undefined
}

function nowIso() {
  return new Date().toISOString()
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function createInitialStore(): AccountsStore {
  const ownerEmail = normalizeEmail(process.env.ADMIN_OWNER_EMAIL || 'admin@local')
  const ownerPassword = process.env.ADMIN_PASSWORD || 'doya-admin-2024'
  const createdAt = nowIso()
  const passwordHash = bcrypt.hashSync(ownerPassword, 10)

  return {
    version: 1,
    accounts: [
      {
        id: 'owner-1',
        email: ownerEmail,
        name: 'Owner',
        role: 'owner',
        passwordHash,
        createdAt,
        updatedAt: createdAt,
      },
    ],
  }
}

export function getAccountsStore(): AccountsStore {
  if (!globalThis.__DOYA_ADMIN_ACCOUNTS__) {
    globalThis.__DOYA_ADMIN_ACCOUNTS__ = createInitialStore()
  }
  return globalThis.__DOYA_ADMIN_ACCOUNTS__!
}

export function listAccounts(): AdminAccountPublic[] {
  const store = getAccountsStore()
  return store.accounts
    .map(({ passwordHash: _pw, ...rest }) => rest)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export function findAccountByEmail(email: string): AdminAccount | undefined {
  const store = getAccountsStore()
  const e = normalizeEmail(email)
  return store.accounts.find((a) => a.email === e)
}

export function verifyPassword(account: AdminAccount, password: string) {
  return bcrypt.compareSync(password, account.passwordHash)
}

export function markLogin(accountId: string) {
  const store = getAccountsStore()
  const a = store.accounts.find((x) => x.id === accountId)
  if (!a) return
  a.lastLoginAt = nowIso()
  a.updatedAt = nowIso()
}

export function createAccount(input: { email: string; name: string; role: AdminRole; password: string }): AdminAccountPublic {
  const store = getAccountsStore()
  const email = normalizeEmail(input.email)
  if (!email || !email.includes('@')) throw new Error('invalid email')
  if (store.accounts.some((a) => a.email === email)) throw new Error('email already exists')
  if (!input.password || input.password.length < 10) throw new Error('password too short')

  const createdAt = nowIso()
  const account: AdminAccount = {
    id: `acc-${Date.now()}`,
    email,
    name: input.name.trim() || email,
    role: input.role,
    passwordHash: bcrypt.hashSync(input.password, 10),
    createdAt,
    updatedAt: createdAt,
  }
  store.accounts.unshift(account)
  const { passwordHash: _pw, ...pub } = account
  return pub
}

export function updateAccountRole(accountId: string, role: AdminRole): AdminAccountPublic {
  const store = getAccountsStore()
  const a = store.accounts.find((x) => x.id === accountId)
  if (!a) throw new Error('not found')
  a.role = role
  a.updatedAt = nowIso()
  const { passwordHash: _pw, ...pub } = a
  return pub
}

export function resetAccountPassword(accountId: string, newPassword: string): AdminAccountPublic {
  const store = getAccountsStore()
  const a = store.accounts.find((x) => x.id === accountId)
  if (!a) throw new Error('not found')
  if (!newPassword || newPassword.length < 10) throw new Error('password too short')
  a.passwordHash = bcrypt.hashSync(newPassword, 10)
  a.updatedAt = nowIso()
  const { passwordHash: _pw, ...pub } = a
  return pub
}

export function deleteAccount(accountId: string) {
  const store = getAccountsStore()
  const idx = store.accounts.findIndex((x) => x.id === accountId)
  if (idx === -1) throw new Error('not found')
  if (store.accounts[idx].role === 'owner') throw new Error('cannot delete owner')
  store.accounts.splice(idx, 1)
}







