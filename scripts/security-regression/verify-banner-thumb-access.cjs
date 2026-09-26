// Offline cache authorization regression; no database or image network access.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const repo=path.resolve(__dirname,'../..'),ts=require('typescript');
const compiled=ts.transpileModule(fs.readFileSync(path.join(repo,'src/app/api/banner/history/thumb/route.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
function harness(){const exports={};let user='owner',exists=true,queries=0,renders=0,cutoff=new Date(0);const imageDate=new Date('2026-09-01T00:00:00.000Z');class NextResponse{constructor(body,opts){this.body=body;this.status=opts?.status||200;this.headers=opts?.headers||{}}static json(body,opts){return new NextResponse(body,opts)}}
vm.runInNewContext(compiled,{exports,URL,Buffer,Uint8Array,console:{error(){}},require(name){
 if(name==='next/server')return{NextResponse};if(name==='next-auth')return{getServerSession:async()=>user?{user:{id:user}}:null};if(name==='@/lib/auth')return{authOptions:{}};
 if(name==='@/lib/prisma')return{prisma:{generation:{findFirst:async({where})=>{queries++;return exists&&where.userId==='owner'&&where.id==='known-generation'&&imageDate>=where.createdAt.gte?{output:'data:image/png;base64,ZmFrZQ=='}:null}}}};
 if(name==='@/lib/banner/history-access')return{bannerHistoryCutoff:async()=>cutoff};
 if(name==='sharp')return()=>{renders++;return{resize(){return this},webp(){return this},async toBuffer(){return Buffer.from('thumbnail')}}};
 if(name==='@/lib/net/safe-fetch')return{safeFetchResource:async()=>{throw Error('unexpected network')}};throw Error('Unexpected import '+name);
},fetch(){throw Error('UNSAFE FETCH')}});
return{...exports,setUser(v){user=v},setCutoff(v){cutoff=v},delete(){exists=false},get queries(){return queries},get renders(){return renders},req(etag){return{url:'https://example.test/api/banner/history/thumb?id=known-generation&w=320',headers:{get:name=>name==='if-none-match'?etag:null}}}};}
(async()=>{
 await test('cached image never returned to another logged-in user',async()=>{const x=harness();assert.equal((await x.GET(x.req())).status,200);x.setUser('attacker');const out=await x.GET(x.req());assert.equal(out.status,404);assert.equal(out.body.error,'not found');assert.equal(x.renders,1);assert.equal(x.queries,2);});
 await test('deleted image cannot be retrieved from warm cache',async()=>{const x=harness();await x.GET(x.req());x.delete();assert.equal((await x.GET(x.req())).status,404);assert.equal(x.renders,1);});
 await test('expired history cannot be retrieved from warm cache',async()=>{const x=harness();await x.GET(x.req());x.setCutoff(new Date('2026-09-20T00:00:00.000Z'));assert.equal((await x.GET(x.req())).status,404);assert.equal(x.renders,1);});
 await test('owner receives cache hit only after renewed ownership check',async()=>{const x=harness();await x.GET(x.req());const out=await x.GET(x.req());assert.equal(out.status,200);assert.equal(x.queries,2);assert.equal(x.renders,1);});
 await test('conditional cache hit also checks ownership and existence',async()=>{const x=harness();const first=await x.GET(x.req());assert.equal((await x.GET(x.req(first.headers.ETag))).status,304);x.delete();assert.equal((await x.GET(x.req(first.headers.ETag))).status,404);});
 await test('anonymous caller rejected before DB or cache',async()=>{const x=harness();x.setUser(null);assert.equal((await x.GET(x.req())).status,401);assert.equal(x.queries,0);assert.equal(x.renders,0);});
 console.log(JSON.stringify({passed,failed:0,networkRequests:0,databaseRequests:0}));
})().catch(e=>{console.error(e);process.exitCode=1});
