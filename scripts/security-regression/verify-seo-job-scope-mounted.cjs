for (const key of Object.keys(process.env))
    if (!['PATH', 'HOME', 'USER', 'LANG', 'TMPDIR', 'DOYA_SEO_JOB_SCOPE_EVIDENCE_DIR'].includes(key))
        delete process.env[key];
process.env.NODE_ENV = 'test';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict'), crypto = require('node:crypto'), root = path.resolve(__dirname, '../..'), out = process.env.DOYA_SEO_JOB_SCOPE_EVIDENCE_DIR || fs.mkdtempSync(require('node:os').tmpdir() + '/doya-seo-page-');
fs.mkdirSync(out, { recursive: true });
const React = require(root + '/node_modules/react'), { JSDOM } = require(root + '/node_modules/jsdom'), ts = require(root + '/node_modules/typescript');
const dom = new JSDOM('<body><div id="host"></div></body>', { url: 'https://synthetic.invalid/seo/articles/article-a?auto=1' });
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require(root + '/node_modules/react-dom/client'), { act } = React;
let realNetworkAttempts = 0;
const denyNetwork = () => { realNetworkAttempts++; throw Error('Real network disabled in SEO regression'); };
global.fetch = denyNetwork;
for (const name of ['node:http', 'node:https']) {
    const module = require(name);
    module.request = denyNetwork;
    module.get = denyNetwork;
}
const sourceHashes = {}, timers = new Map();
let nextTimer = 1, renderErrors = [], unexpectedImports = [], world;
const realConsoleError = console.error;
console.error = (...args) => { renderErrors.push(args.map(x => x instanceof Error ? x.name : String(x).slice(0, 120)).join(' ')); };
const passthrough = ({ children, ...p }) => React.createElement('div', { 'data-stub': 'presentation' }, children), button = ({ children, onClick, disabled, type }) => React.createElement('button', { onClick, disabled, type: type || 'button' }, children), motion = new Proxy({}, { get: (_, tag) => React.forwardRef(({ children, className, onClick }, ref) => React.createElement(String(tag), { ref, className, onClick }, children)) });
const presentationPaths = ['@seo/components/MarkdownPreview', '@seo/components/EditableMarkdownPreview', './components/ScorePanel', './components/OutlineEditor', '@seo/components/ClientErrorBoundary', '@seo/components/GenerationProgress', '@seo/components/ui/Button', '@seo/components/ui/Badge', '@seo/components/CompletionModal', '@seo/components/AiThinkingStrip', '@/components/FeatureGuide', '@/components/seo/CompetitorAnalysisTab', '@/components/ds', '@/components/EmptyState'];
const uiModules = new Map(presentationPaths.map(n => [n, new Proxy({}, { get: (_, key) => key === '__esModule' ? true : key === 'Button' ? button : passthrough })]));
function setT(fn, ms, repeat = false) { const id = nextTimer++; timers.set(id, { fn, ms, repeat }); return id; }
function clearT(id) { timers.delete(id); }
const boundFiles = { '@seo/lib/score': 'seo/lib/score.ts', '@seo/lib/markdown': 'seo/lib/markdown.ts', '@seo/lib/clientSettings': 'seo/lib/clientSettings.ts', '@/lib/seo-limit-action': 'src/lib/seo-limit-action.ts', '@/components/seo/user-message': 'src/components/seo/user-message.ts', '@/lib/seo/use-image-read': 'src/lib/seo/use-image-read.ts' };
const modules = new Map();
function load(rel) { if (modules.has(rel))
    return modules.get(rel); const src = fs.readFileSync(root + '/' + rel, 'utf8'); sourceHashes[rel] = crypto.createHash('sha256').update(src).digest('hex'); const exports = {}; const requireBound = n => { if (n === 'react' || n === 'react/jsx-runtime')
    return require(root + '/node_modules/' + n); if (n === 'next/navigation')
    return { useParams: () => ({ id: world.id }), useSearchParams: () => world.search, useRouter: () => world.router }; if (n === 'next/link')
    return { __esModule: true, default: ({ children, href }) => React.createElement('a', { href }, children) }; if (n === 'framer-motion')
    return { AnimatePresence: passthrough, motion }; if (n === 'lucide-react')
    return require(root + '/node_modules/lucide-react'); if (n === '@/components/ds/dialog')
    return { confirmDialog: async () => false }; if (n in boundFiles)
    return load(boundFiles[n]); if (n === '@/components/EmptyState')
    return { EmptyState: ({ title, description, action }) => React.createElement('section', null, React.createElement('h2', null, title), React.createElement('p', null, description), action) }; if (uiModules.has(n))
    return uiModules.get(n); unexpectedImports.push(n); throw Error('Unbound dependency: ' + n); }; vm.runInNewContext(ts.transpileModule(src, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, { exports, require: requireBound, window: dom.window, document: dom.window.document, navigator: dom.window.navigator, performance: { now: () => 0 }, URL, URLSearchParams, Request, Response, Headers, AbortController, Buffer, Date, Math, Set, Map, Error, Promise, console, setTimeout: (fn, ms) => setT(fn, ms), clearTimeout: clearT, setInterval: (fn, ms) => setT(fn, ms, true), clearInterval: clearT, fetch: (...a) => world.fetch(...a), requestAnimationFrame: fn => setT(fn, 16), cancelAnimationFrame: clearT }, { filename: rel }); modules.set(rel, exports); return exports; }
const Page = load('src/app/(shell)/seo/jobs/[id]/page.tsx').default;
const baseJob = id => ({ id, status: 'running', step: 'outline', progress: 10, activityState: 'waiting', articleId: 'article-' + id, article: { id: 'article-' + id, title: 'Synthetic title ' + id, targetChars: 2000 }, sections: [] });
function makeWorld(auto = '0', hold = 'job-a', patch = {}) { const w = { id: 'job-a', search: new URLSearchParams({ auto }), router: { push() { }, replace() { }, refresh() { } }, posts: [], reads: [], pending: [], pendingResumes: [], hold }; w.fetch = async (url, init = {}) => { if ((init.method || 'GET') !== 'GET') {
    w.posts.push({ url, method: init.method });
    if (url.endsWith('/resume') && w.holdResume)
        return new Promise(resolve => w.pendingResumes.push(resolve));
    if (url.endsWith('/resume') && w.rejectResume)
        return Response.json({ success: false }, { status: 403 });
    return Response.json({ success: true });
} w.reads.push({ url, signal: init.signal }); const id = url.split('/').at(-1); if (w.hold === id)
    return new Promise((resolve, reject) => { w.pending.push({ url, signal: init.signal, resolve }); if (w.honorAbort)
        init.signal?.addEventListener('abort', () => reject(new DOMException('Synthetic abort', 'AbortError')), { once: true }); }); return Response.json({ success: true, job: { ...baseJob(id), ...patch } }); }; return w; }
async function settle() { for (let i = 0; i < 5; i++)
    await new Promise(r => setImmediate(r)); }
async function mount(w, strict = false) { world = w; const host = document.getElementById('host'); host.replaceChildren(); const node = createRoot(host); const rerender = async () => { await act(async () => { node.render(strict ? React.createElement(React.StrictMode, null, React.createElement(Page)) : React.createElement(Page)); await settle(); }); }; await rerender(); return { rerender, unmount: async () => { await act(async () => { node.unmount(); await settle(); }); } }; }
(async () => {
    try {
        const observations = [];
        {
            const w = makeWorld('0'), m = await mount(w);
            w.id = 'job-b';
            w.hold = null;
            await m.rerender();
            const before = document.body.textContent.includes('Synthetic title job-b');
            await act(async () => { w.pending[0].resolve(Response.json({ success: true, job: baseJob('job-a') })); await settle(); });
            observations.push({ case: 'late old GET after parameter navigation', newJobVisibleBefore: before, newJobVisibleAfter: document.body.textContent.includes('Synthetic title job-b'), oldJobVisibleAfter: document.body.textContent.includes('Synthetic title job-a'), oldRequestAborted: w.pending[0].signal.aborted, posts: w.posts });
            await m.unmount();
        }
        {
            const w = makeWorld('0'), m = await mount(w);
            await m.unmount();
            observations.push({ case: 'unmount pending GET', requestAborted: w.pending[0].signal.aborted });
            await act(async () => { w.pending[0].resolve(Response.json({ success: true, job: baseJob('job-a') })); await settle(); });
        }
        {
            const w = makeWorld('1', null), m = await mount(w);
            w.id = 'job-b';
            w.hold = 'job-b';
            await m.rerender();
            const timerEntry = [...timers.entries()].find(([, x]) => x.ms === 1800);
            const tick = timerEntry?.[1];
            if (timerEntry)
                timers.delete(timerEntry[0]);
            if (tick)
                await act(async () => { void tick.fn(); await settle(); });
            observations.push({ case: 'parameter navigation holds new GET with old running job', hasAdvanceTimer: !!tick, posts: w.posts, pendingNewRead: w.pending.some(x => x.url.endsWith('/job-b')) });
            await m.unmount();
        }
        assert.equal(observations[0].newJobVisibleBefore, true);
        assert.equal(observations[0].newJobVisibleAfter, true);
        assert.equal(observations[0].oldJobVisibleAfter, false);
        assert.equal(observations[0].oldRequestAborted, true);
        assert.equal(observations[1].requestAborted, true);
        assert.equal(observations[2].posts.length, 0);
        assert.equal(observations[2].hasAdvanceTimer, false);
        {
            const w = makeWorld('1', null), m = await mount(w);
            const timerEntry = [...timers.entries()].find(([, x]) => x.ms === 1800);
            const tick = timerEntry?.[1];
            if (timerEntry)
                timers.delete(timerEntry[0]);
            assert(tick);
            await act(async () => { void tick.fn(); await settle(); });
            assert.deepEqual(w.posts.map(x => x.url), ['/api/seo/jobs/job-a/advance']);
            observations.push({ case: 'normal running job automatically advances once', passed: true });
            await m.unmount();
        }
        {
            const w = makeWorld('0', null), m = await mount(w);
            assert(![...timers.values()].some(x => x.ms === 1800));
            assert.equal(w.posts.length, 0);
            observations.push({ case: 'auto=0 running job remains read only', passed: true });
            await m.unmount();
        }
        for (const status of ['done', 'paused', 'error', 'cancelled']) {
            const w = makeWorld('1', null, { status }), m = await mount(w);
            assert(![...timers.values()].some(x => x.ms === 1800));
            assert.equal(w.posts.length, 0);
            observations.push({ case: 'terminal ' + status + ' never automatically advances', passed: true });
            await m.unmount();
        }
        for (const patch of [{ supersededAt: '2026-11-01T00:00:00Z' }, { activityState: 'needs-review' }]) {
            const w = makeWorld('1', null, patch), m = await mount(w);
            assert(![...timers.values()].some(x => x.ms === 1800));
            assert.equal(w.posts.length, 0);
            observations.push({ case: patch.supersededAt ? 'superseded job never automatically advances' : 'review-required job never automatically advances', passed: true });
            await m.unmount();
        }
        {
            const w = makeWorld('1', null), m = await mount(w);
            w.id = 'job-b';
            w.hold = 'job-b';
            await m.rerender();
            await act(async () => { w.pending[0].resolve(Response.json({ success: true, job: baseJob('job-b') })); await settle(); });
            const timerEntry = [...timers.entries()].find(([, x]) => x.ms === 1800);
            const tick = timerEntry?.[1];
            if (timerEntry)
                timers.delete(timerEntry[0]);
            assert(tick);
            await act(async () => { void tick.fn(); await settle(); });
            assert.deepEqual(w.posts.map(x => x.url), ['/api/seo/jobs/job-b/advance']);
            observations.push({ case: 'new job advances only after its own current read', passed: true });
            await m.unmount();
        }
        for (const leave of ['none', 'navigate', 'unmount', 'denied']) {
            const w = makeWorld('0', null, { status: 'paused' });
            w.holdResume = leave === 'navigate' || leave === 'unmount';
            w.rejectResume = leave === 'denied';
            const m = await mount(w);
            const button = [...document.querySelectorAll('button')].find(x => x.textContent.includes('1工程だけ進める'));
            assert(button && !button.disabled);
            await act(async () => { button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); await settle(); });
            if (leave === 'navigate') {
                w.id = 'job-b';
                w.hold = 'job-b';
                await m.rerender();
            }
            if (leave === 'unmount')
                await m.unmount();
            if (w.holdResume)
                await act(async () => { w.pendingResumes[0](Response.json({ success: true })); await settle(); });
            assert.equal(w.posts.filter(x => x.url.endsWith('/resume')).length, 1);
            assert.equal(w.posts.filter(x => x.url.endsWith('/advance')).length, leave === 'none' ? 1 : 0);
            observations.push({ case: 'manual paused resume ' + leave, passed: true });
            if (leave !== 'unmount')
                await m.unmount();
        }
        {
            const w = makeWorld('0', 'job-a');
            w.honorAbort = true;
            const m = await mount(w, true);
            assert.equal(w.pending.length, 2);
            assert(w.pending[0].signal.aborted);
            assert(!w.pending[1].signal.aborted);
            assert(!document.body.textContent.includes('読み込みに時間がかかっています'));
            assert(document.querySelector('[aria-busy="true"]'));
            const interval = [...timers.entries()].find(([, x]) => x.ms === 4000);
            assert(interval);
            await act(async () => { void interval[1].fn(); await settle(); });
            assert.equal(w.reads.length, 2);
            await act(async () => { w.pending[1].resolve(Response.json({ success: true, job: baseJob('job-a') })); await settle(); });
            assert(document.body.textContent.includes('Synthetic title job-a'));
            observations.push({ case: 'StrictMode cleanup abort stays silent and cannot release the current read guard', passed: true });
            await m.unmount();
        }
        {
            const w = makeWorld('0', 'job-a');
            w.honorAbort = true;
            const m = await mount(w);
            const deadline = [...timers.entries()].filter(([, x]) => x.ms === 12000).at(-1);
            assert(deadline);
            timers.delete(deadline[0]);
            await act(async () => { deadline[1].fn(); await settle(); });
            assert(w.pending[0].signal.aborted);
            assert(document.body.textContent.includes('読み込みに時間がかかっています'));
            assert(!document.querySelector('[aria-busy="true"]'));
            assert.equal(w.posts.length, 0);
            observations.push({ case: 'real read deadline remains visible and releases loading', passed: true });
            await m.unmount();
        }
        assert.equal(realNetworkAttempts, 0);
        assert.equal(renderErrors.length, 0);
        const result = { completed: true, groups: observations.length, observations, renderErrors, sourceHashes, presentationStubs: presentationPaths, realNetworkRequests: 0, providerRequests: 0, productionWrites: 0, realNextNavigationVerified: false, actualComponentInstanceRetainedByHarness: true };
        fs.writeFileSync(out + '/job-page-observations.json', JSON.stringify(result, null, 2));
        console.log(JSON.stringify(result));
        if (renderErrors.length)
            process.exitCode = 1;
    }
    catch (e) {
        console.log(JSON.stringify({ error: e.message, renderErrors, unexpectedImports }));
        process.exitCode = 1;
    }
    finally {
        console.error = realConsoleError;
        dom.window.close();
    }
})();
