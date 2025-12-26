'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'

const STORAGE_KEY = 'doya:logout-toast'

function safeReadFlag(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function safeClearFlag() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function markLogoutToastPending() {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // ignore
  }
}

export default function LogoutToastListener() {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    const hasQuery = params.get('loggedOut') === '1'
    const hasFlag = safeReadFlag()
    if (!hasQuery && !hasFlag) return

    firedRef.current = true
    safeClearFlag()

    toast.success('ログアウトしました')

    // クエリを消してリロード/戻るでの再表示を防ぐ
    if (hasQuery) {
      const next = new URLSearchParams(params.toString())
      next.delete('loggedOut')
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }
  }, [params, pathname, router])

  return null
}


