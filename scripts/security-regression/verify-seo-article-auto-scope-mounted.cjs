for (const key of Object.keys(process.env))
    if (!['PATH', 'HOME', 'USER', 'LANG', 'TMPDIR', 'DOYA_SEO_PAGE_EVIDENCE_DIR'].includes(key))
        delete process.env[key];
process.env.NODE_ENV = 'test';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict'), crypto = require('node:crypto'), root = path.resolve(__dirname, '../..'), out = process.env.DOYA_SEO_PAGE_EVIDENCE_DIR || fs.mkdtempSync(require('node:os').tmpdir() + '/doya-seo-page-');
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
const presentationPaths = ['@seo/components/MarkdownPreview', '@seo/components/EditableMarkdownPreview', './components/ScorePanel', './components/OutlineEditor', '@seo/components/ClientErrorBoundary', '@seo/components/GenerationProgress', '@seo/components/ui/Button', '@seo/components/ui/Badge', '@seo/components/CompletionModal', '@seo/components/AiThinkingStrip', '@/components/FeatureGuide', '@/components/seo/CompetitorAnalysisTab', '@/components/ds'];
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
    return load(boundFiles[n]); if (uiModules.has(n))
    return uiModules.get(n); unexpectedImports.push(n); throw Error('Unbound dependency: ' + n); }; vm.runInNewContext(ts.transpileModule(src, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, { exports, require: requireBound, window: dom.window, document: dom.window.document, navigator: dom.window.navigator, URL, URLSearchParams, Request, Response, Headers, AbortController, Buffer, Date, Math, Set, Map, Error, Promise, console, setTimeout: (fn, ms) => setT(fn, ms), clearTimeout: clearT, setInterval: (fn, ms) => setT(fn, ms, true), clearInterval: clearT, fetch: (...a) => world.fetch(...a), requestAnimationFrame: fn => setT(fn, 16), cancelAnimationFrame: clearT }, { filename: rel }); modules.set(rel, exports); return exports; }
const Page = load('src/app/(shell)/seo/articles/[id]/page.tsx').default;
const baseArticle = id => ({ id, title: 'Synthetic article ' + id, status: 'DONE', activityState: 'waiting', targetChars: 2000, finalMarkdown: '## 合成見出し\n合成本文', autoBundle: true, jobs: [], audits: [], images: [], linkChecks: [], knowledgeItems: [], references: [], createdAt: '2026-11-01T00:00:00Z' });
function makeWorld(auto = '1', options = {}) { const w = { id: 'article-a', search: new URLSearchParams({ auto }), router: { push() { }, replace() { }, refresh() { } }, posts: [], reads: [], pendingEntitlements: [], pendingArticles: [], ...options }; w.fetch = async (url, init = {}) => { const method = init.method || 'GET'; if (method !== 'GET') {
    w.posts.push({ url, method, body: init.body ? JSON.parse(init.body) : null });
    assert(url.endsWith('/images/ensure'), 'unexpected mutation boundary');
    return Response.json({ success: true, skipped: true });
} w.reads.push({ url, signal: init.signal }); if (url === '/api/seo/entitlements') {
    if (w.holdEntitlements)
        return new Promise(resolve => w.pendingEntitlements.push({ resolve, signal: init.signal }));
    return Response.json({ success: true, isLoggedIn: w.loggedIn !== false, canUseSeoImages: w.paid !== false });
} if (/^\/api\/seo\/articles\/[^/]+$/.test(url)) {
    if (w.holdArticleId === url.split('/').at(-1))
        return new Promise(resolve => w.pendingArticles.push({ resolve, url, signal: init.signal }));
    return Response.json({ success: true, article: { ...baseArticle(url.split('/').at(-1)), ...(w.articlePatch || {}) } });
} throw Error('Unexpected read ' + url); }; return w; }
async function settle() { for (let i = 0; i < 5; i++)
    await new Promise(r => setImmediate(r)); }
