// 見積書 → ドヤスライド の引き渡し（POST /api/doyaslide/projects/from-quote）の回帰確認
const assert = require('node:assert/strict');
const { z } = require('zod');
const { load, check } = require('./load-typescript.cjs');

const ORG_A = 'org-a';
const ORG_B = 'org-b';
const DOC_A = 'cdocaaaaaaaaaaaaaaaaaaaaa1';
const DOC_B = 'cdocbbbbbbbbbbbbbbbbbbbbb2';
const DOC_DRAFT = 'cdocdraftdraftdraftdraft03';
const CLIENT = '株式会社テスト商事';
const members = [
  { organizationId: ORG_A, userId: 'user-a', status: 'ACTIVE', role: 'member' },
  { organizationId: ORG_A, userId: 'user-invited', status: 'INVITED', role: 'member' },
  { organizationId: ORG_B, userId: 'user-b', status: 'ACTIVE', role: 'owner' },
];
const items = [
  { ord: 2, itemName: '運用', qty: 1, unit: '式', unitPrice: 123456, notes: 'x' },
  { ord: 1, itemName: '設計', qty: 3, unit: '人日', unitPrice: 80000 },
];
const docs = [
  { id: DOC_A, organizationId: ORG_A, title: '2026年度 広告運用の見積', clientCompany: CLIENT, status: 'confirmed', totalExclTax: 543456, totalInclTax: 597801, notes: 'SECRET-NOTES', confirmedBy: 'SECRET-CONFIRMER', lineItems: items },
  { id: DOC_B, organizationId: ORG_B, title: '他社の見積', clientCompany: '他社', status: 'sent', totalExclTax: 1, totalInclTax: 1, lineItems: [] },
  { id: DOC_DRAFT, organizationId: ORG_A, title: '下書きの見積', clientCompany: CLIENT, status: 'draft', totalExclTax: 543456, totalInclTax: 597801, lineItems: items },
];

const counters = { gemini: 0, serp: 0, scrape: 0, charge: 0 };
const queries = [];
const projects = [];
const slides = [];
let currentUser = 'user-a';
let ledger = null;

// quoteDocument.findFirst の where を、実際のDBと同じ意味で評価する簡易版
const quoteFindArgs = [];
const quoteDocument = {
  findFirst: async (args) => {
    quoteFindArgs.push(args);
    const { where, select } = args;
    const some = where.organization?.members?.some;
    const hit = docs.find((d) => d.id === where.id && some
      && members.some((m) => m.organizationId === d.organizationId && m.userId === some.userId
        && m.status === some.status && some.role.in.includes(m.role)));
    if (!hit) return null;
    const out = {};
    for (const key of Object.keys(select)) {
      if (key === 'lineItems') {
        out.lineItems = [...hit.lineItems].sort((a, b) => a.ord - b.ord)
          .map((li) => Object.fromEntries(Object.keys(select.lineItems.select).map((k) => [k, li[k]])));
      } else out[key] = hit[key];
    }
    return out;
  },
};
const matches = (project, where) => project.id === where.id
  && (!where.userId || project.userId === where.userId)
  && (!where.status || project.status === where.status)
  && (!where.updatedAt || project.updatedAt.getTime() === where.updatedAt.getTime())
  && (!where.slides || slides.filter((s) => s.projectId === project.id).length === 0);
const projectStore = {
  count: async ({ where }) => projects.filter((p) => p.userId === where.userId && p.createdAt >= where.createdAt.gte).length,
  create: async ({ data }) => {
    const project = { id: `project-${projects.length + 1}`, createdAt: new Date(), updatedAt: new Date(0), ...data };
    projects.push(project);
    return project;
  },
  findFirst: async ({ where }) => projects.map((p) => ({ ...p })).find((p) => matches(p, where)) || null,
  updateMany: async ({ where, data }) => {
    const p = projects.find((x) => matches(x, where));
    if (!p) return { count: 0 };
    Object.assign(p, data, { updatedAt: data.updatedAt || new Date() });
    return { count: 1 };
  },
  update: async ({ where, data }) => { const p = projects.find((x) => x.id === where.id); Object.assign(p, data, { updatedAt: new Date() }); return p; },
};
const slideStore = {
  count: async ({ where }) => slides.filter((s) => s.projectId === where.projectId).length,
  createMany: async ({ data }) => { slides.push(...data); return { count: data.length }; },
  findMany: async ({ where }) => slides.filter((s) => s.projectId === where.projectId),
};
const subscriptionStore = {
  findUnique: async () => ledger,
  upsert: async ({ create, update }) => { ledger = ledger ? { ...ledger, ...update } : create; return ledger; },
};
const tx = {
  $queryRaw: async () => [{ id: 'user' }],
  doyaSlideProject: projectStore, doyaSlideSlide: slideStore, userServiceSubscription: subscriptionStore,
};
const prisma = { ...tx, quoteDocument, $transaction: async (operation) => operation(tx) };

