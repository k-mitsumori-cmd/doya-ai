process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const Module = require('node:module');
const root = path.resolve(__dirname, '../..');
const req = Module.createRequire(path.join(root, 'package.json'));
const React = req('react');
const ts = req('typescript');
const { renderToStaticMarkup } = req('react-dom/server');
const nextNavigation = req('next/navigation');
const Link = ({ href, children }) => React.createElement('a', { href }, children);
const Null = () => null;

function load(relative, mocks) {
  const exports = {};
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, {
    exports,
    require(id) {
      if (id === 'react' || id === 'react/jsx-runtime') return req(id);
      if (Object.hasOwn(mocks, id)) return mocks[id];
      throw new Error(`Unmocked ${id} from ${relative}`);
    },
    console,
  }, { filename: relative });
  return exports;
}

const Dashboard = load('src/app/kantan/dashboard/page.tsx', { 'next/navigation': nextNavigation }).default;
for (const [name, props] of [
  ['direct-old-url', undefined],
  ['loggedOut-query', { searchParams: Promise.resolve({ loggedOut: '1' }) }],
  ['signed-in-entry', { session: { user: { id: 'actor' } } }],
  ['guest-entry', { session: null }],
]) {
  assert.throws(() => Dashboard(props), error => {
    assert.equal(error.digest, 'NEXT_REDIRECT;replace;/kantan/dashboard/text;307;');
    return true;
  }, name);
}
console.log('PASS actual dashboard page always yields a temporary 307 to /kantan/dashboard/text');

let session = { user: { id: 'actor' } };
const entry = load('src/app/kantan/page.tsx', {
  'next-auth/react': { useSession: () => ({ data: session }) },
  '@/lib/services': { getServiceById: () => ({ features: [], useCases: [] }) },
  './lp-data': { ACCENT: '#000', CTA: '/auth/signin?service=kantan', STEPS: [], BENEFITS: [], FAQ: [] },
  '@/components/lp': {
    LpShell: ({ children, ctaHref }) => React.createElement('main', { 'data-kind': 'lp', 'data-cta': ctaHref }, children),
    Hero: ({ ctaHref }) => React.createElement('a', { href: ctaHref }, 'hero'),
    HowItWorks: Null, Benefits: Null, FeatureGrid: Null, UseCases: Null, FaqSection: Null, CtaBand: Null,
  },
}).default;
assert.match(renderToStaticMarkup(React.createElement(entry)), /href="\/kantan\/dashboard"/);
session = null;
const guestHtml = renderToStaticMarkup(React.createElement(entry));
assert.match(guestHtml, /data-kind="lp"/);
assert.match(guestHtml, /href="\/auth\/signin\?service=kantan"/);
console.log('PASS actual LP logged-in CTA retains old alias and guest remains public LP');

const pricing = load('src/app/kantan/pricing/page.tsx', {
  'next/link': { __esModule: true, default: Link },
  'next-auth/react': { useSession: () => ({ data: { user: { id: 'actor' } } }) },
  'lucide-react': new Proxy({}, { get: () => Null }),
  '@/lib/unified-plan': { UNIFIED_PRO_PLAN_ID: 'unified-pro' },
  '@/lib/pricing': { KANTAN_PRICING: { plans: [{ id: 'free', name: '無料', price: 0, priceLabel: '無料', features: [{ text: 'fixture' }], cta: '作業画面へ' }] }, getAnnualMonthlyPrice: value => value },
  '@/components/CheckoutButton': { CheckoutButton: Null },
  '@/components/TrialCallout': { TrialBadge: Null, TrialNote: Null },
}).default;
const pricingHtml = renderToStaticMarkup(React.createElement(pricing));
assert.match(pricingHtml, /href="\/kantan\/dashboard"/);
assert.match(pricingHtml, /href="\/kantan"/);
console.log('PASS actual public pricing free work CTA retains alias and Top remains LP');

const templates = load('src/lib/templates.ts', {});
const detail = load('src/app/kantan/dashboard/text/[templateId]/page.tsx', {
  'next/link': { __esModule: true, default: Link },
  'next/navigation': { useParams: () => ({ templateId: 'unknown-template' }), useRouter: () => ({ push() {}, replace() {} }) },
  'next-auth/react': { useSession: () => ({ data: session, status: 'unauthenticated' }) },
  'lucide-react': new Proxy({}, { get: () => Null }),
  'react-hot-toast': { __esModule: true, default: { success() {}, error() {} }, Toaster: Null },
  '@/lib/templates': templates,
  '@/lib/pricing': { GUEST_DAILY_LIMIT: 3, getGuestUsage: () => ({ date: '', count: 0 }) },
}).default;
const notFound = renderToStaticMarkup(React.createElement(detail));
assert.match(notFound, /テンプレートが見つかりません/);
assert.match(notFound, /href="\/kantan\/dashboard"/);
console.log('PASS actual missing-template Back retains old alias');

const servicesSource = fs.readFileSync(path.join(root, 'src/lib/services.ts'), 'utf8');
const kantanStart = servicesSource.indexOf("id: 'kantan',");
const kantanService = servicesSource.slice(kantanStart, servicesSource.indexOf("id: 'banner',", kantanStart));
assert.ok(kantanService.includes("dashboardHref: '/kantan/dashboard'"));
assert.ok(kantanService.includes("status: 'maintenance'"));
console.log('CONTROL services maintenance dashboardHref still uses alias');

const destination = spawnSync(process.execPath, [path.join(__dirname, 'verify-banner-kantan-work-navigation.cjs')], {
  cwd: root, encoding: 'utf8', timeout: 60000,
});
assert.equal(destination.error, undefined);
assert.equal(destination.status, 0, destination.stderr);
for (const expected of ['PASS text brand=/kantan/dashboard/text', 'PASS text/[templateId] brand=/kantan/dashboard/text']) {
  assert.ok(destination.stdout.includes(expected), expected);
}
assert.match(destination.stdout, /actual template definitions; text list card and detail input\/action checked without generation/);
console.log('PASS actual destination list/card and actual template detail input/action; network/provider calls zero');
console.log(JSON.stringify({ passed: 9, scope: 'Actual Next redirect sentinel, actual LP/pricing/missing-template controls, registry data source, and independently mounted actual destination. No OAuth/DB/provider/network writes.' }));
