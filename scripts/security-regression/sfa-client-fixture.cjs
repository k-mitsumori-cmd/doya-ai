process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), crypto = require('node:crypto');
const React = require('react'), ts = require('typescript'), { JSDOM } = require('jsdom');
const dom = new JSDOM('<body></body>', { url: 'https://example.invalid' });
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
const act = fn => React.act(async () => { await fn(); for (let i = 0; i < 12; i++) await new Promise(setImmediate); });
const props = e => e[Object.keys(e).find(k => k.startsWith('__reactProps$'))];
const stamp = '2026-10-07T00:00:00.000Z';
const stage = { id: 'stage', name: '提案', order: 1, probability: 50, color: '#123456', isWon: false, isLost: false };
const makeDeal = id => ({ id, createdAt: stamp, updatedAt: stamp, lostReason: null, name: 'Synthetic ' + id, amount: 100, stageId: 'stage', probability: 50, accountId: null, accountName: null, contactId: null, contactName: null, note: null, status: 'open', startDate: null, expectedCloseDate: null, wonAt: null, lostAt: null, lastActivityAt: null, openTaskCount: 0 });
const makeTask = (input = {}, id = 'task') => ({ id, title: 'Synthetic task', status: 'open', dueDate: null, dealId: null, createdAt: stamp, updatedAt: stamp, dealName: null, ...input });
const makeLead = (input = {}) => ({ id: 'lead-a', name: 'Synthetic lead', contactName: 'Contact', corporateNumber: null, email: null, phone: null, note: null, raw: {}, status: 'new', score: null, source: 'manual', convertedAccountId: null, updatedAt: stamp, ...input });
const makeAccount = (input = {}) => ({ id: 'account-a', name: 'Synthetic account', industry: null, prefecture: null, url: null, note: null, createdAt: stamp, updatedAt: stamp, ...input });
const makeContact = (input = {}) => ({ id: 'contact-a', name: 'Synthetic contact', accountId: null, title: null, department: null, email: null, phone: null, note: null, isKeyPerson: false, accountName: null, createdAt: stamp, updatedAt: stamp, ...input });
async function fixture(page, options = {}) {
  if (!options.keepStorage) window.sessionStorage.clear();
  let actor = 'actor-a', status = 'authenticated', orgSlug = 'alpha', component, currentHook;
  const leads = options.leads || [makeLead()];
  const accounts = structuredClone(options.accounts || []), contacts = structuredClone(options.contacts || []);
  const writes = [], requests = [], notices = [], receipts = new Map(), tasks = options.tasks || [], deals = structuredClone(options.deals || [makeDeal('deal-a'), makeDeal('deal-b')]);
  let writeReply, readReply, failStorage = false, timeout = false, recoveries = 0;
  const session = () => ({ status, data: status === 'unauthenticated' ? null : { user: { id: actor, plan: 'FREE' } } });
  const taskData = body => makeTask({ ...body, title: body.title?.trim() || 'Synthetic task', dueDate: body.dueDate ? new Date(body.dueDate).toISOString() : null, dealId: body.dealId || null }, 'task-' + writes.length);
  const activityData = body => ({ id: 'activity-' + writes.length, type: body.type || 'note', subject: body.subject?.trim() || null, body: body.body?.trim() || null, occurredAt: stamp, dealId: body.dealId || null });
  const fetch = async (raw, init = {}) => {
    const url = new URL(raw, 'https://example.invalid'), pathname = url.pathname;
    const request = { path: pathname, url, init, body: init.body ? JSON.parse(init.body) : null };
    requests.push(request);
    if (init.method && init.method !== 'GET') {
      writes.push(request);
      if (writeReply) return writeReply(request);
      if (pathname.endsWith('/next-action') && init.method === 'POST') {
        const source = deals.find(d => d.id === request.body.dealId);
        const row = { id: request.body.operationId, dealId: source.id, dealName: source.name, sourceUpdatedAt: request.body.expectedUpdatedAt, startedAt: stamp, nextAction: 'Synthetic next action', reason: 'Synthetic reason', risk: '', tasks: [{ title: 'First candidate', dueDate: null }, { title: 'Second candidate', dueDate: null }] };
        receipts.set(row.id, { kind: 'suggestion', row }); return Response.json({ state: 'found', suggestion: row });
      }
      const crmKind = pathname.startsWith('/api/sfa/accounts') ? 'account' : pathname.startsWith('/api/sfa/contacts') ? 'contact' : null;
      if (crmKind && init.method === 'POST') {
        const row = crmKind === 'account' ? makeAccount({ id: 'account-' + writes.length }) : makeContact({ id: 'contact-' + writes.length });
        for (const key of Object.keys(row)) if (key in request.body) row[key] = typeof request.body[key] === 'string' ? (key === 'note' ? request.body[key] : request.body[key].trim()) || null : request.body[key];
        (crmKind === 'account' ? accounts : contacts).push(row); receipts.set(request.body.operationId, { kind: crmKind, row }); return Response.json({ [crmKind]: row });
      }
      if (crmKind && !url.searchParams.has('operationId') && ['PATCH', 'DELETE'].includes(init.method)) {
        const rows = crmKind === 'account' ? accounts : contacts, index = rows.findIndex(r => pathname.endsWith('/' + r.id));
        assert.ok(index >= 0); const original = rows[index], updatedAt = new Date(new Date(original.updatedAt).getTime() + 1).toISOString();
        if (init.method === 'DELETE') { rows.splice(index, 1); return Response.json({ ok: true, id: original.id, updatedAt }); }
        const row = { ...original, ...request.body, updatedAt }; for (const key of Object.keys(request.body)) if (typeof row[key] === 'string') row[key] = (key === 'note' ? row[key] : row[key].trim()) || null;
        rows[index] = row; return Response.json({ [crmKind]: row });
      }
      if (init.method === 'DELETE' && url.searchParams.has('operationId')) {
        recoveries++; const saved = receipts.get(url.searchParams.get('operationId'));
        return Response.json(saved ? { state: 'found', [saved.kind]: saved.row } : { state: 'cancelled', [pathname.endsWith('/next-action') ? 'suggestion' : pathname.endsWith('/convert') ? 'conversion' : pathname.endsWith('/ai/score') ? 'score' : pathname.endsWith('/leads/import') ? 'import' : pathname.endsWith('/leads') ? 'lead' : pathname.endsWith('/accounts') ? 'account' : pathname.endsWith('/contacts') ? 'contact' : pathname.endsWith('/tasks') ? 'task' : pathname.endsWith('/deals') ? 'deal' : 'activity']: null });
      }
      if (pathname.endsWith('/convert') && init.method === 'POST') {
        const leadId = pathname.split('/').at(-2), body = request.body;
        const account = { id: 'converted-account', organizationId: 'organization', isActive: true, name: body.accountName, corporateNumber: body.corporateNumber || null, industry: body.industry || null, prefecture: body.prefecture || null, url: body.url || null, note: body.note || null, createdAt: stamp, updatedAt: stamp };
        const row = { id: 'converted-deal', leadId, account, deal: { ...makeDeal('converted-deal'), organizationId: 'organization', isActive: true, accountId: account.id, name: body.dealName, amount: Number(body.amount) } };
        receipts.set(body.operationId, { kind: 'conversion', row });
        const lead = leads.find(l => l.id === leadId); if (lead) { lead.status = 'converted'; lead.convertedAccountId = account.id; }
        return Response.json({ ok: true, ...row });
      }
      if (pathname === '/api/sfa/ai/score' && init.method === 'POST') {
        const source = leads.find(l => l.id === request.body.leadId);
        const row = { id: request.body.operationId, leadId: source.id, leadName: source.name, score: 70, reason: 'Synthetic reason', nextAction: 'Synthetic action', sourceUpdatedAt: request.body.expectedUpdatedAt, leadUpdatedAt: '2026-10-07T00:00:00.001Z' };
        receipts.set(row.id, { kind: 'score', row }); source.score = row.score; source.updatedAt = row.leadUpdatedAt;
        return Response.json({ state: 'found', score: row });
      }
      if (pathname === '/api/sfa/leads/import' && init.method === 'POST') {
        const rows = request.body.rows, skippedRows = rows.flatMap((r, i) => r.name?.trim() ? [] : [i + 1]);
        const row = { id: request.body.operationId, imported: rows.length - skippedRows.length, skipped: skippedRows.length, skippedRows };
        receipts.set(row.id, { kind: 'import', row });
        return Response.json({ ok: true, ...row });
      }
      if (pathname === '/api/sfa/leads' && init.method === 'POST') {
        const row = makeLead({ ...request.body, id: 'lead-' + writes.length, name: request.body.name.trim(), contactName: request.body.contactName || null });
        receipts.set(request.body.operationId, { kind: 'lead', row }); leads.push(row);
        return Response.json({ lead: row });
      }
      if (init.method === 'PATCH' && pathname.startsWith('/api/sfa/leads/')) {
        const original = leads.find(l => pathname.endsWith('/' + l.id));
        const row = { ...original, ...request.body, updatedAt: '2026-10-07T00:00:00.001Z' };
        leads.splice(leads.indexOf(original), 1, row); return Response.json({ lead: row });
      }
      if (init.method === 'PATCH' && pathname.startsWith('/api/sfa/deals/')) {
        const original = deals.find(d => pathname.endsWith('/' + d.id));
        const row = { ...original, ...request.body, amount: request.body.amount === undefined ? original.amount : Math.round(Number(request.body.amount)), updatedAt: '2026-10-07T00:00:00.001Z' };
        for (const k of ['accountId', 'contactName', 'note']) if (k in request.body) row[k] = request.body[k] || null;
        for (const k of ['startDate', 'expectedCloseDate']) if (k in request.body) row[k] = request.body[k] ? new Date(request.body[k]).toISOString() : null;
        if ('probability' in request.body) row.probability = Number(request.body.probability);
        deals.splice(deals.indexOf(original), 1, row);
        return Response.json({ deal: row });
      }
      if (init.method === 'PATCH') {
        const original = tasks.find(t => pathname.endsWith('/' + t.id));
        return Response.json({ task: { ...original, ...request.body, updatedAt: '2026-10-07T00:00:00.001Z' } });
      }
      if (init.method === 'DELETE') return Response.json({ ok: true });
      const kind = pathname.endsWith('/next-action') ? 'suggestion' : pathname.endsWith('/convert') ? 'conversion' : pathname.endsWith('/ai/score') ? 'score' : pathname.endsWith('/leads/import') ? 'import' : pathname.endsWith('/leads') ? 'lead' : pathname.endsWith('/accounts') ? 'account' : pathname.endsWith('/contacts') ? 'contact' : pathname.endsWith('/tasks') ? 'task' : pathname.endsWith('/deals') ? 'deal' : 'activity';
      const row = kind === 'task' ? taskData(request.body) : kind === 'deal' ? { ...makeDeal('deal-' + writes.length), name: request.body.name.trim(), amount: Number(request.body.amount), accountId: request.body.accountId || null, startDate: request.body.startDate ? new Date(request.body.startDate).toISOString() : stamp } : activityData(request.body);
      if (kind === 'deal') deals.push(row);
      receipts.set(request.body.operationId, { kind, row });
      return Response.json({ [kind]: row });
    }
    if (readReply) { const result = await readReply(request); if (result) return result; }
    if (url.searchParams.has('operationId')) {
      const saved = receipts.get(url.searchParams.get('operationId'));
      return Response.json(saved ? { state: 'found', [saved.kind]: saved.row } : { state: 'missing', [pathname.endsWith('/next-action') ? 'suggestion' : pathname.endsWith('/convert') ? 'conversion' : pathname.endsWith('/ai/score') ? 'score' : pathname.endsWith('/leads/import') ? 'import' : pathname.endsWith('/leads') ? 'lead' : pathname.endsWith('/accounts') ? 'account' : pathname.endsWith('/contacts') ? 'contact' : pathname.endsWith('/tasks') ? 'task' : pathname.endsWith('/deals') ? 'deal' : 'activity']: null });
    }
    if (pathname.startsWith('/api/sfa/deals/')) { const row = deals.find(d => pathname.endsWith('/' + d.id)); return Response.json({ state: row ? 'found' : 'missing', deal: row || null }); }
    if (pathname.startsWith('/api/sfa/tasks/')) return Response.json({ state: 'found', task: tasks.find(t => pathname.endsWith('/' + t.id)) || null });
    if (pathname.startsWith('/api/sfa/leads/')) { const row = leads.find(l => pathname.endsWith('/' + l.id)); return Response.json({ state: row ? 'found' : 'missing', lead: row || null }); }
    if (pathname === '/api/sfa/leads') return Response.json({ leads, totalCount: leads.length, nextCursor: null });
    if (pathname === '/api/sfa/summary') return Response.json({ summary: { totalCount: 2, openCount: 2, staleCount: 0, openTaskCount: 0, openTotal: '200', weighted: '100', wonTotal: '0' } });
    if (pathname === '/api/sfa/deals') return Response.json({ stages: [stage], deals, nextCursor: null, totalCount: 2, stageSummary: [{ stageId: 'stage', count: 2, total: '200' }] });
    if (pathname === '/api/sfa/accounts') return Response.json({ accounts: url.searchParams.has('options') ? accounts.map(({id,name,updatedAt}) => ({id,name,updatedAt})) : accounts, totalCount: accounts.length, nextCursor: null });
    if (pathname === '/api/sfa/contacts') return Response.json({ contacts, totalCount: contacts.length, nextCursor: null });
    if (pathname.startsWith('/api/sfa/accounts/') || pathname.startsWith('/api/sfa/contacts/')) { const kind = pathname.startsWith('/api/sfa/accounts/') ? 'account' : 'contact', row = (kind === 'account' ? accounts : contacts).find(r => pathname.endsWith('/' + r.id)); return Response.json({ state: row ? 'found' : 'missing', [kind]: row || null }); }
    if (pathname === '/api/sfa/tasks') return Response.json({ tasks: tasks.filter(t => !url.searchParams.has('dealId') || t.dealId === url.searchParams.get('dealId')), page: Number(url.searchParams.get('page') || 1), hasMore: false });
    if (pathname === '/api/sfa/activities') return Response.json({ activities: [], nextCursor: null, totalCount: 0 });
    if (pathname === '/api/sfa/usage') return Response.json({ plan: 'FREE', memberships: [{ slug: orgSlug, name: 'Synthetic workspace', role: 'member' }] });
    throw Error('Unexpected synthetic request ' + raw);
  };
  const cache = new Map();
  const storage = {
    get length() { return window.sessionStorage.length; }, key: i => window.sessionStorage.key(i),
    getItem: k => window.sessionStorage.getItem(k), removeItem: k => window.sessionStorage.removeItem(k),
    setItem: (k, v) => { if (failStorage) throw Error('synthetic storage denied'); window.sessionStorage.setItem(k, v); },
  };
  const globals = { fetch, window, document, sessionStorage: storage, crypto: crypto.webcrypto, AbortController, URL, URLSearchParams, Request, Response, Headers, TextDecoder, Uint8Array, Error, Date, Set, Map, console,
    setTimeout: (fn, ms) => setTimeout(fn, timeout && [30000, 310000].includes(ms) ? 5 : ms), clearTimeout };
  const externals = {
    'framer-motion': { motion: { div: ({ children }) => React.createElement('div', null, children) }, AnimatePresence: ({ children }) => children },
    'lucide-react': { Menu: () => null, TrendingUp: () => null },
    '@/components/sfa/SfaSidebar': { __esModule: true, default: ({ plan, memberships }) => React.createElement('aside', { 'data-plan': plan || '', 'data-memberships': JSON.stringify(memberships) }) },
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'next-auth/react': { useSession: session },
    'next/navigation': { useParams: () => ({ orgSlug }), usePathname: () => '/sfa/' + orgSlug },
    'next/link': { __esModule: true, default: ({ children, href }) => React.createElement('a', { href }, children) },
    '@/components/promane/character': { Character: () => React.createElement('span') },
    'react-hot-toast': { __esModule: true, Toaster: () => null, default: { success: text => notices.push({ kind: 'success', text }), error: text => notices.push({ kind: 'error', text }) } },
  };
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    vm.runInNewContext(source, { exports, ...globals, require: name => {
      if (name in externals) return externals[name];
      let base = name.startsWith('@/') ? 'src/' + name.slice(2) : name.startsWith('.') ? path.join(path.dirname(file), name) : null;
      assert.ok(base, 'Unmocked ' + name);
      const target = ['.ts', '.tsx'].map(s => base + s).find(p => fs.existsSync(p)); assert.ok(target, base);
      return load(target);
    } }, { filename: file });
    return exports;
  }
  if (page === 'hook') {
    const hook = load('src/lib/sfa/use-client-mutations.ts').useSfaClientMutations;
    component = () => { currentHook = hook(orgSlug, () => { recoveries++; }); return null; };
  } else if (page === 'layout') {
    const Layout = load('src/app/sfa/[orgSlug]/layout.tsx').default;
    const Child = () => { const [value, setValue] = React.useState('Initial'); return React.createElement('input', { id: 'scoped-child', value, onChange: e => setValue(e.target.value) }); };
    component = () => React.createElement(Layout, null, React.createElement(Child));
  } else component = load('src/app/sfa/[orgSlug]/' + (page ? page + '/' : '') + 'page.tsx').default;
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  const render = () => act(() => root.render(React.createElement(React.StrictMode, null, React.createElement(component))));
  await render();
  return { container, writes, requests, notices, receipts, storage, makeTask, taskData, activityData, act, props, render,
    hook: () => currentHook, recovered: () => recoveries,
    reply: fn => writeReply = fn, read: fn => readReply = fn, noStorage: () => failStorage = true, timeout: () => timeout = true,
    auth: async (a, s = 'authenticated') => { actor = a; status = s; await render(); }, org: async value => { orgSlug = value; await render(); },
    edit: (selector, value) => act(() => { const input = container.querySelector(selector); assert.ok(input, selector); props(input).onChange({ target: { value } }); }),
    openDetail: async (index = 0) => act(() => { const card = container.querySelectorAll('[role="button"]')[index]; assert.ok(card); props(card).onClick(); }),
    button: (text, parent = container) => [...parent.querySelectorAll('button')].find(b => b.textContent.trim() === text || b.textContent.trim().startsWith(text)),
    close: async () => { await act(() => root.unmount()); container.remove(); },
  };
}
module.exports = { fixture, deferred, act, props, makeTask, makeDeal, makeLead, makeAccount, makeContact, stamp };