async function mount(w, strict = false) { world = w; const host = document.getElementById('host'); host.replaceChildren(); const node = createRoot(host); await act(async () => { node.render(strict ? React.createElement(React.StrictMode, null, React.createElement(Page)) : React.createElement(Page)); await settle(); }); assert(!renderErrors.length, 'Render failed: ' + renderErrors.join(';')); return { node, async rerender() { await act(async () => { node.render(strict ? React.createElement(React.StrictMode, null, React.createElement(Page)) : React.createElement(Page)); await settle(); }); }, async unmount() { await act(async () => { node.unmount(); await settle(); }); } }; }
const cases = [];
async function check(name, fn) { const before = renderErrors.length; await fn(); assert.equal(renderErrors.length, before, 'React reported errors'); cases.push({ name, passed: true }); }
(async () => {
    try {
        await check('auto=0 completed bundle never performs automatic entitlement or generation', async () => { const w = makeWorld('0'), m = await mount(w); assert.equal(w.posts.length, 0); assert.equal(w.reads.filter(x => x.url === '/api/seo/entitlements').length, 0); await m.unmount(); assert.equal(timers.size, 0); });
        await check('completed bundle requests images once across rerenders', async () => { const w = makeWorld('1'), m = await mount(w); assert.equal(w.posts.length, 1); assert.equal(w.posts[0].body.trigger, 'auto'); await m.rerender(); await m.rerender(); assert.equal(w.posts.length, 1); await m.unmount(); assert.equal(timers.size, 0); });
        await check('StrictMode completed bundle generates only once', async () => { const w = makeWorld('1'), m = await mount(w, true); assert.equal(w.posts.length, 1); await m.unmount(); assert.equal(timers.size, 0); });
        await check('unmount before entitlement response aborts and prevents a late generation', async () => { const w = makeWorld('1', { holdEntitlements: true }), m = await mount(w); assert.equal(w.pendingEntitlements.length, 1); await m.unmount(); assert(w.pendingEntitlements[0].signal.aborted); await act(async () => { w.pendingEntitlements[0].resolve(Response.json({ success: true, isLoggedIn: true, canUseSeoImages: true })); await settle(); }); assert.equal(w.posts.length, 0); assert.equal(timers.size, 0); });
        await check('switching auto=0 while entitlement pending prevents late generation', async () => { const w = makeWorld('1', { holdEntitlements: true }), m = await mount(w); w.search = new URLSearchParams({ auto: '0' }); await m.rerender(); assert(w.pendingEntitlements[0].signal.aborted); await act(async () => { w.pendingEntitlements[0].resolve(Response.json({ success: true, isLoggedIn: true, canUseSeoImages: true })); await settle(); }); assert.equal(w.posts.length, 0); await m.unmount(); });
        for (const [name, flags] of [['unpaid', { paid: false }], ['anonymous', { loggedIn: false }], ['bundle disabled', { articlePatch: { autoBundle: false } }]])
            await check(name + ' cannot automatically generate images', async () => { const w = makeWorld('1', flags), m = await mount(w); assert.equal(w.posts.length, 0); await m.unmount(); });
        let navigationObservation;
        await check('observe parameter navigation during pending entitlement without a real provider', async () => { const w = makeWorld('1', { holdEntitlements: true }), m = await mount(w); const old = w.pendingEntitlements[0]; w.id = 'article-b'; w.holdArticleId = 'article-b'; await m.rerender(); const abortedAfterNavigation = old.signal.aborted; await act(async () => { old.resolve(Response.json({ success: true, isLoggedIn: true, canUseSeoImages: true })); await settle(); }); navigationObservation = { parametersChangedTo: 'article-b', newArticleReadHeld: true, oldEntitlementAborted: abortedAfterNavigation, postsAfterNavigation: w.posts.map(x => ({ url: x.url, trigger: x.body?.trigger })), actualComponentInstanceRetainedByHarness: true, realNextNavigationVerified: false }; assert.equal(abortedAfterNavigation, true); assert.equal(w.posts.length, 0); await m.unmount(); assert(w.pendingArticles.every(x => x.signal.aborted)); assert.equal(timers.size, 0); });
        let staleReadObservation;
        await check('observe old article response arriving after new route data', async () => { const w = makeWorld('0', { holdArticleId: 'article-a' }), m = await mount(w); assert.equal(w.pendingArticles.length, 1); w.id = 'article-b'; w.holdArticleId = null; await m.rerender(); const before = document.body.textContent.includes('Synthetic article article-b'); await act(async () => { w.pendingArticles[0].resolve(Response.json({ success: true, article: baseArticle('article-a') })); await settle(); }); staleReadObservation = { parametersChangedTo: 'article-b', newArticleVisibleBeforeLateRead: before, oldArticleVisibleAfterLateRead: document.body.textContent.includes('Synthetic article article-a'), newArticleVisibleAfterLateRead: document.body.textContent.includes('Synthetic article article-b'), posts: w.posts.length, actualComponentInstanceRetainedByHarness: true, realNextNavigationVerified: false }; assert(before); assert.equal(staleReadObservation.oldArticleVisibleAfterLateRead, false); assert.equal(staleReadObservation.newArticleVisibleAfterLateRead, true); await m.unmount(); });
        await check('next completed article retains its own automatic image attempt', async () => { const w = makeWorld('1'), m = await mount(w); w.id = 'article-b'; await m.rerender(); assert.deepEqual(w.posts.map(x => x.url), ['/api/seo/articles/article-a/images/ensure', '/api/seo/articles/article-b/images/ensure']); assert(w.posts.every(x => x.body.trigger === 'auto')); await m.unmount(); });
        await check('manual image generation remains available with auto=0', async () => { const w = makeWorld('0'); w.search = new URLSearchParams({ auto: '0', tab: 'media' }); const m = await mount(w); assert.equal(w.posts.length, 0); const action = [...document.querySelectorAll('button')].find(x => x.textContent.includes('図解を作成')); assert(action && !action.disabled); await act(async () => { action.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); await settle(); }); assert.equal(w.posts.length, 1); assert.equal(w.posts[0].body.trigger, 'manual'); await m.unmount(); });
        await check('a mismatched article identity fails closed without generation', async () => { const w = makeWorld('1', { articlePatch: { id: 'wrong-article' } }), m = await mount(w); assert.equal(w.posts.length, 0); assert(!document.body.textContent.includes('Synthetic article article-a')); assert(document.body.textContent.includes('記事を確かめられませんでした')); await m.unmount(); });
        await check('unmount aborts a pending article read before its late response', async () => { const w = makeWorld('1', { holdArticleId: 'article-a' }), m = await mount(w); await m.unmount(); assert(w.pendingArticles[0].signal.aborted); await act(async () => { w.pendingArticles[0].resolve(Response.json({ success: true, article: baseArticle('article-a') })); await settle(); }); assert.equal(w.posts.length, 0); assert.equal(timers.size, 0); });
        assert.equal(realNetworkAttempts, 0);
        fs.writeFileSync(out + '/full-page-mounted-results.json', JSON.stringify({ checkedAt: new Date().toISOString(), completed: true, groups: cases.length, cases, navigationObservation, staleReadObservation, renderErrors, unexpectedImports, sourceHashes, presentationStubs: presentationPaths, actualFullPageReact: true, actualImageReadHook: true, syntheticNetworkAndClock: true, realNetworkRequests: realNetworkAttempts, providerRequests: 0, productionWrites: 0, wholeAuditComplete: false }, null, 2) + '\n');
        console.log(JSON.stringify({ completed: true, groups: cases.length, navigationObservation, staleReadObservation, renderErrors, sourceFiles: Object.keys(sourceHashes).length }));
    }
    catch (e) {
        fs.writeFileSync(out + '/full-page-mounted-failure.json', JSON.stringify({ completed: false, groups: cases.length, error: e.message, renderErrors, unexpectedImports }, null, 2));
        console.log(JSON.stringify({ completed: false, groups: cases.length, error: e.message, renderErrors, unexpectedImports }));
        process.exitCode = 1;
    }
    finally {
        console.error = realConsoleError;
        dom.window.close();
    }
})();
