const assert = require('node:assert/strict');
const { load, check, results } = require('./load-typescript.cjs');

function fixture({ conflicts = 0, used = 2, max = 3, member = true, otherError = false, actor = 'member' } = {}) {
  let attempts = 0;
  let writes = 0;
  let reads = 0;
  const tx = {
    promaneMember: {
      findFirst: async ({ where }) => {
        assert.equal(where.userId, actor);
        assert.equal(where.isActive, true);
        assert.deepEqual(Array.from(where.role.in), ['owner', 'admin', 'member']);
        return member ? { id: 'm' } : null;
      },
    },
    promaneProject: { create: async () => { writes++; return { id: 'p' }; } },
  };
  const prisma = {
    $transaction: async (fn, options) => {
      attempts++;
      assert.equal(options.isolationLevel, 'Serializable');
      if (otherError) throw Error('internal');
      if (attempts <= conflicts) throw { code: 'P2034' };
      return fn(tx);
    },
  };
  const actions = load('src/lib/promane/actions-projects.ts', {
    './time-input': load('src/lib/promane/time-input.ts'),
    '@/lib/prisma': { prisma },
    '@/lib/promane/auth': {
      requirePromaneAuthAction: async () => ({ userId: actor }),
      requireWritableWorkspace: async () => ({ id: 'w', userId: 'owner' }),
    },
    '@/lib/promane/limits': {
      getUserPromaneLimits: async (userId, db) => {
        assert.equal(userId, 'owner', 'the workspace owner pays for projects');
        assert.equal(db, tx);
        return { maxProjects: max };
      },
      countUserProjects: async (userId, db) => {
        assert.equal(userId, 'owner', 'invited workspaces do not consume the owner quota');
        assert.equal(db, tx);
        reads++;
        return used;
      },
    },
    'next/cache': { revalidatePath() {} },
  });
  return { run: () => actions.createProject('w', { name: 'P' }), state: () => ({ attempts, writes, reads }) };
}

(async () => {
  await check('project usage counts only workspaces owned by the paying user', async () => {
    const limits = load('src/lib/promane/limits.ts', {
      '@/lib/prisma': { prisma: {} },
      '@/lib/plan-utils': { tierFrom: () => 'FREE' },
    });
    const count = await limits.countUserProjects('owner', {
      promaneProject: {
        count: async ({ where }) => {
          assert.equal(where.workspace.userId, 'owner');
          assert.equal(where.workspace.members, undefined);
          return 2;
        },
      },
    });
    assert.equal(count, 2);
  });
  await check('serializable transaction retries conflicts and uses owner quota', async () => {
    const f = fixture({ conflicts: 1 });
    assert.equal((await f.run()).id, 'p');
    assert.deepEqual(f.state(), { attempts: 2, writes: 1, reads: 1 });
  });
  await check('full and disabled owner quotas return LIMIT without writes', async () => {
    for (const options of [{ used: 3 }, { max: 0 }]) {
      const f = fixture(options);
      assert.equal((await f.run()).code, 'LIMIT');
      assert.equal(f.state().writes, 0);
    }
  });
  await check('member sees owner guidance while owner sees plan guidance', async () => {
    assert.match((await fixture({ used: 3 }).run()).error, /契約者にご相談/);
    assert.match((await fixture({ used: 3, actor: 'owner' }).run()).error, /プランをご確認/);
  });
  await check('membership recheck denies before quota or write', async () => {
    const f = fixture({ member: false });
    await assert.rejects(f.run(), /変更権限/);
    assert.deepEqual(f.state(), { attempts: 1, writes: 0, reads: 0 });
  });
  await check('retry bound and non-conflict errors do not loop indefinitely', async () => {
    const f = fixture({ conflicts: 9 });
    await assert.rejects(f.run(), /同時に案件/);
    assert.equal(f.state().attempts, 3);
    const other = fixture({ otherError: true });
    await assert.rejects(other.run(), /internal/);
    assert.equal(other.state().attempts, 1);
  });
  await check('unlimited owner quota still checks membership and creates once', async () => {
    const f = fixture({ max: -1 });
    assert.equal((await f.run()).id, 'p');
    assert.deepEqual(f.state(), { attempts: 1, writes: 1, reads: 0 });
  });
  console.log(JSON.stringify({ passed: results.length, results }, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
