'use strict';
// 会話の確認カードと保存の間の決まりを、本物の Provider で確かめる（#135 の検証を、全部の操作へ広げたもの）。
// - 8つの操作は、本物の Provider と、値を持つだけのフォームで動かす。
// - 収入の契約と請求書は、本物のフォームも載せる。通信は作り物で、DB にも外部にも触らない。
// 通らない場面: 実際のブラウザ、ログインと権限の切り替え、実際の保存、通信の結果が分からないあとの再送。
process.env.NODE_ENV = 'test'; // React の act をこの検証のプロセスの中だけで使う
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(process.argv[2] || path.join(__dirname, '../..'));
const evidence = process.env.DOYA_AGENT_CONFIRM_EVIDENCE_DIR || null;
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'doya-agent-confirm-'));
const fromRoot = (name) => require(path.join(root, 'node_modules', name));

const CONTROLLED = {
  link: "import React from 'react';export default ({href,children,...p})=>React.createElement('a',{href,...p},children);",
  navigation: 'export const useRouter=()=>({push(){},replace(){},refresh(){}});export const usePathname=()=>window.location.pathname;export const useSearchParams=()=>new URLSearchParams(window.location.search);',
  motion: 'const tick=()=>new Promise(r=>setImmediate(r));export const blurField=()=>{};export const clearMarks=()=>{};export const clearStage=()=>{};export const cursorOff=()=>{};export const fly=async()=>{await tick()};export const focusField=async()=>{globalThis.__focusHook?.();await tick()};export const nextFrames=async()=>{await tick();await tick()};export const paceMs=()=>0;export const sleep=async()=>{await tick()};export const typeInto=async(v,set,alive)=>{if(alive())set(v)};',
};

async function build() {
  const entry = [
    "export {default as Provider,useAgentChat} from '@/components/agent-chat/AgentChatProvider';",
    "export {registerAgentForm,getAgentForm} from '@/components/agent-chat/form-bus';",
    "export {useAgentForm} from '@/components/agent-chat/useAgentForm';",
    "export {default as ContractForm} from '@/components/income/ContractForm';",
    "export {default as NewInvoicePage} from '@/app/(shell)/income/invoices/new/page';",
    "export {CHAT_OPS,INCOME_SALE_ADD,INCOME_INVOICE_DRAFT} from '@/lib/agent-chat/ops';",
  ].join('');
  await fromRoot('esbuild').build({
    stdin: { contents: entry, resolveDir: root, sourcefile: 'entry.ts', loader: 'ts' },
    outfile: path.join(out, 'bundle.cjs'),
    bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', logLevel: 'silent',
    banner: { js: `var require = require("node:module").createRequire(${JSON.stringify(path.join(root, 'package.json'))});` },
    loader: { '.css': 'empty' }, external: ['react', 'react-dom'],
    nodePaths: [path.join(root, 'node_modules')], tsconfig: path.join(root, 'tsconfig.json'),
    plugins: [{
      name: 'controlled',
      setup(b) {
        b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'controlled' }));
        b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'controlled' }));
        b.onResolve({ filter: /^\.\/motion$/ }, () => ({ path: 'motion', namespace: 'controlled' }));
        b.onLoad({ filter: /.*/, namespace: 'controlled' }, (a) => ({ contents: CONTROLLED[a.path], loader: 'js' }));
      },
    }],
  });
}

// 各操作のフォームがある画面の例（?to= を持つ操作は、運ばれた先の画面）
const SCREENS = {
  'income.contract.new': '/income/contracts/new',
  'income.invoice.new': '/income/invoices/new',
  'expense.contract.new': '/expense/sample-org/contracts/new',
  'promane.project.new': '/promane/sample-ws/projects/new',
  'kintai.request.new': '/kintai/requests/new',
  'promane.client.new': '/promane/sample-ws/clients',
  'expense.schedule.new': '/expense/sample-org/payables',
};
const SNAP = { client: 'Sample A', vendor: 'Sample A', name: 'Sample A', title: 'Sample', start: '2026-11-06', end: '2026-11-07', date: '2026-11-06', issue: '2026-11-06', due: '2026-11-30', payDate: '2026-11-06', amount: '100000', subtotal: '100000', tax: '10000', total: '110000', taxIncluded: 'false', taxRate: '10%', withholding: 'false', category: 'SaaS', cycle: '毎月', currency: 'JPY', status: '下書き', billing: '固定', typeLabel: '休暇申請', leaveLabel: '有給休暇', hours: '2', minutes: '', reason: 'Sample', contactName: '', email: '', phone: '' };
const sample = (f) => (f.type === 'yen' ? '100000' : f.type === 'date' ? '2026-11-06' : 'Sample');

