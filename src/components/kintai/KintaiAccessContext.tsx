'use client'

import { createContext, useContext } from 'react'

export const KintaiAccessContext = createContext<{ isActive: boolean | null }>({ isActive: null })

export function useKintaiAccess() {
  return useContext(KintaiAccessContext)
}
