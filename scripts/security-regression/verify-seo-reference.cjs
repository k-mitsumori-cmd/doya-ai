// Offline route regressions: no database, DNS, HTTP or model requests.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const repo=path.resolve(__dirname,'../..'),ts=require('typescript'),zod=require('zod');
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
function harness(route,{auth=true,result='<title>Company</title><body>Business</body>',failure=false}={}){
 const exports={},calls=[],models=[];let active=0,peak=0,read=0;
 const text=fs.readFileSync(path.join(repo,`src/app/api/seo/reference/${route}/route.ts`),'utf8');
 const compiled=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(compiled,{exports,URL,require(name){
  if(name==='next/server')return {NextResponse:{json:(body,opts)=>({body,status:opts?.status||200})}};
  if(name==='next-auth')return {getServerSession:async()=>auth?{user:{id:'mock-user'}}:null};
  if(name==='@/lib/auth')return {authOptions:{}};
  if(name==='zod')return zod;
  if(name==='@/lib/net/safe-fetch')return {safeFetchText:async(url,opts)=>{calls.push({url,opts});active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,1));active--;if(failure)throw Error('secret internal error');return result;}};
  if(name==='@seo/lib/gemini')return {GEMINI_TEXT_MODEL_DEFAULT:'mock',geminiGenerateJson:async args=>{models.push(args);return {axes:[],tables:[],faq:[],summary:'ok',scoringCriteria:[]};}};
  throw Error('Unexpected import '+name);
 },fetch(){throw Error('UNSAFE FETCH');}});
 return {...exports,calls,models,get peak(){return peak;},get read(){return read;},req(body){return {json:async()=>{read++;return body;}};}};
}
(async()=>{
 for(const route of ['meta','parse'])await test(route+' requires login before input read/network/model',async()=>{const x=harness(route,{auth:false});const out=await x.POST(x.req({url:'http://127.1',urls:['http://127.1']}));assert.equal(out.status,401);assert.equal(x.read,0);assert.equal(x.calls.length,0);assert.equal(x.models.length,0);});
 await test('meta limits concurrency to five and retains ordering',async()=>{const x=harness('meta');const urls=Array.from({length:12},(_,i)=>`https://site${i}.test`);const out=await x.POST(x.req({urls}));assert.equal(out.status,200);assert.deepEqual(Array.from(out.body.items,i=>i.url),urls);assert.equal(x.peak,5);assert.equal(x.calls[0].opts.timeoutMs,9000);});
 await test('meta rejects more than thirty before fetch',async()=>{const x=harness('meta');assert.equal((await x.POST(x.req({urls:Array(31).fill('https://example.test')}))).status,400);assert.equal(x.calls.length,0);});
 await test('meta safe-fetch denial produces failed item',async()=>{const x=harness('meta',{result:null});const out=await x.POST(x.req({urls:['http://127.1']}));assert.equal(out.body.items[0].ok,false);assert.equal(out.body.items[0].title,null);});
 await test('parse safe-fetch denial prevents model call',async()=>{const x=harness('parse',{result:null});assert.equal((await x.POST(x.req({url:'http://127.1'}))).status,422);assert.equal(x.models.length,0);});
 await test('parse successful URL retains title and model extraction',async()=>{const x=harness('parse');const out=await x.POST(x.req({url:'https://example.test'}));assert.equal(out.body.title,'Company');assert.equal(out.body.template.summary,'ok');assert.equal(x.calls.length,1);assert.equal(x.models.length,1);});
 await test('parse pasted text bypasses network',async()=>{const x=harness('parse');const out=await x.POST(x.req({text:'## Heading\nBusiness detail',titleHint:'Sample'}));assert.equal(out.body.title,'Sample');assert.equal(x.calls.length,0);assert.equal(x.models.length,1);});
 for(const route of ['meta','parse'])await test(route+' unexpected exception does not echo internal detail',async()=>{const x=harness(route,{failure:true});const out=await x.POST(x.req({url:'https://example.test',urls:['https://example.test']}));assert.equal(out.status,400);assert.ok(!JSON.stringify(out).includes('secret'));});
 console.log(JSON.stringify({passed,failed:0,networkRequests:0,modelRequests:0}));
})().catch(e=>{console.error(e);process.exitCode=1;});
