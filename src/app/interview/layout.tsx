import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { InterviewAppLayout } from '@/components/InterviewAppLayout'

export default async function InterviewLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  const isLoggedIn = !!session?.user
  const firstLoginAt = (session?.user as any)?.firstLoginAt as string | null | undefined

  // プラン判定
  const interviewPlan = String((session?.user as any)?.interviewPlan || '').toUpperCase()
  const globalPlan = String((session?.user as any)?.plan || '').toUpperCase()
  const p = interviewPlan || globalPlan || (isLoggedIn ? 'FREE' : 'GUEST')
  const currentPlan =
    p === 'ENTERPRISE'
      ? 'ENTERPRISE'
      : p === 'PRO'
        ? 'PRO'
        : p === 'FREE'
          ? 'FREE'
          : p === 'GUEST'
            ? 'GUEST'
            : 'UNKNOWN'

  return (
    <InterviewAppLayout currentPlan={currentPlan} isLoggedIn={isLoggedIn} firstLoginAt={firstLoginAt}>
      {children}
    </InterviewAppLayout>
  )
}

