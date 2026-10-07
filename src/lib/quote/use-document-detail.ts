'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { getSelectedOrg, orgStorageKey } from '@/components/org/OrgSwitcher'
import { QuoteWorkspaceContext } from '@/lib/quote/workspace-context'
import { parseQuoteOrganizations } from '@/lib/quote/organization-response'
import { requestOrgJson, orgErrorMessage } from '@/lib/org-client-response'
import { parseQuoteDetailDocument, quoteDraftFromDocument, quoteDocumentDraftMatches, quoteDocumentWrite, isQuoteDocumentWriteAcknowledgement, type QuoteDetailDocument, type QuoteDetailDraft, type QuoteDetailLine } from '@/lib/quote/document-response'

const emptyDraft = (): QuoteDetailDraft => ({ items:[], clientCompany:'', clientPerson:'', discountType:'', discountValue:'', notes:'', paymentTerms:'', deliveryTerms:'' })
export function useQuoteDocumentDetail(id: string | undefined) {
  const { data:session, status } = useSession()
  const lastActor = useRef('')
  if (status==='authenticated') lastActor.current=session?.user?.id||''
  if (status==='unauthenticated') lastActor.current=''
  const actor=status==='loading'?lastActor.current:session?.user?.id||''
  const selection=getSelectedOrg('quote')
  const contextRef=useRef<QuoteWorkspaceContext|null>(null)
  if (!contextRef.current) contextRef.current=new QuoteWorkspaceContext(()=>getSelectedOrg('quote'))
  const context=contextRef.current
  const lastRoute=useRef(id)
  if (lastRoute.current!==id) { context.invalidate(); lastRoute.current=id }
  const epoch=context.update({actor,selection,status})
  const identity=JSON.stringify([actor,selection,id])
  const lastIdentity=useRef(identity)
  const state=useRef<{doc:QuoteDetailDocument|null;issuer:{companyName:string}|null;draft:QuoteDetailDraft;revision:number;dirty:boolean;org:string|null}>(
    {doc:null,issuer:null,draft:emptyDraft(),revision:0,dirty:false,org:null})
  const pending=useRef<{body:ReturnType<typeof quoteDocumentWrite>;revision:number;preserveDraft:boolean}|null>(null)
  if (lastIdentity.current!==identity) {
    lastIdentity.current=identity
    state.current={doc:null,issuer:null,draft:emptyDraft(),revision:0,dirty:false,org:null}
    pending.current=null
  }
  const [,redraw]=useState(0)
  const [ready,setReady]=useState<{epoch:number;slug:string;role:string}|null>(null)
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  const changed=useCallback(()=>{context.invalidate();redraw(n=>n+1)},[context])
  useEffect(()=>{
    const storage=(e:StorageEvent)=>{if(e.key===null||e.key===orgStorageKey('quote'))changed()}
    window.addEventListener('quote:organization-changed',changed);window.addEventListener('storage',storage)
    redraw(n=>n+1)
    return()=>{window.removeEventListener('quote:organization-changed',changed);window.removeEventListener('storage',storage);context.invalidate()}
  },[context,changed])
  const load=useCallback(async()=>{
    if (!id||!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {setLoading(false);setError('見積書のURLを確認してください');return}
    const ticket=context.begin('document-read',true,epoch)
    if(!ticket)return
    setLoading(true);setReady(null);setSaving(false);setError('');setMessage('')
    try {
      const orgs=await requestOrgJson('quote','/api/quote/organizations',selection,{signal:ticket.signal})
      if(!ticket.current())return
      if(!orgs.res.ok)throw new Error(orgErrorMessage(orgs.data,orgs.res.status,false))
      const org=parseQuoteOrganizations(orgs.data).current
      if(!org||!context.verifyOrganization(epoch,org.slug))throw new Error('組織の所属を確認できませんでした')
      if(state.current.org!==null&&state.current.org!==org.slug){state.current={doc:null,issuer:null,draft:emptyDraft(),revision:0,dirty:false,org:null};pending.current=null}
      state.current.org=org.slug
      const {res,data}=await requestOrgJson('quote',`/api/quote/documents/${id}`,org.slug,{signal:ticket.signal})
      if(!ticket.current())return
      if(!res.ok)throw new Error(orgErrorMessage(data,res.status,false))
      if(data.error!==undefined||data.code!==undefined)throw new Error('見積書の内容を確認できませんでした')
      const doc=parseQuoteDetailDocument(data.document,id)
      if(data.issuer!==null&&(!data.issuer||typeof data.issuer!=='object'||Array.isArray(data.issuer)||typeof (data.issuer as {companyName?:unknown}).companyName!=='string'))throw new Error('発行者情報を確認できませんでした')
      state.current.doc=doc;state.current.issuer=data.issuer as {companyName:string}|null
      const recovered=pending.current&&isQuoteDocumentWriteAcknowledgement(doc,pending.current.body)
      if(recovered){
        if(state.current.revision===pending.current?.revision&&!pending.current.preserveDraft)state.current.dirty=false
        pending.current=null;setMessage('保存済みの見積書を確認しました')
      }
      if(!state.current.dirty)state.current.draft=quoteDraftFromDocument(doc)
      state.current.dirty=!quoteDocumentDraftMatches(doc,state.current.draft)
      setReady({epoch,slug:org.slug,role:org.role})
    }catch(e){if(ticket.current())setError(e instanceof Error?e.message:'見積書を取得できませんでした')}
    finally{if(ticket.current())setLoading(false);ticket.end()}
  },[context,epoch,id,selection])
  useEffect(()=>{void load()},[load])
  const loaded=!!id&&ready?.epoch===epoch&&context.isCurrent(epoch)&&state.current.doc?.id===id
  const edit=<K extends keyof QuoteDetailDraft>(field:K,value:QuoteDetailDraft[K])=>{
    if(!loaded||!context.isCurrent(epoch)||state.current.doc?.status!=='draft')return
    state.current.draft={...state.current.draft,[field]:value};state.current.revision++;state.current.dirty=!quoteDocumentDraftMatches(state.current.doc,state.current.draft);redraw(n=>n+1)
  }
  const save=async(extra:Record<string,unknown>={})=>{
    const doc=state.current.doc
    if(!loaded||!context.isCurrent(epoch)||!id||doc?.id!==id||pending.current)return
    if(extra.status!==undefined&&(!ready||!['owner','admin','manager'].includes(ready.role)))return
    const ticket=context.begin('document-save',false,epoch)
    if(!ticket)return
    let body:ReturnType<typeof quoteDocumentWrite>
    try{body=quoteDocumentWrite(doc,state.current.draft,typeof extra.status==='string'?extra.status:undefined)}
    catch(e){ticket.end();setError(e instanceof Error?e.message:'入力内容をご確認ください');return}
    const revision=state.current.revision
    const preserveDraft= !('items' in body && body.items) && state.current.dirty
    pending.current={body,revision,preserveDraft};setSaving(true);setError('');setMessage('')
    try{
      const {res,data}=await requestOrgJson('quote',`/api/quote/documents/${id}`,ticket.organization,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:ticket.signal})
      if(!ticket.current())return
      if(!res.ok){if(res.status<500)pending.current=null;throw new Error(orgErrorMessage(data,res.status,true))}
      if(data.error!==undefined||data.code!==undefined)throw new Error('保存結果を確認できませんでした。再読み込みして状態をご確認ください。')
      const saved=parseQuoteDetailDocument(data.document,id)
      if(!isQuoteDocumentWriteAcknowledgement(saved,body))throw new Error('保存内容との一致を確認できませんでした。再読み込みして状態をご確認ください。')
      pending.current=null;state.current.doc=saved
      if(state.current.revision===revision&&!preserveDraft)state.current.draft=quoteDraftFromDocument(saved)
      state.current.dirty=!quoteDocumentDraftMatches(saved,state.current.draft)
      setMessage(state.current.dirty?'送信時点の内容を保存しました。新しい変更は未保存です。':'保存しました')
    }catch(e){if(ticket.current())setError(e instanceof Error?e.message:'保存結果を確認できませんでした')}
    finally{if(ticket.current()){setSaving(false);redraw(n=>n+1)}ticket.end()}
  }
  const currentDoc=loaded?state.current.doc:null
  const unknown=!!pending.current&&!saving
  const pdfUrl=loaded&&ready&&currentDoc&&!saving&&!pending.current&&!state.current.dirty&&!error
    ? `/api/quote/documents/${encodeURIComponent(currentDoc.id)}/pdf?org=${encodeURIComponent(ready.slug)}&expectedRevision=${encodeURIComponent(currentDoc.revision)}`:null
  return {
    doc:currentDoc,issuer:loaded?state.current.issuer:null,...state.current.draft,
    loading:status==='loading'||status==='authenticated'&&loading&&!loaded,saving,unknown,
    error:status==='unauthenticated'?'ログインして見積書をご確認ください。':error,message,
    canApprove:loaded&&!!ready&&['owner','admin','manager'].includes(ready.role),pdfUrl,
    hasUnsavedChanges:state.current.dirty,load,save,
    setClientCompany:(v:string)=>edit('clientCompany',v),setClientPerson:(v:string)=>edit('clientPerson',v),
    setDiscountType:(v:string)=>edit('discountType',v),setDiscountValue:(v:string)=>edit('discountValue',v),
    setNotes:(v:string)=>edit('notes',v),setPaymentTerms:(v:string)=>edit('paymentTerms',v),setDeliveryTerms:(v:string)=>edit('deliveryTerms',v),
    updateItem:(target:QuoteDetailLine,patch:Partial<QuoteDetailLine>)=>{
      if(!state.current.draft.items.some(i=>i===target))return
      edit('items',state.current.draft.items.map(i=>i===target?{...i,...patch}:i))
    },
  }
}
