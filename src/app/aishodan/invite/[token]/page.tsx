'use client'

import { useParams } from 'next/navigation'
import { OrganizationInvitePage } from '@/components/OrganizationInvitePage'

export default function AishodanInvitePage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '')
  return <OrganizationInvitePage key={token} service="aishodan" token={token} />
}
