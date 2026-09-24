const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

const projects = [];
let transactions = 0;
let lockTail = Promise.resolve();
const projectStore = {
  count: async () => projects.length,
  create: async ({ data }) => {
    const project = { id: `project-${projects.length + 1}`, ...data };
    projects.push(project);
    return project;
  },
};
const tx = { $queryRaw: async () => [{ id: 'user' }], doyaSlideProject: projectStore };
const prisma = {
  doyaSlideProject: projectStore,
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
const docTypes = [{ value: 'proposal', defaultCount: 10, defaultAspect: 'wide' }];
const route = load('src/app/api/doyaslide/projects/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma },
  '@/lib/doyaslide/access': { getUserId: async () => 'user' },
  '@/lib/doyaslide/limits': { getUserDoyaSlideLimits: async () => ({ maxProjects: 3 }) },
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
  for (const body of [null, { title: '   ' }, { title: 'Title', slideCount: '5' },
    { title: 'Title', customBrief: {} }, { title: 'Title', aspectRatio: 'toString' },
    { title: 'Title', stylePreset: 'unknown' }, { title: 'Title', themeColor: 'red' }]) {
    assert.equal((await post(body)).status, 400, JSON.stringify(body));
  }
  assert.equal(transactions, 0, 'invalid input must not acquire a DB lock');
  const responses = await Promise.all(Array.from({ length: 4 }, (_, i) => post({
    title: ` Project ${i + 1} `,
    docType: 'proposal',
    slideCount: 8,
    aspectRatio: 'wide',
    themeColor: '#2563eb',
    stylePreset: 'corporate',
  })));
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 201, 201, 403]);
  assert.equal(projects.length, 3, 'free users must not create a fourth project concurrently');
  assert.ok(projects.every((project) => project.title.startsWith('Project')));
  console.log('PASS DoyaSlide projects: invalid settings rejected and concurrent creation respects the free limit');
})().catch((error) => { console.error(error); process.exitCode = 1; });
