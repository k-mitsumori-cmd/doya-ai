'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useOrgSettingsGuard } from '@/lib/use-org-settings-guard'
import { requestOrgJson, orgErrorMessage } from '@/lib/org-client-response'
import { TEAM_ROLE_RANK, readTeamMembers, normalizeTeamInvitation, readTeamInvitation, teamDeleteConfirmed, type TeamService, type TeamMember } from '@/lib/org-team-response'

type Pending={kind:'invite'|'remove';id?:string;email?:string;role?:string;beforeIds:Set<string>}
const fresh=()=>({email:'',role:'member',members:[] as TeamMember[],myRole:'member',myMemberId:'',ready:'',loading:'',busy:null as {key:string;label:string}|null,error:null as {key:string;message:string}|null,notice:'',inviteUrl:'',inviteMemberId:''})
export function useOrgTeamMembers(service:TeamService,orgSlug:string) {
  const guard=useOrgSettingsGuard(orgSlug?JSON.stringify([service,orgSlug]):'')
  const currentGuard=useRef(guard);currentGuard.current=guard
  const key=JSON.stringify([service,guard.key])
  const identity=JSON.stringify([service,guard.identity])
  const lastIdentity=useRef(identity),state=useRef(fresh()),pending=useRef<Pending|null>(null)
  if(lastIdentity.current!==identity){lastIdentity.current=identity;state.current=fresh();pending.current=null}
  const [,render]=useState(0),redraw=()=>render(n=>n+1)
  const current=()=>currentGuard.current.key===guard.key&&currentGuard.current.active()
  const load=useCallback(async()=>{
    const g=currentGuard.current
    if(JSON.stringify([service,g.key])!==key)return
    const ticket=g.begin('team-members-read');if(!ticket)return
    state.current.loading=key;state.current.ready='';state.current.error=null;redraw()
    try{
      const {res,data}=await requestOrgJson(service,`/api/${service}/members`,orgSlug,{signal:ticket.signal})
      if(!ticket.current())return
      if(!res.ok){if(res.status===401)g.rejectAuthentication();throw new Error(orgErrorMessage(data,res.status,false))}
      const parsed=readTeamMembers(data);Object.assign(state.current,parsed)
      if(state.current.inviteMemberId&&!parsed.members.some(m=>m.id===state.current.inviteMemberId&&m.status==='PENDING')){
        state.current.inviteUrl='';state.current.inviteMemberId='';state.current.notice='招待状態が変わったため、以前の招待リンクの表示を終了しました。'
      }
      const waiting=pending.current
      if(waiting&&(waiting.kind==='remove'?!parsed.members.some(m=>m.id===waiting.id):parsed.members.some(m=>!waiting.beforeIds.has(m.id)&&m.inviteEmail===waiting.email&&m.role===waiting.role&&['ACTIVE','PENDING'].includes(m.status)))){
        pending.current=null
        state.current.notice=waiting.kind==='invite'?'招待済みのメンバーを確認しました。メールの配信状況と招待リンクは一覧からは確認できません。':'削除済みのメンバー情報を確認しました。'
        if(waiting.kind==='invite'&&state.current.email.trim().toLowerCase()===waiting.email&&state.current.role===waiting.role)state.current.email=''
      }
      state.current.ready=key
    }catch(e){if(ticket.current())state.current.error={key,message:e instanceof Error?e.message:'メンバー一覧を確認できませんでした。'}}
    finally{if(ticket.current()){state.current.loading='';redraw()}ticket.end()}
  },[key,orgSlug,service])
  useEffect(()=>{void load()},[load])
  const loaded=state.current.ready===key&&current()
  const canManage=loaded&&TEAM_ROLE_RANK[state.current.myRole]>=TEAM_ROLE_RANK.admin
  const editable=(id:string)=>{
    const m=state.current.members.find(m=>m.id===id)
    return !!m&&m.id!==state.current.myMemberId&&m.role!=='owner'&&!!TEAM_ROLE_RANK[m.role]&&TEAM_ROLE_RANK[m.role]<TEAM_ROLE_RANK[state.current.myRole]
  }
  const mutate=async(kind:Pending['kind'],id?:string)=>{
    if(!current()||state.current.ready!==key||TEAM_ROLE_RANK[state.current.myRole]<TEAM_ROLE_RANK.admin||pending.current)return
    let sent:{email:string;role:string}|undefined
    if(kind==='invite'){
      try{sent=normalizeTeamInvitation(state.current.email,state.current.role,state.current.myRole)}catch(e){state.current.error={key,message:e instanceof Error?e.message:'招待内容を確認してください。'};redraw();return}
    }else if(!id||!editable(id))return
    const ticket=currentGuard.current.begin('team-members-mutation');if(!ticket)return
    if(kind==='remove'){
      const target=state.current.members.find(m=>m.id===id)!
      const confirmed=window.confirm(`${target.name||target.inviteEmail||'このメンバー'}を削除しますか？`)
      if(!confirmed||!ticket.current()){ticket.end();return}
    }
    pending.current={kind,id,email:sent?.email,role:sent?.role,beforeIds:new Set(state.current.members.map(m=>m.id))}
    state.current.busy={key,label:kind==='invite'?'invite':`remove-${id}`};state.current.error=null;state.current.notice=''
    if(kind==='invite'){state.current.inviteUrl='';state.current.inviteMemberId=''}
    redraw()
    try{
      const {res,data}=await requestOrgJson(service,kind==='invite'?`/api/${service}/members`:`/api/${service}/members/${encodeURIComponent(id!)}`,orgSlug,{method:kind==='invite'?'POST':'DELETE',...(sent?{headers:{'Content-Type':'application/json'},body:JSON.stringify(sent)}:{}),signal:ticket.signal})
      if(!ticket.current())return
      if(!res.ok){if(res.status<500)pending.current=null;if([401,403].includes(res.status))state.current.ready='';throw new Error(orgErrorMessage(data,res.status,true))}
      if(sent){
        const ack=readTeamInvitation(data,sent,service,window.location.origin)
        state.current.inviteUrl=ack.inviteUrl;state.current.inviteMemberId=ack.id
        state.current.notice=ack.emailSent?'招待メールを送信しました。':'招待を作成しましたが、メールを送信できませんでした。下の招待リンクをご確認ください。'
        if(state.current.email.trim().toLowerCase()===sent.email&&state.current.role===sent.role)state.current.email=''
      }else{
        if(!id||!teamDeleteConfirmed(data,id))throw new Error('削除結果を確認できませんでした。再送信せず、一覧をご確認ください。')
        state.current.members=state.current.members.filter(m=>m.id!==id)
        if(state.current.inviteMemberId===id){state.current.inviteUrl='';state.current.inviteMemberId=''}
        state.current.notice='メンバーを削除しました。'
      }
      pending.current=null
      await load()
    }catch(e){if(ticket.current())state.current.error={key,message:e instanceof Error?e.message:'操作結果を確認できませんでした。'}}
    finally{if(ticket.current()){state.current.busy=null;redraw()}ticket.end()}
  }
  const busy=state.current.busy?.key===key&&current()?state.current.busy.label:null
  return {members:loaded?state.current.members:null,myRole:loaded?state.current.myRole:'member',email:state.current.email,role:state.current.role,loaded,canManage,busy,unknown:!!pending.current&&!busy,
    loading:guard.requiresLogin?false:!guard.allowed||state.current.loading===key,requiresLogin:guard.requiresLogin,
    error:state.current.error?.key===key?state.current.error.message:null,notice:current()?state.current.notice:'',inviteUrl:current()?state.current.inviteUrl:'',
    setEmail:(email:string)=>{if(!current()||state.current.ready!==key||TEAM_ROLE_RANK[state.current.myRole]<TEAM_ROLE_RANK.admin)return;state.current.email=email;redraw()},
    setRole:(role:string)=>{if(!current()||state.current.ready!==key||TEAM_ROLE_RANK[state.current.myRole]<TEAM_ROLE_RANK.admin)return;state.current.role=role;redraw()},
    canRemove:(id:string)=>canManage&&editable(id),invite:()=>mutate('invite'),remove:(id:string)=>mutate('remove',id),load}
}
