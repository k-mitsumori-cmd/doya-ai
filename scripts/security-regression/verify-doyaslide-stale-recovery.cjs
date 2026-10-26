// ドヤスライドの止まった資料を、読むときに操作できる状態へ戻す（統括の指摘 2026-10-26）の回帰確認
// - 構成中のまま 6 分を超え、スライドが 0 枚 → error。6 分の内は触らない
// - 生成中で操作の記録がある → 15 分を過ぎたら expire() と同じく閉じる（記録・目印・資料・スライドを片づける）。15 分の内は触らない
// - 操作の記録が無いまま止まったもの（LEGACY_UNCONFIRMED） → 15 分を過ぎたら、絵のあるスライドは done、無いものは error
// - 一覧と詳細の GET が戻す部品を呼ぶ、一覧に「もう一度」、見積書から来た下書きは構成を先に作る、/home/roles の 404 の題
// git・docs・reference を読まない。DB・課金・外部 API には触れない（メモリの中の表だけ）。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { load, check } = require('./load-typescript.cjs');

const root = path.resolve(__dirname, '../..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const digest = (v) => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const MIN = 60 * 1000;
const ACTOR = 'user_a';

let projects, slides, settings;
function reset() { projects = []; slides = []; settings = new Map(); }
function matches(row, where = {}) {
  return Object.entries(where).every(([k, v]) => {
    if (k === 'slides') return v.none ? !slides.some((s) => s.projectId === row.id) : true;
    if (v instanceof Date) return row[k] instanceof Date && row[k].getTime() === v.getTime();
    if (v && typeof v === 'object' && 'not' in v) return row[k] !== v.not;
    if (v && typeof v === 'object' && 'in' in v) return v.in.includes(row[k]);
    return row[k] === v;
  });
}
const tx = {
  $queryRaw: async (strings, ...values) => {
    const sql = strings.join('?');
    if (sql.includes('"User"')) return values[0] === ACTOR ? [{ id: ACTOR, plan: 'FREE' }] : [];
    return projects.filter((p) => p.id === values[0] && p.userId === values[1]).map((p) => ({ id: p.id }));
  },
  doyaSlideProject: {
    findFirst: async ({ where }) => {
      const p = projects.find((row) => matches(row, where));
      return p ? { ...p, _count: { slides: slides.filter((s) => s.projectId === p.id).length } } : null;
    },
    update: async ({ where, data }) => { const p = projects.find((row) => row.id === where.id); Object.assign(p, data, { updatedAt: new Date() }); return p; },
    updateMany: async ({ where, data }) => {
      const hit = projects.filter((row) => matches(row, where));
      hit.forEach((p) => Object.assign(p, data, { updatedAt: new Date() }));
      return { count: hit.length };
    },
  },
  doyaSlideSlide: {
    count: async ({ where }) => slides.filter((s) => matches(s, where)).length,
    updateMany: async ({ where, data }) => { const hit = slides.filter((s) => matches(s, where)); hit.forEach((s) => Object.assign(s, data)); return { count: hit.length }; },
  },
  doyaSlideVersion: { findUnique: async () => null, findFirst: async () => null },
  userServiceSubscription: { findUnique: async () => null, update: async () => { throw Error('no refund expected'); } },
  systemSetting: {
    findUnique: async ({ where }) => (settings.has(where.key) ? { value: settings.get(where.key) } : null),
    upsert: async ({ where, create, update }) => { settings.set(where.key, settings.has(where.key) ? update.value : create.value); },
    deleteMany: async ({ where }) => { if (settings.get(where.key) === where.value) settings.delete(where.key); return { count: 1 }; },
  },
};
const db = { $transaction: async (fn) => fn(tx) };
const op = load('src/lib/doyaslide/generation-operation.ts', {
  'node:crypto': crypto,
  '@/lib/prisma': { prisma: db },
  '@/lib/plan-utils': { tierFrom: () => 'FREE' },
  './limits': { DOYASLIDE_LIMITS: {}, monthStart: (d) => d, isSameMonth: () => true },
});

function addProject(id, status, minutesAgo, extra = {}) {
  const p = { id, userId: ACTOR, status, updatedAt: new Date(Date.now() - minutesAgo * MIN), ...extra };
  projects.push(p);
  return p;
}
function addReceipt(projectId, minutesAgo) {
  const operationId = '11111111-1111-4111-8111-111111111111';
  const key = 'doyaslide-operation:v1:' + digest([ACTOR, projectId, 'batch', operationId]);
  const active = 'doyaslide-active:v1:' + digest([ACTOR, projectId]);
  const at = new Date(Date.now() - minutesAgo * MIN).toISOString();
  const receipt = { version: 1, actor: ACTOR, operationId, projectId, kind: 'batch', inputHash: digest(['batch', null, null, false]), phase: 'pending', startedAt: at, claimedAt: at, month: null, resetAt: null, reserved: 1, limit: -1, skipped: 0, deferred: 0, message: null, slots: [{ id: 's1', version: 1, imageUrl: null, visualPrompt: 'v', phase: 'pending', output: null }] };
  settings.set(key, JSON.stringify(receipt));
  settings.set(active, key);
  return { key, active, at };
}

(async () => {
  await check('structuring over 6 minutes with no slides becomes error; within 6 minutes stays', async () => {
    reset();
    const old = addProject('p_old', 'structuring', 7);
    const fresh = addProject('p_fresh', 'structuring', 3);
    assert.equal(op.isDoyaSlideStaleCandidate(old), true);
    assert.equal(op.isDoyaSlideStaleCandidate(fresh), false);
    assert.equal(await op.settleStaleDoyaSlideProject(ACTOR, 'p_old', db), 'structure');
    assert.equal(old.status, 'error');
    assert.equal(await op.settleStaleDoyaSlideProject(ACTOR, 'p_fresh', db), 'none');
    assert.equal(fresh.status, 'structuring');
  });

  await check('another user cannot settle a project they do not own', async () => {
    reset();
    const p = addProject('p_other', 'structuring', 30, { userId: 'user_b' });
    assert.equal(await op.settleStaleDoyaSlideProject(ACTOR, 'p_other', db), 'none');
    assert.equal(p.status, 'structuring');
  });

  await check('generating with a pending receipt: closed after 15 minutes like expire(); untouched within 15 minutes', async () => {
    reset();
    const { at } = addReceipt('p_live', 10);
    const live = addProject('p_live', 'generating', 0, { updatedAt: new Date(at) });
    slides.push({ id: 's1', projectId: 'p_live', version: 1, imageUrl: null, visualPrompt: 'v', status: 'generating' });
    assert.equal(await op.settleStaleDoyaSlideProject(ACTOR, 'p_live', db), 'none');
    assert.equal(live.status, 'generating');

    reset();
    const { key, active, at: oldAt } = addReceipt('p_stuck', 16);
    const stuck = addProject('p_stuck', 'generating', 0, { updatedAt: new Date(oldAt) });
    slides.push({ id: 's1', projectId: 'p_stuck', version: 1, imageUrl: null, visualPrompt: 'v', status: 'generating' });
    assert.equal(op.isDoyaSlideStaleCandidate(stuck), true);
    assert.equal(await op.settleStaleDoyaSlideProject(ACTOR, 'p_stuck', db), 'expired');
    assert.equal(stuck.status, 'error');
    assert.equal(slides[0].status, 'error');
    assert.equal(settings.has(active), false, 'the active pointer is removed');
    assert.equal(JSON.parse(settings.get(key)).phase, 'failed');
  });

  await check('legacy generating without a receipt: rescued after 15 minutes (images kept, others error)', async () => {
    reset();
    const p = addProject('p_legacy', 'generating', 16);
    slides.push({ id: 'a', projectId: 'p_legacy', imageUrl: 'https://x.invalid/a.png', status: 'generating' });
    slides.push({ id: 'b', projectId: 'p_legacy', imageUrl: null, status: 'generating' });
    assert.equal(await op.settleStaleDoyaSlideProject(ACTOR, 'p_legacy', db), 'legacy');
    assert.equal(p.status, 'completed');
    assert.deepEqual(slides.map((s) => s.status), ['done', 'error']);

    reset();
    const young = addProject('p_young', 'generating', 10);
    slides.push({ id: 'c', projectId: 'p_young', imageUrl: null, status: 'generating' });
    assert.equal(await op.settleStaleDoyaSlideProject(ACTOR, 'p_young', db), 'none');
    assert.equal(young.status, 'generating');
  });

  await check('legacy structuring with slides is rescued after 15 minutes; the message no longer says to contact support', async () => {
    reset();
    const p = addProject('p_ls', 'structuring', 16);
    slides.push({ id: 'd', projectId: 'p_ls', imageUrl: null, status: 'pending' });
    assert.equal(await op.settleStaleDoyaSlideProject(ACTOR, 'p_ls', db), 'legacy');
    assert.equal(p.status, 'error');
    const src = read('src/lib/doyaslide/generation-operation.ts');
    assert.match(src, /'LEGACY_UNCONFIRMED', '前の処理が止まったままです。15分ほどたってから/);
  });

  await check('GET list and detail settle stale projects; list shows もう一度; quote handoff draft builds the structure first', async () => {
    const list = read('src/app/api/doyaslide/projects/route.ts');
    assert.match(list, /filter\(\(row\) => isDoyaSlideStaleCandidate\(row\)\)/);
    assert.match(list, /settleStaleDoyaSlideProject\(userId, row\.id\)/);
    assert.match(list, /isDoyaSlideStaleCandidate\(row\)\)\.slice\(0, 5\)/, 'at most 5 per read');
    assert.doesNotMatch(list, /Promise\.all\(stale/, 'settle one at a time');
    const detail = read('src/app/api/doyaslide/projects/[id]/route.ts');
    assert.match(detail, /settleStaleDoyaSlideProject\(userId, project\.id\)/);
    const page = read('src/app/(shell)/doyaslide/projects/page.tsx');
    assert.match(page, /p\.status === 'error' && \(\s*<Link href=\{`\/doyaslide\/\$\{p\.id\}`\}/);
    assert.match(page, /もう一度/);
    const editor = read('src/app/(shell)/doyaslide/[id]/page.tsx');
    assert.match(editor, /if \(p\.status === 'draft' && p\.slides\.length === 0\) void retryStructure\(\)/);
    const suggest = read('src/components/notice/HandoffSuggest.tsx');
    // 同じ見積書の資料（200）を開くときは ?generate=1 を付けない（構成のある資料で絵の生成が自動で始まり、月の枠を使うため）
    assert.match(suggest, /res\.status === 201 \? slideProjectPath\(data\?\.projectId\) : res\.status === 200 \? slideProjectPath\(data\?\.projectId, false\)/);
    const artifacts = load('src/lib/notice/artifacts.ts');
    const id = 'c' + 'a'.repeat(24);
    assert.equal(artifacts.slideProjectPath(id), `/doyaslide/${id}?generate=1`);
    assert.equal(artifacts.slideProjectPath(id, false), `/doyaslide/${id}`);
  });

  await check('/home/roles: the tab title is the 404 title when the flag is off, without reading the session', async () => {
    const src = read('src/app/(shell)/home/roles/page.tsx');
    const meta = src.slice(src.indexOf('export async function generateMetadata'));
    assert.ok(meta.indexOf("if (companyRolesRollout() === 'off') return { title: NOT_FOUND_TITLE, robots }") > 0);
    assert.ok(meta.indexOf("=== 'off') return") < meta.indexOf('getServerSession('), 'off must return before reading the session');
    assert.doesNotMatch(src, /export const metadata/);
  });
})().catch((error) => { console.error(error); process.exitCode = 1; });