const limits = load('src/lib/doyaslide/limits.ts', {
  '@/lib/prisma': { prisma },
  '@/lib/plan-utils': { tierFrom: () => 'FREE' },
  '@/lib/pricing': { SUPPORT_CONTACT_URL: 'https://example.invalid/contact' },
});
let maxProjects = 3;
const createProject = load('src/lib/doyaslide/create-project.ts', { '@/lib/prisma': { prisma }, '@/lib/doyaslide/limits': limits });
const quoteTypes = load('src/lib/quote/types.ts');
const quoteAccess = load('src/lib/quote/access.ts', {
  'next-auth': { getServerSession: async () => null },
  '@/lib/auth': { authOptions: {} },
  '@/lib/prisma': { prisma },
  './types': quoteTypes,
});
const constants = load('src/lib/doyaslide/constants.ts');
let flagOn = true;
let flagReads = 0;
const route = load('src/app/api/doyaslide/projects/from-quote/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/doyaslide/access': { getUserId: async () => currentUser },
  '@/lib/doyaslide/limits': { ...limits, getUserDoyaSlideLimits: async () => ({ maxProjects }) },
  '@/lib/doyaslide/create-project': createProject,
  '@/lib/doyaslide/constants': constants,
  '@/lib/quote/access': quoteAccess,
  '@/lib/notice/flag': { isGuidePopupsEnabled: async () => { flagReads++; return flagOn; } },
  '@/lib/doyaslide/errors': { errorSuffix: () => '' },
});
const structure = load('src/app/api/doyaslide/structure/route.ts', {
  'next/server': { NextResponse: Response },
  zod: { z },
  '@/lib/prisma': { prisma },
  '@seo/lib/gemini': {
    GEMINI_TEXT_MODEL_DEFAULT: 'test',
    geminiGenerateJson: async () => { counters.gemini++; return { slides: Array.from({ length: 10 }, (_, i) => i + 1).map((n) => ({ role: '本文', headline: `h${n}`, subText: 's', visualPrompt: 'v' })) }; },
  },
  '@/lib/doyaslide/access': { getUserId: async () => currentUser },
  '@/lib/doyaslide/text-budget': { reserveDoyaSlideTextCall: async () => {}, DoyaSlideTextLimitError: class extends Error {} },
  '@/lib/doyaslide/prompts': { buildStructurePrompt: () => 'prompt' },
  '@/lib/doyaslide/scrape': { scrapeUrlText: async () => { counters.scrape++; return { title: '', text: '' }; } },
  '@seo/lib/serpapi': {
    hasSerpApiKey: () => true,
    serpapiSearchGoogle: async ({ query }) => { counters.serp++; queries.push(query); return { organic: [] }; },
  },
  '@/lib/doyaslide/errors': { errorSuffix: () => '' },
  '@/lib/doya-power/charge': { withDoyaPowerCharge: (_spec, handler) => handler },
});
const post = (body) => route.POST({ json: async () => body });
const noExternalCalls = () => assert.deepEqual(counters, { gemini: 0, serp: 0, scrape: 0, charge: 0 });

