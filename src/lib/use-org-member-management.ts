'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { getSelectedOrg, orgStorageKey } from '@/components/org/OrgSwitcher'
import { QuoteWorkspaceContext } from '@/lib/quote/workspace-context'
import { parseQuoteOrganizations } from '@/lib/quote/organization-response'
import { requestOrgJson, orgErrorMessage } from '@/lib/org-client-response'
import { MEMBER_ROLE_RANK, normalizeMemberInvitation, parseOrganizationMembers, parseMemberInvitationAcknowledgement, isMemberMutationAcknowledgement, type OrganizationMemberRow, type MemberService } from '@/lib/org-member-response'

type Pending = {kind:'invite'|'role'|'remove';id?:string;email?:string;role?:string;beforeIds:Set<string>}
const fresh=()=>({members:[] as OrganizationMemberRow[],myRole:'member',myUserId:null as string|null,email:'',role:'member',inviteUrl:'',inviteMemberId:null as string|null,notice:'',org:null as string|null})
export function useOrgMemberManagement(service:MemberService,basePath:string) {
  const {data:session,status}=useSession()
  const lastActor=useRef('')
  if(status==='authenticated')lastActor.current=session?.user?.id||''
  if(status==='unauthenticated')lastActor.current=''
  const actor=status==='loading'?lastActor.current:session?.user?.id||''
  const selection=getSelectedOrg(service)
  const holder=useRef<{service:MemberService;context:QuoteWorkspaceContext}|null>(null)
  if(!holder.current||holder.current.service!==service){holder.current?.context.invalidate();holder.current={service,context:new QuoteWorkspaceContext(()=>getSelectedOrg(service),service)}}
  const context=holder.current.context
  const epoch=context.update({actor,selection,status})
  const identity=JSON.stringify([actor,service,selection])
  const scope=JSON.stringify([identity,epoch])
  const lastIdentity=useRef(identity)
  const state=useRef(fresh())
  const pending=useRef<Pending|null>(null)
  if(lastIdentity.current!==identity){lastIdentity.current=identity;state.current=fresh();pending.current=null}
  const [,redraw]=useState(0)
  const [ready,setReady]=useState<string|null>(null)
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState<{scope:string;key:string}|null>(null)
  const [error,setError]=useState('')
  const changed=useCallback(()=>{context.invalidate();redraw(n=>n+1)},[context])
  useEffect(()=>{
    const storage=(e:StorageEvent)=>{if(e.key===null||e.key===orgStorageKey(service))changed()}
    window.addEventListener(`${service}:organization-changed`,changed);window.addEventListener('storage',storage);redraw(n=>n+1)
    return()=>{window.removeEventListener(`${service}:organization-changed`,changed);window.removeEventListener('storage',storage);context.invalidate()}
  },[context,service,changed])
  const load=useCallback(async()=>{
    if(basePath!==`/api/${service}`){setLoading(false);setError('メンバー管理の画面を確認してください');return}
    const ticket=context.begin('members-read',true,epoch)
    if(!ticket)return
    setLoading(true);setReady(null);setError('')
    try{
      const orgs=await requestOrgJson(service,`${basePath}/organizations`,selection,{signal:ticket.signal})
      if(!ticket.current())return
      if(!orgs.res.ok)throw new Error(orgErrorMessage(orgs.data,orgs.res.status,false))
      const org=parseQuoteOrganizations(orgs.data).current
      if(!org||selection!==null&&org.slug!==selection)throw new Error('組織の所属を確認できませんでした')
      // Default organizations can also change server-side without a storage event.
      if(state.current.org!==null&&state.current.org!==org.slug){state.current=fresh();pending.current=null;changed();return}
      if(!context.verifyOrganization(epoch,org.slug))return
      state.current.org=org.slug
      const {res,data}=await requestOrgJson(service,`${basePath}/members`,org.slug,{signal:ticket.signal})
      if(!ticket.current())return
      if(!res.ok)throw new Error(orgErrorMessage(data,res.status,false))
      const parsed=parseOrganizationMembers(data,actor,org.role)
      Object.assign(state.current,parsed)
      if(state.current.inviteMemberId&&!parsed.members.some(m=>m.id===state.current.inviteMemberId&&m.status==='PENDING')){
        state.current.inviteUrl='';state.current.inviteMemberId=null
        state.current.notice='招待状態が変わったため、以前の招待URLの表示を終了しました。現在のメンバー一覧をご確認ください。'
      }
      const waiting=pending.current
      if(waiting){
        const row=parsed.members.find(m=>m.id===waiting.id)
        const confirmed=waiting.kind==='remove'?!row:waiting.kind==='role'?row?.role===waiting.role
          :parsed.members.some(m=>!waiting.beforeIds.has(m.id)&&m.inviteEmail===waiting.email&&m.role===waiting.role&&['ACTIVE','PENDING'].includes(m.status))
        if(confirmed){
          pending.current=null
          state.current.notice=waiting.kind==='invite'?'招待済みのメンバーを確認しました。メール配信状況と招待URLはこの一覧からは確認できません。':'保存済みのメンバー情報を確認しました。'
          if(waiting.kind==='invite'&&state.current.email.trim().toLowerCase()===waiting.email&&state.current.role===waiting.role)state.current.email=''
        }
      }
      setReady(scope)
    }catch(e){if(ticket.current())setError(e instanceof Error?e.message:'メンバー一覧を取得できませんでした')}
    finally{if(ticket.current()){setLoading(false);redraw(n=>n+1)}ticket.end()}
  },[actor,basePath,changed,context,epoch,scope,selection,service])
  useEffect(()=>{void load()},[load])
  const loaded=ready===scope&&context.isCurrent(epoch)
  const currentBusy=busy?.scope===scope&&context.isCurrent(epoch)?busy.key:null
  const canManage=loaded&&MEMBER_ROLE_RANK[state.current.myRole]>=MEMBER_ROLE_RANK.admin
  const mutate=async(kind:Pending['kind'],id?:string,next?:string)=>{
    if(!loaded||!context.isCurrent(epoch)||MEMBER_ROLE_RANK[state.current.myRole]<MEMBER_ROLE_RANK.admin||pending.current||basePath!==`/api/${service}`)return
    let sent:{email:string;role:string}|undefined
    if(kind==='invite'){
      try{sent=normalizeMemberInvitation(state.current.email,state.current.role,state.current.myRole)}catch(e){setError(e instanceof Error?e.message:'招待内容を確認してください');return}
    }else{
      const row=state.current.members.find(m=>m.id===id)
      if(!row||row.userId===actor||row.role==='owner'||!MEMBER_ROLE_RANK[row.role]||MEMBER_ROLE_RANK[row.role]>=MEMBER_ROLE_RANK[state.current.myRole])return
      if(kind==='role'&&(!next||!['member','manager','admin'].includes(next)||MEMBER_ROLE_RANK[next]>MEMBER_ROLE_RANK[state.current.myRole]))return
    }
    const ticket=context.begin('member-mutation',false,epoch)
    if(!ticket)return
    const intent:Pending={kind,id,email:sent?.email,role:sent?.role||next,beforeIds:new Set(state.current.members.map(m=>m.id))}
    pending.current=intent;setBusy({scope,key:kind==='invite'?'invite':`${kind==='role'?'role':'member'}-${id}`});setError('');state.current.notice=''
    if(kind==='invite'){state.current.inviteUrl='';state.current.inviteMemberId=null}
    try{
      const method=kind==='invite'?'POST':kind==='role'?'PATCH':'DELETE'
      const {res,data}=await requestOrgJson(service,kind==='invite'?`${basePath}/members`:`${basePath}/members/${encodeURIComponent(id!)}`,ticket.organization,
        {method,headers:{'Content-Type':'application/json'},...(kind==='remove'?{}:{body:JSON.stringify(sent||{role:next})}),signal:ticket.signal})
      if(!ticket.current())return
      if(!res.ok){if(res.status<500)pending.current=null;if([401,403].includes(res.status))setReady(null);throw new Error(orgErrorMessage(data,res.status,true))}
      if(kind==='invite'&&sent){
        const ack=parseMemberInvitationAcknowledgement(data,sent,service,window.location.origin)
        state.current.inviteUrl=ack.url
        state.current.inviteMemberId=ack.member.id
        state.current.notice=ack.emailSent?'招待メールを送信しました。':'招待を作成しましたが、メールを送信できませんでした。下の招待URLを直接お渡しください。'
        if(state.current.email.trim().toLowerCase()===sent.email&&state.current.role===sent.role)state.current.email=''
        state.current.members=[...state.current.members.filter(m=>m.id!==ack.member.id),ack.member]
      }else{
        if(!id||!isMemberMutationAcknowledgement(data,id,kind==='role'?next:undefined))throw new Error('操作結果を確認できませんでした。再読み込みでメンバー情報を確認してください。')
        state.current.members=kind==='remove'?state.current.members.filter(m=>m.id!==id):state.current.members.map(m=>m.id===id?{...m,role:next!}:m)
        if(kind==='remove'&&state.current.inviteMemberId===id){state.current.inviteUrl='';state.current.inviteMemberId=null}
        state.current.notice=kind==='remove'?'メンバーを外しました。':'メンバーの権限を変更しました。'
      }
      pending.current=null
      await load() // Read failure must not turn a confirmed mutation into an unconfirmed one.
    }catch(e){if(ticket.current())setError(e instanceof Error?e.message:'操作結果を確認できませんでした')}
    finally{if(ticket.current()){setBusy(value=>value?.scope===scope?null:value);redraw(n=>n+1)}ticket.end()}
  }
  return {
    members:loaded?state.current.members:[],myRole:loaded?state.current.myRole:'member',myUserId:loaded?state.current.myUserId:null,
    email:state.current.email,role:state.current.role,inviteUrl:state.current.inviteUrl,notice:state.current.notice,
    loading:status==='loading'||status==='authenticated'&&loading,busy:currentBusy,
    error:status==='unauthenticated'?'ログインしてメンバー情報をご確認ください。':error,
    loaded,canManage,unknown:!!pending.current&&!currentBusy,
    setEmail:(v:string)=>{if(!canManage||!context.isCurrent(epoch))return;state.current.email=v;redraw(n=>n+1)},
    setRole:(v:string)=>{if(!canManage||!context.isCurrent(epoch))return;state.current.role=v;redraw(n=>n+1)},
    invite:()=>mutate('invite'),changeRole:(id:string,next:string)=>mutate('role',id,next),remove:(id:string)=>mutate('remove',id),load,
    session:loaded?session:null,
  }
}
