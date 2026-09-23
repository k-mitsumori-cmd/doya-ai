'use client'

import ServiceLimitProvider from '@/components/limits/ServiceLimitProvider'
import { SessionProvider } from 'next-auth/react'

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider><ServiceLimitProvider />{children}</SessionProvider>
}


