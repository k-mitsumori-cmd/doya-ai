'use client'

import { Suspense } from 'react'
import ServiceLimitProvider from '@/components/limits/ServiceLimitProvider'
import { SessionProvider } from 'next-auth/react'
import { TrialEligibilityProvider } from '@/components/TrialEligibilityProvider'
import { CheckoutRecoveryProvider } from '@/components/CheckoutRecoveryProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider><CheckoutRecoveryProvider><TrialEligibilityProvider><Suspense fallback={null}><ServiceLimitProvider /></Suspense>{children}</TrialEligibilityProvider></CheckoutRecoveryProvider></SessionProvider>
}


