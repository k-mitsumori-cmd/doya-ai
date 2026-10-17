// DMMF 駆動・既定拒否の walkData の核（プロトタイプ）。DB 接続なし。改訂 9: FIN6-01/02/06 を核に実装。
const { Prisma } = require('@prisma/client')
const dm = Prisma.dmmf.datamodel
const models = new Map(dm.models.map(m => [m.name, m]))
// --- 許可リスト（Prisma 5.22 NestedInput の閉じた集合） ---
const NESTED = {
  'to-many': { create: 'data', connectOrCreate: 'where+create', upsert: 'where+create+update', createMany: 'envelope', set: 'where', disconnect: 'where', delete: 'where', connect: 'where', update: 'where+data', updateMany: 'where+data', deleteMany: 'where' },
  'to-one':  { create: 'data', connectOrCreate: 'where+create', upsert: 'where+create+update', connect: 'where', update: 'data|where+data', disconnect: 'bool|where', delete: 'bool|where' },
}
const CREATE_MANY_ENVELOPE = new Set(['data', 'skipDuplicates'])   // FIN6-02: 既定拒否の明示的な例外
// --- 疑似テナント表（本番はマニフェストから）。organizationId/companyId/workspaceId を持つモデル＝テナント。
//     それ以外で scalar userId と User への relation を持つモデル＝ユーザー単位（kind 'user'）。NextAuth の Account/Session は非テナントのまま ---
const TENANT = new Map()
for (const m of dm.models) {
  const org = m.fields.find(f => ['companyId','organizationId','workspaceId'].includes(f.name) && f.kind === 'scalar')
  if (org) { TENANT.set(m.name, org.name); continue }
  if (['Account','Session','User','VerificationToken'].includes(m.name)) continue
  const u = m.fields.find(f => f.name === 'userId' && f.kind === 'scalar'); const rel = m.fields.find(f => f.kind === 'object' && f.type === 'User')
  if (u && rel) TENANT.set(m.name, 'userId')
}
// FIN6-01: テナント列を FK に持つ relation フィールド（例 organizationId ↔ organization、userId ↔ user）
const tenantRelations = model => { const m = models.get(model); const t = TENANT.get(model); if (!t) return []; return m.fields.filter(f => f.kind === 'object' && (f.relationFromFields || []).includes(t)) }
const pkOf = model => { const m = models.get(model); return m.primaryKey ? m.primaryKey.fields : m.fields.filter(f => f.isId).map(f => f.name) }
class TenantViolation extends Error {}
class UnknownNestedKey extends Error {}
function walkData(model, data, op, ctx, refs = [], path = model) {
  const m = models.get(model); if (!m) throw new Error('unknown model ' + model)
  if (Array.isArray(data)) return { data: data.map(d => walkData(model, d, op, ctx, refs, path).data), refs }
  if (!data || typeof data !== 'object') return { data, refs }
  const out = { ...data }
  const fieldNames = new Set(m.fields.map(f => f.name))
  for (const k of Object.keys(out)) if (!fieldNames.has(k)) throw new UnknownNestedKey(`${path}.${k} はモデルのフィールドではない（既定拒否）`)
  const tcol = TENANT.get(model)
  if (tcol) {
    const trels = tenantRelations(model)
    if (op === 'update') {
      if (tcol in out) throw new TenantViolation(`${path}: ${tcol} の書き換え禁止`)
      for (const r of trels) if (r.name in out) throw new TenantViolation(`${path}: relation ${r.name}（FK=${tcol}）経由の書き換え禁止`)   // FIN6-01 update: 種類を問わず throw
    }
    if (op === 'create') {
      if (out[tcol] !== undefined && out[tcol] !== ctx.expected(model)) throw new TenantViolation(`${path}: ${tcol} が他社`)
      let viaRelation = false
      for (const r of trels) if (r.name in out) {                                                                           // FIN6-01 create: connect:{<pk>: expected} 以外は throw
        const v = out[r.name]; const keys = Object.keys(v || {}); const pk = r.relationToFields && r.relationToFields.length ? r.relationToFields : pkOf(r.type)
        const ok = keys.length === 1 && keys[0] === 'connect' && v.connect && Object.keys(v.connect).length === pk.length && pk.every(k => v.connect[k] === ctx.expected(model))
        if (!ok) throw new TenantViolation(`${path}: relation ${r.name}（FK=${tcol}）は connect:{${pk.join(',')}: expected} 以外禁止`)
        viaRelation = true
      }
      if (!viaRelation) out[tcol] = ctx.expected(model)                                                                    // スカラと relation の併記は Prisma が拒否するので片方だけ
    }
  }
  for (const f of m.fields) {
    if (f.kind !== 'object' || !(f.name in out)) continue
    if (tcol && op === 'create' && tenantRelations(model).some(r => r.name === f.name)) continue                          // 上で検査済み（connect のみ。refs 不要）
    const nested = out[f.name]; if (nested == null) continue
    const kind = f.isList ? 'to-many' : 'to-one'; const allowed = NESTED[kind]; const child = f.type
    const o2 = {}
    for (const key of Object.keys(nested)) {
      if (!(key in allowed)) throw new UnknownNestedKey(`${path}.${f.name}.${key} は許可リスト外（${kind}）`)
      const v = nested[key]; const items = Array.isArray(v) ? v : [v]
      const conv = items.map(item => {
        switch (key) {
          case 'create': return walkData(child, item, 'create', ctx, refs, path + '.' + f.name).data
          case 'createMany': { for (const ek of Object.keys(item)) if (!CREATE_MANY_ENVELOPE.has(ek)) throw new UnknownNestedKey(`${path}.${f.name}.createMany.${ek} はエンベロープ外（FIN6-02）`); return { ...item, data: walkData(child, item.data, 'create', ctx, refs, path + '.' + f.name).data } }
          case 'connectOrCreate': refs.push({ model: child, where: item.where }); return { where: item.where, create: walkData(child, item.create, 'create', ctx, refs, path + '.' + f.name).data }
          case 'upsert': if (item.where) refs.push({ model: child, where: item.where }); return { ...item, create: walkData(child, item.create, 'create', ctx, refs, path + '.' + f.name).data, update: walkData(child, item.update, 'update', ctx, refs, path + '.' + f.name).data }
          case 'update': case 'updateMany': if (item.where) refs.push({ model: child, where: item.where }); return item.data !== undefined ? { ...item, data: walkData(child, item.data, 'update', ctx, refs, path + '.' + f.name).data } : walkData(child, item, 'update', ctx, refs, path + '.' + f.name).data
          case 'connect': case 'set': case 'disconnect': case 'delete': case 'deleteMany': if (typeof item === 'object' && item !== null) refs.push({ model: child, where: item }); return item
          default: throw new UnknownNestedKey(key)
        }
      })
      o2[key] = Array.isArray(v) ? conv : conv[0]
    }
    out[f.name] = o2
  }
  return { data: out, refs }
}
// FIN6-06: 入口ゲート（拡張側）。data（upsert は create/update）に relation キーが 1 つでもあればマーカー要求（再帰判定しない保守的な規則）
function touchesTenantRelation(model, args) {
  const m = models.get(model); const payloads = 'data' in args ? [].concat(args.data) : [args.create, args.update].filter(Boolean)
  return payloads.some(d => d && typeof d === 'object' && m.fields.some(f => f.kind === 'object' && f.name in d))
}
// refs の所属検証で使う select（FIN6-03）: DMMF の primaryKey.fields、無ければ @id 列
const selectFor = model => Object.fromEntries(pkOf(model).map(k => [k, true]))
const A = { expected: () => 'A' }
const ok = (label, fn) => { try { const r = fn(); console.log(`${label} -> PASS`, r === undefined ? '' : JSON.stringify(r)) } catch (e) { console.log(`${label} -> FAIL(${e.constructor.name}: ${e.message})`) } }
const deny = (label, fn) => { try { fn(); console.log(`${label} -> FAIL(通過してしまった)`) } catch (e) { console.log(`${label} -> ${e.constructor.name}: ${e.message}`) } }
// --- 1) 全モデル・全 relation をたどれるか ---
let visited = 0, rels = 0
for (const m of dm.models) for (const f of m.fields.filter(f => f.kind === 'object')) { rels++; try { const r = walkData(m.name, { [f.name]: { connect: { id: 'x' } } }, 'update', A); if (r.refs.length === 1 && r.refs[0].model === f.type) visited++ } catch (e) { if (e instanceof TenantViolation) { visited++ } else { throw e } } }   // テナント relation は update で拒否される＝到達している
console.log(`models=${dm.models.length} relations=${rels} traversed=${visited} tenantModels=${TENANT.size}`)
// --- 2) 許可リスト外キー / 未知フィールド ---
deny('case2 unknown nested key (User.hrMemberships.foo)', () => walkData('User', { hrMemberships: { foo: {} } }, 'update', A))
deny('case2b unknown top-level key (User.notAField)', () => walkData('User', { notAField: 1 }, 'update', A))
// --- 3) 非テナント親からのネスト update.data でテナント列書き換え ---
deny('case3 User.hrMemberships.update.data.organizationId=B', () => walkData('User', { hrMemberships: { update: { where: { id: 'm1' }, data: { organizationId: 'B' } } } }, 'update', A))
// --- 4) ネスト upsert ---
ok('case4 nested upsert refs/create', () => { const r = walkData('User', { hrMemberships: { upsert: { where: { id: 'm9' }, create: { role: 'member' }, update: { role: 'owner' } } } }, 'update', A); return { refs: r.refs, create: r.data.hrMemberships.upsert.create } })
// --- 5) 純関数 ---
ok('case5 input unchanged', () => { const input = { hrMemberships: { connect: { id: 'm2' } } }; const snap = JSON.stringify(input); walkData('User', input, 'update', A); return JSON.stringify(input) === snap })
// --- 6) FIN6-01: relation 形式の FK 書き換え（update 契約）: 各キーで TenantViolation ---
for (const key of ['connect', 'disconnect', 'set', 'update', 'upsert', 'create', 'connectOrCreate']) {
  const v = key === 'disconnect' ? true : key === 'update' ? { name: 'x' } : key === 'upsert' ? { create: { name: 'x', slug: 's' }, update: {} } : key === 'create' ? { name: 'x', slug: 's' } : key === 'connectOrCreate' ? { where: { id: 'B' }, create: { name: 'x', slug: 's' } } : { id: 'B' }
  deny(`case6 HrOrganizationMember.update data.organization.${key}`, () => walkData('HrOrganizationMember', { organization: { [key]: v } }, 'update', A))
}
deny('case6u userId-kind: SeoArticle.update data.user.connect OTHER', () => walkData('SeoArticle', { user: { connect: { id: 'OTHER' } } }, 'update', A))
// --- 7) FIN6-01: create 契約: 他社への connect は throw、expected への connect は通る（スカラは付けない） ---
deny('case7a HrOrganizationMember.create organization.connect B', () => walkData('HrOrganizationMember', { role: 'member', organization: { connect: { id: 'B' } } }, 'create', A))
ok('case7b HrOrganizationMember.create organization.connect A (expected)', () => { const r = walkData('HrOrganizationMember', { role: 'member', organization: { connect: { id: 'A' } } }, 'create', A); return { hasScalar: 'organizationId' in r.data, organization: r.data.organization } })
deny('case7c HrOrganizationMember.create organization.create (connect 以外)', () => walkData('HrOrganizationMember', { organization: { create: { name: 'x', slug: 's' } } }, 'create', A))
ok('case7d HrOrganizationMember.create without relation -> scalar forced', () => walkData('HrOrganizationMember', { role: 'member' }, 'create', A).data.organizationId)
// --- 8) FIN6-02: createMany エンベロープ ---
deny('case8a createMany envelope unknown key foo', () => walkData('HrOrganization', { members: { createMany: { data: [{ userId: 'u', role: 'MEMBER' }], foo: 1 } } }, 'update', A))
ok('case8b createMany skipDuplicates kept', () => walkData('HrOrganization', { members: { createMany: { data: [{ userId: 'u', role: 'MEMBER' }], skipDuplicates: true } } }, 'update', A).data.members.createMany.skipDuplicates)
// --- 9) FIN6-06: 非テナント親 → 非テナント子 → テナント孫の 2 段ネスト ---
const deep = { accounts: { update: { where: { id: 'acc1' }, data: { user: { update: { hrMemberships: { update: { where: { id: 'm1' }, data: { organizationId: 'B' } } } } } } } } }
console.log('case9a entry gate touchesTenantRelation(User, {data: deep}) =', touchesTenantRelation('User', { data: deep }))
deny('case9b walkData deep chain User.accounts.user.hrMemberships.organizationId=B', () => walkData('User', deep, 'update', A))
console.log('case9c entry gate for scalar-only user.update =', touchesTenantRelation('User', { data: { name: 'x' } }), '(relation 無しは拡張が素通し。非テナントモデルの scalar 更新)')
// --- 10) 審査担当のプローブ（回帰として保持） ---
ok('probe-json Json 列の中身は走査しない', () => walkData('HrOrganization', { customFields: { connect: { id: 'B' }, organizationId: 'B' } }, 'update', A).data.customFields)
ok('probe-toone disconnect:true / delete:true', () => walkData('User', { mitsuboshiNagusameSubscription: { disconnect: true } }, 'update', A).refs.length)
ok('probe-set set: []', () => walkData('User', { hrMemberships: { set: [] } }, 'update', A).refs.length)
deny('probe-upsert-update upsert.update.organizationId=B', () => walkData('User', { hrMemberships: { upsert: { where: { id: 'm9' }, create: { role: 'member' }, update: { organizationId: 'B' } } } }, 'update', A))
// --- 11) FIN6-03: refs の select は主キー（複合主キー対応） ---
const composite = dm.models.find(m => m.primaryKey && m.primaryKey.fields.length > 1)
console.log('case11 selectFor composite pk', composite ? composite.name : '(none)', '=', JSON.stringify(composite ? selectFor(composite.name) : null), '; selectFor(HrOrganizationMember) =', JSON.stringify(selectFor('HrOrganizationMember')))
// --- 12) 許可リスト ---
console.log('allowlist to-many =', Object.keys(NESTED['to-many']).join(' ')); console.log('allowlist to-one  =', Object.keys(NESTED['to-one']).join(' '), '; createMany envelope =', [...CREATE_MANY_ENVELOPE].join(' '))
