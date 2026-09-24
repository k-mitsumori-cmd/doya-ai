const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

let project = {
  id: 'project-1', userId: 'user-1', title: '提案資料', customBrief: null,
  docType: 'proposal', slideCount: 2, status: 'draft', updatedAt: new Date(0),
};
const slides = [];
let modelCalls = 0;
let modelResult = { slides: [{ headline: '表紙', visualPrompt: 'cover' }] };
let resumeModel;
let modelGate = null;
const matches = (where) => project && project.id === where.id
  && (!where.userId || project.userId === where.userId)
  && (!where.status || project.status === where.status)
  && (!where.updatedAt || project.updatedAt.getTime() === where.updatedAt.getTime())
  && (!where.slides || slides.length === 0);
const projectStore = {
  findFirst: async ({ where }) => matches(where) ? { ...project } : null,
  updateMany: async ({ where, data }) => {
    if (!matches(where)) return { count: 0 };
    project = { ...project, ...data, updatedAt: data.updatedAt || new Date() };
    return { count: 1 };
  },
  update: async ({ data }) => { project = { ...project, ...data, updatedAt: new Date() }; return project; },
};
const slideStore = {
  count: async () => slides.length,
  createMany: async ({ data }) => { slides.push(...data); return { count: data.length }; },
  findMany: async () => [...slides],
};
const tx = { doyaSlideProject: projectStore, doyaSlideSlide: slideStore };
const prisma = { ...tx, $transaction: async (operation) => operation(tx) };
const route = load('src/app/api/doyaslide/structure/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma },
  '@seo/lib/gemini': {
    GEMINI_TEXT_MODEL_DEFAULT: 'test',
    geminiGenerateJson: async () => {
      modelCalls++;
      if (modelGate) await modelGate;
      return modelResult;
    },
  },
  '@/lib/doyaslide/access': { getUserId: async () => 'user-1' },
  '@/lib/doyaslide/prompts': { buildStructurePrompt: () => 'prompt' },
  '@/lib/doyaslide/scrape': { scrapeUrlText: async () => ({ title: '', text: '' }) },
  '@seo/lib/serpapi': { hasSerpApiKey: () => false },
  '@/lib/doyaslide/errors': { errorSuffix: () => '' },
});
const post = (body) => route.POST({ json: async () => body });

(async () => {
  for (const bad of [null, [], {}, { projectId: 1 }, { projectId: 'project-1', referenceText: {} },
    { projectId: 'project-1', referenceUrl: 4 }]) {
    assert.equal((await post(bad)).status, 400);
  }
  assert.equal(modelCalls, 0);

  modelGate = new Promise((resolve) => { resumeModel = resolve; });
  const first = post({ projectId: 'project-1' });
  while (modelCalls === 0) await new Promise((resolve) => setImmediate(resolve));
  assert.equal((await post({ projectId: 'project-1' })).status, 409, 'concurrent structure request must not run paid AI again');
  assert.equal(modelCalls, 1);
  resumeModel();
  assert.equal((await first).status, 200);
  assert.equal(slides.length, 1);
  assert.equal(project.status, 'structured');
  const saved = structuredClone(slides);
  assert.equal((await post({ projectId: 'project-1' })).status, 409, 'replay must preserve existing slides');
  assert.deepEqual(structuredClone(slides), saved);
  assert.equal(modelCalls, 1);

  slides.length = 0;
  project = { ...project, status: 'error', updatedAt: new Date() };
  modelGate = null;
  modelResult = { slides: [] };
  assert.equal((await post({ projectId: 'project-1' })).status, 502);
  assert.equal(project.status, 'error', 'failed model response must release the claim for retry');
  modelResult = { slides: [{ headline: '再試行' }] };
  assert.equal((await post({ projectId: 'project-1' })).status, 200);
  assert.equal(slides.length, 1);
  console.log('PASS DoyaSlide structure: input validation, one active claim, no replay deletion, retry after failure');
})().catch((error) => { console.error(error); process.exitCode = 1; });
