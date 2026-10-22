'use client'

import { useSession } from 'next-auth/react'
import { useParams } from 'next/navigation'
import { OrganizationInvitePage } from '@/components/OrganizationInvitePage'

export default function AishodanInvitePage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '')
  const { data: session, status } = useSession()
  const actorId = status === 'authenticated' ? session?.user?.id : null
  if (status === 'loading' || (status === 'authenticated' && !actorId)) {
    return <p role="status" className="p-6 text-center text-sm">ログイン状態を確認しています…</p>
  }
  // A new actor must not adopt the previous account's lookup, acceptance or redirect.
  const invitationScope = JSON.stringify([token, status, actorId])
  return <OrganizationInvitePage key={invitationScope} service="aishodan" token={token} />
}
