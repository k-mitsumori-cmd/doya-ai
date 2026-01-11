export type AdminRole = 'owner' | 'admin' | 'operator' | 'viewer'

export type AdminAccount = {
  id: string
  email: string
  name: string
  role: AdminRole
  passwordHash: string
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
}

export type AdminAccountPublic = Omit<AdminAccount, 'passwordHash'>







