// A storage outage must not be represented as a successful empty interview list.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');

function route(file, unavailable) {
  const exports = {};
  const prisma = {
    interviewProject: { findMany: async () => [], count: async () => 0, groupBy: async () => [] },
    interviewRecipe: { count: async () => 0, findMany: async () => [] },
  };
  const mocks = {
    'next/server': { NextResponse: { json: (body, opts) => ({ body, status: opts?.status ?? 200 }) } },
    '@/lib/prisma': { prisma },
    '@/lib/interview/access': {
      requireDatabase: () => unavailable ? { body: { success: false, code: 'NO_DATABASE' }, status: 503 } : null,
      getInterviewUser: async () => ({ userId: 'test-user' }),
    },
    '@/lib/interview/recipes-seed': { PRESET_RECIPES: [] },
  };
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, require: (name) => {
    if (!(name in mocks)) throw new Error(`Unexpected dependency: ${name}`);
    return mocks[name];
  }, process: { env: {} }, Date });
  return exports;
}

(async () => {
  for (const [file, key] of [
    ['src/app/api/interview/projects/route.ts', 'projects'],
    ['src/app/api/interview/recipes/route.ts', 'recipes'],
  ]) {
    const outage = await route(file, true).GET({});
    assert.equal(outage.status, 503);
    assert.equal(outage.body.success, false);
    const empty = await route(file, false).GET({ nextUrl: new URL('https://test.example/api/interview/projects') });
    assert.equal(empty.status, 200);
    assert.equal(empty.body.success, true);
    assert.equal(empty.body[key].length, 0);
    console.log(`PASS ${key}: outage 503 differs from valid empty 200`);
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
