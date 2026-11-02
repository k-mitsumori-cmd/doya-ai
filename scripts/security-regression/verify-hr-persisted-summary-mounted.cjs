process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const React = require('react'), ts = require('typescript'), { JSDOM } = require('jsdom');
const sourceRoot = process.env.DOYA_TEST_BASELINE || path.resolve(__dirname, '../..');
const dom = new JSDOM('<body></body>', { url: 'https://synthetic.test' });
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
const forbidden = () => { throw Error('Unexpected write, provider, navigation or toast'); };
const act = fn => React.act(async () => { await fn(); for (let i = 0; i < 5; i++) await new Promise(setImmediate); });
const motion = new Proxy({}, { get: (_target, tag) => props => {
  const { initial, animate, exit, transition, whileHover, whileTap, layout, ...rest } = props;
  return React.createElement(tag, rest);
} });
function load(file, mocks) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(sourceRoot, file), 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, { exports, require: name => {
    assert(name in mocks, 'Unmocked dependency: ' + name);
    return mocks[name];
  }, crypto: require('node:crypto'), console, Date, setTimeout, clearTimeout }, { filename: file });
  return exports;
}
let responseRecord, requests = [];
const request = async (url, init) => { assert(!init?.method || init.method === 'GET'); requests.push(url); return Response.json({ oneOnOne: responseRecord }); };
const common = {
  react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
  'framer-motion': { motion, AnimatePresence: ({ children }) => children },
  '@/components/hr/HrOrganizationScope': { useHrOrganizationRequest: () => ({ request }) },
  '@/lib/hr/use-page-lifetime': { useHrPageLifetime: () => ({ toast: { error: forbidden }, router: { back: forbidden, push: forbidden }, live: () => true }) },
};
const items = load('src/lib/hr/one-on-one-items.ts', {});
const panel = load('src/components/hr/AiInsightPanel.tsx', common);
const Form = load('src/components/hr/OneOnOneForm.tsx', { ...common, './AiInsightPanel': panel, '@/lib/hr/one-on-one-items': items }).default;
const Page = load('src/app/(shell)/hr/one-on-one/[id]/page.tsx', { ...common,
  'next/navigation': { useParams: () => ({ id: 'saved' }), useRouter: () => ({}) },
  '@/components/hr/ui-next': { PageTitle: ({ children, ...props }) => React.createElement('h2', props, children) },
  '@/components/hr/OneOnOneForm': { default: Form, __esModule: true },
}).default;
let root, host; const cases = [];
async function mount(Component, props) { host = document.createElement('div'); document.body.append(host); root = createRoot(host); await act(() => root.render(React.createElement(Component, props))); }
async function close() { await act(() => root.unmount()); host.remove(); root = null; }
const text = () => host.textContent;
const generateButton = () => [...host.querySelectorAll('button')].find(e => e.textContent.includes('AI要約生成'));
(async () => {
  for (const completed of [false, true]) {
    responseRecord = { id: 'saved', employeeId: 'employee', employeeName: 'Synthetic', duration: null, date: null, agenda: [], actionItems: [], sharedNote: null, managerNote: null, canViewManagerNotes: true, status: completed ? 'COMPLETED' : 'SCHEDULED', aiSummary: 'SYNTHETIC_PERSISTED_SUMMARY' };
    requests = []; await mount(Page);
    assert(text().includes('SYNTHETIC_PERSISTED_SUMMARY'), 'Saved summary must survive opening the detail page, including completed records');
    assert.equal(Boolean(generateButton()), !completed); assert.equal(requests.length, 1);
    assert(requests[0].endsWith('/saved')); cases.push(completed ? 'Completed saved summary visible without generation or save controls' : 'Editable saved summary visible after GET without generation');
    if (completed) assert(![...host.querySelectorAll('button')].some(e => e.textContent.includes('保存する')));
    await close();
  }
  for (const readOnly of [false, true]) {
    const props = { recordId: 'saved', initialAiSummary: 'SYNTHETIC_PRIVATE_SUMMARY', canViewManagerNotes: true, readOnly };
    requests = []; await mount(Form, props); assert(text().includes('SYNTHETIC_PRIVATE_SUMMARY'));
    await act(() => root.render(React.createElement(Form, { ...props, canViewManagerNotes: false })));
    assert(!text().includes('SYNTHETIC_PRIVATE_SUMMARY')); assert(!generateButton());
    assert.equal(requests.length, 0); cases.push('Permission downgrade hides existing private summary: readOnly=' + readOnly); await close();
    await mount(Form, { ...props, canViewManagerNotes: false }); assert(!text().includes('SYNTHETIC_PRIVATE_SUMMARY')); assert(!generateButton()); await close();
  }
  for (const summary of [null, undefined, '']) {
    requests = []; await mount(Form, { readOnly: true, canViewManagerNotes: true, initialAiSummary: summary });
    assert(!text().includes('AIが生成しました')); assert(!generateButton()); assert.equal(requests.length, 0); await close();
  }
  cases.push('Empty and nullable completed summaries do not create a blank result or paid call');
  console.log(JSON.stringify({ passed: cases.length, cases, scope: 'Actual detail page, Form and insight panel under React/jsdom; synthetic readonly GET. No model, mutation, browser or customer data.' }));
})().catch(async error => { console.error(error); if (root) await close(); process.exitCode = 1; });
