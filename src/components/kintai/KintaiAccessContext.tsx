'use client'

import { createContext, useContext } from 'react'

export const KintaiAccessContext = createContext<{ isActive: boolean | null; organizationId?: string | null; actorId?: string; ready?: boolean; role?: string }>({ isActive: null })

export function useKintaiAccess() {
  return useContext(KintaiAccessContext)
}
