// 自動点検（system-watch の B1）が作った見積書・スライドを、利用者の枠と台帳に数えないことを確かめる。
// 2026-10-26 ユーザー決定（進めてください）。商談準備と同じく、合図（CRON_SECRET から作る HMAC）を確かめたルートだけが記録の ID を残す。
// - 合図が正しい: ID を残し、台帳（見積書の org-quota / スライドの monthlyUsage・1日の文章生成の回数）を増やさない。数えるときは ID を除く。
// - 合図が無い・偽の合図・名前を「【自動点検】…」にした利用者の物: いつも通り数える。
// 実行: node scripts/security-regression/verify-system-watch-quote-slide.cjs
const assert=require('node:assert/strict'),crypto=require('node:crypto'),{z}=require('zod'),{load,check}=require('./load-typescript.cjs');

const SECRET='test-cron-secret';
const TOKEN=crypto.createHmac('sha256',SECRET).update('doya-system-watch:v1').digest('hex');
const FAKES=[{},{'x-doya-system-watch':'0'.repeat(64)},{'x-doya-system-watch':TOKEN.slice(0,-1)}];
const G={Promise,JSON,Array};
const marker=()=>load('src/lib/system-watch/marker.ts',{'node:crypto':crypto},{process:{env:{CRON_SECRET:SECRET}}});
const marked=()=>load('src/lib/system-watch/marked-records.ts',{},G);

/** SystemSetting の見本（prisma でも tx でも同じものを使う） */
function settingStore(){
  const map=new Map();
  return {map,systemSetting:{
    findUnique:async({where})=>map.has(where.key)?{value:map.get(where.key)}:null,
    upsert:async({where,create,update})=>{map.set(where.key,map.has(where.key)?update.value:create.value)},
  }};
}
const markedIds=(map,prefix)=>{const k=[...map.keys()].find(k=>k.startsWith(prefix));return k?JSON.parse(map.get(k)):[]};
const notInOf=(where)=>where.id?.notIn??[];

