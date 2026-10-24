// アカウントの会社（/api/account/company）のセキュリティの回帰テスト（UI 品質 B-1・B-2）。
// - 読み書きするのは、セッションの本人の会社だけ。body の userId は使わない（他人の会社は読めない・書けない）
// - 未ログインは 401、新しい見た目でない人は 404。どちらも DB に触らない
// - 各ツールの組織の名前は書き換えない（候補は読むだけ）
// 合成のセッションと、記録するだけの prisma を使う。本物の DB・課金・AI には触れない。
const assert=require('node:assert/strict'),path=require('node:path'),{load,check}=require('./load-typescript.cjs');
const root=path.resolve(__dirname,'../..');
const nextServer=require(path.join(root,'node_modules/next/server'));
function fixture({session={user:{id:'alice',email:'alice@example.invalid'}},rows={alice:{name:'アリス株式会社',websiteUrl:null,industry:null,updatedAt:new Date(0)},bob:{name:'ボブ株式会社',websiteUrl:null,industry:null,updatedAt:new Date(0)}}}={}){
  const calls=[];
  const orgWrites=[];
  const prisma={
    user:{findUnique:async(a)=>{calls.push(['user.findUnique',a]);return null}},
    accountCompany:{
      findUnique:async(a)=>{calls.push(['findUnique',a]);return rows[a.where.userId]??null},
      upsert:async(a)=>{calls.push(['upsert',a]);rows[a.where.userId]={...a.update,updatedAt:new Date(0)};return rows[a.where.userId]},
    },
  };
  const lister=(names)=>({listMemberships:async()=>names.map((name,i)=>({slug:'s'+i,name}))});
  const access=new Proxy({},{get:()=>{orgWrites.push('touched');return undefined}});
  const company=load('src/lib/shell/company.ts',{});
  const server=load('src/lib/shell/company.server.ts',{
    'next-auth':{getServerSession:async()=>session},
    '@/lib/auth':{authOptions:{}},
    '@/lib/prisma':{prisma},
    './company':company,
    '@/lib/quote/access':lister(['株式会社スリスタ']),
    '@/lib/shodan/access':lister(['株式会社スリスタ']),
    '@/lib/mensetsu/access':lister([]),
    '@/lib/aishodan/access':lister([]),
    '@/lib/sfa/access':lister(['スリスタ']),
    '@/lib/expense/access':lister([]),
  },{Promise});
  const route=load('src/app/api/account/company/route.ts',{
    'next/server':nextServer,
    '@/lib/shell/company':company,
    '@/lib/shell/company.server':server,
  },{Promise});
  return {route,calls,rows,orgWrites};
}
const req=(method,body)=>new nextServer.NextRequest('https://doya.example.invalid/api/account/company',{method,body:body===undefined?undefined:JSON.stringify(body),headers:{'content-type':'application/json'}});
(async()=>{
  await check('GET returns only the session user company and tool names as candidates',async()=>{
    const f=fixture();
    const res=await f.route.GET();
    assert.equal(res.status,200);
    const j=await res.json();
    assert.equal(j.company.name,'アリス株式会社');
    assert.deepEqual(JSON.parse(JSON.stringify(j.candidates)),['株式会社スリスタ','スリスタ']);
    for(const [op,a] of f.calls.filter(c=>c[0]==='findUnique'))assert.equal(a.where.userId,'alice',op);
    assert.match(res.headers.get('cache-control')||'',/no-store/);
  });
  await check('PUT ignores a userId in the body and writes only the session user row',async()=>{
    const f=fixture();
    const res=await f.route.PUT(req('PUT',{name:'乗っ取り株式会社',userId:'bob'}));
    assert.equal(res.status,200);
    const ups=f.calls.filter(c=>c[0]==='upsert');
    assert.equal(ups.length,1);
    assert.equal(ups[0][1].where.userId,'alice');
    assert.equal(ups[0][1].create.userId,'alice');
    assert.equal('userId' in ups[0][1].update,false);
    assert.equal(f.rows.bob.name,'ボブ株式会社');
  });
  await check('Signed-out users are rejected without touching the table',async()=>{
    for(const [opts,status] of [[{session:null},401]]){
      const f=fixture(opts);
      for(const call of [()=>f.route.GET(),()=>f.route.PUT(req('PUT',{name:'x'}))]){
        const res=await call();
        assert.equal(res.status,status);
        assert.equal(f.calls.filter(c=>c[0]==='findUnique'||c[0]==='upsert').length,0);
      }
    }
  });
  await check('Invalid input is rejected before writing',async()=>{
    const f=fixture();
    for(const body of [{},{name:''},{name:'x',websiteUrl:'javascript:alert(1)'},{name:'a'.repeat(101)}]){
      const res=await f.route.PUT(req('PUT',body));
      assert.equal(res.status,400);
    }
    assert.equal(f.calls.filter(c=>c[0]==='upsert').length,0);
  });
  await check('Display prefers the registered company and falls back to tool names when the table is unavailable',async()=>{
    const f=fixture();
    // 登録があれば、それを出す
    const server=load('src/lib/shell/company.server.ts',{'next-auth':{getServerSession:async()=>({user:{id:'alice'}})},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma:{accountCompany:{findUnique:async()=>({name:'登録した会社',websiteUrl:null,industry:null})}}},'./company':load('src/lib/shell/company.ts',{}),'@/lib/quote/access':{listMemberships:async()=>[{slug:'q',name:'株式会社スリスタ'}]}},{Promise});
    assert.deepEqual(JSON.parse(JSON.stringify(await server.getAccountCompanyName())),{name:'登録した会社',source:'company',websiteUrl:null,industry:null});
    // 表が無い（本番に反映する前）ときは、ツールの組織の名前に戻る
    const broken=load('src/lib/shell/company.server.ts',{'next-auth':{getServerSession:async()=>({user:{id:'alice'}})},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma:{accountCompany:{findUnique:async()=>{throw Object.assign(Error('missing table'),{code:'P2021'})}}}},'./company':load('src/lib/shell/company.ts',{}),'@/lib/quote/access':{listMemberships:async()=>[{slug:'q',name:'株式会社スリスタ'}]}},{Promise});
    assert.deepEqual(JSON.parse(JSON.stringify(await broken.getAccountCompanyName())),{name:'株式会社スリスタ',source:'tool'});
  });
  await check('Company code never writes tool organizations',async()=>{
    const fs=require('node:fs');
    for(const f of ['src/lib/shell/company.server.ts','src/app/api/account/company/route.ts']){
      const src=fs.readFileSync(path.join(root,f),'utf8');
      assert.doesNotMatch(src,/prisma\.(?!accountCompany|user\.findUnique)\w+\.(create|update|upsert|delete)/,f);
      assert.doesNotMatch(src,/lib\/aio\//,f);
    }
  });
  console.log(JSON.stringify({scope:'Account company API and display helper with synthetic sessions and a recording prisma. No real DB, billing or AI.'}));
})().catch(e=>{console.error(e);process.exitCode=1});
