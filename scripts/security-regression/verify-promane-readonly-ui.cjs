process.env.NODE_ENV = 'test';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = process.cwd(), req = n => require(path.join(root, 'node_modules', n));
const ts = req('typescript'), React = req('react'), { JSDOM } = req('jsdom');
const dom = new JSDOM('<body></body>', { url: 'https://example.invalid/promane/synthetic' });
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = req('react-dom/client');
const modules = new Map(), hooks = [], mutations = [], sortable = [], reads = []; let dnd, pageRole = 'guest';
const Null = () => null;
function ui(tag) { return function SyntheticElement({ children, ...p }) { return React.createElement(tag, p, children); }; }
const hook = kind => (...args) => { hooks.push({ kind, args }); return { status: 'ready', scopeKey: 'synthetic', save: async () => { mutations.push(kind); return true; } }; };
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const exports = {}; modules.set(file, exports);
  const requireLocal = n => {
    if (n === 'react' || n === 'react/jsx-runtime') return req(n);
    if (n === 'next/navigation') return { redirect: () => { throw Error('Unexpected redirect'); }, notFound: () => { throw Error('Unexpected missing project'); }, useRouter: () => ({ refresh() {}, replace() {} }) };
    if (n === 'next/link') return { __esModule: true, default: ui('a') };
    if (n === '@/lib/promane/auth') return { requirePromaneAuth: async () => ({ user: { id: 'synthetic' } }), getWorkspaceBySlug: async () => ({ id: 'ws-synthetic', members: [{ role: pageRole }] }) };
    if (n === '@/lib/prisma') return { prisma: { promaneClient: { findMany: async () => { reads.push('clients'); return []; } }, promaneProject: { findFirst: async () => { reads.push('project'); return { id: 'p-synthetic', name: 'Synthetic project' }; } } } };
    if (n === '@/components/promane/project-form') return { ProjectForm: () => React.createElement('form', { 'aria-label': 'project-editor' }) };
    if (n === '@/components/promane/PromanePageHeading') return { __esModule: true, default: ui('h2') };
    if (n === 'next/image') return { __esModule: true, default: ({ unoptimized, ...p }) => React.createElement('img', p) };
    if (n === 'sonner') return { toast: { success() {}, error() {} } };
    if (n === 'lucide-react') return new Proxy({}, { get: () => Null });
    if (n.includes('use-expense-creation')) return { useExpenseCreation: hook('expense') };
    if (n.includes('use-client-creation')) return { useClientCreation: hook('client') };
    if (n.includes('use-time-entry-creation')) return { useTimeEntryCreation: hook('time') };
    if (n.includes('/actions-')) return new Proxy({}, { get: (_, k) => async () => { mutations.push(k); } });
    if (n.endsWith('/confirm-dialog')) return { useConfirm: () => ({ confirm: async () => true, ConfirmDialog: Null }) };
    if (n.includes('/ui/')) {
      const leaf = n.split('/').pop();
      if (leaf === 'input') return { Input: ui('input') };
      if (leaf === 'button') return { Button: ({ variant, size, ...p }) => React.createElement('button', p) };
      if (leaf === 'label') return { Label: ui('label') };
      if (leaf === 'select') return new Proxy({}, { get: () => Null });
      if (leaf === 'dialog') return new Proxy({ DialogTrigger: ({ render }) => render, Dialog: ({ children }) => children }, { get: (o,k) => k in o ? o[k] : ui('div') });
      return new Proxy({}, { get: () => ui('div') });
    }
    if (n === '@dnd-kit/core') return {
      DndContext: ({ children, ...p }) => { dnd = p; return children; }, DragOverlay: ui('div'),
      closestCorners() {}, PointerSensor() {}, useSensor() {}, useSensors() {}, useDroppable: () => ({ setNodeRef() {}, isOver: false }),
    };
    if (n === '@dnd-kit/sortable') return { SortableContext: ({ children }) => children, verticalListSortingStrategy() {}, useSortable: p => { sortable.push(p); return { attributes: {}, listeners: {}, setNodeRef() {}, transform: null }; } };
    if (n === '@dnd-kit/utilities') return { CSS: { Transform: { toString() {} } } };
    if (n === 'clsx') return { clsx: (...v) => v.filter(Boolean).join(' ') };
    if (n === 'tailwind-merge') return { twMerge: x => x };
    let target = n.startsWith('@/') ? path.join('src', n.slice(2)) : n.startsWith('.') ? path.join(path.dirname(file), n) : null;
    if (target) { for (const ext of ['.tsx', '.ts']) if (fs.existsSync(path.join(root, target + ext))) return load(target + ext); }
    throw Error('Unmocked import ' + n + ' in ' + file);
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, { exports, require: requireLocal, window: dom.window, document: dom.window.document, console, Date, setTimeout, clearTimeout, fetch: async () => { throw Error('Unexpected transport'); } }, { filename: file });
  return exports;
}
const container = document.createElement('div'); document.body.append(container); const renderer = createRoot(container);
const act = fn => React.act(async () => { await fn(); await new Promise(setImmediate); });
const render = async (Component, props) => act(() => renderer.render(React.createElement(React.StrictMode, null, React.createElement(Component, props))));
const props = el => { assert.ok(el); return el[Object.keys(el).find(k => k.startsWith('__reactProps$'))]; };
const button = text => [...container.querySelectorAll('button')].find(x => x.textContent === text);
const shared = { workspaceSlug: 'synthetic', workspaceId: 'ws-synthetic', projectId: 'p-synthetic', memberId: 'm-synthetic' }, checks = [];
(async () => {
  const canWrite = load('src/lib/promane/ui-permissions.ts').canWritePromaneWorkspace;
  for (const role of ['owner', 'admin', 'member']) assert.equal(canWrite(role), true);
  for (const role of ['guest', 'unknown', undefined, null, {}, 'OWNER']) assert.equal(canWrite(role), false);
  const cases = [
    ['finance-tab', 'FinanceTab', { ...shared, laborCost: 4500, totalMinutes: 90, expenses: [{ id: 'e', category: 'outsource', amount: 5500, description: 'Synthetic expense', date: '2026-10-29' }], members: [{ id: 'm', displayName: 'Synthetic member', hourlyRate: 3000, minutes: 90 }] }, 'Synthetic expense', '追加'],
    ['client-actions', 'ClientActions', { ...shared, clients: [{ id: 'c', name: 'Synthetic client', contactName: null, email: null, totalRevenue: 120000, projectCount: 1, activeCount: 1 }] }, 'Synthetic client', '顧客を追加'],
    ['timesheet-view', 'TimesheetView', { ...shared, totalCount: 1, totalMinutes: 90, periodLabel: '全期間', projects: [], entries: [{ id: 't', taskId: null, duration: 90, date: '2026-10-29', note: 'Synthetic note', projectName: 'Synthetic project', taskTitle: null }] }, 'Synthetic project', '時間を記録'],
  ];
  for (const [file, name, data, visible, createLabel] of cases) {
    const Component = load('src/components/promane/' + file + '.tsx');
    const before = hooks.length;
    await render(Component[name], { ...data, canWrite: false });
    assert.ok(container.textContent.includes(visible)); assert.equal(hooks.length, before);
    assert.equal(container.querySelectorAll('form,input,textarea,select,button').length, 0);
    for (const role of ['owner', 'admin', 'member']) {
      await render(Component[name], { ...data, canWrite: canWrite(role) });
      assert.ok(button(createLabel)); assert.ok(hooks.length > before); assert.ok(container.textContent.includes(visible));
    }
    const afterWriter = hooks.length;
    await render(Component[name], { ...data, canWrite: false });
    assert.equal(hooks.length, afterWriter); assert.equal(container.querySelectorAll('form,button').length, 0);
    checks.push(name + ': readonly retains records without creation/recovery hooks, all writer roles retain controls, downgrade unmounts writer');
  }
  const task = { id: 'task', title: 'Synthetic task', description: 'Preserved details', status: 'done', priority: 'urgent', assigneeId: null, startDate: null, dueDate: null };
  const Modal = load('src/components/promane/task-edit-modal.tsx').TaskEditModal;
  await render(Modal, { workspaceSlug: 'synthetic', canWrite: false, task, members: [], open: true, onClose() {} });
  assert.ok(container.textContent.includes('タスク詳細')); assert.equal(container.querySelector('textarea').value, task.description);
  assert.ok([...container.querySelectorAll('input,textarea')].every(x => x.readOnly));
  assert.ok([...container.querySelectorAll('select')].every(x => x.disabled));
  assert.ok(!button('保存')); assert.ok(!button('削除')); assert.ok(button('閉じる'));
  checks.push('Task details and memo remain readable; readonly fields have no save/delete controls');
  const Gantt = load('src/components/promane/gantt-chart.tsx').GanttChart;
  await render(Gantt, { workspaceSlug: 'synthetic', tasks: [task], members: [], canWrite: false, projectStartDate: null, projectEndDate: null });
  assert.ok(container.textContent.includes('日程未設定')); assert.ok(!container.textContent.includes('クリックして日程設定'));
  await act(() => props(container.querySelector('[title="タスク詳細を表示"]')).onClick());
  assert.ok(container.querySelector('[role="dialog"]')); assert.ok(!button('保存'));
  checks.push('Readonly Gantt keeps week navigation and opens task details without date editor');
  const Kanban = load('src/components/promane/kanban-board.tsx').KanbanBoard;
  await render(Kanban, { workspaceSlug: 'synthetic', tasks: [{ ...task, order: 0, totalMinutes: 0, assigneeName: null }], members: [], canWrite: false });
  assert.ok(sortable.length); assert.ok(sortable.every(x => x.disabled));
  await act(() => dnd.onDragEnd({ active: { id: task.id }, over: { id: 'todo' } }));
  await act(() => props(container.querySelector('[aria-label="Synthetic taskの詳細を表示"]')).onClick({ stopPropagation() {}, preventDefault() {} }));
  assert.ok(container.textContent.includes('タスク詳細')); assert.ok(!button('保存')); assert.equal(mutations.length, 0);
  checks.push('Readonly Kanban disables sorting and ignores drag mutation; details remain accessible');
  await render(Modal, { workspaceSlug: 'synthetic', canWrite: true, task, members: [], open: true, onClose() {} });
  assert.ok(button('保存')); assert.ok(button('削除')); assert.equal(container.querySelector('textarea').readOnly, false);
  checks.push('Writable task modal retains editing and deletion');
  for (const file of ['projects/new/page.tsx', 'projects/[projectId]/edit/page.tsx']) {
    const Page = load('src/app/(shell)/promane/[workspaceSlug]/' + file).default;
    for (const role of ['guest', 'unknown', 'owner', 'admin', 'member']) {
      pageRole = role; const before = reads.length;
      const element = await Page({ params: Promise.resolve({ workspaceSlug: 'synthetic', projectId: 'p-synthetic' }) });
      await act(() => renderer.render(element));
      assert.equal(!!container.querySelector('form[aria-label="project-editor"]'), canWrite(role));
      if (!canWrite(role)) { assert.equal(reads.length, before); assert.ok(container.textContent.includes('閲覧のみ')); }
    }
    checks.push(file + ': actual server page rejects guest/unknown editor before data queries and preserves owner/admin/member editor');
  }
  await act(() => renderer.unmount()); dom.window.close();
  console.log(JSON.stringify({ passed: checks.length, checks, scope: 'Mounted actual components under StrictMode with synthetic data and bounded creation/DnD/UI mocks. No DB, network, provider, real account or production verification.' }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; dom.window.close(); });
