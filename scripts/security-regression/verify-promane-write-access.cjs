const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
function load(file,deps){const exported={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../../',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exported,Date,require:n=>{if(n in deps)return deps[n];throw Error(n)}});return exported}
(async()=>{const results=[];const files=fs.readdirSync(path.join(__dirname,'../../src/lib/promane')).filter(f=>f.startsWith('actions-'));
for(const mode of ['inactive','missing','anonymous','foreign-slug','active-control','guest','unknown-role','member-repair']){
 let writes=0,unexpected=0,workspaceQueries=0;
 const prisma=new Proxy({promaneWorkspace:{findFirst:async({where})=>{workspaceQueries++;const member=where.members.some;return mode!=='missing'&&where.slug==='target'&&(member.userId===undefined||member.userId==='user')&&(member.isActive===undefined||member.isActive===(mode!=='inactive'))?{id:'workspace',slug:'target',members:[{userId:'user',isActive:true,role:mode==='guest'?'guest':mode==='unknown-role'?'unknown':mode==='member-repair'?'member':'owner'}]}:null}},promaneClient:{create:async({data})=>{writes++;return {id:'client',...data}}}},{get:(t,k)=>{if(k in t)return t[k];unexpected++;throw Error('Unexpected database model '+String(k))}});
 const auth=load('src/lib/promane/auth.ts',{'next-auth':{getServerSession:async()=>mode==='anonymous'?null:{user:{id:'user'}}},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma},'next/navigation':{redirect:()=>{throw Error('Unexpected redirect')}}});
 for(const file of files){
  const actions=load('src/lib/promane/'+file,{'./time-input':load('src/lib/promane/time-input.ts',{}),'@/lib/prisma':{prisma},'@/lib/promane/auth':auth,'next/cache':{revalidatePath:()=>{}},'@/lib/promane/limits':{getUserPromaneLimits:()=>{throw Error('Unexpected limit lookup')},countUserProjects:()=>{throw Error('Unexpected count')}}});
  for(const [name,fn] of Object.entries(actions)){
   if(mode==='active-control'&&name!=='createClient')continue;
   if(mode==='member-repair'&&!name.startsWith('repairInvalid'))continue;
   const before=writes,beforeUnexpected=unexpected;let error=null;
   try{await fn(mode==='foreign-slug'?'other':'target',{name:'Synthetic client'},{});}catch(e){error=e.message;}
   const deniedRole=['guest','unknown-role','member-repair'].includes(mode);
   const expected=deniedRole?(name.startsWith('repairInvalid')?'この操作はオーナー・管理者のみ実行できます':'閲覧専用のため変更できません'):mode==='anonymous'?'ログインセッションが切れています。ページを再読み込みしてください。':'ワークスペースにアクセスできません';
   const ok=mode==='active-control'?error===null&&writes-before===1:error===expected&&writes===before&&unexpected===beforeUnexpected;
   results.push({name:mode+'-'+name,outcome:ok?'PASS':'FAIL',error,writes:writes-before,unexpectedQueries:unexpected-beforeUnexpected});
  }
 }
}
if(results.some(r=>r.outcome==='FAIL'))process.exitCode=1;
console.log(JSON.stringify({cases:results.length,pass:results.filter(r=>r.outcome==='PASS').length,fail:results.filter(r=>r.outcome==='FAIL')},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
