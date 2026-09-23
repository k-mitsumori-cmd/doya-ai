const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict');
const { check, results } = require('./load-typescript.cjs');
const source = fs.readFileSync('src/app/seo/articles/[id]/edit/page.tsx', 'utf8');
const ast = ts.createSourceFile('editor.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let effect;
function visit(n) {
  if (ts.isCallExpression(n) && n.expression.getText(ast) === 'useEffect' && n.arguments[1]?.getText(ast) === '[articleId]') effect = n.arguments[0].getText(ast);
  ts.forEachChild(n, visit);
}
visit(ast);
function fixture() {
  let resolve, reject;
  const state = {}, updates = [];
  const env = { articleId: 'a', Error, fetch: () => new Promise((r,j) => { resolve=r; reject=j; }) };
  for (const key of ['Loading','Error','Article','Content','OriginalContent']) env['set'+key] = value => {state[key]=value; updates.push(key)};
  const cleanup = vm.runInNewContext(ts.transpileModule('('+effect+')', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText, env)();
  return {state,updates,cleanup,respond:body=>resolve(Response.json(body)),reject:e=>reject(e)};
}
const flush = () => new Promise(r=>setImmediate(r));
(async()=>{
 await check('article identity keys the entire editor state',()=>assert.match(source, /<SeoRichEditor key=\{params.id\} articleId=\{params.id\}/));
 await check('valid article populates editor',async()=>{const f=fixture();f.respond({success:true,article:{id:'a',finalMarkdown:'body'}});await flush();assert.equal(f.state.Content,'body');assert.equal(f.state.Loading,false)});
 for (const body of [{success:true,article:{id:'b',finalMarkdown:'wrong'}},{success:true},{success:true,article:{id:'a',finalMarkdown:45}}]) await check('invalid article response does not populate editor '+JSON.stringify(body),async()=>{const f=fixture();f.respond(body);await flush();assert.equal(f.state.Content,undefined);assert.ok(f.state.Error)});
 for(const failed of [false,true]) await check('disposed load ignores late '+(failed?'failure':'success'),async()=>{const f=fixture();f.cleanup();const count=f.updates.length;if(failed)f.reject(new Error('late'));else f.respond({success:true,article:{id:'a',finalMarkdown:'old'}});await flush();assert.equal(f.updates.length,count)});
 console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
