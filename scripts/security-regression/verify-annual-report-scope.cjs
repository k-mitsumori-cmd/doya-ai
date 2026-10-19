// 年間レポート（/api/annual-report/image）のセキュリティの回帰テスト。
// - 読むのは、セッションの本人が作ったものと、本人が ACTIVE で入っている会社（組織）の分だけ。
//   クエリの org・organizationId・userId は使わない（ほかの会社のデータは読めない）
// - 顧客名・金額・社員名は、既定で読まない・入れない。選んでも、その組織の owner・admin でなければ読まない
// - 未ログインは 401、新しい見た目でない人は 404。どちらも DB に触らない。見本（sample=1）もログインなしは開発のときだけ
// - DB には書かない。有料の生成 API を呼ばない
// 合成のセッションと、記録するだけの prisma を使う。本物の DB・課金・AI には触れない。git も環境変数の既定値も使わない。
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{load,check}=require('./load-typescript.cjs');
const root=path.resolve(__dirname,'../..');
const nextServer=require(path.join(root,'node_modules/next/server'));

const MEMBER_MODELS=['quoteMember','shodanMember','mensetsuMember','aishodanMember','sfaMember'];
/** alice と bob の所属。bob の会社のデータは、alice のリクエストでは決して読まれないこと */
function memberships(aliceRoles){
  const rows=[];
  for(const m of MEMBER_MODELS){
    rows.push({model:m,userId:'alice',status:'ACTIVE',role:aliceRoles[m]??'member',organizationId:`${m}-alice-org`,createdAt:1});
    rows.push({model:m,userId:'bob',status:'ACTIVE',role:'owner',organizationId:`${m}-bob-org`,createdAt:0});
  }
  return rows;
}
function recordingPrisma(aliceRoles={}){
  const calls=[];
  const rows=memberships(aliceRoles);
  const d=new Date('2026-05-10T00:00:00Z');
  const model=(name)=>({
    findFirst:async(a)=>{calls.push([name,'findFirst',a]);
      if(!MEMBER_MODELS.includes(name))return null;
      const w=a.where;return rows.find(r=>r.model===name&&r.userId===w.userId&&r.status===w.status&&(!w.role||r.role===w.role))??null},
    findMany:async(a)=>{calls.push([name,'findMany',a]);
      if(name==='sfaAccount'||name==='sfaMember'||name==='shodanMember')return (a.where.id?.in??[]).map(id=>({id,name:`${name}:${id}`}));
      const sel=a.select||{};
      return [{createdAt:d,wonAt:sel.wonAt?d:undefined,clientCompany:'顧客A',targetName:'顧客B',accountId:'acc1',assigneeMemberId:'mem1',createdByMemberId:'mem2'}]},
    aggregate:async(a)=>{calls.push([name,'aggregate',a]);return {_sum:{totalExclTax:1000000,amount:2000000n}}},
    create:async()=>{throw Error('write')},update:async()=>{throw Error('write')},upsert:async()=>{throw Error('write')},delete:async()=>{throw Error('write')},
  });
  const models=new Map();
  const prisma=new Proxy({},{get:(_,k)=>{if(typeof k!=='string'||k==='then')return undefined;if(!models.has(k))models.set(k,model(k));return models.get(k)}});
  return {prisma,calls};
}
function fixture({session='alice',uiNext=true,roles={},env={}}={}){
  const {prisma,calls}=recordingPrisma(roles);
  const rendered=[];
  const report=load('src/lib/annual-report/report.ts',{});
  const loader=load('src/lib/annual-report/load.server.ts',{'./report':report},{Promise});
  const sample=load('src/lib/annual-report/sample.ts',{});
  const route=load('src/app/api/annual-report/image/route.ts',{
    'next/server':nextServer,
    '@/lib/prisma':{prisma},
    '@/lib/ui-next':{isUiNext:async()=>{calls.push(['ui-next']);return uiNext}},
    '@/lib/shell/company.server':{currentUserId:async()=>session,getAccountCompanyName:async()=>({name:'アリス株式会社',source:'company'})},
    '@/lib/annual-report/report':report,
    '@/lib/annual-report/load.server':loader,
    '@/lib/annual-report/sample':sample,
    '@/lib/annual-report/render.server':{renderAnnualImage:async(r,size)=>{rendered.push({r:JSON.parse(JSON.stringify(r)),size});return Buffer.from('png')}},
  },{Promise,Uint8Array,process:{env}});
  return {route,calls,rendered};
}
const req=(qs)=>new nextServer.NextRequest(`https://doya.example.invalid/api/annual-report/image?${qs}`);
const dbCalls=(f)=>f.calls.filter(c=>c[0]!=='ui-next');
const SENSITIVE_FIELDS=['clientCompany','targetName','accountId','assigneeMemberId','createdByMemberId','totalExclTax','amount'];
function touchesSensitive(f){
  return dbCalls(f).some(([m,op,a])=>op==='aggregate'||['sfaAccount','shodanMember'].includes(m)&&op==='findMany'||m==='sfaMember'&&op==='findMany'||
    Object.keys(a?.select||{}).some(k=>SENSITIVE_FIELDS.includes(k)));
}
/** すべての読み込みが、alice 本人か alice の会社だけに絞られているか */
function assertOnlyAlice(f){
  const json=JSON.stringify(dbCalls(f).map(c=>c[2]));
  assert.doesNotMatch(json,/bob/,'bob の会社・データを条件に使った');
  for(const [m,op,a] of dbCalls(f)){
    if(MEMBER_MODELS.includes(m)&&op==='findFirst'){assert.equal(a.where.userId,'alice');assert.equal(a.where.status,'ACTIVE');continue}
    const w=a.where||{};
    const scoped=w.userId==='alice'||w.concept?.campaign?.userId==='alice'||(typeof w.organizationId==='string'&&w.organizationId.endsWith('-alice-org'));
    assert.ok(scoped,`${m}.${op} が本人・本人の会社に絞られていない: ${JSON.stringify(w)}`);
  }
}

