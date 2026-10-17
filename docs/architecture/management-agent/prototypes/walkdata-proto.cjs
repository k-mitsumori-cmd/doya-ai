// DMMF 駆動・既定拒否の walkData の核（プロトタイプ）。DB 接続なし。
const { Prisma } = require('@prisma/client')
const dm = Prisma.dmmf.datamodel
const models = new Map(dm.models.map(m => [m.name, m]))
// --- 許可リスト（Prisma 5.22 NestedInput の閉じた集合） ---
const NESTED = {
  'to-many': { create: 'data', connectOrCreate: 'where+create', upsert: 'where+create+update', createMany: 'data[]', set: 'where', disconnect: 'where', delete: 'where', connect: 'where', update: 'where+data', updateMany: 'where+data', deleteMany: 'where' },
  'to-one':  { create: 'data', connectOrCreate: 'where+create', upsert: 'where+create+update', connect: 'where', update: 'data|where+data', disconnect: 'bool|where', delete: 'bool|where' },
}
// --- 疑似テナント表（本番はマニフェストから。ここでは organizationId/companyId/workspaceId を持つモデルをテナントとみなす） ---
const TENANT = new Map()
for (const m of dm.models) { const f = m.fields.find(f => ['companyId','organizationId','workspaceId'].includes(f.name) && f.kind === 'scalar'); if (f) TENANT.set(m.name, f.name) }
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
    if (op === 'update') { if (tcol in out) throw new TenantViolation(`${path}: ${tcol} の書き換え禁止`) }
    if (op === 'create') { if (out[tcol] !== undefined && out[tcol] !== ctx.expected(model)) throw new TenantViolation(`${path}: ${tcol} が他社`); out[tcol] = ctx.expected(model) }
  }
  for (const f of m.fields) {
    if (f.kind !== 'object' || !(f.name in out)) continue
    const nested = out[f.name]; if (nested == null) continue
    const kind = f.isList ? 'to-many' : 'to-one'; const allowed = NESTED[kind]; const child = f.type
    const o2 = {}
    for (const key of Object.keys(nested)) {
      if (!(key in allowed)) throw new UnknownNestedKey(`${path}.${f.name}.${key} は許可リスト外（${kind}）`)
      const v = nested[key]; const items = Array.isArray(v) ? v : [v]
      const conv = items.map(item => {
        switch (key) {
          case 'create': case 'createMany': return key === 'createMany' ? { ...item, data: walkData(child, item.data, 'create', ctx, refs, path + '.' + f.name).data } : walkData(child, item, 'create', ctx, refs, path + '.' + f.name).data
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
// --- 1) 全モデル・全 relation をたどれるか: 各 relation に対し空のネスト {} を与えて再帰が到達するか ---
let visited = 0, rels = 0
for (const m of dm.models) for (const f of m.fields.filter(f => f.kind === 'object')) { rels++; const r = walkData(m.name, { [f.name]: { connect: { id: 'x' } } }, 'update', { expected: () => 'A' }); if (r.refs.length === 1 && r.refs[0].model === f.type) visited++ }
console.log(`models=${dm.models.length} relations=${rels} traversed=${visited} tenantModels=${TENANT.size}`)
// --- 2) 許可リスト外キーで throw ---
try { walkData('User', { hrMemberships: { foo: {} } }, 'update', { expected: () => 'A' }); console.log('case2 FAIL') } catch (e) { console.log('case2 unknown nested key ->', e.constructor.name, e.message) }
try { walkData('User', { notAField: 1 }, 'update', { expected: () => 'A' }); console.log('case2b FAIL') } catch (e) { console.log('case2b unknown top-level key ->', e.constructor.name, e.message) }
// --- 3) 非テナント親（User）からのネスト update.data でテナント列書き換え → throw ---
const Mem = dm.models.find(m => m.fields.some(f => f.name === 'organizationId') && m.fields.some(f => f.type === 'User' && f.kind === 'object'))
const userRel = dm.models.find(m => m.name === 'User').fields.find(f => f.kind === 'object' && f.type === Mem.name)
try { walkData('User', { [userRel.name]: { update: { where: { id: 'm1' }, data: { organizationId: 'B' } } } }, 'update', { expected: () => 'A' }); console.log('case3 FAIL') } catch (e) { console.log(`case3 ${Mem.name}.organizationId rewrite via User.${userRel.name} ->`, e.constructor.name, e.message) }
// --- 4) ネスト upsert の where が refs に入り、create にテナント列が強制される ---
const r4 = walkData('User', { [userRel.name]: { upsert: { where: { id: 'm9' }, create: { role: 'member' }, update: { role: 'owner' } } } }, 'update', { expected: () => 'A' })
console.log('case4 nested upsert refs=', JSON.stringify(r4.refs), 'create=', JSON.stringify(r4.data[userRel.name].upsert.create))
// --- 5) 純関数: 入力は不変 ---
const input = { [userRel.name]: { connect: { id: 'm2' } } }; const snap = JSON.stringify(input); walkData('User', input, 'update', { expected: () => 'A' }); console.log('case5 input unchanged =', JSON.stringify(input) === snap)
// --- 6) 許可リストが型定義と一致するか（index.d.ts から実測した鍵集合と比較） ---
console.log('allowlist to-many =', Object.keys(NESTED['to-many']).join(' ')); console.log('allowlist to-one  =', Object.keys(NESTED['to-one']).join(' '))
