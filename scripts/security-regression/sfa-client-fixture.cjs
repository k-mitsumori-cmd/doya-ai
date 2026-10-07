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
const makeDeal = id => ({ id, name: 'Synthetic ' + id, amount: 100, stageId: 'stage', probability: 50, accountId: null, accountName: null, contactName: null, note: null, status: 'open', startDate: null, expectedCloseDate: null, wonAt: null, lostAt: null, lastActivityAt: null, openTaskCount: 0 });
const makeTask = (input = {}, id = 'task') => ({ id, title: 'Synthetic task', status: 'open', dueDate: null, dealId: null, createdAt: stamp, updatedAt: stamp, dealName: null, ...input });
async function fixture(page, options = {}) {
  if (!options.keepStorage) window.sessionStorage.clear();
  let actor = 'actor-a', status = 'authenticated', orgSlug = 'alpha', component, currentHook;
  const writes = [], requests = [], notices = [], receipts = new Map(), tasks = options.tasks || [];
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
      if (pathname.endsWith('/next-action')) return Response.json({ nextAction: 'Synthetic next action', reason: '', risk: '', tasks: [{ title: 'First candidate', dueDate: null }, { title: 'Second candidate', dueDate: null }] });
      if (init.method === 'DELETE' && url.searchParams.has('operationId')) {
        recoveries++; const saved = receipts.get(url.searchParams.get('operationId'));
        return Response.json(saved ? { state: 'found', [saved.kind]: saved.row } : { state: 'cancelled', [pathname.endsWith('/tasks') ? 'task' : 'activity']: null });
      }
      if (init.method === 'PATCH') {
        const original = tasks.find(t => pathname.endsWith('/' + t.id));
        return Response.json({ task: { ...original, ...request.body, updatedAt: '2026-10-07T00:00:00.001Z' } });
      }
      if (init.method === 'DELETE') return Response.json({ ok: true });
      const kind = pathname.endsWith('/tasks') ? 'task' : 'activity';
      const row = kind === 'task' ? taskData(request.body) : activityData(request.body);
      receipts.set(request.body.operationId, { kind, row });
      return Response.json({ [kind]: row });
    }
    if (readReply) { const result = await readReply(request); if (result) return result; }
    if (url.searchParams.has('operationId')) {
      const saved = receipts.get(url.searchParams.get('operationId'));
      return Response.json(saved ? { state: 'found', [saved.kind]: saved.row } : { state: 'missing', [pathname.endsWith('/tasks') ? 'task' : 'activity']: null });
    }
    if (pathname.startsWith('/api/sfa/tasks/')) return Response.json({ state: 'found', task: tasks.find(t => pathname.endsWith('/' + t.id)) || null });
    if (pathname === '/api/sfa/summary') return Response.json({ summary: { totalCount: 2, openCount: 2, staleCount: 0, openTaskCount: 0, openTotal: '200', weighted: '100', wonTotal: '0' } });
    if (pathname === '/api/sfa/deals') return Response.json({ stages: [stage], deals: [makeDeal('deal-a'), makeDeal('deal-b')], nextCursor: null, totalCount: 2, stageSummary: [{ stageId: 'stage', count: 2, total: '200' }] });
    if (pathname === '/api/sfa/accounts') return Response.json({ accounts: [], nextCursor: null });
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
module.exports = { fixture, deferred, act, props, makeTask, stamp };
