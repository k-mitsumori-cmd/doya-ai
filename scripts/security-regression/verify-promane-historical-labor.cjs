process.env.NODE_ENV = 'test';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server'), { JSDOM } = require('jsdom'), ts = require('typescript');
const root = process.cwd(), sourceRoot = process.env.DOYA_TEST_BASELINE || root;
let currentMembers = [], reads = 0;
function Null() { return null; }
function FinanceMarker() { return null; }
function Block({ children }) { return React.createElement('div', null, children); }
const project = { id: 'project-synthetic', workspaceId: 'workspace-synthetic', name: 'Synthetic project', status: 'in_progress', billingType: 'fixed', contractAmount: 120000, startDate: null, endDate: null, client: null, tasks: [], expenses: [{ id: 'expense-synthetic', category: 'outsource', amount: 5500, description: 'Synthetic expense', date: new Date('2026-10-29T00:00:00Z') }] };
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(path.join(sourceRoot, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, require: n => {
    if (n === 'react' || n === 'react/jsx-runtime') return require(n);
    if (n === 'next/navigation') return { redirect() { throw Error('Unexpected redirect'); }, useRouter: () => ({ refresh() {}, replace() {} }) };
    if (n === '@/lib/promane/auth') return { requirePromaneAuth: async () => ({ user: { id: 'owner-synthetic' } }), getWorkspaceBySlug: async () => ({ id: project.workspaceId, members: [{ role: 'owner' }] }) };
    if (n === '@/lib/prisma') return { prisma: {
      promaneProject: { findFirst: async query => { assert.equal(query.where.id, project.id); assert.equal(query.where.workspaceId, project.workspaceId); reads++; return project; } },
      promaneMember: { findMany: async query => { assert.equal(query.where.workspaceId, project.workspaceId); reads++; return currentMembers; } },
    } };
    if (n === '@/components/promane/finance-tab') return { FinanceTab: FinanceMarker };
    if (n === '@/lib/promane/use-expense-creation') return { useExpenseCreation() { throw Error('Readonly view must not mount write hook'); } };
    if (n === '@/components/promane/confirm-dialog') return { useConfirm() { throw Error('Readonly view must not mount confirmation hook'); } };
    if (n === 'next/link' || n === 'next/image') return { __esModule: true, default: Null };
    if (n === 'sonner') return { toast: { success() { throw Error('Unexpected toast'); }, error() { throw Error('Unexpected toast'); } } };
    if (n === 'lucide-react') return new Proxy({}, { get: () => Null });
    if (n.startsWith('@/lib/promane/')) return load('src/' + n.slice(2) + '.ts');
    if (n.startsWith('@/components/promane/ui/')) return new Proxy({}, { get: () => Block });
    if (n.startsWith('@/components/promane/')) return new Proxy({ __esModule: true, default: Null }, { get: (o, k) => k in o ? o[k] : Null });
    throw Error('Unmocked import ' + n);
  }, console, Date }, { filename: file });
  return exports;
}
function findElement(node, type) {
  if (!node || typeof node !== 'object') return null;
  if (node.type === type) return node;
  for (const child of React.Children.toArray(node.props?.children)) { const found = findElement(child, type); if (found) return found; }
  return null;
}
const cases = [
  { name: 'Historical snapshot survives current rate zero', members: [{ current: 0, entries: [[90, 3000]], expected: 4500 }] },
  { name: 'Historical snapshot survives current rate increase', members: [{ current: 4000, entries: [[90, 3000]], expected: 4500 }] },
  { name: 'Multiple historical rates are summed per entry', members: [{ current: 9000, entries: [[60, 3000], [30, 4000]], expected: 5000 }] },
  { name: 'Zero snapshot remains zero', members: [{ current: 5000, entries: [[90, 0]], expected: 0 }] },
  { name: 'Legacy null snapshot keeps established current-rate fallback', members: [{ current: 3000, entries: [[30, null]], expected: 1500 }] },
  { name: 'Legacy and historical entries coexist', members: [{ current: 5000, entries: [[30, null], [30, 3000]], expected: 4000 }] },
  { name: 'Members retain their own snapshot totals', members: [{ current: 0, entries: [[90, 3000]], expected: 4500 }, { current: 8000, entries: [[30, 4000]], expected: 2000 }] },
  { name: 'Fractional cost is preserved until display formatting', members: [{ current: 0, entries: [[1, 100]], expected: 100 / 60 }] },
];
(async () => {
  const Page = load('src/app/(shell)/promane/[workspaceSlug]/projects/[projectId]/page.tsx').default;
  const FinanceTab = load('src/components/promane/finance-tab.tsx').FinanceTab;
  const { formatCurrency } = load('src/lib/promane/format.ts');
  const passed = [];
  for (const test of cases) {
    currentMembers = test.members.map((m, i) => ({ id: 'member-' + i, displayName: 'Synthetic member ' + i, hourlyRate: m.current, timeEntries: m.entries.map(([duration, hourlyRateSnapshot]) => ({ duration, hourlyRateSnapshot })) }));
    const expectedCost = test.members.reduce((sum, m) => sum + m.expected, 0), expectedMinutes = test.members.flatMap(m => m.entries).reduce((sum, e) => sum + e[0], 0);
    const tree = await Page({ params: Promise.resolve({ workspaceSlug: 'synthetic', projectId: project.id }) });
    const finance = findElement(tree, FinanceMarker); assert.ok(finance, test.name);
    assert.equal(finance.props.laborCost, expectedCost, test.name + ': aggregate'); assert.equal(finance.props.totalMinutes, expectedMinutes);
    assert.equal(finance.props.canWrite, true, 'Owner capability remains available');
    for (let i = 0; i < test.members.length; i++) assert.equal(finance.props.members[i].laborCost, test.members[i].expected, test.name + ': member cost');
    const dom = new JSDOM(renderToStaticMarkup(React.createElement(FinanceTab, { ...finance.props, canWrite: false })));
    const body = dom.window.document.body;
    for (let i = 0; i < test.members.length; i++) {
      const name = [...body.querySelectorAll('span')].find(e => e.textContent === 'Synthetic member ' + i); assert.ok(name);
      const row = name.parentElement.parentElement;
      assert.ok(row.textContent.includes(formatCurrency(test.members[i].expected)), test.name + ': displayed member cost');
      assert.ok(row.textContent.includes('作業記録ごとに集計'));
    }
    assert.ok(!body.textContent.includes('/h'), 'Do not present one current rate for mixed historical entries');
    assert.ok(body.textContent.includes(formatCurrency(expectedCost))); assert.ok(body.textContent.includes('Synthetic expense'));
    assert.equal(body.querySelectorAll('button,form').length, 0, 'Readonly finance remains read-only');
    dom.window.close(); passed.push(test.name);
  }
  assert.equal(reads, cases.length * 2);
  console.log(JSON.stringify({ passed: passed.length, checks: passed, scope: 'Actual project server page calculation -> actual FinanceTab server rendering with synthetic auth/Prisma/decorative mocks. No real DB, network/provider, browser or production verification. Existing null fallback and raw aggregate rounding policy retained.' }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
