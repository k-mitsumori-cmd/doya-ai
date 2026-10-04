const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

function fixture(failQuestion = false, organizationId = 'org-1') {
  let template = { id: 'template-1', organizationId: 'org-1', name: 'Original' };
  let questions = [{ text: 'Original question' }];
  let transactions = 0;
  const lazy = (work) => ({ then: (resolve, reject) => Promise.resolve().then(work).then(resolve, reject) });
  const prisma = {
    mensetsuTemplate: {
      findFirst: async ({ where }) => where.id === template.id && where.organizationId === template.organizationId ? { id: template.id } : null,
      update: ({ where, data }) => lazy(() => {
        if (where.id !== template.id || where.organizationId !== template.organizationId) throw new Error('foreign organization');
        template = { ...template, ...data };
        return template;
      }),
      findUnique: async () => ({ ...template, questions }),
    },
    mensetsuSession: { count: async () => 0 },
    mensetsuQuestion: {
      deleteMany: () => lazy(() => { questions = []; return { count: 1 }; }),
      create: ({ data }) => lazy(() => {
        if (failQuestion) throw new Error('question insert failed');
        questions.push({ text: data.text });
        return data;
      }),
    },
    $transaction: async (operations) => {
      transactions++;
      const beforeTemplate = { ...template };
      const beforeQuestions = questions.map((q) => ({ ...q }));
      try {
        for (const operation of operations) await operation;
      } catch (error) {
        template = beforeTemplate;
        questions = beforeQuestions;
        throw error;
      }
    },
  };
  const { PATCH } = load('src/app/api/mensetsu/templates/[id]/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/mensetsu/access': {
      getMensetsuContext: async () => ({ organizationId, role: 'manager' }),
      hasMinRole: () => true,
      orgSlugFrom: () => undefined,
    },
    '@/lib/mensetsu/guardrails': { findViolations: () => [] },
  });
  return {
    patch: (body) => PATCH({ json: async () => body }, { params: Promise.resolve({ id: template.id }) }),
    state: () => ({ template, questions, transactions }),
  };
}

(async () => {
  let f = fixture(true);
  await assert.rejects(f.patch({ name: 'Changed', questions: [{ text: 'New question' }] }), /question insert failed/);
  assert.equal(f.state().template.name, 'Original');
  assert.equal(f.state().questions[0].text, 'Original question');
  assert.equal(f.state().transactions, 1);

  f = fixture();
  const response = await f.patch({ name: 'Changed', questions: [{ text: 'New question' }] });
  assert.equal(response.status, 200);
  assert.equal(f.state().template.name, 'Changed');
  assert.equal(f.state().questions[0].text, 'New question');
  assert.equal(f.state().transactions, 1);

  f = fixture(false, 'foreign-org');
  const denied = await f.patch({ name: 'Changed', questions: [] });
  assert.equal(denied.status, 404);
  assert.equal(f.state().template.name, 'Original');
  assert.equal(f.state().transactions, 0);
  for (const sessions of [0, 2]) {
    let deletes = 0;
    const tx = { mensetsuTemplate: {
      findFirst: async () => ({ id: 'template-1', _count: { sessions } }),
      delete: async () => { deletes++; },
    } };
    const prisma = { $transaction: async (fn, options) => { assert.equal(options.isolationLevel, 'Serializable'); return fn(tx); } };
    const { DELETE } = load('src/app/api/mensetsu/templates/[id]/route.ts', {
      'next/server': { NextResponse: Response },
      '@/lib/prisma': { prisma },
      '@/lib/mensetsu/access': { getMensetsuContext: async () => ({ organizationId: 'org-1', role: 'admin' }), hasMinRole: () => true, orgSlugFrom: () => undefined },
      '@/lib/mensetsu/guardrails': { findViolations: () => [] },
    });
    const response = await DELETE({}, { params: Promise.resolve({ id: 'template-1' }) });
    assert.equal(response.status, sessions ? 409 : 200);
    assert.equal(deletes, sessions ? 0 : 1);
  }
  console.log('PASS mensetsu template: basic fields and replacement questions commit or roll back together');
})().catch((error) => { console.error(error); process.exitCode = 1; });
