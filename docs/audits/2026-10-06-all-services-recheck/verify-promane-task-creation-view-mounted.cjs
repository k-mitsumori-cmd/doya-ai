process.env.NODE_ENV = 'test';
const fs = require('node:fs'), vm = require('node:vm'), crypto = require('node:crypto');
const assert = require('node:assert/strict'), ts = require('typescript'), React = require('react');
const {load}=require('../../../scripts/security-regression/load-typescript.cjs');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<body/>', { url: 'https://example.invalid' });
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let calls = [], successes = [], refreshes = 0, implementation, recoverImpl;
let actorId='staff'; const locks=new Map();
const taskInput=load('src/lib/promane/task-input.ts',{'./time-input':load('src/lib/promane/time-input.ts')});
const actionMocks={createTask:async(...args)=>{calls.push(args);return implementation(...args)},recoverTaskCreation:async(...args)=>recoverImpl(...args)};
const hook=load('src/lib/promane/use-task-creation.ts',{'react':React,'./task-input':taskInput,'./actions-tasks':actionMocks,'next-auth/react':{useSession:()=>({data:{user:{id:actorId}},status:'authenticated'})}}, {window:dom.window,navigator:{locks:{request(key,work){const run=(locks.get(key)||Promise.resolve()).then(work);locks.set(key,run.catch(()=>{}));return run}}},crypto:crypto.webcrypto,setTimeout,clearTimeout});
const saved=data=>({...data,id:'synthetic-task',startDate:data.startDate?new Date(data.startDate+'T00:00:00.000Z'):null,dueDate:data.dueDate?new Date(data.dueDate+'T00:00:00.000Z'):null});
const Noop = () => null;
const element = tag => ({ children, ...props }) => React.createElement(tag, props, children);
const mocks = {
  react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
  '@/lib/promane/use-task-creation':hook,'@/lib/promane/task-input':taskInput,'@/components/promane/confirm-dialog':{useConfirm:()=>({confirm:async()=>true,ConfirmDialog:Noop})},
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
  calls = []; successes = []; refreshes = 0; actorId='staff';dom.window.localStorage.clear();locks.clear();recoverImpl=async()=>({state:'missing',entry:null});
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
    assert.equal(calls.length, 1);
    await act(async () => { resolvers.forEach(resolve => resolve(saved(calls[0][1]))); await Promise.all(waits); });
    assert.equal(successes.length, 1); assert.equal(refreshes, 1);
    cases.push({ finding: 'same-frame submit invokes one creation', actionCalls: 1, successToasts: 1, refreshes: 1 });
    await item.close(); item = await mount(); implementation = async () => ({});
    await act(() => props(item.div.querySelector('form')).onSubmit({ preventDefault() {} }));
    assert.equal(successes.length, 0); assert.equal(refreshes, 0); assert.equal(item.div.querySelector('input').value, 'Private synthetic task');assert(item.div.textContent.includes('保存結果を確認できません'));
    cases.push({ finding: 'empty action acknowledgement retains draft without success', acknowledgement: {}, successToasts: 0, clearedDraft: false });
    await item.close(); item = await mount(); item.switchProject(); await act(item.render);
    assert.equal(item.div.querySelector('input').value, '');
    cases.push({finding:'same-mounted project change clears previous project draft'});
    await item.close();item=await mount();implementation=async()=>{throw Error('Lost response')};
    await act(()=>props(item.div.querySelector('form')).onSubmit({preventDefault(){}}));
    assert.equal(item.div.querySelector('input').value,'Private synthetic task');
    recoverImpl=async()=>({state:'cancelled',entry:null});
    const cancel=[...item.div.querySelectorAll('button')].find(b=>b.textContent==='未完了の送信を取り消す');
    await act(()=>props(cancel).onClick());
    assert.equal(item.div.querySelector('input').value,'Private synthetic task');assert.equal(calls.length,1);
    cases.push({finding:'explicit cancellation of missing save preserves draft and does not resend'});
    await item.close();item=await mount();implementation=async()=>{throw Error('Lost response')};
    await act(()=>props(item.div.querySelector('form')).onSubmit({preventDefault(){}}));
    recoverImpl=async()=>({state:'found',entry:saved(calls[0][1])});
    await act(()=>props([...item.div.querySelectorAll('button')].find(b=>b.textContent==='保存状態を確認')).onClick());
    assert.equal(item.div.querySelector('input').value,'');assert.equal(calls.length,1);assert.equal(refreshes,1);
    cases.push({finding:'recover saved task clears draft and refreshes without creating again'});
    await item.close();item=await mount();actorId='different';await act(item.render);assert.equal(item.div.querySelector('input').value,'');
    cases.push({finding:'account switch clears previous private draft'});
    const report = { checkedAt: new Date().toISOString(), expected: 6, passed: cases.length, cases,
      sourceHashes:Object.fromEntries([file,'src/lib/promane/use-task-creation.ts','src/lib/promane/task-input.ts'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),
      scope: 'Actual TaskCreateForm mounted in React StrictMode with controlled input state. Actual hook/parser and task form, synthetic actions/session/navigation and select shells. Not native browser, actual Next action transport, database-linked UI or production/customer writes.' };
    fs.writeFileSync('docs/audits/2026-10-06-all-services-recheck/promane-task-creation-view-mounted-results.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
  } finally { if (item) await item.close(); dom.window.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
