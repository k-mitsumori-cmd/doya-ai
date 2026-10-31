const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = process.env.DOYA_SHANAI_TRANSCRIPT_ROOT || path.resolve(__dirname, '../..');
const deps = process.env.DOYA_SHANAI_TRANSCRIPT_DEPS || path.join(root, 'node_modules');
const ts = require(path.join(deps, 'typescript')), { PrismaClient, Prisma } = require(path.join(deps, '@prisma/client'));
const connection = process.env.DOYA_PRIVATE_TEST_DATABASE_URL, socket = process.env.DOYA_PRIVATE_TEST_SOCKET;
assert(connection && socket, 'Run through verify-shanai-storage-postgres.py');
const url = new URL(connection); assert.equal(url.hostname, 'localhost'); assert.equal(url.password, ''); assert.equal(url.searchParams.get('host'), socket); assert.match(socket, /^\/tmp\/doya-shanai-transcript-[^/]+\/socket$/);
const db = new PrismaClient({ datasources: { db: { url: connection } } });
const owner = 'synthetic-owner', id = 'c' + 'a'.repeat(24), photoId = 'c' + 'b'.repeat(24), photoPath = `${owner}/shanai_photo_${id}/photo.jpg`;
let objects = new Map(), user = owner, metadataBarrier = null, storageOutage = false;
function load(file, mocks) { const exports = {}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: name => { assert(name in mocks, 'Unmocked ' + name); return mocks[name]; }, Date, Buffer, Error, AbortSignal, Response, process:{env:{ASSEMBLYAI_API_KEY:'synthetic'}}, fetch:(...args)=>providerFetch(...args), setTimeout:fn=>setImmediate(fn), clearTimeout, console: { error: () => {}, warn: () => {}, log: () => {} } }, { filename: file }); return exports; }
const workerStorage = { deleteFile: async file => { if (storageOutage) throw Error('Synthetic outage'); objects.delete(file); }, purgeInterviewProjectStorageBatch: async () => true };
const loadQueue = () => load('src/lib/interview/storage-purge-queue.ts', { './storage': workerStorage });
const purgeQueue = loadQueue();
const purge = fs.existsSync(path.join(root, 'src/lib/shanai/storage-purge.ts')) ? load('src/lib/shanai/storage-purge.ts', { 'node:crypto': require('node:crypto'), '@/lib/interview/storage-purge-queue': purgeQueue }) : {};
const storage = load('src/lib/shanai/storage.ts', { '@/lib/interview/storage': { getFileMetadata: async file => { if (metadataBarrier) await metadataBarrier(); return objects.get(file) || null; }, getSupabaseAdmin: () => ({ storage: { from: () => ({ remove: async () => ({ error: null }) }) } }) } });
const attempt=fs.existsSync(path.join(root,'src/lib/shanai/transcription-attempt.ts'))?load('src/lib/shanai/transcription-attempt.ts',{'node:crypto':require('node:crypto'),'@/lib/prisma':{prisma:db},'./storage-purge':purge}):{};
let quotaAllowed=true;
const access=load('src/lib/shanai/access.ts', {'next-auth':{getServerSession:async()=>({user:{id:user}})},'next/server':{NextResponse:{json:(x,options)=>Response.json(x,options)}},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma:db},'./transcription-attempt':attempt,'./storage-purge':purge,'@/lib/plan-limit':{planTierOf:async()=> 'PRO',assertLimitForTier:async()=>({ok:quotaAllowed}),assertFreeLimit:async()=>({ok:quotaAllowed})}});
const mocks = { '@prisma/client': { Prisma }, '@/lib/prisma': { prisma: db }, '@/lib/shanai/access': access, '@/lib/shanai/dto': { interviewDetailDto: async () => ({ id }) }, '@/lib/shanai/interviews-read': {}, '@/lib/shanai/types': load('src/lib/shanai/types.ts', {}), '@/lib/shanai/storage': storage, '@/lib/shanai/storage-purge': purge, '@/lib/shanai/transcription-attempt':attempt };
const interview = load('src/app/api/shanai/interviews/[id]/route.ts', mocks), photo = load('src/app/api/shanai/interviews/[id]/photos/[photoId]/route.ts', mocks), confirm = load('src/app/api/shanai/interviews/[id]/confirm-upload/route.ts', mocks);
const ctx = key => ({ params: Promise.resolve({ id, photoId: key || photoId }) });
const confirmPhoto = file => confirm.POST(new Request('https://example.invalid', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'photo', path: file, mimeType: 'image/jpeg' }) }), ctx());
const quote = s => '"' + s.replace(/"/g, '""') + '"';
async function schema() {
  // Only the four used models, with scalar names/types/defaults from the actual generated DMMF.
  for (const name of ['SystemSetting', 'ShanaiInterview', 'ShanaiPhoto', 'ShanaiUsageLog']) {
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
const oldAudio = `${owner}/shanai_audio_${id}/old.mp3`, newAudio = `${owner}/shanai_audio_${id}/new.mp3`;
const oldResult = { segments: [{ start: 0, end: 1, speaker: 'A', text: 'SYNTHETIC OLD AUDIO' }] };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
class TerminalError extends Error {}
let pollAction, sendAction, providerFetch, inspectAction, sends, inspections;
function runtime(actualAdapter = false) {
  const adapter = actualAdapter ? load('src/lib/interview/transcription.ts', { './storage': { getSignedFileUrl: async () => 'https://example.invalid/synthetic-audio' } }) : {
    InterviewTranscriptionTerminalError: TerminalError,
    transcribeExistingJob: job => pollAction(job),
    transcribeFromUrl: options => sendAction(options),
  };
  return load('src/app/api/shanai/interviews/[id]/transcribe/route.ts', { ...mocks,
    '@/lib/interview/transcription': adapter,
    '@/lib/interview/media-duration': { inspectInterviewMediaDuration: async file => { inspections++; return inspectAction(file); } },
    '@/lib/service-usage': { recordServiceUsage: async () => {} },
  });
}
const route = runtime();
async function voice(status = 'none', job = null) {
  await fresh(); await db.shanaiUsageLog.deleteMany();
  await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS synthetic_attempt_failure ON "SystemSetting"');
  sends = 0; inspections = 0; quotaAllowed = true;
  await db.shanaiInterview.update({ where: { id }, data: { audioPath: oldAudio, audioSize: 100, audioMime: 'audio/mpeg', audioDurationSec: 60, transcriptStatus: status, transcriptJobId: job } });
  objects.set(newAudio, { size: 200, mimeType: 'audio/mpeg' }); objects.set(oldAudio, { size: 100, mimeType: 'audio/mpeg' });
  inspectAction = async file => file === newAudio ? 120 : 60;
  pollAction = async () => oldResult;
  sendAction = async options => { await options.onBeforeSubmit?.(); sends++; await options.onJobSubmitted('synthetic-job-' + sends); return oldResult; };
  providerFetch = async (endpoint, options = {}) => {
    if (options.method === 'POST') { sends++; return Response.json({ id: 'transport-job-' + sends }); }
    assert(endpoint.startsWith('https://api.assemblyai.com/v2/transcript/'));
    return Response.json({ status: 'completed', text: 'SYNTHETIC OLD AUDIO', utterances: [{ start: 0, end: 1000, speaker: 'A', text: 'SYNTHETIC OLD AUDIO' }] });
  };
}
const replace = file => confirm.POST(new Request('https://example.invalid', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'audio', path: file || newAudio, mimeType: 'audio/mpeg' }) }), ctx());
const row = () => db.shanaiInterview.findUniqueOrThrow({ where: { id } });
const attemptRows = () => db.systemSetting.findMany({ where: { key: { startsWith: 'shanai-transcription-attempt:v1:' } } });
async function prepare() { assert.equal(typeof attempt.authorizeTranscriptSubmission, 'function'); const reserved = await access.reserveTranscript(owner, id, { audioPath: oldAudio, durationSec: 60 }); assert(reserved.ok && reserved.context); return reserved.context; }
const EXPECTED_CASES = 28;
// Keep Node alive while deferred races are pending; an unfinished suite must fail.
const watchdog = setTimeout(() => { console.error('FAIL transcription regression did not finish within120seconds'); process.exit(1); }, 120000);
const results = [];
async function check(name, fn) { try { await voice(); await fn(); results.push({ name, passed: true }); console.log('PASS ' + name); } catch (error) { results.push({ name, passed: false, error: error.message.slice(0, 400) }); console.error('FAIL ' + name + ': ' + error.message.slice(0, 400)); } }
(async () => {
  await schema();
  await check('new transcription uses one run and one initial usage ledger row', async () => { assert.equal((await route.POST(null, ctx())).status, 200); const r = await row(); assert.equal(r.transcriptStatus, 'done'); assert.equal(r.transcriptRuns, 1); assert.equal(await db.shanaiUsageLog.count(), 1); assert.equal(sends, 1); });
  await check('known legacy job resumes without measuring or submitting again', async () => { await voice('processing', 'legacy-job'); assert.equal((await route.POST(null, ctx())).status, 200); assert.equal(inspections, 0); assert.equal(sends, 0); assert.equal((await row()).transcriptStatus, 'done'); });
  await check('old poll completion cannot overwrite replacement transcript', async () => { await voice('processing', 'old-job'); const entered = deferred(), finish = deferred(); pollAction = () => { entered.resolve(); return finish.promise; }; const pending = route.POST(null, ctx()); await entered.promise; const replacement = await replace(); finish.resolve(oldResult); const r = await pending; assert.equal(replacement.status, 200); assert.equal(r.status, 409); const current = await row(); assert.equal(current.audioPath, newAudio); assert.equal(current.transcriptStatus, 'none'); assert.equal(current.transcriptSegments, null); });
  await check('late job callback never attaches old job to replacement audio', async () => { const entered = deferred(), proceed = deferred(); sendAction = async options => { await options.onBeforeSubmit?.(); entered.resolve(); await proceed.promise; await options.onJobSubmitted('old-job'); return oldResult; }; const pending = route.POST(null, ctx()); await entered.promise; const replacement = await replace(); proceed.resolve(); const r = await pending; assert.equal(replacement.status, 200); assert.equal(r.status, 409); assert.equal((await row()).transcriptJobId, null); assert.equal((await row()).audioPath, newAudio); });
  await check('old terminal error never marks replacement audio failed', async () => { await voice('processing', 'old-job'); const entered = deferred(), finish = deferred(); pollAction = () => { entered.resolve(); return finish.promise; }; const pending = route.POST(null, ctx()); await entered.promise; await replace(); finish.reject(new TerminalError('Synthetic old terminal error')); assert.equal((await pending).status, 409); assert.equal((await row()).transcriptStatus, 'none'); });
  await check('replacement clears old duration while same-path retry preserves it', async () => { await voice('done', 'old-job'); assert.equal((await replace(oldAudio)).status, 200); assert.equal((await row()).audioDurationSec, 60); assert.equal((await row()).transcriptStatus, 'done'); assert.equal((await replace()).status, 200); assert.equal((await row()).audioDurationSec, null); });
  await check('two requests during URL preparation invoke one submitter', async () => { const entered = deferred(), proceed = deferred(); let invocations = 0; sendAction = async options => { if (++invocations === 1) { entered.resolve(); await proceed.promise; } await options.onBeforeSubmit?.(); sends++; await options.onJobSubmitted('job-' + sends); return oldResult; }; const a = route.POST(null, ctx()); await entered.promise; const b = await route.POST(null, ctx()); const body = await b.json(); proceed.resolve(); await a; assert.equal(invocations, 1); assert.equal(sends, 1); assert.equal(body.pending, true); assert.equal((await row()).transcriptRuns, 1); });
  await check('actual adapter sends one POST while first submit response is pending', async () => { const entered = deferred(), proceed = deferred(); providerFetch = async (endpoint, options = {}) => { if (options.method === 'POST') { const n = ++sends; if (n === 1) { entered.resolve(); await proceed.promise; } return Response.json({ id: 'transport-job-' + n }); } return Response.json({ status: 'completed', text: 'SYNTHETIC', utterances: [{ start: 0, end: 1000, text: 'SYNTHETIC' }] }); }; const actual = runtime(true); const a = actual.POST(null, ctx()); await entered.promise; const b = await actual.POST(null, ctx()); const body = await b.json(); proceed.resolve(); await a; assert.equal(body.pending, true); assert.equal(sends, 1); assert.equal((await row()).transcriptRuns, 1); });
  await check('post-submit connection uncertainty never automatically resends', async () => { providerFetch = async () => { sends++; throw Error('Synthetic connection loss after acceptance'); }; const actual = runtime(true); const a = await actual.POST(null, ctx()), b = await actual.POST(null, ctx()); assert.equal(a.status, 409); assert.equal(b.status, 409); assert.equal(sends, 1); assert.equal((await row()).transcriptStatus, 'uncertain'); assert.equal((await row()).transcriptRuns, 1); });
  await check('accepted response without an ID remains uncertain without resubmission', async () => { providerFetch = async () => { sends++; return Response.json({}); }; const actual = runtime(true); assert.equal((await actual.POST(null, ctx())).status, 409); assert.equal((await actual.POST(null, ctx())).status, 409); assert.equal(sends, 1); });
  await check('oversized submit response does not turn into a second chargeable request', async () => { providerFetch = async () => { sends++; return new Response('{}', { headers: { 'Content-Length': '99999999' } }); }; const actual = runtime(true); assert.equal((await actual.POST(null, ctx())).status, 409); assert.equal((await actual.POST(null, ctx())).status, 409); assert.equal(sends, 1); });
  await check('failure before POST safely retries the same reserved run', async () => { sendAction = async () => { throw Error('Synthetic signing failure before POST'); }; assert.equal((await route.POST(null, ctx())).status, 500); sendAction = async options => { await options.onBeforeSubmit?.(); sends++; await options.onJobSubmitted('recovered-job'); return oldResult; }; assert.equal((await route.POST(null, ctx())).status, 200); assert.equal(sends, 1); assert.equal((await row()).transcriptRuns, 1); assert.equal(await db.shanaiUsageLog.count(), 1); });
  await check('expired preparation changes execution token without another run', async () => { const old = await prepare(); const record = (await attemptRows())[0], value = JSON.parse(record.value); value.expiresAt = 0; await db.systemSetting.update({ where: { key: record.key }, data: { value: JSON.stringify(value) } }); const next = await access.reserveTranscript(owner, id, { audioPath: oldAudio, durationSec: null }); assert(next.ok && next.context); assert.notEqual(next.context.token, old.token); await assert.rejects(() => attempt.authorizeTranscriptSubmission(old)); assert.equal((await row()).transcriptRuns, 1); await attempt.authorizeTranscriptSubmission(next.context); });
  await check('actual adapter waits for async authorization before POST', async () => { const entered = deferred(), proceed = deferred(); const adapter = load('src/lib/interview/transcription.ts', { './storage': { getSignedFileUrl: async () => 'https://example.invalid/synthetic' } }); const pending = adapter.transcribeFromUrl({ storagePath: oldAudio, mimeType: 'audio/mpeg', fileSize: 100, onBeforeSubmit: async () => { entered.resolve(); await proceed.promise; } }); await entered.promise; const before = sends; proceed.resolve(); await pending; assert.equal(before, 0); assert.equal(sends, 1); });
  await check('known job resumes even when two-run limit has been reached', async () => { await voice('processing', 'legacy-job'); await db.shanaiInterview.update({ where: { id }, data: { transcriptRuns: 2 } }); assert.equal((await route.POST(null, ctx())).status, 200); assert.equal(sends, 0); assert.equal((await row()).transcriptRuns, 2); });
  await check('legacy processing without a saved job ID fails closed', async () => { await voice('processing'); await db.shanaiInterview.update({ where: { id }, data: { transcriptRuns: 1 } }); const r = await route.POST(null, ctx()); assert.equal(r.status, 409); assert.equal(sends, 0); assert.equal(inspections, 0); assert.equal((await row()).transcriptRuns, 1); });
  await check('attempt persistence failure rolls quota and run reservation back', async () => { await db.$executeRawUnsafe("CREATE OR REPLACE FUNCTION synthetic_attempt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic attempt persistence outage'; END $$"); await db.$executeRawUnsafe('CREATE TRIGGER synthetic_attempt_failure BEFORE INSERT ON "SystemSetting" FOR EACH ROW EXECUTE FUNCTION synthetic_attempt_failure()'); const r = await route.POST(null, ctx()); assert.equal(r.status, 500); assert.equal(sends, 0); assert.equal((await row()).transcriptRuns, 0); assert.equal(await db.shanaiUsageLog.count(), 0); });
  await check('recording changed during duration inspection is never submitted', async () => { const entered = deferred(), proceed = deferred(); inspectAction = async () => { entered.resolve(); await proceed.promise; return 60; }; const pending = route.POST(null, ctx()); await entered.promise; await replace(); proceed.resolve(); const r = await pending; assert.equal(r.status, 409); assert.equal(sends, 0); assert.equal((await row()).transcriptRuns, 0); });
  await check('another owner cannot reserve or submit transcription', async () => { user = 'other-owner'; assert.equal((await route.POST(null, ctx())).status, 404); assert.equal(sends, 0); assert.equal(await db.shanaiUsageLog.count(), 0); });
  await check('parent deletion retires in-flight completion and clears attempts', async () => { await voice('processing', 'old-job'); const entered = deferred(), finish = deferred(); pollAction = () => { entered.resolve(); return finish.promise; }; const pending = route.POST(null, ctx()); await entered.promise; const before = (await attemptRows()).length; await interview.DELETE(null, ctx()); finish.resolve(oldResult); const r = await pending; assert(before > 0); assert.equal(r.status, 409); assert.equal((await attemptRows()).length, 0); assert.equal(await db.shanaiInterview.count(), 0); });
  await check('job ID persistence failure leaves an uncertain single submission', async () => { await db.$executeRawUnsafe("CREATE OR REPLACE FUNCTION synthetic_attempt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.key LIKE 'shanai-transcription-attempt:v1:%' THEN IF NEW.value::jsonb->>'phase' = 'polling' THEN RAISE EXCEPTION 'synthetic job persistence outage'; END IF; END IF; RETURN NEW; END $$"); await db.$executeRawUnsafe('CREATE TRIGGER synthetic_attempt_failure BEFORE INSERT OR UPDATE ON "SystemSetting" FOR EACH ROW EXECUTE FUNCTION synthetic_attempt_failure()'); assert.equal((await route.POST(null, ctx())).status, 409); assert.equal((await route.POST(null, ctx())).status, 409); assert.equal(sends, 1); assert.equal((await row()).transcriptStatus, 'uncertain'); });
  await check('poll timeout resumes saved job in another route instance without resubmitting', async () => { sendAction = async options => { await options.onBeforeSubmit?.(); sends++; await options.onJobSubmitted('durable-job'); throw Error('Synthetic polling timeout'); }; const first = await route.POST(null, ctx()); assert.equal((await first.json()).pending, true); await db.shanaiInterview.update({ where: { id }, data: { transcriptRuns: 2 } }); const cold = runtime(); assert.equal((await cold.POST(null, ctx())).status, 200); assert.equal(sends, 1); assert.equal((await row()).transcriptRuns, 2); assert.equal(await db.shanaiUsageLog.count(), 1); });
  await check('superseded same-path attempt cannot save success or failure', async () => { const first = await prepare(); await attempt.authorizeTranscriptSubmission(first); await attempt.rememberTranscriptJob(first, 'first-job'); await attempt.failTranscriptAttempt(first, true, 'Synthetic terminal'); const next = await access.reserveTranscript(owner, id, { audioPath: oldAudio, durationSec: 60 }); assert(next.ok && next.context); assert.notEqual(first.token, next.context.token); assert.equal(await attempt.completeTranscriptAttempt(first, 'first-job', oldResult.segments), 'stale'); assert.equal(await attempt.failTranscriptAttempt(first, true, 'Late old error'), 'stale'); assert.equal((await row()).transcriptStatus, 'processing'); assert.equal((await row()).transcriptRuns, 2); });
  await check('terminal and transient poll interleaving never starts an automatic new job', async () => { await voice('processing', 'old-job'); const firstEntered = deferred(), bothEntered = deferred(), a = deferred(), b = deferred(); let polls = 0; pollAction = () => { if (++polls === 1) firstEntered.resolve(); if (polls === 2) bothEntered.resolve(); return polls === 1 ? a.promise : b.promise; }; const one = route.POST(null, ctx()); await firstEntered.promise; const two = route.POST(null, ctx()); await bothEntered.promise; a.reject(new TerminalError('Synthetic terminal')); const r1 = await one; b.reject(Error('Synthetic late transient')); const r2 = await two; assert.equal(r1.status, 422); assert.equal(r2.status, 500); assert.equal(sends, 0); });
  await check('quota denial does not create an attempt or invoke provider', async () => { quotaAllowed = false; const r = await access.reserveTranscript(owner, id, { audioPath: oldAudio, durationSec: 60 }); assert.equal(r.ok, false); assert(r.quota); assert.equal((await attemptRows()).length, 0); assert.equal((await row()).transcriptRuns, 0); assert.equal(sends, 0); });
  await check('corrupt durable attempt never falls back to a new submission', async () => { await prepare(); const record = (await attemptRows())[0]; await db.systemSetting.update({ where: { key: record.key }, data: { value: 'invalid synthetic JSON' } }); assert.equal((await route.POST(null, ctx())).status, 500); assert.equal(sends, 0); assert.equal((await row()).transcriptRuns, 1); });
  await check('actual adapter rejects stale execution before any HTTP POST', async () => { const old = await prepare(); const record = (await attemptRows())[0], value = JSON.parse(record.value); value.expiresAt = 0; await db.systemSetting.update({ where: { key: record.key }, data: { value: JSON.stringify(value) } }); await access.reserveTranscript(owner, id, { audioPath: oldAudio, durationSec: null }); const adapter = load('src/lib/interview/transcription.ts', { './storage': { getSignedFileUrl: async () => 'https://example.invalid/synthetic' } }); await assert.rejects(() => adapter.transcribeFromUrl({ storagePath: oldAudio, mimeType: 'audio/mpeg', fileSize: 100, onBeforeSubmit: () => attempt.authorizeTranscriptSubmission(old) })); assert.equal(sends, 0); });
  await check('anonymous transcription does not inspect or reserve or submit', async () => { user = null; assert.equal((await route.POST(null, ctx())).status, 401); assert.equal(inspections, 0); assert.equal(sends, 0); assert.equal(await db.shanaiUsageLog.count(), 0); });
})().catch(error => { results.push({ name: 'harness', passed: false, error: error.message.slice(0, 400) }); }).finally(async () => {
  await db.$disconnect(); const report = { root, expectedCases: EXPECTED_CASES, complete: results.length === EXPECTED_CASES, passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, results,
    scope: 'Actual route, access/reservation, durable attempt/purge helpers and selected actual adapter cases with real Prisma/isolated PostgreSQL and four minimal DMMF tables. Auth quota tier/result, duration inspector, Storage and provider fetch/poll boundaries synthetic; deferred promises control races. No real provider/production DB/media/browser/charging verification.' };
  const out = process.env.DOYA_SHANAI_TRANSCRIPT_PG_OUTPUT || path.join(root, 'docs/audits/2026-10-06-all-services-recheck/shanai-transcription-postgres-results.json'); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ expectedCases: report.expectedCases, complete: report.complete, passed: report.passed, failed: report.failed })); clearTimeout(watchdog); if (report.failed || !report.complete) process.exitCode = 1;
});

