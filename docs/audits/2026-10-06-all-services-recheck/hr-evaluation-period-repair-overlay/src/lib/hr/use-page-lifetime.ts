'use client'
import { useHrOrganizationRequest } from '@/components/hr/HrOrganizationScope'
import { useCallback, useLayoutEffect, useRef } from 'react'
import rawToast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { readDepartmentSettingsResponse } from '@/lib/hr/department-settings-client'

/** Scope every response, notification and navigation to the mounted authenticated page. */
export function useHrPageLifetime(readResponse = readDepartmentSettingsResponse) {
  const organizationScope = useHrOrganizationRequest()
  const lifetime = useRef<AbortController | null>(null), router = useRouter()
  useLayoutEffect(() => {
    const controller = new AbortController(); lifetime.current = controller
    return () => controller.abort()
  }, [])
  const live = () => Boolean(organizationScope.isCurrent() && lifetime.current && !lifetime.current.signal.aborted)
  const canceled = () => Error('操作が中断されました。')
  const fetch = useCallback(async (url: string, init: RequestInit = {}) => {
    const captured = lifetime.current
    if (!captured || captured.signal.aborted) throw canceled()
    const controller = new AbortController(), abort = () => controller.abort()
    const signals = [captured.signal, init.signal].filter((signal): signal is AbortSignal => Boolean(signal))
    for (const signal of signals) { signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort() }
    const current = () => organizationScope.isCurrent() && lifetime.current === captured && !captured.signal.aborted && !controller.signal.aborted
    try {
      const response = await readResponse(url, init, controller.signal, organizationScope.request)
      if (!current()) throw canceled()
      return { status: response.status, ok: response.status >= 200 && response.status < 300,
        json: async (): Promise<any> => { if (!current()) throw canceled(); return response.data } }
    } finally { for (const signal of signals) signal.removeEventListener('abort', abort) }
  }, [readResponse, organizationScope])
  const toast = {
    success: (...args: Parameters<typeof rawToast.success>) => { if (live()) return rawToast.success(...args) },
    error: (...args: Parameters<typeof rawToast.error>) => { if (live() && args[0] !== '操作が中断されました。') return rawToast.error(...args) },
  }
  return { fetch, toast, live, router: { push: (url: string) => { if (live()) router.push(url) }, back: () => { if (live()) router.back() } } }
}
