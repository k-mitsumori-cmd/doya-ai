const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = process.env.DOYA_SHANAI_PURGE_ROOT || path.resolve(__dirname, '../..');
const deps = process.env.DOYA_SHANAI_PURGE_DEPS || path.join(root, 'node_modules');
const ts = require(path.join(deps, 'typescript')), { PrismaClient, Prisma } = require(path.join(deps, '@prisma/client'));
const connection = process.env.DOYA_PRIVATE_TEST_DATABASE_URL, socket = process.env.DOYA_PRIVATE_TEST_SOCKET;
assert(connection && socket, 'Run through verify-shanai-storage-postgres.py');
const url = new URL(connection); assert.equal(url.hostname, 'localhost'); assert.equal(url.password, ''); assert.equal(url.searchParams.get('host'), socket); assert.match(socket, /^\/tmp\/doya-shanai-purge-[^/]+\/socket$/);
const db = new PrismaClient({ datasources: { db: { url: connection } } });
const owner = 'synthetic-owner', id = 'c' + 'a'.repeat(24), photoId = 'c' + 'b'.repeat(24), photoPath = `${owner}/shanai_photo_${id}/photo.jpg`;
let objects = new Map(), user = owner, metadataBarrier = null, storageOutage = false;
function load(file, mocks) { const exports = {}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: name => { assert(name in mocks, 'Unmocked ' + name); return mocks[name]; }, Date, Buffer, console: { error: () => {}, warn: () => {} } }, { filename: file }); return exports; }
const workerStorage = { deleteFile: async file => { if (storageOutage) throw Error('Synthetic outage'); objects.delete(file); }, purgeInterviewProjectStorageBatch: async () => true };
const loadQueue = () => load('src/lib/interview/storage-purge-queue.ts', { './storage': workerStorage });
const purgeQueue = loadQueue();
const purge = fs.existsSync(path.join(root, 'src/lib/shanai/storage-purge.ts')) ? load('src/lib/shanai/storage-purge.ts', { 'node:crypto': require('node:crypto'), '@/lib/interview/storage-purge-queue': purgeQueue }) : {};
const storage = load('src/lib/shanai/storage.ts', { '@/lib/interview/storage': { getFileMetadata: async file => { if (metadataBarrier) await metadataBarrier(); return objects.get(file) || null; }, getSupabaseAdmin: () => ({ storage: { from: () => ({ remove: async () => ({ error: null }) }) } }) } });
const access = { getShanaiUserId: async () => user, json: (x, status = 200) => Response.json(x, { status }), notFound: () => Response.json({}, { status: 404 }), unauthorized: () => Response.json({}, { status: 401 }), ownInterview: (userId, id) => ({ userId, id }) };
const mocks = { '@prisma/client': { Prisma }, '@/lib/prisma': { prisma: db }, '@/lib/shanai/access': access, '@/lib/shanai/dto': { interviewDetailDto: async () => ({ id }) }, '@/lib/shanai/interviews-read': {}, '@/lib/shanai/types': load('src/lib/shanai/types.ts', {}), '@/lib/shanai/storage': storage, '@/lib/shanai/storage-purge': purge };
const interview = load('src/app/api/shanai/interviews/[id]/route.ts', mocks), photo = load('src/app/api/shanai/interviews/[id]/photos/[photoId]/route.ts', mocks), confirm = load('src/app/api/shanai/interviews/[id]/confirm-upload/route.ts', mocks);
const ctx = key => ({ params: Promise.resolve({ id, photoId: key || photoId }) });
const confirmPhoto = file => confirm.POST(new Request('https://example.invalid', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'photo', path: file, mimeType: 'image/jpeg' }) }), ctx());
const quote = s => '"' + s.replace(/"/g, '""') + '"';
async function schema() {
  // Only the three used models, with scalar names/types/defaults from the actual generated DMMF.
  for (const name of ['SystemSetting', 'ShanaiInterview', 'ShanaiPhoto']) {
    const model = Prisma.dmmf.datamodel.models.find(m => m.name === name); assert(model);
    const columns = model.fields.filter(f => f.kind !== 'object').map(f => {
      const type = { String: 'TEXT', Int: 'INTEGER', Float: 'DOUBLE PRECISION', Boolean: 'BOOLEAN', Json: 'JSONB', DateTime: 'TIMESTAMP(3)', BigInt: 'BIGINT', Decimal: 'DECIMAL', Bytes: 'BYTEA' }[f.type]; assert(type, f.type);
      let def = f.isRequired ? ({ String: "''", Int: '0', Float: '0', Boolean: 'false', Json: "'null'::jsonb", DateTime: 'CURRENT_TIMESTAMP' }[f.type]) : 'NULL';
      if (typeof f.default === 'string') def = "'" + f.default.replace(/'/g, "''") + "'";
      if (typeof f.default === 'number' || typeof f.default === 'boolean') def = String(f.default);
      return `${quote(f.dbName || f.name)} ${type}${f.isId ? ' PRIMARY KEY' : f.isUnique ? ' UNIQUE' : ''}${f.isRequired ? ' NOT NULL' : ''}${def ? ' DEFAULT ' + def : ''}`;
    });
    await db.$executeRawUnsafe(`CREATE TABLE ${quote(model.dbName || name)} (${columns.join(',')})`);
  }
  await db.$executeRawUnsafe('ALTER TABLE shanai_photo ADD CONSTRAINT shanai_photo_interview_fkey FOREIGN KEY ("interviewId") REFERENCES shanai_interview(id) ON DELETE CASCADE');
}
async function fresh(count = 0) {
  await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS synthetic_queue_failure ON "SystemSetting"');
  await db.shanaiPhoto.deleteMany(); await db.shanaiInterview.deleteMany(); await db.systemSetting.deleteMany();
  objects = new Map(); user = owner; metadataBarrier = null; storageOutage = false;
  await db.shanaiInterview.create({ data: { id, userId: owner, mode: 'voice', intervieweeName: 'Synthetic', surveyToken: 'synthetic-token' } });
  for (let i = 0; i < count; i++) {
    const file = photoPath + i; objects.set(file, { size: 100, mimeType: 'image/jpeg' });
    await db.shanaiPhoto.create({ data: { id: i === 0 ? photoId : 'c' + String(i).padStart(24, '0'), interviewId: id, storagePath: file, mimeType: 'image/jpeg' } });
  }
}
async function failFileQueue() {
  await db.$executeRawUnsafe("CREATE OR REPLACE FUNCTION synthetic_queue_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.key LIKE 'interview-%' THEN RAISE EXCEPTION 'synthetic queue outage'; END IF; RETURN NEW; END $$");
  await db.$executeRawUnsafe('CREATE TRIGGER synthetic_queue_failure BEFORE INSERT ON "SystemSetting" FOR EACH ROW EXECUTE FUNCTION synthetic_queue_failure()');
}
function synchronizeTwoMetadataReads() {
  let count = 0, release; const barrier = new Promise(resolve => { release = resolve; });
  metadataBarrier = async () => { if (++count === 2) release(); await barrier; };
}
const results = [];
async function check(name, fn) { try { await fresh(); await fn(); results.push({ name, passed: true }); console.log('PASS ' + name); } catch (error) { results.push({ name, passed: false, error: error.message.slice(0, 400) }); console.error('FAIL ' + name + ': ' + error.message.slice(0, 400)); } }
(async () => {
  await schema();
  await check('PostgreSQL interview deletion commits both prefix jobs with cascade', async () => { await fresh(1); const r = await interview.DELETE(null, ctx()); assert.equal(r.status, 200); assert.equal((await r.json()).fileCleanupPending, true); assert.equal(await db.shanaiInterview.count(), 0); assert.equal(await db.shanaiPhoto.count(), 0); assert.equal(await db.systemSetting.count(), 2); });
  await check('PostgreSQL queue trigger failure rolls interview deletion back', async () => { await fresh(1); await failFileQueue(); assert.equal((await interview.DELETE(null, ctx())).status, 500); assert.equal(await db.shanaiInterview.count(), 1); assert.equal(await db.shanaiPhoto.count(), 1); assert.equal(await db.systemSetting.count(), 0); });
  await check('PostgreSQL file job failure rolls photo and marker back together', async () => { await fresh(1); await failFileQueue(); assert.equal((await photo.DELETE(null, ctx())).status, 500); assert.equal(await db.shanaiPhoto.count(), 1); assert.equal(await db.systemSetting.count(), 0); });
  await check('PostgreSQL concurrent photo confirmations stop exactly at eight', async () => { await fresh(7); for (const f of ['A', 'B']) objects.set(photoPath + f, { size: 100, mimeType: 'image/jpeg' }); synchronizeTwoMetadataReads(); const r = await Promise.all([confirmPhoto(photoPath + 'A'), confirmPhoto(photoPath + 'B')]); assert.deepEqual(r.map(x => x.status).sort(), [200, 400]); assert.equal(await db.shanaiPhoto.count(), 8); assert.equal(await db.systemSetting.count(), 2); });
  await check('PostgreSQL concurrent confirmations of one path create one photo', async () => { objects.set(photoPath, { size: 100, mimeType: 'image/jpeg' }); synchronizeTwoMetadataReads(); const r = await Promise.all([confirmPhoto(photoPath), confirmPhoto(photoPath)]); assert(r.every(x => x.status === 200)); assert.equal(await db.shanaiPhoto.count(), 1); });
  await check('PostgreSQL deleted photo path cannot be re-registered', async () => { await fresh(1); const file = photoPath + '0'; assert.equal((await photo.DELETE(null, ctx())).status, 200); assert.equal((await confirmPhoto(file)).status, 409); assert.equal(await db.shanaiPhoto.count(), 0); assert.equal(await db.systemSetting.count(), 2); });
  await check('PostgreSQL simultaneous duplicate-reference deletions retain one durable job', async () => { await fresh(1); const second = 'c' + 'd'.repeat(24); await db.shanaiPhoto.create({ data: { id: second, interviewId: id, storagePath: photoPath + '0', mimeType: 'image/jpeg' } }); const r = await Promise.all([photo.DELETE(null, ctx()), photo.DELETE(null, ctx(second))]); assert(r.every(x => x.status === 200)); assert.equal(await db.shanaiPhoto.count(), 0); assert.equal(await db.systemSetting.count(), 2); });
  await check('PostgreSQL parent deletion and confirmation cannot leave an orphan row', async () => { objects.set(photoPath, { size: 100, mimeType: 'image/jpeg' }); const r = await Promise.all([interview.DELETE(null, ctx()), confirmPhoto(photoPath)]); assert.equal(r[0].status, 200); assert([200, 404].includes(r[1].status)); assert.equal(await db.shanaiPhoto.count(), 0); assert.equal(await db.shanaiInterview.count(), 0); assert.equal(await db.systemSetting.count({ where: { key: { startsWith: 'interview-storage-purge:v1:' } } }), 2); });
  await check('PostgreSQL ownership check rejects a different user', async () => { user = 'other-owner'; assert.equal((await interview.DELETE(null, ctx())).status, 404); assert.equal(await db.shanaiInterview.count(), 1); assert.equal(await db.systemSetting.count(), 0); });
  await check('PostgreSQL failed job survives a fresh worker instance and retries', async () => { await fresh(1); const file = photoPath + '0'; assert.equal((await photo.DELETE(null, ctx())).status, 200); const row = await db.systemSetting.findFirstOrThrow({ where: { key: { startsWith: 'interview-file-purge:v1:' } } }); const now = new Date(Date.parse(row.value.split('|')[0]) + 1000); storageOutage = true; assert.equal((await loadQueue().purgeQueuedInterviewStorage(db, now)).failed, 1); assert(objects.has(file)); assert.equal(await db.systemSetting.count(), 2); storageOutage = false; assert.equal((await loadQueue().purgeQueuedInterviewStorage(db, new Date(now.getTime() + 300001))).failed, 0); assert(!objects.has(file)); assert.equal(await db.systemSetting.count(), 2); });
})().catch(error => { results.push({ name: 'harness', passed: false, error: error.message.slice(0, 400) }); }).finally(async () => {
  await db.$disconnect(); const report = { root, passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, results, scope: 'Actual routes, actual purge producers/shared serializer, real Prisma and isolated PostgreSQL transactions/advisory locks/FK cascade. Three model scalar tables from generated DMMF; production schema migration and full production database are not verified. Auth, DTO, storage metadata and worker storage boundary are synthetic. Unix socket only, no TCP listener/production DB/providers.' };
  const out = process.env.DOYA_SHANAI_PURGE_PG_OUTPUT || path.join(root, 'docs/audits/2026-10-06-all-services-recheck/shanai-storage-postgres-results.json'); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ passed: report.passed, failed: report.failed })); if (report.failed) process.exitCode = 1;
});