(async()=>{
  await check('Quote documents + system watch: a valid signal marks the id and leaves the org quota ledger alone; others are counted',async()=>{
    const s=settingStore();let seq=0;const counts=[];
    const quoteDocument={count:async({where})=>{counts.push(where);return 0},create:async({data})=>({id:'q-'+(++seq),quoteNo:'Q-'+seq,title:data.title}),findFirst:async()=>null};
    const tx={systemSetting:s.systemSetting,quoteDocument};
    const prisma={systemSetting:s.systemSetting,quoteDocument,quoteIssuer:{findUnique:async()=>null},quoteProduct:{findFirst:async()=>null},$transaction:async(fn)=>fn(tx)};
    const route=load('src/app/api/quote/documents/route.ts',{
      'next/server':{NextResponse:Response},
      '@/lib/prisma':{prisma},
      '@/lib/organization-billing':{getOrganizationOwnerUserId:async()=>'u'},
      '@/lib/quote/access':{getQuoteContext:async()=>({organizationId:'org-a',userId:'u',role:'owner'}),orgSlugFrom:()=>'alpha'},
      '@/lib/quote/document':{defaultExpiry:()=>new Date('2026-11-30T00:00:00Z'),nextQuoteNo:async()=>'Q',recalcDocument:async()=>{}},
      // 枠の確認は、ルートが渡す数え方（累計・今月）を両方呼ぶ
      '@/lib/plan-limit':{assertFreeLimit:async(_k,countUsed,_o,countSince)=>{await countUsed();await countSince(new Date('2026-10-01T00:00:00Z'));return {ok:true,used:0,limit:100}},FREE_LIMITS:{quoteDocuments:3},jstStartOfMonthUtc:()=>new Date('2026-10-01T00:00:00Z')},
      '@/lib/organization-quota-ledger':load('src/lib/organization-quota-ledger.ts',{'node:crypto':crypto},G),
      '@/lib/pricing':{SUPPORT_CONTACT_URL:'https://example.invalid/contact'},
      '@/lib/service-usage':{recordServiceUsage:async()=>{}},
      '@/lib/system-watch/marker':marker(),
      '@/lib/system-watch/marked-records':marked(),
    },G);
    const post=(headers,title)=>route.POST({headers:new Headers(headers),json:async()=>({title})});
    const ledger=()=>[...s.map.entries()].filter(([k])=>!k.startsWith('watch:')).map(([,v])=>v).join(',');
    const MARK='watch:v1:marked:quote-document:org-a:';

    // 1. 合図が正しい: ID を残し、台帳は作らない
    assert.equal((await post({'x-doya-system-watch':TOKEN},'【自動点検】お見積り')).status,200);
    assert.deepEqual(markedIds(s.map,MARK),['q-1']);
    assert.equal(ledger(),'','a signalled quote must not touch the org quota ledger');
    // 2. 合図が無い・偽の合図: 数え方から q-1 を除き、台帳を増やし、ID は残さない
    for(const h of FAKES){
      counts.length=0;
      assert.equal((await post(h,'【自動点検】お見積り')).status,200,JSON.stringify(h));
      assert.ok(counts.length>=4,'lifetime and monthly, outside and inside the transaction');
      for(const w of counts)assert.deepEqual(notInOf(w),['q-1']);
    }
    assert.deepEqual(markedIds(s.map,MARK),['q-1'],'no extra ids without a valid signal');
    assert.notEqual(ledger(),'','unsignalled quotes are recorded in the ledger');
    // 3. 名前を「【自動点検】…」にした利用者の見積書（q-2〜q-4）は除かない
    counts.length=0;
    await post({},'次');
    for(const w of counts)for(const id of ['q-2','q-3','q-4'])assert.equal(notInOf(w).includes(id),false);
  });

  await check('DoyaSlide projects + system watch: a valid signal is not counted against the free monthly limit and leaves monthlyUsage alone',async()=>{
    const s=settingStore();let seq=0;let rows=[];let usage=null;const counts=[];
    const doyaSlideProject={
      count:async({where})=>{counts.push(where);const ex=notInOf(where);return rows.filter(r=>!ex.includes(r.id)).length},
      create:async({data})=>{const r={id:'p-'+(++seq),...data};rows.push(r);return r},
    };
    const userServiceSubscription={findUnique:async()=>usage,upsert:async({create,update})=>{usage=usage?{...usage,...update}:{...create}}};
    const tx={$queryRaw:async()=>[{id:'u'}],systemSetting:s.systemSetting,doyaSlideProject,userServiceSubscription};
    let maxProjects=3;
    const route=load('src/app/api/doyaslide/projects/route.ts',{
      'next/server':{NextResponse:Response},
      '@/lib/prisma':{prisma:{...tx,$transaction:async(fn)=>fn(tx)}},
      '@/lib/doyaslide/access':{getUserId:async()=>'u'},
      '@/lib/doyaslide/limits':{getUserDoyaSlideLimits:async()=>({maxProjects}),DOYASLIDE_PROJECT_SERVICE_ID:'doyaslide-projects',isSameMonth:()=>true,monthStart:()=>new Date('2026-09-30T15:00:00Z')},
      '@/lib/doyaslide/constants':{getDocType:()=>({value:'proposal',defaultCount:8,defaultAspect:'16:9'}),DOC_TYPES:[{value:'proposal'}],ASPECT_TO_SIZE:{'16:9':{}},STYLE_PRESETS:[{value:'corporate'}],MIN_SLIDES:1,MAX_SLIDES:30},
      '@/lib/doyaslide/errors':{errorSuffix:()=>''},
      '@/lib/system-watch/marker':marker(),
      '@/lib/system-watch/marked-records':marked(),
    },G);
    const post=(headers,title)=>route.POST({headers:new Headers(headers),json:async()=>({title})});
    const MARK='watch:v1:marked:doyaslide-project:u:';

    // 1. 合図が正しい: 無料の月3件を超えて5件作っても止めない。monthlyUsage は作らない
    for(let i=0;i<5;i++)assert.equal((await post({'x-doya-system-watch':TOKEN},'【自動点検】提案')).status,201);
    assert.deepEqual(markedIds(s.map,MARK),['p-1','p-2','p-3','p-4','p-5']);
    assert.equal(usage,null,'a signalled project must not touch monthlyUsage');
    // 2. 合図が無い・偽の合図・名前の偽の印: いつも通り数え、3件目の次で止める
    const plain=[[FAKES[0],'【自動点検】自分で付けた名前'],[FAKES[1],'提案'],[FAKES[2],'提案']];
    for(const [h,title] of plain)assert.equal((await post(h,title)).status,201,JSON.stringify(h));
    assert.equal(usage.monthlyUsage,3);
    assert.deepEqual(notInOf(counts.at(-1)),['p-1','p-2','p-3','p-4','p-5']);
    const res=await post({},'4件目');
    assert.equal(res.status,403);
    assert.equal((await res.json()).code,'LIMIT_REACHED');
    for(const h of FAKES.slice(1))assert.equal((await post(h,'4件目')).status,403,JSON.stringify(h));
    assert.deepEqual(markedIds(s.map,MARK),['p-1','p-2','p-3','p-4','p-5'],'no extra ids without a valid signal');
    // 3. プロ（上限なし）でも、合図が正しいときだけ ID を残す
    maxProjects=-1;
    await post({},'プロ');
    assert.equal(markedIds(s.map,MARK).length,5);
    await post({'x-doya-system-watch':TOKEN},'【自動点検】プロ');
    assert.deepEqual(markedIds(s.map,MARK).slice(-1),['p-'+seq]);
  });

  await check('DoyaSlide countProjects: excludes only the marked ids (usage gauge)',async()=>{
    const s=settingStore();let seen;
    await marked().markSystemWatchRecord(s,'doyaslide-project','u','p-1');
    const limits=load('src/lib/doyaslide/limits.ts',{
      '@/lib/prisma':{prisma:{systemSetting:s.systemSetting,doyaSlideProject:{count:async({where})=>{seen=where;return 2}},userServiceSubscription:{findUnique:async()=>null}}},
      '@/lib/plan-utils':{tierFrom:()=>'FREE'},
      '@/lib/pricing':{SUPPORT_CONTACT_URL:'https://example.invalid/contact'},
      '@/lib/system-watch/marked-records':marked(),
    },G);
    assert.equal(await limits.countProjects('u'),2);
    assert.deepEqual(notInOf(seen),['p-1']);
    // ほかの利用者の印は使わない
    await limits.countProjects('other');
    assert.deepEqual(notInOf(seen),[]);
  });

  await check('DoyaSlide structure + system watch: only a valid signal skips the daily text-call reservation',async()=>{
    let reserves=0;let project;const slides=[];
    const reset=()=>{project={id:'project-1',userId:'u',title:'提案',customBrief:null,docType:'proposal',slideCount:2,status:'draft',updatedAt:new Date(0)};slides.length=0};
    const matches=(where)=>project.id===where.id&&(!where.status||project.status===where.status)&&(!where.slides||slides.length===0);
    const projectStore={findFirst:async({where})=>matches(where)?{...project}:null,updateMany:async({where,data})=>{if(!matches(where))return {count:0};project={...project,...data};return {count:1}},update:async({data})=>{project={...project,...data};return project}};
    const slideStore={count:async()=>slides.length,createMany:async({data})=>{slides.push(...data);return {count:data.length}},findMany:async()=>[...slides]};
    const tx={doyaSlideProject:projectStore,doyaSlideSlide:slideStore};
    const slide=(h)=>({role:'本文',headline:h,subText:'内容',visualPrompt:'図解'});
    const route=load('src/app/api/doyaslide/structure/route.ts',{
      'next/server':{NextResponse:Response},zod:{z},
      '@/lib/prisma':{prisma:{...tx,$transaction:async(fn)=>fn(tx)}},
      '@seo/lib/gemini':{GEMINI_TEXT_MODEL_DEFAULT:'test',CLAUDE_MODEL_LIGHT:'',geminiGenerateJson:async()=>({slides:[slide('表紙'),slide('本文')]})},
      '@/lib/doyaslide/access':{getUserId:async()=>'u'},
      '@/lib/doyaslide/text-budget':{reserveDoyaSlideTextCall:async()=>{reserves++},DoyaSlideTextLimitError:class extends Error{}},
      '@/lib/doyaslide/prompts':{buildStructurePrompt:()=>'prompt'},
      '@/lib/doyaslide/scrape':{scrapeUrlText:async()=>({title:'',text:''})},
      '@seo/lib/serpapi':{hasSerpApiKey:()=>false},
      '@/lib/doyaslide/errors':{errorSuffix:()=>''},
      '@/lib/system-watch/marker':marker(),
    },G);
    const post=(headers)=>{reset();return route.POST({headers:new Headers(headers),json:async()=>({projectId:'project-1'})})};
    assert.equal((await post({'x-doya-system-watch':TOKEN})).status,200);
    assert.equal(reserves,0,'a signalled structure call must not count as a daily text call');
    for(const h of FAKES){
      const before=reserves;
      assert.equal((await post(h)).status,200,JSON.stringify(h));
      assert.equal(reserves,before+1,JSON.stringify(h));
    }
  });
})().catch(e=>{console.error(e);process.exit(1)});
