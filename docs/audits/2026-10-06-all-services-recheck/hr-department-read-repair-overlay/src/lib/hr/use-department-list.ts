'use client'
import { useEffect, useRef, useState } from 'react'
import { loadHrDepartmentList } from '@/lib/hr/department-list-client'
import type { DepartmentHierarchyRow } from '@/lib/hr/department-hierarchy'

type View = { key: string; status: 'loading' | 'ready' | 'error'; rows: DepartmentHierarchyRow[]; organizationId?: string; error: string }

/** A list belongs to one authentication/organization scope; retries never recreate a department or employee. */
export function useHrDepartmentList(status: string, actor: string, organizationId?: string) {
  const allowed = status === 'authenticated' && Boolean(actor)
  const scope = JSON.stringify([status, actor, organizationId ?? null])
  const epoch = useRef({ scope, version: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, version: epoch.current.version + 1 }
  const key = JSON.stringify([scope, epoch.current.version]), latest = useRef(key)
  latest.current = key
  const [attempt, setAttempt] = useState(0)
  const [view, setView] = useState<View>({ key: '', status: 'loading', rows: [], error: '' })
  useEffect(() => {
    if (!allowed) return
    const controller = new AbortController()
    let active = true
    const current = () => active && !controller.signal.aborted && latest.current === key
    setView(old => ({ key, status: 'loading', rows: old.key === key ? old.rows : [],
      organizationId: old.key === key ? old.organizationId : undefined, error: '' }))
    void loadHrDepartmentList(controller.signal, organizationId).then(result => {
      if (current()) setView({ key, status: 'ready', rows: result.rows, organizationId: result.organizationId, error: '' })
    }).catch((error: unknown) => {
      if (current()) setView(old => ({ key, status: 'error', rows: old.key === key ? old.rows : [],
        organizationId: old.key === key ? old.organizationId : undefined,
        error: error instanceof Error ? error.message : '部署一覧を取得できませんでした。再取得してください。' }))
    })
    return () => { active = false; controller.abort() }
  }, [key, allowed, organizationId, attempt])
  const visible = allowed && view.key === key
  return { status: visible ? view.status : 'loading' as const, rows: visible ? view.rows : [],
    organizationId: visible ? view.organizationId : undefined, error: visible ? view.error : '',
    retry: () => { if (allowed && latest.current === key) setAttempt(value => value + 1) } }
}
