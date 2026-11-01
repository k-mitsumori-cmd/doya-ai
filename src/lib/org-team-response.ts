export type TeamService = 'aio' | 'shodan'
export interface TeamMember { id:string; name:string|null; role:string; status:string; inviteEmail:string|null; acceptedAt:string|null }
export const TEAM_ROLE_RANK: Record<string,number> = Object.freeze(Object.assign(Object.create(null),{owner:4,admin:3,manager:2,member:1}))
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
const validId=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,200}$/.test(value)
const text=(value:unknown,max:number)=>value===null||typeof value==='string'&&value.length<=max
export function readTeamMembers(value:unknown) {
  if(!record(value)||value.error!==undefined||value.code!==undefined||!Array.isArray(value.members)||!validId(value.myMemberId)||typeof value.myRole!=='string'||!TEAM_ROLE_RANK[value.myRole])throw new Error('所属と権限を確認できませんでした。再読み込みしてください。')
  const rows=value.members
  if(!rows.every(row=>record(row)&&validId(row.id)&&typeof row.role==='string'&&!!TEAM_ROLE_RANK[row.role]&&['ACTIVE','PENDING','INACTIVE'].includes(row.status as string)&&text(row.name,2000)&&text(row.inviteEmail,254)&&text(row.acceptedAt,64)))throw new Error('メンバー一覧を確認できませんでした。')
  const members=rows as unknown as TeamMember[]
  if(new Set(members.map(m=>m.id)).size!==members.length||members.filter(m=>m.id===value.myMemberId&&m.role===value.myRole&&m.status==='ACTIVE').length!==1)throw new Error('ご自身の有効な所属を確認できませんでした。')
  return {members,myRole:value.myRole,myMemberId:value.myMemberId}
}
export function normalizeTeamInvitation(email:unknown,role:unknown,myRole:string) {
  if(typeof email!=='string'||typeof role!=='string')throw new Error('招待内容を確認してください。')
  const normalized=email.trim().toLowerCase()
  if(normalized.length>254||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized))throw new Error('有効なメールアドレスを入力してください。')
  if(!['member','manager','admin'].includes(role)||!TEAM_ROLE_RANK[myRole]||TEAM_ROLE_RANK[role]>=TEAM_ROLE_RANK[myRole])throw new Error('自分と同格以上の権限では招待できません。')
  return {email:normalized,role}
}
export function readTeamInvitation(value:unknown,sent:{email:string;role:string},service:TeamService,origin:string) {
  if(!record(value)||value.ok!==true||value.error!==undefined||value.code!==undefined||typeof value.emailSent!=='boolean'||!record(value.member)||!validId(value.member.id)||value.member.inviteEmail!==sent.email||value.member.role!==sent.role)throw new Error('招待結果を確認できませんでした。再送信せず、一覧をご確認ください。')
  let inviteUrl=''
  if(!value.emailSent){
    if(typeof value.inviteUrl!=='string'||value.inviteUrl.length>2048)throw new Error('招待リンクを確認できませんでした。')
    let url:URL
    try{url=new URL(value.inviteUrl)}catch{throw new Error('招待リンクを確認できませんでした。')}
    if(![origin,'https://doya-ai.surisuta.jp'].includes(url.origin)||url.protocol!=='https:'&&url.origin!==origin||url.username||url.password||url.search||url.hash||!new RegExp(`^/${service}/invite/[a-zA-Z0-9_-]{20,128}$`).test(url.pathname))throw new Error('招待リンクを確認できませんでした。')
    inviteUrl=value.inviteUrl
  }
  return {id:value.member.id,emailSent:value.emailSent,inviteUrl}
}
export function teamDeleteConfirmed(value:unknown,id:string) {
  return record(value)&&value.error===undefined&&value.code===undefined&&value.ok===true&&value.memberId===id
}
