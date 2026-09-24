const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const values = new Map();
let denyRemoval = false;
let orgResponse = Response.json({ memberships: [] });
let organizationFetches = 0;
const localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => { if (denyRemoval) throw new Error('storage disabled'); values.delete(key); },
};
const source = fs.readFileSync('src/components/org/OrgSwitcher.tsx', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
  jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const exported = {};
vm.runInNewContext(compiled, {
  exports: exported,
  require: (name) => {
    if (name === 'react' || name === 'react/jsx-runtime') return {};
    throw new Error(`Unexpected import: ${name}`);
  },
  window: { localStorage },
  fetch: async (url) => {
    assert.match(url, /^\/api\/(quote|aishodan)\/organizations$/);
    organizationFetches++;
    return orgResponse;
  },
});
const { orgStorageKey, reconcileSelectedOrg, ensureSelectedOrg, withOrg } = exported;

values.set(orgStorageKey('quote'), 'previous-account-org');
assert.equal(reconcileSelectedOrg('quote', [{ slug: 'current-org', name: 'Current', role: 'owner' }]), null);
assert.equal(withOrg('quote', '/api/quote/documents'), '/api/quote/documents');
assert.equal(values.has(orgStorageKey('quote')), false);

values.set(orgStorageKey('quote'), 'shared-org');
assert.equal(reconcileSelectedOrg('quote', [{ slug: 'shared-org', name: 'Shared', role: 'member' }]), 'shared-org');
assert.equal(withOrg('quote', '/api/quote/documents'), '/api/quote/documents?org=shared-org');

values.set(orgStorageKey('aishodan'), 'former-org');
assert.equal(reconcileSelectedOrg('aishodan', []), null);
assert.equal(withOrg('aishodan', '/api/aishodan/rooms'), '/api/aishodan/rooms');
assert.equal(withOrg('quote', '/api/quote/documents'), '/api/quote/documents?org=shared-org');

values.set(orgStorageKey('archive'), 'stale-org');
denyRemoval = true;
assert.equal(reconcileSelectedOrg('archive', []), null);
assert.equal(withOrg('archive', '/api/archive/items'), '/api/archive/items');
denyRemoval = false;

(async () => {
  const before = organizationFetches;
  await ensureSelectedOrg('aishodan');
  assert.equal(organizationFetches, before, 'No saved choice needs no network request');

  values.set(orgStorageKey('aishodan'), 'previous-account-org');
  orgResponse = Response.json({ memberships: [{ slug: 'current-org', name: 'Current', role: 'owner' }] });
  await ensureSelectedOrg('aishodan');
  assert.equal(withOrg('aishodan', '/api/aishodan/sessions'), '/api/aishodan/sessions');

  values.set(orgStorageKey('quote'), 'shared-org');
  orgResponse = Response.json({ memberships: [{ slug: 'shared-org', name: 'Shared', role: 'member' }] });
  await ensureSelectedOrg('quote');
  assert.equal(withOrg('quote', '/api/quote/issuer'), '/api/quote/issuer?org=shared-org');

  orgResponse = Response.json({ error: 'Unavailable' }, { status: 503 });
  await assert.rejects(ensureSelectedOrg('quote'), /Unavailable/);
  assert.equal(withOrg('quote', '/api/quote/issuer'), '/api/quote/issuer?org=shared-org');

  orgResponse = Response.json({ memberships: null });
  await assert.rejects(ensureSelectedOrg('quote'), /組織一覧を確認できませんでした/);
  assert.equal(withOrg('quote', '/api/quote/issuer'), '/api/quote/issuer?org=shared-org');
  console.log('PASS organization selection: stale cross-account slug is cleared on direct entry; valid membership retained; outage preserves choice');
})().catch((error) => { console.error(error); process.exitCode = 1; });
