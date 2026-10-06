export type MemberService = 'quote' | 'aishodan'
export interface OrganizationMemberRow { id:string; role:string; status:string; name:string|null; inviteEmail:string|null; userId:string|null }
export const MEMBER_ROLE_RANK: Record<string,number> = Object.freeze(Object.assign(Object.create(null), {owner:4,admin:3,manager:2,member:1}))
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
const safeId=(v:unknown)=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(v)
const nullableText=(v:unknown,max:number)=>v===null||typeof v==='string'&&v.length<=max
export function parseOrganizationMembers(value:unknown,actor:string,expectedRole:string) {
  if(!record(value)||value.error!==undefined||value.code!==undefined||!Array.isArray(value.members)||value.myUserId!==actor||value.myRole!==expectedRole||!MEMBER_ROLE_RANK[expectedRole])throw new Error('所属・権限を確認できませんでした。再読み込みしてください。')
  if(!value.members.every(v=>record(v)&&safeId(v.id)&&typeof v.role==='string'&&!!MEMBER_ROLE_RANK[v.role]&&['ACTIVE','PENDING'].includes(v.status as string)
    &&nullableText(v.name,2000)&&nullableText(v.inviteEmail,254)&&(v.userId===null||safeId(v.userId))))throw new Error('メンバー一覧を確認できませんでした')
  const members=value.members as unknown as OrganizationMemberRow[]
  if(new Set(members.map(m=>m.id)).size!==members.length||members.filter(m=>m.userId===actor&&m.status==='ACTIVE'&&m.role===expectedRole).length!==1)throw new Error('ご自身の所属を確認できませんでした')
  return {members,myRole:expectedRole,myUserId:actor}
}
export function normalizeMemberInvitation(email:unknown,role:unknown,myRole:string) {
  if(typeof email!=='string'||typeof role!=='string')throw new Error('招待内容を確認してください')
  const normalized=email.trim().toLowerCase()
  if(normalized.length>254||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized))throw new Error('メールアドレスの形式を確認してください')
  if(!['admin','manager','member'].includes(role)||!MEMBER_ROLE_RANK[myRole]||MEMBER_ROLE_RANK[role]>MEMBER_ROLE_RANK[myRole])throw new Error('指定できない権限です')
  return {email:normalized,role}
}
export function parseMemberInvitationAcknowledgement(value:unknown,sent:{email:string;role:string},service:MemberService,origin:string) {
  if(!record(value)||value.error!==undefined||value.code!==undefined||typeof value.emailSent!=='boolean'||typeof value.url!=='string'||value.url.length>2048||!record(value.member))throw new Error('招待結果を確認できませんでした')
  const member=value.member
  if(!safeId(member.id)||member.status!=='PENDING'||member.inviteEmail!==sent.email||member.role!==sent.role)throw new Error('招待結果との一致を確認できませんでした')
  let url:URL
  try{url=new URL(value.url)}catch{throw new Error('招待URLを確認できませんでした')}
  if(url.username||url.password||url.hash||url.search||!new RegExp(`^/${service}/invite/[a-zA-Z0-9_-]{20,128}$`).test(url.pathname)
    ||![origin,'https://doya-ai.surisuta.jp'].includes(url.origin)||url.protocol!=='https:'&&url.origin!==origin)throw new Error('招待URLを確認できませんでした')
  return {member:{id:member.id,role:member.role,status:'PENDING',inviteEmail:sent.email,name:null,userId:null} as OrganizationMemberRow,url:value.url,emailSent:value.emailSent}
}
export function isMemberMutationAcknowledgement(value:unknown,id:string,role?:string) {
  return record(value)&&value.error===undefined&&value.code===undefined&&value.ok===true&&value.memberId===id&&(role===undefined||value.role===role)
}
