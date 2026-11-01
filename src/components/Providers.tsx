'use client'

import { Suspense } from 'react'
import ServiceLimitProvider from '@/components/limits/ServiceLimitProvider'
import { SessionProvider } from 'next-auth/react'

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider><Suspense fallback={null}><ServiceLimitProvider /></Suspense>{children}</SessionProvider>
}


