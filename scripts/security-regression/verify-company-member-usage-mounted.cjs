// React.act needs the development runtime, including when npm build sets
// NODE_ENV=production in the parent. This dedicated test process is synthetic.
process.env.NODE_ENV = 'development';
const reportFailure = console.error.bind(console);
const { root: seatRepo, seatSourcePath, evidenceDir } = require('./seat-regression-support.cjs');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const repo = seatRepo, dep = n => require(repo + '/node_modules/' + n), ts = dep('typescript'), React = dep('react'), { JSDOM } = dep('jsdom');
const loadedSourceHashes = {};
const file = 'src/components/pricing/TeamManage.tsx', source = fs.readFileSync(seatSourcePath(file), 'utf8');
const plans = require(repo + '/scripts/security-regression/load-typescript.cjs').load('src/lib/pricing-v2/plans.ts');
const pending = action => ({ operationKey: 'original-operation-0001', requested: 6, previousSeats: 5, action });
const ready = seats => ({ seats, used: 3, interval: 'month', monthly: plans.teamMonthly(seats), points: plans.teamMonthlyPoints(seats) });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const flush = async () => { for (let i = 0; i < 10; i++)
    await new Promise(r => setImmediate(r)); };
async function scenario(name, options, work) {
    const dom = new JSDOM('<div id="root"></div>', { url: 'https://synthetic.invalid/pricing' }), prior = new Map(), errors = [], calls = [], dialogs = [], timers = new Map();
    let root, timerId = 0, actor = 'owner-a', uuidCalls = 0;
    const state = { pending: options.pending || null, seatsA: 5, seatsB: 7, postReplies: 0 };
    const Session = React.createContext(null), confirm = options.confirmDeferred ? deferred() : null;
    const oldError = console.error;
    console.error = (...args) => errors.push(args.map(String).join(' '));
    for (const [k, v] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })) {
        prior.set(k, Object.getOwnPropertyDescriptor(global, k));
        Object.defineProperty(global, k, { value: v, writable: true, configurable: true });
    }
    Object.defineProperty(dom.window.navigator, 'clipboard', { configurable: true, value: { writeText: async () => { if (options.clipboardReject)
                throw Error('SYNTHETIC_CLIPBOARD_DENIED'); } } });
    const response = (data, status = 200) => Response.json(data, { status });
    const fetcher = async (url, init = {}) => {
        const method = init.method || 'GET', owner = new Headers(init.headers).get('x-doya-owner'), body = init.body ? JSON.parse(init.body) : null;
        const call = { url, method, owner, body, signal: init.signal };
        calls.push(call);
        assert(['owner-a', 'owner-b'].includes(owner), 'expected principal header missing');
        if (options.onFetch) {
            const custom = await options.onFetch({ url, method, owner, body, init, state, response, call });
            if (custom !== undefined)
                return custom;
        }
        if (method === 'GET' && url === '/api/pricing/seats')
            return response(owner === 'owner-a' && state.pending ? { pending: state.pending } : ready(owner === 'owner-a' ? state.seatsA : state.seatsB));
        if (method === 'GET' && url === '/api/pricing/members')
            return response({ members: [] });
        if (method === 'POST' && url === '/api/pricing/seats') {
            state.postReplies++;
            state.pending = null;
            if (owner === 'owner-a')
                state.seatsA = body.seats;
            else
                state.seatsB = body.seats;
            return response({ ok: true, seats: body.seats });
        }
        if (method === 'POST' && url === '/api/pricing/members')
            return response({ inviteUrl: 'https://synthetic.invalid/pricing/join?token=synthetic' });
        throw Error('UNEXPECTED_SYNTHETIC_REQUEST');
    };
    const cache = new Map(), classes = new Proxy({}, { get: (_, key) => String(key) });
    function load(name) {
        if (cache.has(name))
            return cache.get(name);
        const target = seatSourcePath(name), bytes = fs.readFileSync(fs.existsSync(target) ? target : path.join(repo, name), 'utf8'), exports = {};
        cache.set(name, exports);
        loadedSourceHashes[name] = crypto.createHash('sha256').update(bytes).digest('hex');
        const requireMock = n => {
            if (n === 'react')
                return React;
            if (n === 'react/jsx-runtime')
                return dep('react/jsx-runtime');
            if (n === 'next-auth/react')
                return { useSession: () => React.useContext(Session) };
            if (n === 'lucide-react')
                return { Minus: () => null, Plus: () => null, Copy: () => null, Check: () => null };
            if (n === '@/components/ds')
                return { confirmDialog: async (data) => { dialogs.push(data); return confirm ? confirm.promise : true; } };
            if (n.endsWith('.module.css'))
                return { __esModule: true, default: classes };
            if (n === './PaymentThanks')
                return { __esModule: true, default: () => null };
            if (n.startsWith('@/'))
                return load('src/' + n.slice(2) + '.ts');
            if (n.startsWith('.'))
                return load(path.posix.normalize(path.posix.join(path.posix.dirname(name), n)) + '.ts');
            throw Error('UNEXPECTED_CLIENT_DEPENDENCY ' + n);
        };
        vm.runInNewContext(ts.transpileModule(bytes, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, { exports, require: requireMock, console, Promise, URL, Headers, Request, Response, AbortController, TextDecoder, Uint8Array, Map, Set, Error, fetch: fetcher, navigator: dom.window.navigator, window: dom.window, document: dom.window.document, crypto: { randomUUID: () => { uuidCalls++; return '00000000-0000-4000-8000-000000000001'; } }, setTimeout: (cb, ms) => { const id = ++timerId; timers.set(id, { cb, ms }); return id; }, clearTimeout: id => timers.delete(id) }, { filename: name });
        return exports;
    }
    const TeamManage = load(file).TeamManage;
    const render = async (next = actor, status = 'authenticated') => { actor = next; await React.act(async () => { root.render(React.createElement(options.strict ? React.StrictMode : React.Fragment, {}, React.createElement(Session.Provider, { value: { status, data: status === 'authenticated' ? { user: { id: actor } } : null } }, React.createElement(TeamManage, { membershipOnly: Boolean(options.membershipOnly) })))); await flush(); }); };
    const button = label => [...document.querySelectorAll('button')].find(b => b.textContent === label || b.getAttribute('aria-label') === label);
    const click = async (label) => { const target = button(label); assert(target, 'missing button ' + label); assert(!target.disabled, 'disabled button ' + label); await React.act(async () => { target.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); await flush(); }); };
    try {
        root = dep('react-dom/client').createRoot(document.getElementById('root'));
        await render();
        await work({ dom, state, calls, dialogs, confirm, button, click, render, flush, expire: async () => { const due = [...timers.values()]; assert(due.length); assert(due.every(t => t.ms === 35000)); await React.act(async () => { for (const t of due)
                t.cb(); await flush(); }); }, uuid: () => uuidCalls, text: () => document.body.textContent });
        assert.equal(errors.length, 0, name + ': React/render errors: ' + errors.join(' | '));
        assert(calls.every(c => c.url.startsWith('/api/pricing/')));
        return { name, requests: calls.length, posts: calls.filter(c => c.method === 'POST').length, uuidCalls, strict: Boolean(options.strict), renderErrors: errors.length };
    }
    finally {
        try {
            if (root)
                await React.act(async () => { root.unmount(); await flush(); });
        }
        finally {
            console.error = oldError;
            for (const [k, descriptor] of prior) {
                if (descriptor)
                    Object.defineProperty(global, k, descriptor);
                else
                    delete global[k];
            }
            dom.window.close();
        }
    }
}
(async () => {
    const results = [];
    const payload = (used = 1, limit = 1, kind = 'legacy') => ({ members: [], used, limit, kind, seatUsageUnavailable: false });
    const opts = data => ({ membershipOnly: true, onFetch: ({ url, response }) => url === '/api/pricing/members' ? response(data) : undefined });
    for (const [name, data, expected] of [['legacy one person', payload(), '会社全体で使用中 1人 / 上限 1人'], ['free company union', payload(2, 3, 'none'), '会社全体で使用中 2人 / 上限 3人'], ['tool only users not counted from central list', payload(7, 8, 'team'), '会社全体で使用中 7人 / 上限 8人'], ['over capacity is visible without clipping', payload(6, 5, 'team'), '会社全体で使用中 6人 / 上限 5人']])
        results.push(await scenario(name, opts(data), async (x) => { assert(x.text().includes(expected), name); assert(x.calls.every(c => c.method === 'GET' && c.url === '/api/pricing/members')); assert.equal(x.calls.length, 1); }));
    for (const [name, data] of [['string usage', payload('1', 1)], ['unknown usage', { members: [], used: null, limit: null, seatUsageUnavailable: true }], ['malformed limit', payload(1, 0)]])
        results.push(await scenario(name, opts(data), async (x) => { assert(x.text().includes('会社全体の使用人数を確認できませんでした')); assert(!x.text().includes('会社全体で使用中')); assert(document.querySelector('input[type="email"]').disabled); assert(x.calls.every(c => c.method === 'GET')); }));
    {
        const late = deferred();
        results.push(await scenario('late old owner usage cannot overwrite new owner', { membershipOnly: true, onFetch: ({ url, owner, response }) => url === '/api/pricing/members' ? (owner === 'owner-a' ? late.promise : response(payload(4, 6, 'team'))) : undefined }, async (x) => { await x.render('owner-b'); assert(x.text().includes('会社全体で使用中 4人 / 上限 6人')); await React.act(async () => { late.resolve(Response.json(payload())); await flush(); }); assert(x.text().includes('会社全体で使用中 4人 / 上限 6人')); assert(!x.text().includes('会社全体で使用中 1人')); assert(x.calls.every(c => c.method === 'GET')); }));
    }
    {
        let reads = 0;
        results.push(await scenario('failed refresh clears old capacity and explicit retry recovers', { membershipOnly: true, onFetch: ({ url, response }) => url === '/api/pricing/members' ? response(++reads === 2 ? { members: [], seatUsageUnavailable: true } : payload(2, 3, 'none')) : undefined }, async (x) => { assert(x.text().includes('会社全体で使用中 2人 / 上限 3人')); await x.click('一覧を再確認する'); assert(!x.text().includes('会社全体で使用中')); assert(x.text().includes('会社全体の使用人数を確認できませんでした')); await x.click('一覧を再確認する'); assert(x.text().includes('会社全体で使用中 2人 / 上限 3人')); assert(x.calls.every(c => c.method === 'GET')); }));
    }
    results.push(await scenario('unknown capacity still permits choosing readonly guest role', opts({ members: [], used: null, limit: null, seatUsageUnavailable: true }), async (x) => { assert(document.querySelector('input[type="email"]').disabled); const role = document.querySelector('select'); assert(!role.disabled); await React.act(async () => { role.value = 'guest'; role.dispatchEvent(new x.dom.window.Event('change', { bubbles: true })); await flush(); }); assert(!document.querySelector('input[type="email"]').disabled); assert(x.text().includes('この会社への招待では購入席を使わず')); assert(x.calls.every(c => c.method === 'GET')); }));
    assert.equal(results.length, 10);
    const files = [file, 'src/lib/pricing-v2/company-member-usage-view.ts'];
    fs.writeFileSync(evidenceDir + '/company-member-usage-mounted-result.json', JSON.stringify({ checkedAt: new Date().toISOString(), count: results.length, results, actualReactDomAndCandidateComponent: true, actualSharedBillingResponseHelper: true, sessionFetchAndConfirmSynthetic: true, realNetworkRequests: 0, realPayments: 0, nativeBrowserVisualQa: false, sourceHashes: loadedSourceHashes, sharedReadHelperSha256: crypto.createHash('sha256').update(fs.readFileSync(repo + '/src/lib/billing-response-client.ts')).digest('hex') }, null, 2) + String.fromCharCode(10));
    console.log(JSON.stringify({ passed: results.length, realNetworkRequests: 0, realPayments: 0 }));
})().catch(e => { reportFailure(e); process.exitCode = 1; });