(async () => {
  await check('flag off: 404 before reading the body, session, or quote', async () => {
    flagOn = false;
    let bodyRead = false;
    const res = await route.POST({ json: async () => { bodyRead = true; return { kind: 'quote', id: DOC_A }; } });
    assert.equal(res.status, 404);
    assert.equal(bodyRead, false);
    assert.equal(quoteFindArgs.length, 0);
    assert.equal(projects.length, 0);
    flagOn = true;
  });

  await check('bad kind or id: 400 and no quote read', async () => {
    for (const body of [null, [], {}, { kind: 'quote' }, { id: DOC_A }, { kind: 'quote', id: 5 },
      { kind: 'unknown', id: DOC_A }, { kind: 'quote', id: 'short' }, { kind: 'quote', id: `${DOC_A}../x` },
      { kind: 'quote', id: { in: [DOC_A] } }, { kind: 'quote', id: 'a'.repeat(41) },
      { kind: 'persona', id: DOC_A }, { kind: 'seo', id: DOC_A }]) {
      assert.equal((await post(body)).status, 400, JSON.stringify(body));
    }
    assert.equal(quoteFindArgs.length, 0, 'invalid input must not reach the database');
    assert.equal(projects.length, 0);
  });

  await check('other org / INVITED / missing: same 404 and message, no project, no external calls', async () => {
    const seen = [];
    for (const [user, id] of [['user-a', DOC_B], ['user-invited', DOC_A], ['user-b', DOC_A], ['user-a', 'cnotexistnotexistnotexist']]) {
      currentUser = user;
      const res = await post({ kind: 'quote', id });
      assert.equal(res.status, 404, `${user} ${id}`);
      seen.push(JSON.stringify(await res.json()));
    }
    assert.equal(new Set(seen).size, 1, 'all denials must look the same');
    assert.equal(projects.length, 0);
    assert.equal(ledger, null);
    noExternalCalls();
  });

  await check('query: where has both the id and the ACTIVE membership; select excludes secrets', async () => {
    currentUser = 'user-a';
    const before = quoteFindArgs.length;
    assert.equal((await post({ kind: 'quote', id: DOC_A })).status, 201);
    assert.equal(quoteFindArgs.length, before + 1, 'exactly one query');
    const { where, select } = quoteFindArgs[before];
    assert.equal(where.id, DOC_A);
    const some = where.organization.members.some;
    assert.equal(some.userId, 'user-a');
    assert.equal(some.status, 'ACTIVE');
    assert.ok(Array.isArray(some.role.in) && some.role.in.length > 0);
    assert.deepEqual(Object.keys(select).sort(), ['clientCompany', 'lineItems', 'status', 'title', 'totalExclTax', 'totalInclTax']);
    assert.deepEqual(Object.keys(select.lineItems.select).sort(), ['itemName', 'qty', 'unit', 'unitPrice']);
    assert.equal(JSON.stringify(select.lineItems.orderBy), '{"ord":"asc"}');
    const json = JSON.stringify(select);
    for (const word of ['issuer', 'invoiceNo', 'seal', 'confirmedBy', 'notes']) assert.ok(!json.includes(word), word);
    const stored = JSON.stringify(projects[projects.length - 1]);
    assert.ok(!stored.includes('SECRET'), 'secrets must not reach the project');
  });

  await check('client title/href are ignored; title is the server title without the client name', async () => {
    currentUser = 'user-a';
    const res = await post({ kind: 'quote', id: DOC_A, title: '改ざんタイトル', href: 'https://evil.invalid/x', referenceUrl: 'https://evil.invalid/y', customBrief: 'x' });
    assert.equal(res.status, 201);
    const project = projects[projects.length - 1];
    assert.equal(project.title, '2026年度 広告運用の見積');
    assert.ok(!project.title.includes(CLIENT));
    const stored = JSON.stringify(project);
    assert.ok(!stored.includes('evil.invalid') && !stored.includes('改ざん'));
    assert.deepEqual(Object.keys(await res.json()), ['projectId']);
    assert.ok(project.customBrief.startsWith('［見積書から作成］'));
    assert.ok(project.customBrief.indexOf('設計') < project.customBrief.indexOf('運用'), 'lines are in ord order');
    noExternalCalls();
  });

  await check('draft quote: every amount is labeled 未確定; confirmed quote is not', async () => {
    const draft = await post({ kind: 'quote', id: DOC_DRAFT });
    assert.equal(draft.status, 201);
    const brief = projects[projects.length - 1].customBrief;
    const amountLines = brief.split('\n').filter((l) => /円/.test(l));
    assert.ok(amountLines.length >= 4);
    for (const line of amountLines) assert.ok(line.includes('未確定'), line);
    const confirmed = projects.find((p) => p.title === '2026年度 広告運用の見積').customBrief;
    assert.ok(!confirmed.includes('未確定'));
  });

  await check('structure: quote-made project never reaches web search; normal project still does', async () => {
    const quoteProject = projects.find((p) => p.title === '下書きの見積');
    currentUser = 'user-a';
    const res = await structure.POST({ json: async () => ({ projectId: quoteProject.id }) });
    assert.equal(res.status, 200);
    assert.equal(counters.serp, 0, 'no SerpAPI call for a quote project');
    assert.equal(counters.gemini, 1);
    // 目印を持たない資料は、これまでどおり検索する（この確認が空振りしないことの裏付け）
    const normal = await prisma.doyaSlideProject.create({ data: { userId: 'user-a', title: '通常の資料', docType: 'proposal', customBrief: CLIENT, slideCount: 10, status: 'draft' } });
    assert.equal((await structure.POST({ json: async () => ({ projectId: normal.id }) })).status, 200);
    assert.equal(counters.serp, 1);
    assert.equal(queries.length, 1);
    for (const q of queries) assert.ok(!/543456|597801|123456|80000/.test(q));
  });

  await check('limit: reached limit returns 403 and creates nothing; route never charges or calls AI', async () => {
    const used = projects.length;
    maxProjects = used;
    currentUser = 'user-a';
    const res = await post({ kind: 'quote', id: DOC_A });
    assert.equal(res.status, 403);
    assert.equal((await res.json()).code, 'LIMIT_REACHED');
    assert.equal(projects.length, used);
    maxProjects = 3;
    const fs = require('node:fs');
    const source = fs.readFileSync('src/app/api/doyaslide/projects/from-quote/route.ts', 'utf8');
    assert.ok(!/doya-power|gemini|serpapi|fetch\(|scrape/i.test(source), 'route must not charge or call external services');
    assert.ok(!/getQuoteContext/.test(source), 'must use loadQuoteForHandoff, not slug-less getQuoteContext');
  });
})().catch((error) => { console.error(error); process.exitCode = 1; });
