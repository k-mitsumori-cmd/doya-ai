const assert = require('node:assert/strict'), fs = require('node:fs'), crypto = require('node:crypto')
const { PrismaClient, Prisma } = require('@prisma/client'), { load } = require('../../../scripts/security-regression/load-typescript.cjs')
const base = 'docs/audits/2026-10-06-all-services-recheck/'
const quote = s => '"' + s.replaceAll('"', '""') + '"'
;(async () => {
  const socket = process.env.DOYA_SFA_AUTHORITY_PG_SOCKET, port = Number(process.env.DOYA_SFA_AUTHORITY_PG_PORT)
  assert.match(socket || '', /^\/tmp\/doya-sfa-authority-[a-f0-9]{8}\/socket$/); assert(port > 1024 && port < 65536)
  const db = new PrismaClient({ datasources: { db: { url: `postgresql://doya_sfa@localhost:${port}/postgres?host=${encodeURIComponent(socket)}&schema=doyaslide_operation_fixture&connection_limit=12` } } })
  const cases = [], deadline = setTimeout(() => { console.error('DoyaSlide probe did not finish'); process.exit(1) }, 30000)
  try {
    const server = await db.$queryRawUnsafe('SELECT inet_server_addr() AS address,current_user AS role'); assert.equal(server[0].address, null); assert.equal(server[0].role, 'doya_sfa')
    await db.$executeRawUnsafe('CREATE SCHEMA doyaslide_operation_fixture'); await db.$executeRawUnsafe('CREATE TABLE "User" (id TEXT PRIMARY KEY,plan TEXT NOT NULL)')
    for (const name of ['SystemSetting', 'UserServiceSubscription', 'DoyaSlideProject', 'DoyaSlideSlide', 'DoyaSlideVersion', 'DoyaSlideChatMessage']) {
      const model = Prisma.dmmf.datamodel.models.find(m => m.name === name), table = quote(model.dbName || name)
      const columns = model.fields.filter(f => f.kind !== 'object').map(f => {
        let type = ({ String: 'TEXT', Int: 'INTEGER', BigInt: 'BIGINT', Float: 'DOUBLE PRECISION', Decimal: 'NUMERIC', Boolean: 'BOOLEAN', DateTime: 'TIMESTAMP(3)', Json: 'JSONB', Bytes: 'BYTEA' })[f.type] || 'TEXT'
        if (f.isList) type += '[]'
        let def = ''
        if (f.type === 'DateTime' && (f.isUpdatedAt || f.default?.name === 'now')) def = ' DEFAULT CURRENT_TIMESTAMP'
        else if (f.hasDefaultValue && ['string','number','boolean'].includes(typeof f.default)) def = ' DEFAULT ' + (typeof f.default === 'string' ? "'" + f.default.replaceAll("'", "''") + "'" : String(f.default))
        return quote(f.dbName || f.name) + ' ' + type + (f.isRequired ? ' NOT NULL' : '') + def + (f.isId ? ' PRIMARY KEY' : '') + (f.isUnique ? ' UNIQUE' : '')
      })
      for (const fields of model.uniqueFields) columns.push('UNIQUE (' + fields.map(quote).join(',') + ')')
      await db.$executeRawUnsafe('CREATE TABLE ' + table + ' (' + columns.join(',') + ')')
    }
    await db.$executeRawUnsafe('ALTER TABLE doyaslide_slides ADD FOREIGN KEY ("projectId") REFERENCES doyaslide_projects(id) ON DELETE CASCADE')
    for (const table of ['doyaslide_versions','doyaslide_chat_messages']) await db.$executeRawUnsafe(`ALTER TABLE ${table} ADD FOREIGN KEY ("slideId") REFERENCES doyaslide_slides(id) ON DELETE CASCADE`)
    const plan = load('src/lib/plan-utils.ts'), limits = load('src/lib/doyaslide/limits.ts', { '@/lib/prisma': { prisma: db }, '@/lib/plan-utils': plan, '@/lib/pricing': {} })
    const helper = load('src/lib/doyaslide/generation-operation.ts', { 'node:crypto': crypto, '@/lib/prisma': { prisma: db }, '@/lib/plan-utils': plan, './limits': limits }, { URL })
    const input = { actor: 'actor', projectId: 'project', operationId: '10000000-0000-4000-8000-000000000001', kind: 'batch', onlyPending: true }
    const output = { imageUrl: 'https://local.test/image.png', rawImageUrl: 'https://local.test/raw.png', model: 'synthetic' }
    const reset = async (count = 4) => {
      await db.$executeRawUnsafe('TRUNCATE doyaslide_projects,doyaslide_slides,doyaslide_versions,doyaslide_chat_messages,"SystemSetting","UserServiceSubscription" CASCADE')
      await db.$executeRawUnsafe(`INSERT INTO "User"(id,plan) VALUES ('actor','FREE'),('other','FREE') ON CONFLICT(id) DO UPDATE SET plan='FREE'`)
      await db.doyaSlideProject.create({ data: { id: 'project', userId: 'actor', title: 'Synthetic', status: 'structured', slides: { create: Array.from({ length: count }, (_, index) => ({ id: 'slide-' + index, index, visualPrompt: 'Synthetic prompt' })) } } })
    }
    const used = async () => (await db.userServiceSubscription.findUnique({ where: { userId_serviceId: { userId: 'actor', serviceId: 'doyaslide' } } }))?.monthlyUsage || 0
    const age = async (operation = input) => { const key = 'doyaslide-operation:v1:' + crypto.createHash('sha256').update(JSON.stringify([operation.actor,operation.projectId,operation.kind,operation.operationId])).digest('hex'); const row = await db.systemSetting.findUnique({ where: { key } }); const r = JSON.parse(row.value); r.startedAt = new Date(Date.now() - helper.DOYASLIDE_OPERATION_LEASE_MS - 1000).toISOString(); await db.systemSetting.update({ where: { key }, data: { value: JSON.stringify(r) } }) }
    await reset(); {
      const outcomes = await Promise.all(Array.from({ length: 9 }, () => helper.beginDoyaSlideOperation(input, db)))
      assert.equal(outcomes.filter(o => o.state === 'started').length, 1); assert.equal(outcomes.filter(o => o.state === 'pending').length, 8); assert.equal(await used(), 4)
      await assert.rejects(helper.beginDoyaSlideOperation({ ...input, onlyPending: false }, db), e => e.code === 'INPUT_CHANGED')
      assert.equal((await helper.beginDoyaSlideOperation({ ...input, operationId: crypto.randomUUID() }, db)).state, 'busy'); assert.equal(await used(), 4)
      cases.push('same UUID9parallel admissions reserve4once; changed input rejected; other operation waits for same project')
    }
    await reset(20); {
      const admission = await helper.beginDoyaSlideOperation(input, db); assert.equal(admission.slides.length, 4); assert.equal(admission.receipt.deferred, 16); assert.equal(await used(), 4)
      await age(); const states = await Promise.all(Array.from({ length: 6 }, () => helper.recoverDoyaSlideOperation(input, false, db))); assert(states.every(o => o.state === 'failed')); assert.equal(await used(), 0)
      await assert.rejects(helper.settleDoyaSlideOperationSlot(input, 'slide-0', output, db), e => e.code === 'OPERATION_EXPIRED'); assert.equal(await db.doyaSlideVersion.count(), 0)
      assert.equal((await helper.beginDoyaSlideOperation({ ...input, operationId: crypto.randomUUID() }, db)).state, 'started'); assert.equal(await used(), 4)
      cases.push('crash before first image expires once, refunds exact4, fences old save, and explicit new wave can start')
    }
    await reset(); {
      await helper.beginDoyaSlideOperation(input, db)
      const saved = await Promise.all(Array.from({ length: 6 }, () => helper.settleDoyaSlideOperationSlot(input, 'slide-0', output, db))); assert(saved.every(o => o.version === 1)); assert.equal(await db.doyaSlideVersion.count(), 1)
      await age(); const expired = await helper.recoverDoyaSlideOperation(input, false, db); assert.equal(expired.state, 'completed'); assert.equal(expired.receipt.slots.filter(s => s.phase === 'done').length, 1); assert.equal(await used(), 1)
      assert.equal((await helper.settleDoyaSlideOperationSlot(input, 'slide-0', output, db)).imageUrl, output.imageUrl); await assert.rejects(helper.settleDoyaSlideOperationSlot(input, 'slide-1', output, db)); assert.equal(await used(), 1)
      cases.push('partial output and version settle atomically once; expiry refunds3only; old successful result remains replayable')
    }
    await reset(1); {
      await helper.beginDoyaSlideOperation(input, db); await age()
      await assert.rejects(helper.settleDoyaSlideOperationSlot(input, 'slide-0', output, db), e => e.code === 'OPERATION_EXPIRED'); assert.equal((await helper.recoverDoyaSlideOperation(input, false, db)).state, 'failed'); assert.equal(await used(), 0)
      cases.push('late completion commits terminal failure/refund before rejection outside transaction')
    }
    await reset(1); {
      await helper.beginDoyaSlideOperation(input, db); await helper.settleDoyaSlideOperationSlot(input, 'slide-0', output, db); await age(); assert.equal((await helper.recoverDoyaSlideOperation(input, false, db)).state, 'completed'); assert.equal(await used(), 1)
      assert.equal((await helper.beginDoyaSlideOperation(input, db)).state, 'completed'); assert.equal(await db.doyaSlideVersion.count(), 1)
      cases.push('lost successful commit acknowledgment recovers without another version/admission/refund')
    }
    await reset(); {
      await helper.beginDoyaSlideOperation(input, db); await age(); await db.userServiceSubscription.updateMany({ where: { userId: 'actor' }, data: { lastUsageReset: new Date(Date.now() + 35 * 86400000), monthlyUsage: 7 } }); await helper.recoverDoyaSlideOperation(input, false, db); assert.equal(await used(), 7)
      cases.push('expired prior-month reservation cannot subtract next-month legitimate usage')
    }
    await reset(); {
      await db.$executeRawUnsafe(`ALTER TABLE "SystemSetting" ADD CONSTRAINT reject_receipt CHECK(key NOT LIKE 'doyaslide-operation:v1:%')`)
      await assert.rejects(helper.beginDoyaSlideOperation(input, db)); assert.equal(await used(), 0); assert.equal((await db.doyaSlideProject.findUnique({ where: { id: 'project' } })).status, 'structured'); await db.$executeRawUnsafe('ALTER TABLE "SystemSetting" DROP CONSTRAINT reject_receipt')
      cases.push('receipt write failure rolls back quota and project/slide working markers')
    }
    await reset(1); {
      await helper.beginDoyaSlideOperation(input, db); await db.$executeRawUnsafe(`ALTER TABLE "SystemSetting" ADD CONSTRAINT reject_done CHECK(value NOT LIKE '%"done"%')`)
      await assert.rejects(helper.settleDoyaSlideOperationSlot(input, 'slide-0', output, db)); assert.equal(await db.doyaSlideVersion.count(), 0); assert.equal((await db.doyaSlideSlide.findUnique({ where: { id: 'slide-0' } })).imageUrl, null); assert.equal(await used(), 1); await db.$executeRawUnsafe('ALTER TABLE "SystemSetting" DROP CONSTRAINT reject_done'); await helper.settleDoyaSlideOperationSlot(input, 'slide-0', output, db); assert.equal(await used(), 1)
      cases.push('result receipt failure rolls back output/version and retry saves same in-memory result without provider repeat')
    }
    for (const kind of ['regenerate', 'chat']) {
      await reset(1); await db.doyaSlideSlide.update({ where: { id: 'slide-0' }, data: { imageUrl: 'https://local.test/old.png', rawImageUrl: 'https://local.test/old-raw.png', status: 'done', version: 2 } })
      const operation = { ...input, kind, slideId: 'slide-0', ...(kind === 'chat' ? { message: 'Synthetic change' } : {}) }; await helper.beginDoyaSlideOperation(operation, db); await helper.settleDoyaSlideOperationSlot(operation, 'slide-0', output, db); await helper.settleDoyaSlideOperationSlot(operation, 'slide-0', output, db)
      assert.equal((await db.doyaSlideSlide.findUnique({ where: { id: 'slide-0' } })).version, 3); assert.equal(await db.doyaSlideVersion.count(), 1); assert.equal(await db.doyaSlideChatMessage.count(), kind === 'chat' ? 2 : 0); assert.equal(await used(), 1)
      const identity = { ...operation }; delete identity.message; assert.equal((await helper.recoverDoyaSlideOperation(identity, false, db)).state, 'completed')
      cases.push(`${kind} output/version/chat history settle once; recovery requires metadata only`)
    }
    await reset(1); {
      await helper.beginDoyaSlideOperation(input, db); await age(); await db.doyaSlideProject.delete({ where: { id: 'project' } }); assert.equal((await helper.recoverDoyaSlideOperation(input, false, db)).state, 'unavailable'); assert.equal(await used(), 0)
      cases.push('deleted project reservation expires/refunds without exposing a private result or recreating project')
    }
    await reset(1); {
      await helper.beginDoyaSlideOperation(input, db); await db.doyaSlideProject.update({ where: { id: 'project' }, data: { userId: 'other' } }); await age(); assert.equal((await helper.recoverDoyaSlideOperation(input, false, db)).state, 'unavailable'); assert.equal(await used(), 0); assert.equal((await db.doyaSlideProject.findUnique({ where: { id: 'project' } })).userId, 'other')
      cases.push('ownership transfer hides saved operation and expires original actor reservation without touching new owner data')
    }
    await reset(1); {
      assert.equal((await helper.recoverDoyaSlideOperation(input, true, db)).state, 'cancelled'); assert.equal((await helper.beginDoyaSlideOperation(input, db)).state, 'cancelled'); assert.equal(await used(), 0)
      cases.push('missing-operation cancel fences delayed admission without charging')
    }
    await reset(1); {
      await helper.beginDoyaSlideOperation(input, db); await db.doyaSlideProject.update({ where: { id: 'project' }, data: { themeColor: '#abcdef', updatedAt: new Date(Date.now() + 1000) } }); await assert.rejects(helper.settleDoyaSlideOperationSlot(input, 'slide-0', output, db), e => e.code === 'PROJECT_CHANGED'); await helper.finishDoyaSlideOperation(input, db); assert.equal(await used(), 0); assert.equal((await db.doyaSlideProject.findUnique({ where: { id: 'project' } })).themeColor, '#abcdef')
      cases.push('changed branding snapshot rejects stale result without overwriting branding; exact reservation cleanup stays possible')
    }
    await reset(1); {
      await db.userServiceSubscription.create({data:{userId:'actor',serviceId:'doyaslide',monthlyUsage:19,lastUsageReset:new Date()}})
      await db.doyaSlideProject.create({data:{id:'project-2',userId:'actor',title:'Other',status:'structured',slides:{create:{id:'other-slide',index:0,visualPrompt:'Synthetic'}}}})
      const outcomes=await Promise.all([helper.beginDoyaSlideOperation(input,db),helper.beginDoyaSlideOperation({...input,projectId:'project-2',operationId:crypto.randomUUID()},db)]);assert.equal(outcomes.filter(o=>o.state==='started').length,1);assert.equal(outcomes.filter(o=>o.state==='limit').length,1);assert.equal(await used(),20)
      cases.push('different projects at19/20 serialize actor quota and admit one wave only')
    }
    await reset(1); {
      await helper.beginDoyaSlideOperation(input,db);const before=await used();assert.equal((await helper.recoverDoyaSlideOperation(input,true,db)).state,'pending');assert.equal(await used(),before)
      cases.push('cancel during live provider work cannot release reservation or remove receipt')
    }
    await reset(1); {
      await helper.beginDoyaSlideOperation(input,db);await age();await db.userServiceSubscription.updateMany({where:{userId:'actor'},data:{monthlyUsage:7,lastUsageReset:new Date(Date.now()+60000)}});assert.equal((await helper.recoverDoyaSlideOperation(input,false,db)).state,'failed');assert.equal(await used(),7)
      cases.push('same-month administrative reset is fenced by exact reset token; new usage is never guessed-refunded')
    }
    await reset(1); {
      await helper.beginDoyaSlideOperation(input,db);await age();await db.$executeRawUnsafe(`ALTER TABLE "SystemSetting" ADD CONSTRAINT reject_failed CHECK(value NOT LIKE '%"failed"%')`);await assert.rejects(helper.recoverDoyaSlideOperation(input,false,db));assert.equal(await used(),1);await db.$executeRawUnsafe('ALTER TABLE "SystemSetting" DROP CONSTRAINT reject_failed');assert.equal((await helper.recoverDoyaSlideOperation(input,false,db)).state,'failed');assert.equal(await used(),0)
      cases.push('terminal receipt outage rolls back refund/working markers; explicit later recovery refunds once')
    }
    await reset(1); {
      await helper.beginDoyaSlideOperation(input,db);await age();const key='doyaslide-operation:v1:'+crypto.createHash('sha256').update(JSON.stringify([input.actor,input.projectId,input.kind,input.operationId])).digest('hex');await db.doyaSlideVersion.create({data:{id:'doyaslide-operation-'+crypto.createHash('sha256').update(JSON.stringify([key,'slide-0'])).digest('hex'),slideId:'slide-0',version:1,imageUrl:output.imageUrl}});await assert.rejects(helper.recoverDoyaSlideOperation(input,false,db),e=>e.code==='INVALID_RECEIPT');assert.equal(await used(),1)
      cases.push('inconsistent pending receipt with persisted operation version never refunds or deletes output')
    }
    await reset(1); {
      await helper.beginDoyaSlideOperation(input,db);const row=await db.systemSetting.findFirst({where:{key:{startsWith:'doyaslide-operation:v1:'}}});const r=JSON.parse(row.value);r.actor='other';await db.systemSetting.update({where:{key:row.key},data:{value:JSON.stringify(r)}});await assert.rejects(helper.recoverDoyaSlideOperation(input,false,db),e=>e.code==='INVALID_RECEIPT');assert.equal(await used(),1)
      cases.push('corrupt actor/key binding fails closed without quota or output changes')
    }
    await reset(1); {
      await db.doyaSlideProject.update({where:{id:'project'},data:{status:'generating',updatedAt:new Date(Date.now()-1800000)}});await db.userServiceSubscription.create({data:{userId:'actor',serviceId:'doyaslide',monthlyUsage:20,lastUsageReset:new Date()}});await assert.rejects(helper.beginDoyaSlideOperation(input,db),e=>e.code==='LEGACY_UNCONFIRMED');assert.equal(await used(),20)
      cases.push('untracked legacy aggregate usage is preserved, with explicit unconfirmed recovery instead of fabricated refund')
    }
    await reset(1); {
      await helper.beginDoyaSlideOperation(input,db);await db.$executeRawUnsafe(`DELETE FROM "User" WHERE id='actor'`);await assert.rejects(helper.recoverDoyaSlideOperation(input,false,db),e=>e.code==='ACTOR_UNAVAILABLE');await assert.rejects(helper.settleDoyaSlideOperationSlot(input,'slide-0',output,db),e=>e.code==='ACTOR_UNAVAILABLE');assert.equal(await db.doyaSlideVersion.count(),0)
      cases.push('deleted actor stale session cannot recover or commit a result')
    }
    await reset(20); {
      await db.userServiceSubscription.create({data:{userId:'actor',serviceId:'doyaslide',monthlyUsage:19,lastUsageReset:new Date()}});const admission=await helper.beginDoyaSlideOperation(input,db);assert.equal(admission.receipt.reserved,1);assert.equal(admission.receipt.skipped,19);assert.equal(admission.receipt.deferred,0);assert.equal(await used(),20)
      cases.push('partial remaining quota reports all19omitted slides as quota skipped; deferred waves never hide quota skips')
    }
    await reset(1); {
      for(const value of [null,12,{toString:()=>input.operationId}])await assert.rejects(helper.beginDoyaSlideOperation({...input,operationId:value},db),e=>e.code==='INVALID_OPERATION');assert.equal(await used(),0)
      cases.push('non-string operation UUID rejects before locks/quota/receipt; object coercion cannot bypass validation')
    }
    await reset(1); {
      await helper.beginDoyaSlideOperation(input,db);await helper.settleDoyaSlideOperationSlot(input,'slide-0',output,db);await db.doyaSlideVersion.deleteMany();const recovered=await helper.recoverDoyaSlideOperation(input,false,db);assert.equal(recovered.state,'unavailable');assert.equal(recovered.receipt,undefined);assert.equal((await helper.beginDoyaSlideOperation(input,db)).state,'unavailable');await assert.rejects(helper.settleDoyaSlideOperationSlot(input,'slide-0',output,db),e=>e.code==='RESULT_UNAVAILABLE');assert.equal(await used(),1);assert.equal(await db.doyaSlideVersion.count(),0)
      cases.push('deleted saved version is unavailable, hides private URLs and cannot be recreated or refunded by replay')
    }
    const { NextRequest, NextResponse } = require('next/server')
    let providerPrompts = [], routeActor = 'actor', recoveryCalls = 0, providerCalls = 0, providerMode = 'success', saveMode = 'normal'
    const worker = load('src/lib/doyaslide/generation-worker.ts', {
      './generation-operation': { ...helper, settleDoyaSlideOperationSlot: async (...args) => {
        if (saveMode === 'outage') throw new Error('Synthetic DB save outage')
        const saved = await helper.settleDoyaSlideOperationSlot(...args)
        if (saveMode === 'lost-ack') throw new Error('Synthetic lost commit acknowledgment')
        return saved
      } },
      './generate': { composeSlideImage: async (_actor, _project, slide) => { providerCalls++; providerPrompts.push(slide.visualPrompt); if (providerMode === 'failure' || providerMode === 'partial' && slide.index > 0) throw new Error('Synthetic provider failure'); return { ...output, fallbackUsed: false } } },
      './vision': { reviseSlidePrompt: async () => 'Synthetic revised prompt' }, './logo': { fetchBuffer: async () => Buffer.from('Synthetic') },
      '@/lib/fetch-timeout': { raceTimeout: async (_label, _duration, value) => value },
    })
    const http = load('src/lib/doyaslide/generation-http.ts', {
      'next/server': { NextResponse }, '@/lib/prisma': { prisma: db }, '@/lib/doyaslide/generation-worker': worker, '@/lib/doyaslide/limits': limits, '@/lib/doyaslide/access': { getUserId: async () => routeActor },
      '@/lib/doyaslide/generation-operation': { ...helper, recoverDoyaSlideOperation: async (...args) => { recoveryCalls++; return helper.recoverDoyaSlideOperation(...args) } },
    }, { setTimeout, clearTimeout, TextDecoder })
    const route = load('src/app/api/doyaslide/operations/route.ts', { '@/lib/doyaslide/generation-http': http })
    const legacyRoutes = Object.fromEntries(['batch','regenerate','chat'].map(kind => [kind,load(kind === 'batch' ? 'src/app/api/doyaslide/generate/route.ts' : `src/app/api/doyaslide/slides/[id]/${kind}/route.ts`, { '@/lib/doyaslide/generation-http': http })]))
    const request = (extra = {}, operation = input) => new NextRequest('https://local.test/api/doyaslide/operations?' + new URLSearchParams({ operationId: operation.operationId, projectId: operation.projectId, kind: operation.kind, ...(operation.slideId ? { slideId: operation.slideId } : {}), ...extra }))
    const privateResponse = response => { assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(response.headers.get('vary'), 'Cookie') }
    await reset(1); {
      routeActor = null; const before = recoveryCalls
      const denied = await route.GET(request()); assert.equal(denied.status, 401); privateResponse(denied); assert.equal(recoveryCalls, before)
      routeActor = 'actor'
      for (const req of [request({ kind: 'unknown' }), request({ message: 'private input' }), new NextRequest(request().url + '&projectId=other')]) {
        const bad = await route.GET(req); assert.equal(bad.status, 400); privateResponse(bad)
      }
      assert.equal(recoveryCalls, before); assert.equal(await used(), 0)
      cases.push('actual recovery API rejects anonymous, unknown kind, extra private input and duplicate metadata before DB')
    }
    await reset(1); {
      const missing = await route.GET(request()); assert.equal((await missing.json()).state, 'missing'); privateResponse(missing)
      const cancelled = await route.DELETE(request()); assert.equal((await cancelled.json()).state, 'cancelled'); assert.equal((await helper.beginDoyaSlideOperation(input)).state, 'cancelled'); assert.equal(await used(), 0)
      cases.push('actual DELETE fences missing operation; delayed admission cannot reserve quota')
    }
    await reset(1); {
      await helper.beginDoyaSlideOperation(input); const pending = await route.DELETE(request()); assert.equal((await pending.json()).state, 'pending'); assert.equal(await used(), 1)
      await age(); const responses = await Promise.all(Array.from({ length: 4 }, () => route.GET(request()))); assert((await Promise.all(responses.map(r => r.json()))).every(r => r.state === 'failed')); assert.equal(await used(), 0)
      cases.push('actual DELETE cannot cancel live work; concurrent expiry GET releases one exact reservation once')
    }
    await reset(1); {
      const operation = { ...input, kind: 'chat', slideId: 'slide-0', message: 'Private instruction never exposed' }
      await helper.beginDoyaSlideOperation(operation); await helper.settleDoyaSlideOperationSlot(operation, 'slide-0', output)
      const response = await route.GET(request({}, operation)); privateResponse(response); const payload = await response.json()
      assert.equal(payload.state, 'completed'); assert.equal(payload.results[0].imageUrl, output.imageUrl); assert.equal(payload.results[0].slideId, 'slide-0')
      for (const secret of ['Private instruction', 'visualPrompt', 'inputHash', 'resetAt', 'actor']) assert(!JSON.stringify(payload).includes(secret))
      const wrong = await route.GET(request({ slideId: 'wrong-slide' }, operation)); assert.equal(wrong.status, 409); assert.equal((await wrong.json()).code, 'INPUT_CHANGED')
      assert.equal(await used(), 1); assert.equal(await db.doyaSlideChatMessage.count(), 2)
      routeActor = 'other'; const hidden = await route.GET(request({}, operation)); assert.equal(hidden.status, 404); assert(!JSON.stringify(await hidden.json()).includes(output.imageUrl)); privateResponse(hidden); routeActor = 'actor'
      await db.doyaSlideVersion.deleteMany(); const deleted = await route.GET(request({}, operation)); assert.equal(deleted.status, 404); assert(!JSON.stringify(await deleted.json()).includes(output.imageUrl))
      cases.push('actual chat recovery returns saved output with metadata only; wrong slide, other actor and deleted history hide results')
    }
    await reset(1); {
      await helper.beginDoyaSlideOperation(input); await age()
      await db.$executeRawUnsafe(`ALTER TABLE "SystemSetting" ADD CONSTRAINT reject_route_expiry CHECK(value NOT LIKE '%"failed"%')`)
      const response = await route.GET(request()); assert.equal(response.status, 503); privateResponse(response); assert.equal((await response.json()).code, 'RECOVERY_UNAVAILABLE'); assert.equal(await used(), 1)
      await db.$executeRawUnsafe('ALTER TABLE "SystemSetting" DROP CONSTRAINT reject_route_expiry')
      assert.equal((await (await route.GET(request())).json()).state, 'failed'); assert.equal(await used(), 0)
      cases.push('actual API receipt outage returns private503 without speculative refund; later GET safely completes expiry')
    }
    const post = (body = input) => route.POST(new NextRequest('https://local.test/api/doyaslide/operations', { method: 'POST', body: JSON.stringify(Object.fromEntries(Object.entries(body).filter(([key]) => key !== 'actor'))), headers: { 'Content-Type': 'application/json' } }))
    await reset(); {
      providerCalls = 0
      const responses = await Promise.all(Array.from({ length: 6 }, () => post())); assert(responses.every(r => [200,202].includes(r.status)))
      const recovered = await route.GET(request()); const payload = await recovered.json(); assert.equal(payload.state, 'completed'); assert.equal(payload.results.length, 4); assert.equal(providerCalls, 4); assert.equal(await used(), 4)
      assert.equal((await (await post()).json()).state, 'completed'); assert.equal(providerCalls, 4); assert.equal(await db.doyaSlideVersion.count(), 4)
      cases.push('actual POST concurrent UUID starts only four providers once; duplicate terminal POST replays without another charge')
    }
    await reset(); {
      providerCalls = 0; providerMode = 'partial'
      const response = await post(); const payload = await response.json(); assert.equal(payload.state, 'completed'); assert.equal(payload.errorCount, 3); assert.equal(payload.results.length, 1); assert.equal(await used(), 1); assert.equal(providerCalls, 4)
      await post(); assert.equal(providerCalls, 4); providerMode = 'success'
      cases.push('actual batch POST partial failure persists one output and refunds exactly three; replay never retries failed AI slots')
    }
    await reset(1); {
      providerCalls = 0; providerMode = 'failure'
      assert.equal((await (await post()).json()).state, 'failed'); assert.equal(await used(), 0); await post(); assert.equal(providerCalls, 1); providerMode = 'success'
      cases.push('actual provider failure closes one operation and refunds once without automatic provider replay')
    }
    await reset(1); {
      providerCalls = 0; saveMode = 'lost-ack'
      assert.equal((await (await post()).json()).state, 'completed'); assert.equal(providerCalls, 1); assert.equal(await db.doyaSlideVersion.count(), 1); assert.equal(await used(), 1); saveMode = 'normal'
      cases.push('actual worker lost settlement acknowledgments recovers committed result with one provider/version/charge')
    }
    await reset(1); {
      providerCalls = 0; saveMode = 'outage'
      const response = await post(); assert.equal(response.status, 202); assert.equal((await response.json()).state, 'pending'); assert.equal(await used(), 1); assert.equal(await db.doyaSlideVersion.count(), 0)
      await post(); assert.equal(providerCalls, 1); saveMode = 'normal'; await age(); assert.equal((await (await route.GET(request())).json()).state, 'failed'); assert.equal(await used(), 0)
      cases.push('actual worker unresolved saves stay pending with reservation; duplicate POST never regenerates; later expiry refunds')
    }
    for (const kind of ['regenerate','chat']) {
      await reset(1); providerCalls = 0
      const operation = { ...input, kind, slideId: 'slide-0', ...(kind === 'chat' ? { message: 'Private change' } : {}) }
      await db.doyaSlideSlide.update({ where: { id: 'slide-0' }, data: { imageUrl: 'https://local.test/old.png', rawImageUrl: 'https://local.test/old-raw.png', status: 'done' } })
      const response = await post(operation); assert.equal((await response.json()).state, 'completed'); await post(operation); assert.equal(providerCalls, 1); assert.equal(await used(), 1); assert.equal(await db.doyaSlideVersion.count(), 1); assert.equal(await db.doyaSlideChatMessage.count(), kind === 'chat' ? 2 : 0)
      cases.push(`actual ${kind} POST uses one provider/version/charge and once-only chat history across replay`)
    }
    await reset(1); {
      providerCalls = 0
      for (const body of [{ ...input, operationId: 12 }, { ...input, projectId: '' }, { ...input, kind: 'chat', slideId: 'slide-0', message: '' }, { ...input, kind: 'regenerate', slideId: null }, { ...input, onlyPending: 'true' }]) {
        const response = await post(body); assert.equal(response.status, 400); privateResponse(response)
      }
      assert.equal(await used(), 0); assert.equal(providerCalls, 0); assert.equal(await db.systemSetting.count(), 0)
      cases.push('actual POST invalid UUID/project/slide/chat instruction/boolean cannot reserve or invoke providers')
    }
    await reset(1); {
      const tooLarge = new NextRequest('https://local.test/api/doyaslide/operations', { method: 'POST', body: 'x'.repeat(16385) })
      const response = await route.POST(tooLarge); assert.equal(response.status, 413); privateResponse(response); assert.equal(await used(), 0)
      const declared = new NextRequest('https://local.test/api/doyaslide/operations', { method: 'POST', body: '{}', headers: { 'content-length': '16385' } })
      assert.equal((await route.POST(declared)).status, 413)
      cases.push('actual POST bounds streamed and declared body bytes before reservation')
    }
    await reset(1); {
      const malformed = new NextRequest('https://local.test/api/doyaslide/operations', { method: 'POST', body: new Uint8Array([255]) })
      assert.equal((await route.POST(malformed)).status, 400)
      const controller = new AbortController(); controller.abort()
      const aborted = new NextRequest('https://local.test/api/doyaslide/operations', { method: 'POST', body: '{}', signal: controller.signal })
      const response = await route.POST(aborted); assert.equal(response.status, 408); privateResponse(response); assert.equal(await used(), 0)
      cases.push('actual POST rejects malformed UTF8 and aborted body without creating a receipt')
    }
    await reset(1); {
      await db.userServiceSubscription.create({ data: { userId: 'actor', serviceId: 'doyaslide', monthlyUsage: 20, lastUsageReset: new Date() } }); providerCalls = 0
      const response = await post(); assert.equal(response.status, 403); privateResponse(response); const body = await response.json(); assert.equal(body.code, 'LIMIT_REACHED'); assert.equal(body.upgradeUrl, '/doyaslide/pricing'); assert.equal(providerCalls, 0); assert.equal(await used(), 20)
      cases.push('actual POST exhausted free quota preserves upgrade guidance and invokes zero providers')
    }
    await reset(1); {
      providerCalls = 0; routeActor = 'other'; const response = await post(); assert.equal(response.status, 404); assert.equal(providerCalls, 0); assert.equal(await used(), 0); routeActor = 'actor'
      cases.push('actual POST other actor cannot admit a private project or invoke provider')
    }
    await reset(1); {
      await db.doyaSlideSlide.update({ where: { id: 'slide-0' }, data: { imageUrl: output.imageUrl, status: 'done' } }); providerCalls = 0
      assert.equal((await (await post()).json()).state, 'empty')
      await db.doyaSlideSlide.update({ where: { id: 'slide-0' }, data: { imageUrl: null, status: 'pending' } })
      assert.equal((await (await post()).json()).state, 'cancelled'); assert.equal(providerCalls, 0); assert.equal(await used(), 0)
      assert.equal((await (await post({ ...input, operationId: crypto.randomUUID() })).json()).state, 'completed'); assert.equal(providerCalls, 1)
      cases.push('empty no-op receipt fences delayed UUID after targets change; only explicit new UUID can generate')
    }
    await reset(1); {
      await db.userServiceSubscription.create({ data: { userId: 'actor', serviceId: 'doyaslide', monthlyUsage: 20, lastUsageReset: new Date() } }); providerCalls = 0
      assert.equal((await post()).status, 403)
      await db.userServiceSubscription.updateMany({ where: { userId: 'actor' }, data: { monthlyUsage: 0, lastUsageReset: new Date(Date.now()+1000) } })
      assert.equal((await (await post()).json()).state, 'cancelled'); assert.equal(providerCalls, 0); assert.equal(await used(), 0)
      assert.equal((await (await post({ ...input, operationId: crypto.randomUUID() })).json()).state, 'completed'); assert.equal(providerCalls, 1)
      cases.push('quota-rejected UUID is fenced across quota reset; old request cannot spend newly available quota')
    }
    await reset(1); {
      await helper.beginDoyaSlideOperation(input); const first = await db.userServiceSubscription.findUnique({ where: { userId_serviceId: { userId: 'actor', serviceId: 'doyaslide' } } });
      await new Promise(resolve => setTimeout(resolve, 5)); await limits.reserveMonthlySlides('actor', 1); await age(); await helper.recoverDoyaSlideOperation(input);
      assert.equal(await used(), 1, 'legacy reservation must not change the reset token and strand owned operation quota')
      const current = await db.userServiceSubscription.findUnique({ where: { userId_serviceId: { userId: 'actor', serviceId: 'doyaslide' } } }); assert.equal(current.lastUsageReset.getTime(), first.lastUsageReset.getTime())
      cases.push('legacy same-month reservation preserves reset token; expiry refunds only new operation slot and retains other legitimate usage')
    }
    const legacyPost = (kind, body, slideId = 'slide-0') => legacyRoutes[kind].POST(new NextRequest('https://local.test/api/doyaslide/legacy', { method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), { params: Promise.resolve({ id: slideId }) })
    await reset(1); {
      providerCalls = 0
      for (const kind of ['batch','regenerate','chat']) for (const body of [undefined, kind === 'batch' ? { projectId: 'project' } : kind === 'chat' ? { message: 'Change' } : {}]) {
        const response = await legacyPost(kind,body); assert.equal(response.status,409); privateResponse(response); assert.equal((await response.json()).code,'OPERATION_REQUIRED')
      }
      assert.equal(providerCalls,0); assert.equal(await used(),0); assert.equal(await db.systemSetting.count(),0)
      cases.push('all three actual legacy APIs reject missing UUID or old empty body with reload guidance before providers/quota')
    }
    await reset(); {
      providerCalls=0; const body={projectId:input.projectId,operationId:input.operationId,onlyPending:true}
      assert.equal((await (await legacyPost('batch',body)).json()).state,'completed');assert.equal((await (await post()).json()).state,'completed');await legacyPost('batch',body)
      assert.equal(providerCalls,4);assert.equal(await used(),4);assert.equal(await db.doyaSlideVersion.count(),4)
      cases.push('actual legacy batch and unified endpoint share UUID receipt and replay four images without duplicate providers/usage/history')
    }
    for(const kind of ['regenerate','chat']) {
      await reset(1);providerCalls=0;const operation={actor:'actor',projectId:'project',operationId:input.operationId,kind,slideId:'slide-0',...(kind==='chat'?{message:'Change'}:{})}
      const body={operationId:input.operationId,...(kind==='chat'?{message:'Change'}:{})}
      assert.equal((await (await legacyPost(kind,body)).json()).state,'completed');assert.equal((await (await post(operation)).json()).state,'completed');await legacyPost(kind,body)
      assert.equal(providerCalls,1);assert.equal(await used(),1);assert.equal(await db.doyaSlideVersion.count(),1);assert.equal(await db.doyaSlideChatMessage.count(),kind==='chat'?2:0)
      cases.push(`actual legacy ${kind} binds owned route slide and shares once-only result/history with unified endpoint`)
    }
    await reset(1); {
      routeActor='other';providerCalls=0;for(const kind of ['regenerate','chat'])assert.equal((await legacyPost(kind,{operationId:input.operationId,...(kind==='chat'?{message:'Change'}:{})})).status,404)
      routeActor='actor';assert.equal(providerCalls,0);assert.equal(await used(),0)
      cases.push('actual legacy single-slide routes resolve only actor-owned slides and hide foreign project data')
    }
    await reset(1); {
      providerCalls=0;for(const kind of ['batch','regenerate','chat']) {
        const response=await legacyPost(kind,{operationId:input.operationId,projectId:'project',kind:'batch',slideId:'slide-0',message:'Change'});assert.equal(response.status,400)
      }
      assert.equal(providerCalls,0);assert.equal(await used(),0)
      cases.push('legacy payload cannot override bound kind/slide/project or smuggle unrelated input')
    }
    await reset(1); {
      providerCalls=0;await helper.beginDoyaSlideOperation(input);await age();const response=await legacyPost('batch',{projectId:'project',operationId:input.operationId,onlyPending:true});assert.equal((await response.json()).state,'failed');assert.equal(providerCalls,0);assert.equal(await used(),0)
      cases.push('actual legacy POST expires abandoned same UUID and refunds without reinvoking provider')
    }
    await reset(1); {
      providerCalls=0;saveMode='lost-ack';const response=await legacyPost('regenerate',{operationId:input.operationId});assert.equal((await response.json()).state,'completed');saveMode='normal';assert.equal(providerCalls,1);assert.equal(await used(),1);assert.equal(await db.doyaSlideVersion.count(),1)
      cases.push('actual legacy regenerate lost persistence acknowledgments recover one image/version/charge')
    }
    await reset(1); {
      routeActor=null;providerCalls=0;for(const kind of ['batch','regenerate','chat']){const response=await legacyPost(kind,{});assert.equal(response.status,401);privateResponse(response)}routeActor='actor';assert.equal(providerCalls,0);assert.equal(await used(),0)
      cases.push('all three actual legacy APIs enforce private anonymous rejection before body/ownership/provider work')
    }
    await reset(1); {
      const projectLock = load('src/lib/doyaslide/project-lock.ts', { '@/lib/prisma': { prisma: db } })
      const revert = load('src/app/api/doyaslide/slides/[id]/revert/route.ts', { 'next/server': { NextResponse }, '@/lib/prisma': { prisma: db }, '@/lib/doyaslide/access': { getUserId: async () => routeActor }, '@/lib/doyaslide/project-lock': projectLock })
      await db.doyaSlideSlide.update({ where: { id: 'slide-0' }, data: { version: 2, imageUrl: output.imageUrl, rawImageUrl: output.rawImageUrl, visualPrompt: 'Current red prompt', status: 'done' } })
      await db.doyaSlideVersion.createMany({ data: [{ id: 'blue-version', slideId: 'slide-0', version: 1, imageUrl: 'https://local.test/blue.png', rawImageUrl: 'https://local.test/blue-raw.png', prompt: 'Restored blue prompt' }, { id: 'red-version', slideId: 'slide-0', version: 2, imageUrl: output.imageUrl, rawImageUrl: output.rawImageUrl, prompt: 'Current red prompt' }] })
      const response=await revert.POST(new NextRequest('https://local.test/api/doyaslide/slides/slide-0/revert',{method:'POST',body:JSON.stringify({version:1})}),{params:Promise.resolve({id:'slide-0'})});assert.equal(response.status,200)
      providerPrompts=[];providerCalls=0;assert.equal((await (await legacyPost('regenerate',{operationId:input.operationId})).json()).state,'completed');assert.deepEqual(providerPrompts,['Restored blue prompt']);assert.equal(providerCalls,1);assert.equal(await used(),1)
      const current=await db.doyaSlideSlide.findUnique({where:{id:'slide-0'}});assert.equal(current.version,3);assert.equal(await db.doyaSlideVersion.count(),3)
      cases.push('actual revert then durable legacy regeneration uses restored prompt and monotonic version sequence in real locked PostgreSQL')
    }
    assert.equal(cases.length, 55)
    const files = ['src/lib/doyaslide/generation-operation.ts','src/lib/doyaslide/limits.ts','src/lib/plan-utils.ts','src/app/api/doyaslide/operations/route.ts','src/lib/doyaslide/generation-worker.ts','src/lib/doyaslide/generation-http.ts','src/app/api/doyaslide/generate/route.ts','src/app/api/doyaslide/slides/[id]/regenerate/route.ts','src/app/api/doyaslide/slides/[id]/chat/route.ts','src/app/api/doyaslide/slides/[id]/revert/route.ts','src/lib/doyaslide/project-lock.ts']
    const report = { checkedAt: new Date().toISOString(), passed: cases.length, cases, sourceHashes: Object.fromEntries(files.map(f => [f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])), scope: 'Actual new operation helper with Prisma against Unix-socket-only isolated PostgreSQL. Synthetic images; no providers/customer DB. Unified operation POST/GET/DELETE actual routes covered. All three legacy routes delegate to shared worker and reject old missing-UUID requests; editor has separate mounted verification; not released, full goal incomplete.' }
    fs.writeFileSync(base+'doyaslide-operation-postgres-results.json', JSON.stringify(report,null,2)+'\n'); console.log(JSON.stringify(report))
  } finally { clearTimeout(deadline); await db.$disconnect() }
})().catch(error => { console.error(error); process.exitCode = 1 })
