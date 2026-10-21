'use client'

import { Suspense } from 'react'
import ServiceLimitProvider from '@/components/limits/ServiceLimitProvider'
import { SessionProvider } from 'next-auth/react'
import { TrialEligibilityProvider } from '@/components/TrialEligibilityProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider><TrialEligibilityProvider><Suspense fallback={null}><ServiceLimitProvider /></Suspense>{children}</TrialEligibilityProvider></SessionProvider>
}


