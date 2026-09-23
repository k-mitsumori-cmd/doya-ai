const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../../src/app/sfa/[orgSlug]/deals/page.tsx'),'utf8');
const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let code;
function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='elapsedLabel')code=n.initializer.getText(ast);ts.forEachChild(n,visit)}visit(ast);if(!code)throw Error('elapsedLabel missing');
class FixedDate extends Date {constructor(...args){super(...(args.length?args:['2026-09-20T00:00:00Z']))}}
const label=vm.runInNewContext(ts.transpileModule('('+code+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{Date:FixedDate});
const base={startDate:'2026-09-01T00:00:00Z',wonAt:'2026-09-05T00:00:00Z',lostAt:'2026-09-20T00:00:00Z'};
const cases=[
 ['lost ignores previous win',{status:'lost'},'19日で決着'],
 ['won uses win date',{status:'won'},'4日で決着'],
 ['reopened uses current time',{status:'open'},'19日経過'],
 ['missing loss date',{status:'lost',lostAt:null},null],
 ['missing win date',{status:'won',wonAt:null},null],
 ['invalid close date',{status:'lost',lostAt:'invalid'},null],
 ['invalid start date',{status:'open',startDate:'invalid'},null],
 ['missing start date',{status:'open',startDate:null},null],
 ['unknown state',{status:'unknown'},null],
 ['same-day close',{status:'lost',lostAt:base.startDate},'0日で決着'],
];
const results=cases.map(([name,override,expected])=>{const actual=label({...base,...override});return {name,outcome:actual===expected?'PASS':'FAIL',expected,actual}});
console.log(JSON.stringify({cases:results.length,results},null,2));if(results.some(r=>r.outcome==='FAIL'))process.exitCode=1;