(async()=>{
  await check('Reads only the session user and their own organizations, ignoring org/userId in the query',async()=>{
    const f=fixture({roles:{quoteMember:'owner',sfaMember:'admin',shodanMember:'admin'}});
    const res=await f.route.GET(req('year=2026&org=quoteMember-bob-org&organizationId=sfaMember-bob-org&userId=bob&show=company,customers,amounts,members'));
    assert.equal(res.status,200);
    assert.equal(res.headers.get('content-type'),'image/png');
    assert.match(res.headers.get('cache-control')||'',/no-store/);
    assertOnlyAlice(f);
    // 会社ごとのツールは、alice の会社の id だけで読む
    const orgIds=new Set(dbCalls(f).map(c=>c[2]?.where?.organizationId).filter(Boolean));
    for(const id of orgIds)assert.match(id,/-alice-org$/);
    assert.ok(orgIds.has('quoteMember-alice-org')&&orgIds.has('sfaMember-alice-org'));
  });
  await check('Customer names, amounts and member names are not read or drawn by default',async()=>{
    const f=fixture({roles:{quoteMember:'owner',sfaMember:'owner',shodanMember:'owner'}});
    const res=await f.route.GET(req('year=2026'));
    assert.equal(res.status,200);
    assert.equal(touchesSensitive(f),false,'既定で顧客名・金額・社員名を読んだ');
    const r=f.rendered[0].r;
    assert.equal(r.customers,null);assert.equal(r.amounts,null);assert.equal(r.members,null);
    assert.equal(r.companyName,'アリス株式会社');
    assert.equal(res.headers.get('x-annual-report-revealed'),'company');
    // 何も選ばなければ会社名も入れない
    const g=fixture();const none=await g.route.GET(req('year=2026&show='));
    assert.equal(g.rendered[0].r.companyName,null);assert.equal(none.headers.get('x-annual-report-revealed'),'');
  });
  await check('Non-admin members cannot reveal customers, amounts or member names even when requested',async()=>{
    const f=fixture({roles:{}});
    const res=await f.route.GET(req('year=2026&show=customers,amounts,members,company,__proto__,email'));
    assert.equal(res.status,200);
    assert.equal(touchesSensitive(f),false);
    const r=f.rendered[0].r;
    assert.deepEqual(r.revealed,['company']);
    assert.equal(r.customers,null);assert.equal(r.amounts,null);assert.equal(r.members,null);
    assertOnlyAlice(f);
  });
  await check('Sensitive items are read only from organizations where the user is owner or admin',async()=>{
    // 見積だけ owner。営業管理・商談準備は member
    const f=fixture({roles:{quoteMember:'owner'}});
    const res=await f.route.GET(req('year=2026&show=amounts,customers,members'));
    assert.equal(res.status,200);
    const sensitive=dbCalls(f).filter(([m,op,a])=>op==='aggregate'||Object.keys(a?.select||{}).some(k=>SENSITIVE_FIELDS.includes(k)));
    assert.ok(sensitive.length>0);
    for(const [m,,a] of sensitive){assert.equal(m,'quoteDocument');assert.equal(a.where.organizationId,'quoteMember-alice-org')}
    const r=f.rendered[0].r;
    assert.deepEqual(r.amounts,{quoted:1000000,won:0});
    assert.deepEqual(r.customers,['顧客A']);
    assert.equal(r.members,null);
    assertOnlyAlice(f);
  });
  await check('Signed-out and non-preview users are rejected without touching the database',async()=>{
    for(const [opts,status] of [[{session:null},401],[{uiNext:false},404]]){
      const f=fixture(opts);
      const res=await f.route.GET(req('year=2026&show=amounts'));
      assert.equal(res.status,status);
      assert.equal(dbCalls(f).length,0);
      assert.equal(f.rendered.length,0);
    }
  });
  await check('The sample image needs a login unless explicitly in development, and never reads the database',async()=>{
    const prod=fixture({session:null,env:{}});
    assert.equal((await prod.route.GET(req('sample=1'))).status,401);
    const dev=fixture({session:null,env:{NODE_ENV:'development'}});
    const res=await dev.route.GET(req('sample=1&show=customers'));
    assert.equal(res.status,200);
    assert.equal(dbCalls(dev).length,0);
    assert.deepEqual(dev.rendered[0].r.revealed,['customers']);
  });
  await check('Year and size are validated on the server',async()=>{
    const f=fixture();
    await f.route.GET(req('year=1999&size=99999x99999'));
    assert.equal(f.rendered[0].size,'wide');
    const y=f.rendered[0].r.year;
    assert.ok(y>=2026,'年が今年に戻っていない');
    const g=fixture();await g.route.GET(req('year=2025&size=tall'));
    assert.equal(g.rendered[0].size,'tall');assert.equal(g.rendered[0].r.year,2025);
  });
  await check('Annual report code never writes to the database or calls paid generation APIs',async()=>{
    const files=['src/lib/annual-report/report.ts','src/lib/annual-report/load.server.ts','src/lib/annual-report/render.server.ts','src/lib/annual-report/sample.ts','src/app/api/annual-report/image/route.ts','src/app/(shell)/home/annual/page.tsx'];
    for(const file of files){
      const src=fs.readFileSync(path.join(root,file),'utf8');
      assert.doesNotMatch(src,/\.(create|createMany|update|updateMany|upsert|delete|deleteMany|\$executeRaw|\$queryRaw)\s*\(/,file);
      assert.doesNotMatch(src,/openai|gemini|image-generator|generativelanguage|fetch\s*\(/i,file);
    }
  });
  console.log(JSON.stringify({scope:'Annual report image API with synthetic sessions and a recording prisma. No real DB, billing, AI or git.'}));
})().catch(e=>{console.error(e);process.exitCode=1});
