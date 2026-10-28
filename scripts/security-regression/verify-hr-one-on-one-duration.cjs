const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');
const file = 'src/components/hr/OneOnOneForm.tsx';
const root = process.env.DOYA_TEST_BASELINE || path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, file), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} }).outputText;
const forbidden = () => { throw Error('Unexpected provider/request/side effect'); };
const motion = new Proxy({}, { get: (_target, tag) => props => {
  const { initial, animate, exit, transition, whileHover, whileTap, layout, ...dom } = props;
  return React.createElement(tag, dom);
} });
const mocks = {
  react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
  'framer-motion': { motion, AnimatePresence: ({ children }) => children },
  '@/components/hr/HrOrganizationScope': { useHrOrganizationRequest: () => ({ request: forbidden }) },
  '@/lib/hr/use-page-lifetime': { useHrPageLifetime: () => ({ toast: { error: forbidden }, router: {}, live: () => true }) },
  './AiInsightPanel': { default: () => null, __esModule: true },
};
const exportsObject = {};
vm.runInNewContext(code, { exports: exportsObject, require: name => {
  assert(name in mocks, 'Unmocked dependency: ' + name); return mocks[name];
}, crypto: require('node:crypto'), Date, console }, { filename: file });
let passed = 0;
for (const [duration, expected] of [[undefined, 30], [null, ''], [15, 15], [45, 45], [1, 1], [120, 120], [1440, 1440]]) {
  const warnings = [], original = console.error;
  let html;
  try {
    console.error = (...args) => warnings.push(args.join(' '));
    html = renderToStaticMarkup(React.createElement(exportsObject.default, { initialDuration: duration }));
  } finally { console.error = original; }
  assert.equal(warnings.length, 0, warnings.join('\n'));
  const durationSelect = [...html.matchAll(/<select\b[^>]*>([\s\S]*?)<\/select>/g)]
    .find(match => /<option value="90"/.test(match[1]));
  assert(durationSelect, 'Duration select must be rendered');
  const selected = [...durationSelect[1].matchAll(/<option\b([^>]*)>([^<]*)<\/option>/g)]
    .filter(match => /\bselected=""/.test(match[1]));
  assert.equal(selected.length, 1, 'Exactly one selected duration');
  assert.match(selected[0][1], new RegExp('value="' + expected + '"'));
  assert.equal(selected[0][2], expected === '' ? '未設定' : expected + '分');
  if (expected === '') assert.match(selected[0][1], /disabled=""/);
  passed++;
}
console.log(`PASS actual OneOnOneForm React rendering: ${passed} duration cases, no null-value warnings or requests`);
