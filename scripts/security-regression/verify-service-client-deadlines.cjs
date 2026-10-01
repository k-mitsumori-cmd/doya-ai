const assert = require('node:assert/strict');
const { load, check } = require('./load-typescript.cjs');

async function verify(file, getName, sendName) {
  const deadlines = [];
  let aborted = false;
  const client = load(file, {}, {
    AbortSignal: { timeout(ms) { deadlines.push(ms); return { get aborted() { return aborted; } }; } },
    fetch: async (_url, init) => {
      assert.ok(init.signal);
      if (aborted) throw Error('synthetic timeout');
      return Response.json({ ok: true });
    },
  });

  assert.deepEqual(JSON.parse(JSON.stringify(await client[getName]('/api/test', 'acme'))), { ok: true });
  assert.deepEqual(JSON.parse(JSON.stringify(await client[sendName]('/api/test', 'acme', 'POST'))), { ok: true });
  assert.deepEqual(deadlines, [30_000, 310_000]);

  aborted = true;
  await assert.rejects(client[getName]('/api/test', 'acme'), /読み込みが時間内に完了/);
  await assert.rejects(client[sendName]('/api/test', 'acme', 'POST'), /操作履歴を確認/);
}

(async () => {
  await check('Shodan client bounds reads and allows full server mutation window', () => verify('src/lib/shodan/client.ts', 'shodanGet', 'shodanSend'));
  await check('AIO client bounds reads and allows full server mutation window', () => verify('src/lib/aio/client.ts', 'aioGet', 'aioSend'));
})().catch(error => { console.error(error); process.exitCode = 1; });
