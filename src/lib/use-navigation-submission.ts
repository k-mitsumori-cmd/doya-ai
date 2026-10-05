'use client'

import { useEffect, useRef, useState } from 'react'
import { signIn, signOut } from 'next-auth/react'
import { invitationSignInOptions, safeSignInCallbackUrl } from '@/lib/safe-signin-callback'
import toast from 'react-hot-toast'

export class NavigationSubmissionError extends Error {}

export async function startGoogleSignIn(callbackUrl: string) {
  try {
    const destination = safeSignInCallbackUrl(callbackUrl)
    await signIn('google', { callbackUrl: destination }, invitationSignInOptions(destination))
  } catch {
    throw new NavigationSubmissionError('ログインを開始できませんでした。もう一度お試しください。')
  }
}

// Sign out before selecting another account, to avoid linking it to the current user.
export async function switchGoogleAccount(callbackUrl: string) {
  try {
    const destination = safeSignInCallbackUrl(callbackUrl)
    await signOut({ callbackUrl: `/auth/signin?callbackUrl=${encodeURIComponent(destination)}` })
  } catch {
    throw new NavigationSubmissionError('アカウントの切り替えを開始できませんでした。もう一度お試しください。')
  }
}

// Successful submissions navigate away; keep their lock until navigation or history restoration.
export function useNavigationSubmission(fallbackError: string) {
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const generation = useRef(0)

  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      generation.current += 1
      inFlight.current = false
      setBusy(false)
    }
    window.addEventListener('pageshow', restore)
    return () => {
      window.removeEventListener('pageshow', restore)
      generation.current += 1
    }
  }, [])

  const run = async (action: (isCurrent: () => boolean) => Promise<void>) => {
    if (inFlight.current) return
    inFlight.current = true
    const attempt = ++generation.current
    const isCurrent = () => generation.current === attempt
    setBusy(true)
    try {
      await action(isCurrent)
    } catch (error) {
      if (!isCurrent()) return
      inFlight.current = false
      setBusy(false)
      toast.error(error instanceof NavigationSubmissionError ? error.message : fallbackError, { id: 'navigation-submission-error' })
    }
  }

  return { busy, run }
}
