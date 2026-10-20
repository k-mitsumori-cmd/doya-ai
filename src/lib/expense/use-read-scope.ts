'use client'

import { useCallback, useLayoutEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'

/** Scope changes invalidate private results during render, including A -> B -> A. */
export function useExpenseReadScope(orgSlug: string, resource: string | null) {
  const { data: session, status } = useSession()
  const actor = status === 'authenticated' && typeof session?.user?.id === 'string' ? session.user.id : ''
  const value = JSON.stringify([actor, status, orgSlug, resource])
  const identity = useRef({ value, version: 0 })
  if (identity.current.value !== value) identity.current = { value, version: identity.current.version + 1 }
  const key = JSON.stringify([value, identity.current.version])
  const life = useRef({ key, active: false })
  useLayoutEffect(() => {
    life.current = { key, active: true }
    return () => { life.current.active = false }
  }, [key])
  const current = useCallback(() => life.current.active && life.current.key === key && JSON.stringify([identity.current.value, identity.current.version]) === key, [key])
  return { key, current, actor, status, enabled: status === 'authenticated' && !!actor && !!orgSlug && !!resource }
}
