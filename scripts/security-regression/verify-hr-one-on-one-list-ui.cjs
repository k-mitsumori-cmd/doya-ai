const fs=require('node:fs'), vm=require('node:vm'), ts=require('typescript'), assert=require('node:assert/strict');
const {check,results}=require('./load-typescript.cjs');
const source=fs.readFileSync('src/app/hr/one-on-one/page.tsx','utf8'), ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX), codes={};
function visit(n){if(ts.isFunctionDeclaration(n)&&['fetchRecords','fetchEmployees'].includes(n.name?.text))codes[n.name.text]=n.getText(ast);ts.forEachChild(n,visit)}visit(ast);
function setup(fetch){const state={},env={fetch,Map,Number,Array,Error,recordSequence:{current:0},employeeSequence:{current:0}};for(const key of ['Records','Page','TotalPages','Loading','ListError','Employees','EmployeePage','EmployeeHasMore','EmployeeLoading','EmployeeError','CanCreate','CreationManagerId','SelectedManager']){state[key]=key==='Employees'||key==='Records'?[]:null;env['set'+key]=value=>state[key]=typeof value==='function'?value(state[key]):value;}const f={};for(const [key,code]of Object.entries(codes))f[key]=vm.runInNewContext(ts.transpileModule('('+code+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,env);return{...f,state};}
(async()=>{
for(const kind of ['records','employees']){
const fn=kind==='records'?'fetchRecords':'fetchEmployees',items=kind==='records'?'Records':'Employees',page=kind==='records'?'Page':'EmployeePage',error=kind==='records'?'ListError':'EmployeeError';
await check(kind+': pagination and failed continuation preserve loaded data',async()=>{
let fail=false;const f=setup(async url=>{const p=Number(new URL(url,'http://offline.invalid').searchParams.get('page'));return fail?Response.json({}, {status:500}):Response.json({items:[{id:String(p)}],page:p,totalPages:3});});
await f[fn](1);await f[fn](2);assert.equal(f.state[page],2);assert.equal(f.state[items].at(-1).id,'2');fail=true;await f[fn](3);assert.equal(f.state[page],2);assert.ok(f.state[error]);assert.equal(f.state[items].at(-1).id,'2');
});
await check(kind+': older response cannot overwrite newer page',async()=>{let resolve;const f=setup(url=>new URL(url,'http://offline.invalid').searchParams.get('page')==='1'?new Promise(r=>resolve=r):Promise.resolve(Response.json({items:[{id:'new'}],page:2,totalPages:2})));const old=f[fn](1);await f[fn](2);resolve(Response.json({items:[{id:'old'}],page:1,totalPages:2}));await old;assert.equal(f.state[page],2);assert.equal(f.state[items][0].id,'new');});
}
console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
