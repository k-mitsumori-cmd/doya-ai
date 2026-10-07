process.env.NODE_ENV = 'test';
const fs = require('node:fs'), vm = require('node:vm'), crypto = require('node:crypto');
const assert = require('node:assert/strict'), ts = require('typescript'), React = require('react');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<body/>', { url: 'https://example.invalid' });
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let calls = [], successes = [], refreshes = 0, implementation;
const Noop = () => null;
const element = tag => ({ children, ...props }) => React.createElement(tag, props, children);
const mocks = {
  react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
  '@/lib/promane/actions-tasks': { createTask: async (...args) => { calls.push(args); return implementation(...args); } },
  'next/navigation': { useRouter: () => ({ refresh: () => refreshes++ }) },
  '@/components/promane/ui/button': { Button: element('button') },
  '@/components/promane/ui/input': { Input: element('input') },
  '@/components/promane/ui/select': Object.fromEntries(['Select', 'SelectContent', 'SelectItem', 'SelectTrigger', 'SelectValue'].map(name => [name, Noop])),
  'lucide-react': { Plus: Noop }, 'next/image': { __esModule: true, default: Noop },
  sonner: { toast: { success: message => successes.push(message), error: () => {} } },
};
const file = 'src/components/promane/task-create-form.tsx', exportsForView = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
}}).outputText, { exports: exportsForView, require: name => { if (name in mocks) return mocks[name]; throw Error(name); }, setTimeout: () => 0, console }, { filename: file });
const props = element => element[Object.keys(element).find(key => key.startsWith('__reactProps$'))];
const act = fn => React.act(async () => { await fn(); for (let i = 0; i < 5; i++) await new Promise(setImmediate); });
async function mount() {
  calls = []; successes = []; refreshes = 0;
  const div = document.createElement('div'); document.body.append(div); const root = createRoot(div);
  let projectId = 'synthetic-project-a';
  const render = () => root.render(React.createElement(React.StrictMode, null, React.createElement(exportsForView.TaskCreateForm, { workspaceSlug: 'synthetic-workspace', projectId, members: [] })));
  await act(render);
  await act(() => props(div.querySelector('input')).onChange({ target: { value: 'Private synthetic task' } }));
  return { div, render, switchProject() { projectId = 'synthetic-project-b'; }, async close() { await act(() => root.unmount()); div.remove(); } };
}
(async () => {
  const cases = []; let item;
  try {
    item = await mount(); const resolvers = []; implementation = () => new Promise(resolve => resolvers.push(resolve));
    const submit = props(item.div.querySelector('form')).onSubmit, waits = [];
    await act(() => { waits.push(submit({ preventDefault() {} })); waits.push(submit({ preventDefault() {} })); });
    assert.equal(calls.length, 2); assert.deepEqual(calls[0], calls[1]);
    await act(async () => { resolvers.forEach((resolve, i) => resolve({ id: 'synthetic-task-' + i })); await Promise.all(waits); });
    assert.equal(successes.length, 2); assert.equal(refreshes, 2);
    cases.push({ finding: 'same-frame submit invokes createTask twice with identical input', actionCalls: 2, successToasts: 2, refreshes: 2 });
    await item.close(); item = await mount(); implementation = async () => ({});
    await act(() => props(item.div.querySelector('form')).onSubmit({ preventDefault() {} }));
    assert.equal(successes.length, 1); assert.equal(refreshes, 1); assert.equal(item.div.querySelector('input').value, '');
    cases.push({ finding: 'empty resolved action acknowledgement displays success and discards task draft', acknowledgement: {}, successToasts: 1, clearedDraft: true });
    await item.close(); item = await mount(); item.switchProject(); await act(item.render);
    assert.equal(item.div.querySelector('input').value, 'Private synthetic task');
    implementation = async () => ({ id: 'synthetic-task-b' });
    await act(() => props(item.div.querySelector('form')).onSubmit({ preventDefault() {} }));
    assert.equal(calls[0][1].projectId, 'synthetic-project-b'); assert.equal(calls[0][1].title, 'Private synthetic task');
    cases.push({ finding: 'same-mounted project change retains previous task draft and sends it to new project', submittedProject: 'synthetic-project-b' });
    const report = { checkedAt: new Date().toISOString(), expected: 3, passed: cases.length, cases,
      sourceHashes: { [file]: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') },
      scope: 'Actual TaskCreateForm mounted in React StrictMode with controlled input state. Synthetic action/navigation and select shells. Establishes UI behavior, not database duplicates, Next transport, production impact or whether the real page remounts on project navigation.' };
    fs.writeFileSync('docs/audits/2026-10-06-all-services-recheck/promane-task-submit-baseline.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
  } finally { if (item) await item.close(); dom.window.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
