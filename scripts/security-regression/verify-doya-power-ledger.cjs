// ドヤパワーの台帳のセキュリティの回帰テスト。
// - 同じ operationId で二重に減らさない（順に・同時に）
// - 戻しは1回だけ（順に・同時に）
// - 他の会社の残りを読めない・減らせない・戻せない（他社の operationId を使っても、その会社の残りは返さない）
// - 台帳を使う API は、新しい見た目の人だけ・会社はセッションから決める
// メモリの上の DB（src/lib/doya-power/memory-db.ts）だけを使う。本物の DB・課金・外部 API には触れない。
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{load,check}=require('./load-typescript.cjs');
const root=path.resolve(__dirname,'../..');
function fixture(){
  let t=new Date('2026-10-19T03:00:00.000Z');
  const now=()=>new Date(t.getTime());
  const rules=load('src/lib/doya-power/rules.ts',{});
  const mem=load('src/lib/doya-power/memory-db.ts',{},{structuredClone,Promise,Object,Array,Number,String}).createMemoryDb({now});
  mem.rows('accountCompany').push({id:'co_alice',userId:'alice',name:'アリス株式会社'},{id:'co_bob',userId:'bob',name:'ボブ株式会社'});
  const plan=load('src/lib/unified-plan.ts',{});
  const ledger=load('src/lib/doya-power/ledger.ts',{'./rules':rules,'@/lib/unified-plan':plan},{Promise,Object,Array,Number,Math}).createDoyaPowerLedger(mem.db,{now});
  const total=async(id)=>(await ledger.balance(id)).total;
  const count=(type)=>mem.rows('doyaPowerTransaction').filter(x=>x.type===type).length;
  return {mem,ledger,total,count};
}
const plain=(v)=>JSON.parse(JSON.stringify(v));
(async()=>{
  await check('Doya Power: the same operationId is consumed only once, even concurrently',async()=>{
    const f=fixture();
    await f.ledger.grant('co_alice','purchase',100,null);
    const results=await Promise.all(Array.from({length:5},()=>f.ledger.consume('co_alice',30,'op-1')));
    assert.equal(results.filter(r=>r.ok&&!r.duplicated).length,1);
    assert.equal(results.every(r=>r.ok),true);
    assert.equal(await f.total('co_alice'),80);
    assert.equal(f.count('consume'),1);
    // 先の確認で見えなくても、unique 制約で止まり、取引ごと取り消される
    const tx=f.mem.db.doyaPowerTransaction,orig=tx.findUnique;let hide=1;
    tx.findUnique=async(a)=>{if(hide>0&&a.where.operationId==='op-1'){hide--;return null}return orig(a)};
    const again=await f.ledger.consume('co_alice',30,'op-1');
    assert.equal(again.ok&&again.duplicated,true);
    assert.equal(await f.total('co_alice'),80);
    assert.equal(f.count('consume'),1);
  });
  await check('Doya Power: a refund is applied only once, even concurrently',async()=>{
    const f=fixture();
    await f.ledger.grant('co_alice','purchase',100,null);
    await f.ledger.consume('co_alice',50,'op-r');
    const results=await Promise.all(Array.from({length:5},()=>f.ledger.refund('op-r')));
    assert.equal(results.filter(r=>r.ok&&!r.duplicated).length,1);
    assert.equal(await f.total('co_alice'),110);
    assert.equal((await f.ledger.refund('op-r')).duplicated,true);
    assert.equal(await f.total('co_alice'),110);
    assert.equal(f.count('refund'),1);
    assert.deepEqual(plain(await f.ledger.refund('op-unknown')),{ok:false,reason:'not_found'});
  });
  await check('Doya Power: another company balance cannot be read, consumed or refunded',async()=>{
    const f=fixture();
    await f.ledger.grant('co_bob','purchase',999,null);
    await f.ledger.consume('co_bob',9,'op-bob');
    const bobBefore=await f.total('co_bob');
    // アリスがボブの operationId を使っても、ボブの残りは返らず、減らない
    const r=plain(await f.ledger.consume('co_alice',1,'op-bob'));
    assert.deepEqual(r,{ok:false,reason:'operation_conflict'});
    assert.equal('balance' in r,false);
    // アリスの会社を指定して、ボブの操作を戻せない（あるかも言わない）
    assert.deepEqual(plain(await f.ledger.refund('op-bob',{companyId:'co_alice'})),{ok:false,reason:'not_found'});
    assert.equal(await f.total('co_bob'),bobBefore);
    // ユーザーから引くと、本人の会社だけ
    f.mem.calls.length=0;
    const alice=plain(await f.ledger.balanceForUser('alice'));
    assert.equal(alice.companyId,'co_alice');
    assert.equal(alice.total,10);
    assert.equal(JSON.stringify(alice).includes('999'),false);
    const bobAccount=f.mem.rows('doyaPowerAccount').find(a=>a.companyId==='co_bob').id;
    for(const c of f.mem.calls){
      const s=JSON.stringify(c.args);
      assert.equal(s.includes('co_bob')||s.includes(bobAccount),false,c.model+'.'+c.op+' '+s);
    }
    assert.equal(await f.ledger.balanceForUser('mallory'),null);
  });
  await check('Doya Power: API routes that use the ledger gate on isUiNext and the Doya Power flag, and take the company from the session',async()=>{
    const walk=(d)=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
    const files=walk(path.join(root,'src/app')).filter(f=>/\.(ts|tsx)$/.test(f));
    for(const file of files){
      const src=fs.readFileSync(file,'utf8');
      if(!/from ['"]@\/lib\/doya-power(\/index)?['"]/.test(src))continue;
      assert.match(src,/isUiNext/,file);
      // ドヤパワーの旗（DOYA_POWER_ROLLOUT）も見る（verify-doya-power-flag.cjs）
      assert.match(src,/isDoyaPowerEnabled\(\)/,file);
      assert.match(src,/getServerSession/,file);
      assert.doesNotMatch(src,/(body|searchParams|query)\W[^\n]*companyId/,file);
    }
  });
})().catch(e=>{console.error(e);process.exit(1)});