(async () => {
  await build();
  const React = fromRoot('react');
  const { JSDOM } = fromRoot('jsdom');
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
  Object.assign(global, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true, CustomEvent: dom.window.CustomEvent });
  const { createRoot } = fromRoot('react-dom/client');
  const { Simulate } = fromRoot('react-dom/test-utils');
  const { act } = React;
  const fx = require(path.join(out, 'bundle.cjs'));

  let api; let reactRoot = null; let unregister = () => {};
  const posts = [];
  let gets = 0;
  global.fetch = async (url, init) => {
    if (url === '/api/income/issuer') { gets++; return Response.json({ issuer: null }); }
    if (url === '/api/income/clients') { gets++; return Response.json({ clients: [{ id: 'c1', name: 'Sample A' }] }); }
    if (url === '/api/income/contracts' && init.method === 'POST') { posts.push(JSON.parse(init.body)); return Response.json({ id: 'made' }); }
    if (url === '/api/income/invoices' && init.method === 'POST') { posts.push(JSON.parse(init.body)); return Response.json({ invoice: { id: 'made-invoice' } }); }
    throw Error('予定外の通信: ' + url);
  };
  const Probe = () => { api = fx.useAgentChat(); return null; };
  const frames = async (n = 2) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };
  const settle = async () => { for (let i = 0; i < 300 && (api.state.phase === 'working' || api.state.phase === 'submitting'); i++) await act(async () => { await frames(1); }); };
  const go = (ev) => act(async () => { api.dispatch(ev); await frames(); });
  const approve = async () => { await go({ t: 'approve' }); await settle(); };

  async function mount(child) {
    unregister(); unregister = () => {};
    if (reactRoot) await act(async () => reactRoot.unmount());
    posts.length = 0;
    reactRoot = createRoot(document.getElementById('root'));
    await act(async () => { reactRoot.render(React.createElement(fx.Provider, null, React.createElement(Probe), child || null)); });
    await act(async () => { await frames(3); });
  }
  function fake(formKey, world) {
    return fx.registerAgentForm(formKey, {
      ready: () => world.ready,
      blocked: () => world.blocked,
      setValue: () => true,
      snapshot: () => ({ ...world.snap }),
      draft: () => world.draft,
      submit: async () => { world.submits++; return { ok: true, href: SCREENS[formKey] + '/made' }; },
    });
  }
  async function startFake(op) {
    window.history.replaceState(null, '', SCREENS[op.formKey]);
    await mount();
    const world = { ready: true, blocked: null, snap: { ...SNAP }, draft: { hiddenField: 'A' }, submits: 0 };
    unregister = fake(op.formKey, world);
    const values = Object.fromEntries(op.fields.map((f) => [f.key, sample(f)]));
    await act(async () => { api.begin('sample', { kind: 'op', op, values, missing: [], say: 'sample' }); await frames(); });
    await settle();
    assert.equal(api.state.phase, 'confirm', op.key + ' は確認カードまで進む');
    assert.equal(world.submits, 0, '確認の前に保存しない');
    return world;
  }

  const checks = [];
  const check = async (name, fn) => { await fn(); checks.push(name); };

  assert.equal(fx.CHAT_OPS.length, 8, '操作を足したら、この検証の SCREENS も見直す');
  for (const op of fx.CHAT_OPS) {
    await check(`${op.key}: 変わっていなければ1回だけ保存する`, async () => {
      const w = await startFake(op);
      await act(async () => { api.dispatch({ t: 'approve' }); api.dispatch({ t: 'approve' }); await frames(); });
      await settle();
      assert.equal(w.submits, 1); assert.equal(api.state.phase, 'done');
    });
    await check(`${op.key}: カードに出る値が変わったら、出し直して止める`, async () => {
      const w = await startFake(op);
      w.snap = { ...w.snap, subtotal: '900000', amount: '900000', title: 'Changed', name: 'Changed', reason: 'Changed' };
      await approve();
      assert.equal(w.submits, 0); assert.equal(api.state.phase, 'confirm'); assert.match(api.state.notice, /保存せずに/);
      assert.equal(api.state.snap.subtotal, '900000');
      await approve();
      assert.equal(w.submits, 1, '出し直したカードで本人が押したら保存する');
    });
    await check(`${op.key}: カードに出ない欄が変わったら、止めて知らせる`, async () => {
      const w = await startFake(op);
      w.draft = { hiddenField: 'B' };
      await approve();
      assert.equal(w.submits, 0); assert.equal(api.state.phase, 'confirm'); assert.match(api.state.notice, /出ていない欄/);
      await approve();
      assert.equal(w.submits, 1);
    });
    await check(`${op.key}: 同じ名前の別のフォームには、前の確認を使わない`, async () => {
      const w = await startFake(op);
      unregister();
      const w2 = { ...w, submits: 0 };
      unregister = fake(op.formKey, w2);
      await approve();
      assert.equal(w.submits + w2.submits, 0); assert.equal(api.state.phase, 'failed'); assert.equal(api.state.confirm, null);
      await go({ t: 'retry' }); await settle();
      assert.equal(api.state.phase, 'confirm', 'もう一度は、入力からやり直して確認カードへ');
      assert.equal(w2.submits, 0);
    });
    await check(`${op.key}: フォームが閉じたら保存しない`, async () => {
      const w = await startFake(op);
      unregister(); unregister = () => {};
      await approve();
      assert.equal(w.submits, 0); assert.equal(api.state.phase, 'failed'); assert.equal(api.state.confirm, null);
    });
    await check(`${op.key}: 窓が閉じて全部の欄が無いときは保存しない`, async () => {
      const w = await startFake(op);
      w.draft = null;
      await approve();
      assert.equal(w.submits, 0); assert.equal(api.state.phase, 'failed');
    });
    await check(`${op.key}: 処理が終わっていなければ保存しない`, async () => {
      const w = await startFake(op);
      w.ready = false;
      await approve();
      assert.equal(w.submits, 0); assert.equal(api.state.phase, 'confirm'); assert.match(api.state.notice, /処理が終わって/);
      w.ready = true;
      await approve();
      assert.equal(w.submits, 1);
    });
    await check(`${op.key}: 権限が無くなったら保存しない`, async () => {
      const w = await startFake(op);
      w.blocked = '権限がありません';
      await approve();
      assert.equal(w.submits, 0); assert.equal(api.state.phase, 'failed'); assert.equal(api.state.errorKind, 'blocked');
    });
    await check(`${op.key}: 別の画面に移ったら保存しない`, async () => {
      const w = await startFake(op);
      window.history.replaceState(null, '', '/somewhere-else');
      await approve();
      assert.equal(w.submits, 0); assert.equal(api.state.phase, 'failed'); assert.match(api.state.error, /別の画面/);
    });
  }

  async function startReal() {
    window.history.replaceState(null, '', '/income/contracts/new');
    await mount(React.createElement(fx.ContractForm));
    const values = { amount: '100000', client: 'Sample A', title: 'Sample' };
    await act(async () => { api.begin('sample', { kind: 'op', op: fx.INCOME_SALE_ADD, values, missing: [], say: 'sample' }); await frames(); });
    await settle();
    assert.equal(api.state.phase, 'confirm');
    assert.equal(posts.length, 0);
  }
  const edit = (field, value) => act(async () => { Simulate.change(document.querySelector(`[data-agent-field="${field}"]`), { target: { value } }); await frames(); });

  await check('本物の契約フォーム: 変わっていなければ確認した内容を1件だけ保存する', async () => {
    await startReal(); await approve();
    assert.equal(posts.length, 1); assert.equal(posts[0].type, 'one_time'); assert.equal(posts[0].items[0].unitPrice, 100000); assert.equal(api.state.phase, 'done');
  });
  await check('本物の契約フォーム: 手で直したら保存せず、カードを出し直す', async () => {
    await startReal(); await edit('title', 'Changed');
    await approve();
    assert.equal(posts.length, 0); assert.equal(api.state.phase, 'confirm');
    assert.equal(api.state.snap.title, 'Changed');
    await approve();
    assert.equal(posts.length, 1); assert.equal(posts[0].title, 'Changed');
  });
  await check('本物の契約フォーム: 金額が同じまま種類を変えても、止めて知らせる', async () => {
    await startReal();
    const total = api.state.snap.total;
    await edit('type', 'recurring');
    assert.equal(fx.getAgentForm('income.contract.new').snapshot().total, total);
    await approve();
    assert.equal(posts.length, 0); assert.equal(api.state.phase, 'confirm'); assert.match(api.state.notice, /出ていない欄/);
    await approve();
    assert.equal(posts.length, 1); assert.equal(posts[0].type, 'recurring');
  });
  await check('本物の契約フォーム: 同時の送信も、成功のあとの送信も、1件だけ', async () => {
    await startReal();
    const form = fx.getAgentForm('income.contract.new');
    let results;
    await act(async () => { results = await Promise.all([form.submit(), form.submit()]); });
    assert.equal(posts.length, 1);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.equal(form.ready(), false, '成功のあとは、画面が移るまで次の保存を受け付けない');
    let again;
    await act(async () => { again = await form.submit(); });
    assert.equal(again.ok, false); assert.equal(posts.length, 1);
  });
  await check('本物の契約フォーム: 画面の保存が進んでいる間は、会話からは保存しない', async () => {
    await startReal();
    const form = fx.getAgentForm('income.contract.new');
    let finish;
    const held = new Promise((r) => { finish = r; });
    const realFetch = global.fetch;
    global.fetch = async (url, init) => { if (init && init.method === 'POST') await held; return realFetch(url, init); };
    let screen;
    await act(async () => { screen = form.submit(); await frames(); });
    await approve();
    assert.equal(api.state.phase, 'confirm'); assert.match(api.state.notice, /処理が終わって/);
    await act(async () => { finish(); await screen; await frames(); });
    global.fetch = realFetch;
    assert.equal(posts.length, 1);
    await approve();
    assert.equal(posts.length, 1, '画面で保存が済んだ内容を、会話からもう1件作らない');
  });
  await check('本物の契約フォーム: 税込みの直しのあとも、本人が押すまで保存せず、直した値を保存する', async () => {
    await startReal();
    await go({ t: 'adjust', text: '税込みだった' }); await settle();
    assert.equal(api.state.phase, 'confirm'); assert.equal(posts.length, 0);
    const shown = Number(api.state.snap.subtotal);
    assert.ok(shown > 0 && shown < 100000);
    await approve();
    assert.equal(posts.length, 1); assert.equal(posts[0].items[0].unitPrice, shown);
  });

  // #137 の決まり: 金額の直しは、画面の今の税率で計算し、端数の差を隠さない
  const adjust = async (text) => { await go({ t: 'adjust', text }); await settle(); };
  const snapNow = () => ({ ...fx.getAgentForm('income.contract.new').snapshot() });
  const setRate = async (rate) => {
    const select = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.textContent === '10%'));
    assert.ok(select);
    await act(async () => { Simulate.change(select, { target: { value: String(rate) } }); await frames(); });
  };
  const approvedAmount = async (net, rate, total) => {
    assert.equal(api.state.phase, 'confirm');
    assert.equal(api.state.snap.subtotal, String(net)); assert.equal(api.state.snap.total, String(total)); assert.equal(posts.length, 0);
    await approve();
    assert.equal(posts.length, 1); assert.equal(posts[0].items[0].unitPrice, net); assert.equal(posts[0].items[0].taxRate, rate); assert.equal(api.state.phase, 'done');
  };
  await check('金額の直し: 税率8%で108,000円を100,000円に直す', async () => {
    await startReal(); await setRate(8); await adjust('税込み108000円だった');
    assert.match(api.state.notice, /税率8%/); await approvedAmount(100000, 8, 108000);
  });
  await check('金額の直し: 税率0%は同じ金額のまま', async () => {
    await startReal(); await setRate(0); await adjust('税込み100000円だった');
    assert.equal(api.state.snap.tax, '0'); await approvedAmount(100000, 0, 100000);
  });
  await check('金額の直し: 端数の差を保存の前に知らせる', async () => {
    await startReal(); await adjust('税込み100000円だった');
    assert.equal(api.state.snap.total, '99999'); assert.match(api.state.notice, /¥1 少なく/); await approvedAmount(90909, 10, 99999);
  });
  await check('金額の直し: 手で直した金額を読む。カードの古い金額を使わない', async () => {
    await startReal(); await edit('amount', '110000'); await adjust('税込みだった');
    await approvedAmount(100000, 10, 110000);
  });
  await check('金額の直し: カードに出ない欄を直していたら、直しのあとの案内で知らせる', async () => {
    await startReal(); await edit('type', 'recurring'); await adjust('税抜150000円にして');
    assert.equal(api.state.phase, 'confirm'); assert.match(api.state.notice, /出ていない欄/); assert.equal(posts.length, 0);
  });
  await check('金額の直し: 明細が複数なら、どの欄も変えずに止める', async () => {
    await startReal();
    const button = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('行を追加'));
    assert.ok(button);
    await act(async () => { Simulate.click(button); await frames(); });
    const before = snapNow();
    await adjust('税込みだった');
    assert.equal(api.state.phase, 'failed'); assert.equal(api.state.confirm, null); assert.match(api.state.error, /明細が複数/);
    assert.deepEqual(snapNow(), before); assert.equal(posts.length, 0);
  });
  await check('金額の直し: 別のフォームや別の画面には、何も入れない', async () => {
    await startReal();
    const before = snapNow();
    global.__focusHook = () => window.history.replaceState(null, '', '/income/contracts/another');
    try { await adjust('税込みだった'); } finally { delete global.__focusHook; }
    assert.equal(api.state.phase, 'failed'); assert.deepEqual(snapNow(), before); assert.equal(posts.length, 0);
    const world = { ready: true, blocked: null, snap: { ...SNAP }, draft: { a: 1 }, submits: 0 };
    const op = fx.CHAT_OPS.find((o) => o.key === fx.INCOME_SALE_ADD.key);
    await startFake(op);
    unregister();
    let calls = 0;
    unregister = fx.registerAgentForm(op.formKey, { ready: () => true, setValue: () => { calls++; return true; }, snapshot: () => ({ ...world.snap, _amountLineCount: '1', _amountTaxRate: '10' }), draft: () => world.draft, submit: async () => ({ ok: true, href: '/x' }) });
    await adjust('税込みだった');
    assert.equal(calls, 0); assert.equal(api.state.phase, 'failed'); assert.equal(api.state.confirm, null);
  });
  await check('金額の直し: 途中でやり直したら、どの欄も変えない', async () => {
    await startReal();
    const before = snapNow();
    global.__focusHook = () => api.dispatch({ t: 'reset' });
    try { await adjust('税込みだった'); } finally { delete global.__focusHook; }
    assert.equal(api.state.phase, 'idle'); assert.deepEqual(snapNow(), before); assert.equal(posts.length, 0);
  });

  await check('登録し直されても同じフォームとして扱う（Strict Mode。最初から入力できるフォーム）', async () => {
    const op = fx.CHAT_OPS.find((o) => o.key === 'kintai.request.leave');
    window.history.replaceState(null, '', SCREENS[op.formKey]);
    let saves = 0;
    function Always() {
      fx.useAgentForm(op.formKey, { ready: () => true, setValue: () => true, snapshot: () => ({ ...SNAP }), draft: () => ({ a: 1 }), submit: async () => { saves++; return { ok: true, href: '/kintai/requests' }; } });
      return null;
    }
    await mount();
    await act(async () => { reactRoot.render(React.createElement(fx.Provider, null, React.createElement(Probe))); });
    await act(async () => { reactRoot.unmount(); });
    reactRoot = createRoot(document.getElementById('root'));
    // 依頼を先に始め、フォームを待っている間に Strict Mode の部品を出す（登録の瞬間に受け取るのが古い登録にならないこと）
    const values = Object.fromEntries(op.fields.map((f) => [f.key, sample(f)]));
    let show = () => {};
    function Late() { const [on, setOn] = React.useState(false); show = () => setOn(true); return on ? React.createElement(React.StrictMode, null, React.createElement(Always)) : null; }
    await act(async () => { reactRoot.render(React.createElement(fx.Provider, null, React.createElement(Probe), React.createElement(Late))); await frames(2); });
    await act(async () => { api.begin('sample', { kind: 'op', op, values, missing: [], say: 'sample' }); await frames(); });
    await act(async () => { show(); await frames(3); });
    await settle();
    assert.equal(api.state.phase, 'confirm');
    await approve();
    assert.equal(saves, 1); assert.equal(api.state.phase, 'done');
  });

  // 請求書は、本物の画面を載せて確かめる
  const INVOICE = 'income.invoice.new';
  async function startInvoice() {
    window.history.replaceState(null, '', '/income/invoices/new');
    await mount(React.createElement(fx.NewInvoicePage));
    for (let i = 0; i < 100 && !(fx.getAgentForm(INVOICE) && fx.getAgentForm(INVOICE).ready()); i++) await act(async () => { await frames(1); });
    const values = { amount: '100000', client: 'Sample A', title: 'Sample' };
    await act(async () => { api.begin('sample', { kind: 'op', op: fx.INCOME_INVOICE_DRAFT, values, missing: [], say: 'sample' }); await frames(); });
    await settle();
    assert.equal(api.state.phase, 'confirm');
    assert.equal(posts.length, 0);
  }
  await check('本物の請求書: 変わっていなければ確認した内容を1件だけ保存する', async () => {
    await startInvoice(); await approve();
    assert.equal(posts.length, 1); assert.equal(posts[0].clientId, 'c1'); assert.equal(posts[0].title, 'Sample'); assert.equal(posts[0].lines[0].unitPrice, 100000); assert.equal(api.state.phase, 'done');
  });
  await check('本物の請求書: 件名を手で直したら保存せず、カードを出し直す', async () => {
    await startInvoice(); await edit('title', 'Changed');
    await approve();
    assert.equal(posts.length, 0); assert.equal(api.state.phase, 'confirm'); assert.equal(api.state.snap.title, 'Changed');
    await approve();
    assert.equal(posts.length, 1); assert.equal(posts[0].title, 'Changed');
  });
  await check('本物の請求書: カードに出ない備考を直しても、止めて知らせる', async () => {
    await startInvoice();
    const shown = JSON.stringify(api.state.snap);
    await act(async () => { Simulate.change(document.querySelector('form textarea'), { target: { value: 'Changed note' } }); await frames(); });
    assert.equal(JSON.stringify(fx.getAgentForm(INVOICE).snapshot()), shown);
    await approve();
    assert.equal(posts.length, 0); assert.equal(api.state.phase, 'confirm'); assert.match(api.state.notice, /出ていない欄/);
    await approve();
    assert.equal(posts.length, 1); assert.equal(posts[0].notes, 'Changed note');
  });
  await check('本物の請求書: 同時の送信も、成功のあとの送信も、1件だけ', async () => {
    await startInvoice();
    const form = fx.getAgentForm(INVOICE);
    let results;
    await act(async () => { results = await Promise.all([form.submit(), form.submit()]); });
    assert.equal(posts.length, 1); assert.equal(results.filter((r) => r.ok).length, 1);
    assert.equal(form.ready(), false);
    let again;
    await act(async () => { again = await form.submit(); });
    assert.equal(again.ok, false); assert.equal(posts.length, 1);
  });
  await check('本物の請求書: 画面の保存ボタンのあと、会話からもう1件作らない', async () => {
    await startInvoice();
    await act(async () => { Simulate.submit(document.querySelector('form')); await frames(3); });
    assert.equal(posts.length, 1, '画面の保存ボタンも同じ処理を通る');
    await approve();
    assert.equal(posts.length, 1);
    assert.notEqual(api.state.phase, 'done', '会話の完了は出さない');
  });
  await check('本物の請求書: 税率8%で108,000円を100,000円に直す', async () => {
    await startInvoice(); await setRate(8); await adjust('税込み108000円だった');
    assert.equal(api.state.phase, 'confirm'); assert.match(api.state.notice, /税率8%/);
    assert.equal(api.state.snap.subtotal, '100000'); assert.equal(api.state.snap.total, '108000'); assert.equal(posts.length, 0);
    await approve();
    assert.equal(posts.length, 1); assert.equal(posts[0].lines[0].unitPrice, 100000); assert.equal(posts[0].lines[0].taxRate, 8);
  });

  unregister();
  await act(async () => reactRoot.unmount());
  dom.window.close();
  const result = { checkedAt: new Date().toISOString(), passed: checks.length, failed: 0, checks, syntheticContractPosts: 'in-memory only', syntheticGets: gets, scope: 'React/jsdom。実際のブラウザ、ログインと権限の切り替え、実際の保存、通信の結果が分からないあとの再送は含まない。' };
  if (evidence) { fs.mkdirSync(evidence, { recursive: true }); fs.writeFileSync(path.join(evidence, 'result.json'), JSON.stringify(result, null, 2) + '\n'); }
  console.log(JSON.stringify({ passed: checks.length }));
})().catch((e) => { console.error(e.stack); process.exitCode = 1; }).finally(() => { fs.rmSync(out, { recursive: true, force: true }); });
