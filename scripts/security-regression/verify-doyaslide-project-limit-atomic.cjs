const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

const projects = [];
let ledger = null;
let transactions = 0;
let lockTail = Promise.resolve();
const projectStore = {
  count: async ({ where }) => projects.filter((project) => project.createdAt >= where.createdAt.gte).length,
  create: async ({ data }) => {
    const project = { id: `project-${projects.length + 1}`, createdAt: new Date(), ...data };
    projects.push(project);
    return project;
  },
};
const subscriptionStore = {
  findUnique: async () => ledger,
  upsert: async ({ create, update }) => {
    ledger = ledger ? { ...ledger, ...update } : create;
    return ledger;
  },
};
const tx = { $queryRaw: async () => [{ id: 'user' }], doyaSlideProject: projectStore, userServiceSubscription: subscriptionStore };
const prisma = {
  doyaSlideProject: projectStore,
  userServiceSubscription: subscriptionStore,
  $transaction: async (operation) => {
    transactions++;
    const previous = lockTail;
    let unlock;
    lockTail = new Promise((resolve) => { unlock = resolve; });
    await previous;
    try { return await operation(tx); }
    finally { unlock(); }
  },
};
const limits = load('src/lib/doyaslide/limits.ts', {
  '@/lib/prisma': { prisma },
  '@/lib/plan-utils': { tierFrom: () => 'FREE' },
});
const docTypes = [{ value: 'proposal', defaultCount: 10, defaultAspect: 'wide' }];
const route = load('src/app/api/doyaslide/projects/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma },
  '@/lib/doyaslide/access': { getUserId: async () => 'user' },
  '@/lib/doyaslide/limits': { ...limits, getUserDoyaSlideLimits: async () => ({ maxProjects: 3 }) },
  '@/lib/doyaslide/constants': {
    DOC_TYPES: docTypes,
    getDocType: () => docTypes[0],
    ASPECT_TO_SIZE: { wide: '1536x1024', square: '1024x1024' },
    STYLE_PRESETS: [{ value: 'corporate' }],
    MIN_SLIDES: 1,
    MAX_SLIDES: 20,
  },
  '@/lib/doyaslide/errors': { errorSuffix: () => '' },
});
const post = (body) => route.POST({ json: async () => body });

(async () => {
  assert.equal(limits.monthStart(new Date('2026-09-30T15:00:00.000Z')).toISOString(), '2026-09-30T15:00:00.000Z');
  assert.equal(limits.isSameMonth(new Date('2026-09-30T14:59:59.999Z'), new Date('2026-09-30T15:00:00.000Z')), false);
  assert.equal(limits.isSameMonth(new Date('2026-12-31T14:59:59.999Z'), new Date('2026-12-31T15:00:00.000Z')), false);
  for (const body of [null, { title: '   ' }, { title: 'Title', slideCount: '5' },
    { title: 'Title', customBrief: {} }, { title: 'Title', aspectRatio: 'toString' },
    { title: 'Title', stylePreset: 'unknown' }, { title: 'Title', themeColor: 'red' }]) {
    assert.equal((await post(body)).status, 400, JSON.stringify(body));
  }
  assert.equal(transactions, 0, 'invalid input must not acquire a DB lock');
  projects.push({ id: 'old', createdAt: new Date(limits.monthStart().getTime() - 1) });
  const responses = await Promise.all(Array.from({ length: 4 }, (_, i) => post({
    title: ` Project ${i + 1} `,
    docType: 'proposal',
    slideCount: 8,
    aspectRatio: 'wide',
    themeColor: '#2563eb',
    stylePreset: 'corporate',
  })));
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 201, 201, 403]);
  assert.equal(projects.length, 4, 'an older project must not consume this month’s three slots');
  assert.ok(projects.filter((project) => project.title).every((project) => project.title.startsWith('Project')));
  assert.equal(await limits.countProjects('user'), 3);
  projects.splice(1, 3);
  assert.equal(await limits.countProjects('user'), 3, 'deletion must not restore this month’s used slots');
  assert.equal((await post({ title: 'Fifth' })).status, 403);
  console.log('PASS DoyaSlide projects: JST month, deleted-project ledger, and concurrent free limit');
})().catch((error) => { console.error(error); process.exitCode = 1; });
