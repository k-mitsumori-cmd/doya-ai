process.env.NODE_ENV='test';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react'),jsx=require('react/jsx-runtime'),{renderToStaticMarkup}=require('react-dom/server');
const base=path.resolve(__dirname,'../..');
function component(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(base,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:n=>{assert.ok(n in mocks,'Unmocked '+n);return mocks[n]},console,URL,encodeURIComponent,decodeURIComponent},{filename:file});return exports.default}
let currentPath='/aio/alpha/history';
const signIn=component('src/components/SignInReturnLink.tsx',{react:React,'react/jsx-runtime':jsx,'next/navigation':{usePathname:()=>currentPath},'@/lib/safe-signin-callback':{safeSignInCallbackUrl:p=>p||'/home'}});
const unavailable=component('src/components/OrganizationUnavailable.tsx',{'react/jsx-runtime':jsx,'next/link':{__esModule:true,default:({children,...p})=>React.createElement('a',p,children)},'@/components/SignInReturnLink':{__esModule:true,default:signIn}});
(async()=>{const results=[];
for(const service of ['aio','shodan']){
 let ctx=null,reads=0,shell=true;const title=service==='aio'?'Aio':'Shodan';const frame=({children})=>React.createElement('article',null,children);
 const mocks={'react/jsx-runtime':jsx,'@/components/OrganizationUnavailable':{__esModule:true,default:unavailable},['@/lib/'+service+'/access']:{['get'+title+'Context']:async slug=>{assert.equal(slug,'alpha');if(ctx instanceof Error)throw ctx;return ctx}},['@/lib/'+service+'/billing']:{['get'+title+'Billing']:async()=>{reads++;return {plan:'PRO',ownerUserId:'owner'}}},'@/lib/prisma':{prisma:{[service+'Organization']:{findUnique:async()=>{reads++;return {name:'private organization'}}}}},['@/components/'+service+'/'+title+'AppLayout']:{__esModule:true,default:frame},['@/components/'+service+'/'+title+'ShellFrame']:{__esModule:true,default:frame},'@/lib/ui-shell':{isShellEnabled:()=>shell}};
 const Layout=component('src/app/(shell)/'+service+'/[orgSlug]/layout.tsx',mocks);
 const run=()=>Layout({params:Promise.resolve({orgSlug:'alpha'}),children:React.createElement('b',null,'private child')});currentPath='/'+service+'/alpha/history';
 for(const denied of [null,{organizationSlug:'other',organizationId:'foreign'}]){ctx=denied;reads=0;const html=renderToStaticMarkup(await run());assert.match(html,/この組織を表示できません/);assert.ok(!html.includes('private child'));assert.ok(!html.includes('private organization'));assert.ok(html.includes('href="/'+service+'"'));assert.ok(html.includes('href="/home"'));assert.ok(html.includes('/auth/signin?callbackUrl='+encodeURIComponent(currentPath)));assert.equal(reads,0);results.push(service+' denied branch does not redirect or read private records');}
 ctx={organizationSlug:'alpha',organizationId:'owned',role:'owner',userId:'owner'};for(const enabled of [true,false]){shell=enabled;const html=renderToStaticMarkup(await run());assert.ok(html.includes('private child'));assert.ok(!html.includes('この組織を表示できません'));results.push(service+' valid context retains '+(enabled?'shell':'legacy')+' layout');}
 ctx=Error('unavailable');await assert.rejects(run,/unavailable/);results.push(service+' operational lookup failure remains an error');
}
console.log(JSON.stringify({passed:results.length,results,scope:'Actual server layouts and unavailable TSX; synthetic auth/Prisma, SSR sign-in callback, no browser or DB'}));
})().catch(e=>{console.error(e);process.exitCode=1});
