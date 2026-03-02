'use client'

import { useState, useEffect } from 'react'
import { isWithinFreeHour, getFreeHourRemainingMs } from '@/lib/pricing'

export function useFreeHour(firstLoginAt: string | null | undefined) {
  const isFreeHourActive = !!firstLoginAt && isWithinFreeHour(firstLoginAt)
  const [freeHourRemainingMs, setFreeHourRemainingMs] = useState(() =>
    firstLoginAt ? getFreeHourRemainingMs(firstLoginAt) : 0,
  )

  useEffect(() => {
    if (!isFreeHourActive || !firstLoginAt) return
    const interval = setInterval(() => {
      setFreeHourRemainingMs(getFreeHourRemainingMs(firstLoginAt))
    }, 1000)
    return () => clearInterval(interval)
  }, [isFreeHourActive, firstLoginAt])

  return { isFreeHourActive, freeHourRemainingMs }
}

export function formatRemainingTime(ms: number): string {
  if (ms <= 0) return '00:00'
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
