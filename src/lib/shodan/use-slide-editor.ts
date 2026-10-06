'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useOrgSettingsGuard } from '@/lib/use-org-settings-guard'
import { ShodanApiError, shodanGet, shodanSend } from './client'
import { readSlideEditor, readRegeneratedSlide, slideStructure, slideSlotKey } from './slide-editor-response'
import { exportSlidesPdf } from './export-slides-pdf'
import type { Preparation } from './preparation-response'

type Notice = { message: string; href?: string; label?: string }
type Pending = { index: number; slot: string; structure: string; beforeKey: string | null; beforeVersion: string; instruction: string; ackKey?: string; reviewVersion?: string }
const fresh = () => ({ prep: null as Preparation | null, ready: '', loading: '', active: 0, drafts: new Map<string,string>(), busy: null as { key: string; kind: 'regen' | 'pdf'; index?: number } | null, error: '', missing: false, notice: null as Notice | null })
export function useSlideEditor(orgSlug: string, id: string) {
  const guard = useOrgSettingsGuard(orgSlug && id ? JSON.stringify([orgSlug,id]) : '')
  const latest = useRef(guard); latest.current = guard
  const identity = useRef(guard.identity), state = useRef(fresh()), pending = useRef<Pending | null>(null)
  if (identity.current !== guard.identity) { identity.current = guard.identity; state.current = fresh(); pending.current = null }
  const [, render] = useState(0), redraw = () => render(n=>n+1), key=guard.key
  const current = () => latest.current.key === key && latest.current.active()
  const path = `/api/shodan/preparations/${encodeURIComponent(id)}`
  const busyCurrent = () => state.current.busy?.key === key
  const load = useCallback(async () => {
    if (latest.current.key !== key || state.current.busy?.key === key) return
    const ticket = latest.current.begin('slide-editor-read'); if (!ticket) return
    state.current.loading = key; state.current.error = ''; state.current.missing = false; redraw()
    try {
      const data = await shodanGet<unknown>(path,orgSlug,{signal:ticket.signal}); if (!ticket.current()) return
      const saved = readSlideEditor(data,id), old=state.current.prep, operation=pending.current
      if (!old || slideStructure(old)!==slideStructure(saved)) state.current.active=0
      state.current.prep=saved; state.current.ready=key
      if (operation) {
        const imageKey=saved.slideImages?.[operation.index]?.imageKey || null
        if (operation.structure!==slideStructure(saved)) {
          pending.current=null; state.current.notice={message:'資料の構成が変わっています。以前の指示の結果は確認できません。現在の構成をご確認ください。'}
        } else if (operation.ackKey && imageKey===operation.ackKey) {
          if (state.current.drafts.get(operation.slot)===operation.instruction) state.current.drafts.delete(operation.slot)
          pending.current=null; state.current.notice={message:'再生成したスライドの保存を確認しました。'}
        } else if (!operation.ackKey && imageKey && imageKey!==operation.beforeKey) {
          pending.current=null; state.current.notice={message:'対象スライドの保存内容が更新されています。送信した指示の適用結果かは確認できないため、内容をご確認ください。'}
        } else operation.reviewVersion=saved.updatedAt
      }
    } catch(error) {
      if (!ticket.current()) return
      state.current.ready=''; state.current.missing=error instanceof ShodanApiError && error.status===404
      if (error instanceof ShodanApiError && error.status===401) latest.current.rejectAuthentication()
      state.current.error=error instanceof Error?error.message:'保存内容を読み込めませんでした。'
    } finally { if (ticket.current()) { state.current.loading=''; redraw() } ticket.end() }
  },[key,path,orgSlug,id])
  useEffect(()=>{void load()},[load])
  const loaded=state.current.ready===key&&current(), prep=loaded?state.current.prep:null
  const sameSnapshot=()=>current()&&!!prep&&state.current.ready===key&&state.current.prep===prep&&state.current.loading!==key
  const busy=busyCurrent()?state.current.busy:null
  const regenerate=async(index:number)=>{
    if (!sameSnapshot() || busyCurrent() || pending.current || !prep?.slidesJson || !Number.isSafeInteger(index) || index<0 || index>=prep.slidesJson.length) return
    const slot=slideSlotKey(prep,index),instruction=(state.current.drafts.get(slot)||'').trim()
    if (instruction.length>500) { state.current.error='修正指示は500文字以内で入力してください。'; redraw(); return }
    const ticket=latest.current.begin('slide-editor-action'); if (!ticket) return
    const operation:Pending={index,slot,structure:slideStructure(prep),beforeKey:prep.slideImages?.[index]?.imageKey||null,beforeVersion:prep.updatedAt,instruction}
    pending.current=operation; state.current.busy={key,kind:'regen',index}; state.current.error=''; state.current.notice=null; redraw()
    let acknowledged=false
    try {
      const data=await shodanSend<unknown>(path+'/slides/regenerate',orgSlug,'POST',{index,instruction,expectedUpdatedAt:prep.updatedAt},{signal:ticket.signal}); if (!ticket.current()) return
      acknowledged=true; operation.ackKey=readRegeneratedSlide(data,prep,index)
      const raw=await shodanGet<unknown>(path,orgSlug,{signal:ticket.signal}); if (!ticket.current()) return
      const saved=readSlideEditor(raw,id)
      if (slideStructure(saved)!==operation.structure || saved.slideImages?.[index]?.imageKey!==operation.ackKey) throw new Error('再生成後の保存内容を確認できませんでした。重ねて送信せず、保存内容をご確認ください。')
      state.current.prep=saved; state.current.ready=key
      if ((state.current.drafts.get(slot)||'').trim()===instruction) state.current.drafts.delete(slot)
      pending.current=null; state.current.notice={message:'再生成したスライドの保存を確認しました。'}
    } catch(error) {
      if (!ticket.current()) return
      if (!acknowledged && error instanceof ShodanApiError && error.status>=400 && error.status<500 && error.code!=='GENERATION_PENDING') pending.current=null
      if (error instanceof ShodanApiError && [401,403,409].includes(error.status)) state.current.ready=''
      if (error instanceof ShodanApiError && error.status===401) latest.current.rejectAuthentication()
      state.current.error=error instanceof Error?error.message:'操作結果を確認できませんでした。'
      if (error instanceof ShodanApiError && (error.code==='PLAN'||error.code==='LIMIT')) state.current.notice={message:error.message,href:error.actionUrl,label:error.actionLabel}
    } finally { if(ticket.current()){state.current.busy=null;redraw()}ticket.end() }
  }
  const retryAfterReview=()=>{
    const operation=pending.current
    if (!sameSnapshot() || busyCurrent() || !operation || !prep || operation.reviewVersion!==prep.updatedAt || operation.structure!==slideStructure(prep)) return
    const ticket=latest.current.begin('slide-editor-action');if(!ticket)return
    const confirmed=window.confirm('前回の生成結果を確定できませんでした。確認した保存版と現在の指示をもとに再生成しますか？')
    if(!confirmed||!ticket.current()){ticket.end();return}
    const index=operation.index;pending.current=null;ticket.end();void regenerate(index)
  }
  const downloadPdf=async()=>{
    if(!sameSnapshot()||busyCurrent()||pending.current||!prep)return
    const ticket=latest.current.begin('slide-editor-action');if(!ticket)return
    state.current.busy={key,kind:'pdf'};state.current.error='';state.current.notice=null;redraw()
    try {
      await exportSlidesPdf(prep,ticket.signal,()=>ticket.current()&&state.current.prep===prep)
      if(ticket.current())state.current.notice={message:'PDFのダウンロードを開始しました。ブラウザのダウンロードをご確認ください。'}
    }catch(error){if(ticket.current())state.current.error=error instanceof Error?error.message:'PDF処理の結果を確認できませんでした。'}
    finally{if(ticket.current()){state.current.busy=null;redraw()}ticket.end()}
  }
  const active=Math.min(state.current.active,Math.max(0,(prep?.slidesJson?.length||0)-1))
  return {prep,active,load,regenerate,downloadPdf,retryAfterReview,busy,unknown:!!pending.current&&!busy,
    canAct:sameSnapshot()&&!busy&&!pending.current,canRetryReviewed:sameSnapshot()&&!busy&&!!pending.current&&pending.current.reviewVersion===prep?.updatedAt,
    loading:!guard.allowed||state.current.loading===key,requiresLogin:guard.requiresLogin,missing:current()&&state.current.missing,
    error:current()?state.current.error:'',notice:current()?state.current.notice:null,
    instruction:(index:number)=>prep?state.current.drafts.get(slideSlotKey(prep,index))||'':'',
    setInstruction:(index:number,value:string)=>{if(!sameSnapshot()||!prep?.slidesJson?.[index])return;state.current.drafts.set(slideSlotKey(prep,index),value);redraw()},
    setActive:(index:number)=>{if(!sameSnapshot()||!prep?.slidesJson?.[index])return;state.current.active=index;redraw()}}
}
