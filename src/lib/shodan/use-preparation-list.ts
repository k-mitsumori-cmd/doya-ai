'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useOrgSettingsGuard } from '@/lib/use-org-settings-guard'
import { ShodanApiError, shodanGet, shodanSend } from './client'
import { appendPreparationPage, mergePreparationUpdates } from './preparation-pages'
import { readPreparationList, readPreparationWatch, type PreparationListItem } from './preparation-list-response'

type PendingDelete = { id: string; acknowledged: boolean; reviewed: boolean; reviewedRow?: PreparationListItem }
const fresh = () => ({ items: null as PreparationListItem[] | null, ready: '', busy: null as {key:string;current:()=>boolean} | null, nextCursor: null as string | null, total: 0, hasProfile: null as boolean | null, profileError: false, error: '', moreError: '', refreshError: false, notice: '' })
export function usePreparationList(orgSlug: string) {
  const guard = useOrgSettingsGuard(orgSlug), latest = useRef(guard); latest.current = guard
  const identity = useRef(guard.identity), state = useRef(fresh()), pending = useRef<PendingDelete | null>(null)
  if (identity.current !== guard.identity) { identity.current = guard.identity; state.current = fresh(); pending.current = null }
  const [,render] = useState(0), redraw = () => render(n=>n+1), key = guard.key
  const current = useCallback(() => latest.current.key === key && latest.current.active(),[key])
  const fail = (error: unknown) => {
    if (error instanceof ShodanApiError && [401,403].includes(error.status)) { state.current.ready = ''; state.current.error = error.message }
    if (error instanceof ShodanApiError && error.status === 401) latest.current.rejectAuthentication()
    return error instanceof Error ? error.message : '保存内容を確認できませんでした。'
  }
  const load = useCallback(async () => {
    if (latest.current.key !== key || state.current.busy?.key === key && state.current.busy.current()) return
    const ticket = latest.current.begin('preparation-list'); if (!ticket) return
    state.current.busy = {key,current:ticket.current}; state.current.error = ''; state.current.moreError = ''; state.current.refreshError = false; state.current.ready = ''; redraw()
    try {
      const operation = pending.current
      const data = await shodanGet<unknown>('/api/shodan/preparations',orgSlug,{signal:ticket.signal}); if (!ticket.current()) return
      const page = readPreparationList(data), rows = appendPreparationPage([],page,page.total)
      if (operation && !operation.acknowledged) {
        const raw = await shodanGet<unknown>(`/api/shodan/preparations?watch=${encodeURIComponent(operation.id)}`,orgSlug,{signal:ticket.signal}); if (!ticket.current()) return
        const found = readPreparationWatch(raw,[operation.id])
        if (!found.length) { if (rows.some(row=>row.id === operation.id)) throw new Error('一覧が更新されています。保存状態と一覧を再度ご確認ください。'); pending.current = null; state.current.notice = '対象の商談準備は現在一覧にありません。削除要求の結果とは断定できませんが、現在の一覧をご確認ください。' }
        else { operation.reviewed = true; operation.reviewedRow = found[0]; state.current.notice = '削除結果を確定できませんでした。対象は現在も保存されています。削除する場合は内容を確認して、改めて操作してください。' }
      } else if (operation) { pending.current = null; state.current.notice = '削除を確認し、一覧を更新しました。' }
      state.current.items = rows; state.current.nextCursor = page.nextCursor; state.current.total = page.total; state.current.ready = key
      try {
        const profile = await shodanGet<{profile?: unknown}>('/api/shodan/company-profile',orgSlug,{signal:ticket.signal}); if (!ticket.current()) return
        if (!profile || !Object.prototype.hasOwnProperty.call(profile,'profile') || !(profile.profile === null || typeof profile.profile === 'object' && !Array.isArray(profile.profile))) throw new Error('Invalid profile response')
        state.current.hasProfile = !!profile.profile; state.current.profileError = false
      } catch(error) { if (!ticket.current()) return; fail(error); state.current.hasProfile = null; state.current.profileError = true }
    } catch(error) { if (ticket.current()) { state.current.ready = ''; state.current.error = fail(error) } }
    finally { if (ticket.current()) { state.current.busy = null; redraw() } ticket.end() }
  },[key,orgSlug])
  useEffect(()=>{void load()},[load])
  const items = current() && state.current.ready === key ? state.current.items : null
  const sameSnapshot = () => current() && !!items && state.current.items === items && state.current.ready === key && !(state.current.busy?.key === key && state.current.busy.current())
  const loadMore = async () => {
    if (!sameSnapshot() || pending.current || !state.current.nextCursor) return
    const ticket = latest.current.begin('preparation-list'); if (!ticket) return
    const cursor = state.current.nextCursor, total = state.current.total
    state.current.busy = {key,current:ticket.current}; state.current.moreError = ''; redraw()
    try {
      const raw = await shodanGet<unknown>(`/api/shodan/preparations?cursor=${encodeURIComponent(cursor)}`,orgSlug,{signal:ticket.signal}); if (!ticket.current()) return
      const page = readPreparationList(raw), merged = appendPreparationPage(state.current.items || [],page,total)
      state.current.items = merged; state.current.nextCursor = page.nextCursor
    } catch(error) { if (ticket.current()) state.current.moreError = fail(error) }
    finally { if (ticket.current()) { state.current.busy = null; redraw() } ticket.end() }
  }
  const remove = async (id: string) => {
    if (!sameSnapshot() || pending.current && !(pending.current.id === id && pending.current.reviewed && !pending.current.acknowledged)) return
    const row = pending.current?.id === id && pending.current.reviewed ? pending.current.reviewedRow : items!.find(row=>row.id === id); if (!row) return
    const ticket = latest.current.begin('preparation-list'); if (!ticket) return
    if (!window.confirm(`「${row.targetName || row.targetUrl}」を削除しますか？`) || !ticket.current()) { ticket.end(); return }
    const operation: PendingDelete = {id,acknowledged:false,reviewed:false}; pending.current = operation
    state.current.busy = {key,current:ticket.current}; state.current.error = ''; state.current.notice = ''; redraw()
    try {
      await shodanSend(`/api/shodan/preparations/${encodeURIComponent(id)}`,orgSlug,'DELETE',{expectedUpdatedAt:row.updatedAt},{signal:ticket.signal}); if (!ticket.current()) return
      operation.acknowledged = true; state.current.notice = '削除を確認しました。一覧を更新しています。'
      const raw = await shodanGet<unknown>('/api/shodan/preparations',orgSlug,{signal:ticket.signal}); if (!ticket.current()) return
      const page = readPreparationList(raw), rows = appendPreparationPage([],page,page.total)
      state.current.items = rows; state.current.nextCursor = page.nextCursor; state.current.total = page.total; pending.current = null; state.current.notice = '削除を確認し、一覧を更新しました。'
    } catch(error) {
      if (!ticket.current()) return
      if (!operation.acknowledged && error instanceof ShodanApiError && error.status >= 400 && error.status < 500) pending.current = null
      state.current.error = fail(error)
      if (error instanceof ShodanApiError && [404,409].includes(error.status)) state.current.ready = ''
    } finally { if (ticket.current()) { state.current.busy = null; redraw() } ticket.end() }
  }
  useEffect(()=>{
    const ids = items?.filter(row=>row.status === 'processing').map(row=>row.id) || []
    if (!ids.length) return
    const timer = setInterval(()=>{
      if (!current() || state.current.busy?.key === key && state.current.busy.current() || pending.current || state.current.ready !== key) return
      const ticket = latest.current.begin('preparation-list'); if (!ticket) return
      state.current.busy = {key,current:ticket.current}; redraw()
      const chunks: string[][] = []; for (let i=0;i<ids.length;i+=100) chunks.push(ids.slice(i,i+100))
      void Promise.all(chunks.map(async requested=>readPreparationWatch(await shodanGet<unknown>(`/api/shodan/preparations?watch=${requested.join(',')}`,orgSlug,{signal:ticket.signal}),requested)))
        .then(pages=>{if(ticket.current()){if(pages.flat().length !== ids.length) throw new Error('一覧が更新されています。最新の一覧をご確認ください。');state.current.items=mergePreparationUpdates(state.current.items || [],pages.flat());state.current.refreshError=false;redraw()}})
        .catch(error=>{if(ticket.current()){fail(error);state.current.refreshError=true;redraw()}})
        .finally(()=>{if(ticket.current()){state.current.busy=null;redraw()}ticket.end()})
    },5000)
    return ()=>clearInterval(timer)
  },[current,key,items,orgSlug])
  return {items,load,loadMore,remove,retryPending:()=>{if(pending.current?.reviewed)void remove(pending.current.id)},canRetryPending:sameSnapshot()&&!!pending.current?.reviewed&&!pending.current.acknowledged,total:items?state.current.total:0,nextCursor:items?state.current.nextCursor:null,
    hasProfile:items?state.current.hasProfile:null,profileError:!!items&&state.current.profileError,
    busy:current()&&state.current.busy?.key===key&&state.current.busy.current(),requiresLogin:guard.requiresLogin,error:current()?state.current.error:'',moreError:current()?state.current.moreError:'',refreshError:current()&&state.current.refreshError,
    notice:current()?state.current.notice:'',unknown:current()&&!!pending.current&&!pending.current.acknowledged,confirmed:current()&&!!pending.current?.acknowledged,
    canDelete:(id:string)=>sameSnapshot()&&(!pending.current||pending.current.id===id&&pending.current.reviewed&&!pending.current.acknowledged),canLoadMore:sameSnapshot()&&!pending.current}
}
