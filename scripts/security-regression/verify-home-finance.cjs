// Isolated process; real finance readers, summary/API, UI and agent with synthetic Prisma data only.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const {createRequire} = Module;
const assert = require('node:assert/strict');
const {test} = require('node:test');
const {createHash} = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const req = createRequire(path.join(root,'package.json'));
const ts = req('typescript');
const React = req('react');
const {renderToStaticMarkup} = req('react-dom/server');
const {JSDOM} = req('jsdom');
const RealDate = Date;
let current;
const writes = [];
const network = [];
const clone = value => structuredClone(value);
function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some(item=>matches(row,item));
    if (key === 'AND') return value.every(item=>matches(row,item));
    const actual = row[key];
    if (value && typeof value === 'object' && !(value instanceof RealDate)) {
      if ('in' in value && !value.in.includes(actual)) return false;
      if ('notIn' in value && value.notIn.includes(actual)) return false;
      if ('not' in value && actual === value.not) return false;
      for (const [op, fn] of [['gte',(a,b)=>a>=b],['gt',(a,b)=>a>b],['lte',(a,b)=>a<=b],['lt',(a,b)=>a<b]]) if(op in value && !fn(actual,value[op])) return false;
      if(!['in','notIn','not','gte','gt','lte','lt'].some(op=>op in value)) return matches(actual || {}, value);
      return true;
    }
    return actual === value || actual instanceof RealDate && value instanceof RealDate && actual.getTime()===value.getTime();
  });
}
function query(model, method, input = {}) {
  if (!['findFirst','findUnique','findMany','count','aggregate','groupBy'].includes(method)) {
    writes.push({model,method}); throw Error('write or unsupported operation is forbidden');
  }
  current.calls.push({model,method,input:clone(input)});
  if (current.fail?.(model,method,input)) throw Error('synthetic unavailable');
  const tables=current.tables;
  if (!(model in tables)) throw Error('unhandled read '+model+'.'+method);
  let rows=tables[model].map(row=>{
    if(model==='incomeMember') return {...row,organization:tables.incomeOrganization.find(org=>org.id===row.organizationId)};
    if(model==='expenseMember') return {...row,organization:tables.expenseOrganization.find(org=>org.id===row.organizationId)};
    return row;
  }).filter(row=>matches(row,input.where));
  if(input.orderBy?.createdAt) rows.sort((a,b)=>(a.createdAt-b.createdAt)*(input.orderBy.createdAt==='desc'?-1:1));
  let output;
  if(method==='findFirst'||method==='findUnique') output=rows[0]||null;
  else if(method==='count') output=rows.length;
  else if(method==='aggregate') output={_sum:Object.fromEntries(Object.keys(input._sum).map(key=>[key,rows.reduce((sum,row)=>sum+row[key],0)]))};
  else if(method==='groupBy') {
    const groups=new Map();
    for(const row of rows) {const key=row.period.toISOString(); groups.set(key,(groups.get(key)||0)+row.amountExclTax);}
    output=[...groups].map(([key,value])=>({period:new RealDate(key),_sum:{amountExclTax:value}}));
  } else output=rows;
  const result=clone(output);
  current.afterRead?.(model,method,input);
  return Promise.resolve(result);
}
const prisma=new Proxy({}, {get:(_,model)=>new Proxy({}, {get:(_,method)=>(input)=>query(model,method,input)})});
const Link=({children,href,prefetch,...props})=>React.createElement('a',{...props,href},children);
const mocks={
  'next-auth/react':{useSession:()=>({data:{user:{id:'viewer'}},status:'authenticated',update:async()=>({user:{id:'viewer'}})})},
  '@/lib/prisma':{prisma}, '@/lib/auth':{authOptions:{}},
  'next-auth':{getServerSession:async()=>({user:{id:'viewer',name:'Synthetic'}})},
  'next/link':{__esModule:true,default:Link}, 'next/navigation':{useRouter:()=>({push(){}})},
  '@/components/shell/tools':{SHELL_GROUPS:[],shellGroups:()=>[]},
  '@/components/shell/icons':{ShellIcon:()=>React.createElement('svg')},
  '@/components/ds/motion':{CountUp:({value,format})=>React.createElement('span',null,format?format(value):value)},
  '@/components/ds/charts':{AreaChart:({labels,series})=>React.createElement('figure',{'data-series':JSON.stringify(series),'data-labels':JSON.stringify(labels)}),Bars:()=>null},
  '@/components/shell/ShellCompanyCard':{CompanyRegisterButton:()=>null,ShellCompanyTag:()=>null},
  '@/components/shell/company-context':{useAccountCompany:()=>undefined},
  '@/components/shell/ui-next-context':{useToolHref:()=>x=>x},
  'lucide-react':new Proxy({}, {get:(_,key)=>key==='__esModule'?false:()=>React.createElement('svg')}),
};
const cache=new Map();
function load(file) {
  if(cache.has(file)) return cache.get(file).exports;
  const mod=new Module(file);mod.filename=file;mod.paths=Module._nodeModulePaths(path.dirname(file));cache.set(file,mod);
  mod.require=id=>{
    if(mocks[id]) return mocks[id];
    if(id.endsWith('.css')) return {__esModule:true,default:new Proxy({}, {get:(_,key)=>String(key)})};
    if(id.startsWith('@/')||id.startsWith('./')) {
      const base=id.startsWith('@/')?path.join(root,'src',id.slice(2)):path.resolve(path.dirname(file),id);
      for(const ext of ['.ts','.tsx']) if(fs.existsSync(base+ext)) return load(base+ext);
    }
    return req(id);
  };
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  mod._compile(code,file);return mod.exports;
}
const source=relative=>load(path.join(root,relative));
const at=new RealDate('2026-11-01T00:00:00Z');
const date=value=>new RealDate(value+'T00:00:00Z');
function fixture(reference=at) {
  const month=new RealDate(reference.getTime()+9*3600000).toISOString().slice(0,7);
  const period=date(month+'-01');
  const org={id:'i1',name:'Income A',slug:'income-a',expenseSourceId:'expense',expenseOrganizationId:'e1',promaneWorkspaceId:null};
  const createdAt=new RealDate('2026-01-01');
  const row={id:'expense-row',organizationId:'e1',kind:'contract',title:'Fee',category:'contractor',period,plannedPayDate:period,plannedAmountExclTax:40,amountExclTax:40,taxAmount:4,withholdingAmount:4,netPayAmount:40,status:'paid',paidOn:period,paidAmount:40,estimated:false,contractId:'ec1'};
  return {calls:[],tables:{
    user:[{id:'viewer',name:'Synthetic',email:null,plan:'FREE',stripeCurrentPeriodEnd:null}],subscription:[],
    incomeOrganization:[org],incomeMember:[{id:'im1',organizationId:'i1',userId:'viewer',role:'owner',status:'ACTIVE',createdAt}],
    incomeContract:[{id:'ic1',organizationId:'i1',status:'active',endDate:null}],
    incomeRevenueSchedule:[{id:'r1',organizationId:'i1',period,status:'invoiced',amountExclTax:100}],
    incomePayment:[{organizationId:'i1',receivedOn:period,amount:110}],incomeInvoice:[],
    expenseOrganization:[{id:'e1',name:'Linked Expense A',slug:'expense-a'},{id:'e2',name:'Other Expense B',slug:'expense-b'}],
    expenseMember:[{id:'em1',organizationId:'e1',userId:'viewer',role:'owner',status:'ACTIVE',createdAt},{id:'em2',organizationId:'e2',userId:'viewer',role:'owner',status:'ACTIVE',createdAt:new RealDate('2026-02-01')}],
    expenseContract:[{id:'ec1',organizationId:'e1',title:'Fee',status:'active',endDate:null,autoRenew:false,renewalNoticeDays:null,category:'contractor',frequencyMonths:1}],
    expenseSchedule:[row,{...row,id:'tax',kind:'withholding_tax',amountExclTax:4,netPayAmount:4,paidAmount:4},{...row,id:'other',organizationId:'e2',amountExclTax:999,netPayAmount:999,paidAmount:999}],
    sfaMember:[{id:'sm',organizationId:'s1',userId:'viewer',status:'ACTIVE',role:'owner',createdAt,organization:{id:'s1',name:'Sales Ref',slug:'sales'}}],
    sfaDeal:[{id:'d1',organizationId:'s1',isActive:true,name:'Ref',amount:900,status:'won',wonAt:period,stageId:'x',probability:100,expectedCloseDate:null}],sfaPipeline:[],sfaTask:[],sfaLead:[],
    quoteMember:[{id:'qm',organizationId:'q1',userId:'viewer',status:'ACTIVE',role:'owner',createdAt,organization:{id:'q1',name:'Quote Ref'}}],
    quoteDocument:[{id:'q',organizationId:'q1',status:'confirmed',totalExclTax:800,confirmedAt:period,expiryDate:period}],
    promaneMember:[{id:'pm',userId:'viewer',workspaceId:'w1',isActive:true,role:'owner',hourlyRate:0,timeEntries:[],createdAt,workspace:{id:'w1',name:'Project Ref',slug:'project'}}],
    promaneProject:[{id:'p',workspaceId:'w1',name:'Ref Project',status:'active',contractAmount:700,endDate:null,expenses:[{amount:300}],tasks:[]}],promaneTimeEntry:[],
    kintaiMember:[],hrOrganizationMember:[],
  }};
}
const reset=(reference=at)=>{current=fixture(reference);};
const results=[];
async function run(name,fn){reset();await fn();results.push(name);}
function rendered(summary,component) {
  const Component=source('src/app/(shell)/home/'+component+'.tsx').default;
  return new JSDOM(renderToStaticMarkup(React.createElement(Component,{initial:summary,serverActorId:summary.actorId}))).window.document;
}
test('home finance real read, API, UI and agent regression without writes or providers',async()=>{
  const oldFetch=global.fetch,oldDate=Date,oldTZ=process.env.TZ;
  global.fetch=(...args)=>{network.push(args);throw Error('network forbidden')};
  global.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[at.getTime()]))}static now(){return at.getTime()}};
  try {
    const {loadHomeFinance}=source('src/lib/home/finance-read.ts');
    const {getHomeSummary}=source('src/lib/home/summary.ts');
    const {planAgent}=source('src/app/(shell)/home/agent.ts');
    await run('linked expense wins over newer membership; tax bases remain separate',async()=>{
      const s=await getHomeSummary('viewer',at);const f=s.finance;
      assert.equal(f.income.value.revenue.scheduled,100);assert.equal(f.income.value.revenue.invoiced,100);assert.equal(f.income.value.revenue.received,110);
      assert.equal(f.income.value.expense,40);assert.equal(f.income.value.profit,60);assert.equal(f.expense.value.cashOut,44);assert.equal(f.expense.organization.id,'e1');
      assert.deepEqual(Object.keys(f.income.organization).sort(),['id','name','slug']);
      assert.equal(s.sales.wonThisMonth,900);assert.equal(s.quotes.confirmedThisMonth,800);assert.equal(s.projects.cost,300);
      assert.deepEqual(s.sources,{revenue:'income',cost:'expense'});
      assert.ok(current.calls.filter(x=>x.model==='expenseSchedule').every(x=>x.input.where.organizationId==='e1'));
      for(const name of ['HomeDashboard','HomeDashboardLegacy']) {
        const doc=rendered(s,name);assert.equal(doc.querySelector('[aria-label="今月の主要な数字"]'),null);
        const section=doc.querySelector('[aria-label="収入管理の今月の数字"]');
        assert.deepEqual([...section.querySelectorAll('a strong')].map(x=>x.textContent),['100円','100円','110円','60円']);
        assert.ok(doc.body.textContent.includes('Linked Expense A'));assert.ok(doc.body.textContent.includes('案件別収支（プロマネ・参考）'));
        assert.equal(doc.querySelector('[aria-label="支出管理の出金"] a').getAttribute('href'),'/expense/expense-a');
      }
      const plan=planAgent('今月の売上と収入を教えて',s);assert.equal(plan.rows[0].value,'100円');assert.equal(plan.rows[3].value,'60円');assert.ok(!plan.rows.some(x=>x.value==='900円'||x.value==='800円'));
    });
    await run('used income with zero current month stays authoritative',async()=>{
      current.tables.incomeRevenueSchedule=[];current.tables.incomePayment=[];
      const s=await getHomeSummary('viewer',at);assert.equal(s.finance.income.state,'ready');assert.equal(s.finance.income.value.revenue.scheduled,0);assert.equal(s.sources.revenue,'income');
      for(const name of ['HomeDashboard','HomeDashboardLegacy']) assert.equal(rendered(s,name).querySelector('[aria-label="収入管理の今月の数字"] a strong').textContent,'0円');
    });
    await run('zero contracts is normal unused and permits legacy reference',async()=>{
      current.tables.incomeContract=[];const s=await getHomeSummary('viewer',at);assert.equal(s.finance.income.state,'unused');assert.equal(s.sources.revenue,'sfa_quote');assert.equal(s.sales.wonThisMonth,900);
      for(const name of ['HomeDashboard','HomeDashboardLegacy']) assert.ok(rendered(s,name).querySelector('[aria-label="今月の主要な数字"]'));
    });
    await run('no memberships is unused with zero writes',async()=>{
      current.tables.incomeMember=[];current.tables.expenseMember=[];const f=await loadHomeFinance('viewer',at);assert.equal(f.income.state,'unused');assert.equal(f.expense.state,'unused');
    });
    for(const role of ['unknown','__proto__']) await run('unknown income role '+role+' never falls back',async()=>{
      current.tables.incomeMember[0].role=role;const s=await getHomeSummary('viewer',at);assert.equal(s.finance.income.state,'no_access');assert.equal(s.sources.revenue,'unavailable');assert.equal(s.finance.income.value,null);
      for(const name of ['HomeDashboard','HomeDashboardLegacy']) {const doc=rendered(s,name);assert.equal(doc.querySelector('[aria-label="今月の主要な数字"]'),null);assert.deepEqual([...doc.querySelectorAll('[aria-label="収入管理の今月の数字"] a strong')].map(x=>x.textContent),['—','—','—','—']);}
      assert.equal(planAgent('売上',s).rows[0].value,'—');
    });
    await run('inactive latest membership does not silently choose an older organization',async()=>{
      current.tables.incomeMember[0].status='INACTIVE';current.tables.incomeMember.push({...current.tables.incomeMember[0],id:'older',status:'ACTIVE',organizationId:'other',createdAt:new RealDate('2025-01-01')});
      const f=await loadHomeFinance('viewer',at);assert.equal(f.income.state,'no_access');assert.equal(f.income.value,null);
    });
    await run('multiple active income memberships select one latest organization without addition',async()=>{
      current.tables.incomeOrganization.push({...current.tables.incomeOrganization[0],id:'i2',name:'Income B',slug:'income-b',expenseOrganizationId:'e2'});
      current.tables.incomeMember.push({...current.tables.incomeMember[0],id:'im2',organizationId:'i2',createdAt:new RealDate('2026-02-01')});
      current.tables.incomeContract.push({...current.tables.incomeContract[0],id:'ic2',organizationId:'i2'});
      current.tables.incomeRevenueSchedule.push({...current.tables.incomeRevenueSchedule[0],id:'r2',organizationId:'i2',amountExclTax:200});
      current.tables.incomePayment.push({...current.tables.incomePayment[0],organizationId:'i2',amount:220});
      const f=await loadHomeFinance('viewer',at);assert.equal(f.income.organization.id,'i2');assert.equal(f.income.value.revenue.scheduled,200);assert.equal(f.income.value.revenue.received,220);assert.equal(f.expense.organization.id,'e2');
    });
    await run('foreign caller gets no foreign finance',async()=>{
      const f=await loadHomeFinance('foreign',at);assert.equal(f.income.state,'unused');assert.equal(f.expense.state,'unused');assert.ok(!current.calls.some(x=>['incomeRevenueSchedule','expenseSchedule'].includes(x.model)));
    });
    for(const role of ['unknown','__proto__']) await run('unknown linked expense role '+role+' preserves income and hides cost',async()=>{
      current.tables.expenseMember[0].role=role;const f=await loadHomeFinance('viewer',at);assert.equal(f.income.value.revenue.scheduled,100);assert.equal(f.income.value.profit,null);assert.equal(f.expense.state,'no_access');assert.equal(f.expense.value,null);
    });
    await run('lost linked expense does not substitute newer readable org',async()=>{
      current.tables.expenseMember[0].status='INACTIVE';const f=await loadHomeFinance('viewer',at);assert.equal(f.expense.state,'no_access');assert.equal(f.income.value.profit,null);assert.equal(f.income.value.expenseConnection,'no_access');
      assert.ok(!current.calls.some(x=>x.model==='expenseSchedule'&&x.input.where.organizationId==='e2'));
    });
    await run('income revoked during read discards selected data',async()=>{
      current.afterRead=(m,method)=>{if(m==='incomePayment'&&method==='aggregate') current.tables.incomeMember[0].status='INACTIVE'};
      const f=await loadHomeFinance('viewer',at);assert.equal(f.income.state,'no_access');assert.equal(f.income.value,null);
    });
    await run('expense revoked during read preserves revenue but no profit',async()=>{
      current.afterRead=m=>{if(m==='expenseSchedule') current.tables.expenseMember[0].status='INACTIVE'};
      const f=await loadHomeFinance('viewer',at);assert.equal(f.expense.state,'no_access');assert.equal(f.income.value.revenue.scheduled,100);assert.equal(f.income.value.profit,null);
    });
    await run('expense revoked after its own reads is checked after the full aggregate',async()=>{
      current.afterRead=(m,method,input)=>{if(m==='incomeMember'&&input.where.id) current.tables.expenseMember[0].status='INACTIVE'};
      const f=await loadHomeFinance('viewer',at);assert.equal(f.expense.state,'no_access');assert.equal(f.income.value.revenue.scheduled,100);assert.equal(f.income.value.profit,null);
    });
    await run('selected link tuple changed during read discards data',async()=>{
      current.afterRead=m=>{if(m==='incomePayment') current.tables.incomeOrganization[0].expenseOrganizationId='e2'};
      const f=await loadHomeFinance('viewer',at);assert.equal(f.income.state,'no_access');assert.equal(f.income.value,null);assert.equal(f.expense.value,null);
    });
    await run('income database failure stays unavailable, never zero or unused',async()=>{
      current.fail=m=>m==='incomeRevenueSchedule';const s=await getHomeSummary('viewer',at);assert.equal(s.finance.income.state,'error');assert.equal(s.finance.income.value,null);assert.equal(s.sources.revenue,'unavailable');assert.equal(planAgent('売上',s).rows[0].value,'—');
    });
    await run('expense database failure does not erase income',async()=>{
      current.fail=m=>m==='expenseSchedule';const s=await getHomeSummary('viewer',at);const f=s.finance;assert.equal(f.income.state,'ready');assert.equal(f.income.value.revenue.scheduled,100);assert.equal(f.income.value.revenue.received,110);assert.equal(f.income.value.profit,null);assert.equal(f.expense.state,'error');
      for(const name of ['HomeDashboard','HomeDashboardLegacy']) assert.deepEqual([...rendered(s,name).querySelectorAll('[aria-label="収入管理の今月の数字"] a strong')].map(x=>x.textContent),['100円','100円','110円','—']);
      assert.ok(planAgent('売上',s).rows.find(x=>x.label==='粗利（予定・税抜）').value.startsWith('—'));
    });
    await run('normal unused expense permits only reference fallback, never synthetic gross profit',async()=>{
      current.tables.expenseContract=[];current.tables.expenseSchedule=[];const s=await getHomeSummary('viewer',at);assert.equal(s.finance.expense.state,'unused');assert.equal(s.sources.cost,'promane');assert.equal(s.finance.income.value.revenue.scheduled,100);assert.equal(s.finance.income.value.profit,null);
    });
    await run('accrual month differs from cash month and withholding is not counted twice',async()=>{
      const base=current.tables.expenseSchedule[0];
      current.tables.expenseSchedule=[{...base,period:date('2026-10-01')},{...base,id:'tax',period:date('2026-10-01'),kind:'withholding_tax',amountExclTax:4,netPayAmount:4,paidAmount:4},{...base,id:'next-pay',period:date('2026-11-01'),plannedPayDate:date('2026-12-01'),paidOn:null,paidAmount:null,status:'planned',amountExclTax:20,netPayAmount:22}];
      const f=await loadHomeFinance('viewer',at);assert.equal(f.income.value.expense,20);assert.equal(f.income.value.profit,80);assert.equal(f.expense.value.cashOut,44);assert.equal(f.expense.value.nextMonthOut,22);
    });
    await run('existing income API default still reports expense failure',async()=>{
      current.fail=m=>m==='expenseSchedule';const {buildSummary}=source('src/lib/income/summary-read.ts');await assert.rejects(()=>buildSummary({userId:'viewer',organizationId:'i1'},'2026-11','2026-11-01'));
    });
    for(const legacy of [false,true]) await run('configured promane reference is retained '+legacy,async()=>{
      const org=current.tables.incomeOrganization[0];org.expenseSourceId=legacy?null:'promane';org.promaneWorkspaceId='w1';const before=clone(org);
      const f=await loadHomeFinance('viewer',at);assert.equal(f.income.value.profit,null);assert.equal(f.income.value.expenseConnection,'reference_only');assert.equal(f.expense.state,'unused');assert.deepEqual(org,before);assert.ok(!current.calls.some(x=>x.model==='expenseSchedule'));
    });
    await run('missing explicit expense ID is unavailable, not latest selection',async()=>{
      current.tables.incomeOrganization[0].expenseOrganizationId=null;const f=await loadHomeFinance('viewer',at);assert.equal(f.expense.state,'error');assert.equal(f.income.value.expenseConnection,'not_available');assert.ok(!current.calls.some(x=>x.model==='expenseMember'));
    });
    await run('unlinked standalone expense never supplies a cross-org gross profit',async()=>{
      Object.assign(current.tables.incomeOrganization[0],{expenseSourceId:null,expenseOrganizationId:null,promaneWorkspaceId:null});const f=await loadHomeFinance('viewer',at);assert.equal(f.expense.organization.id,'e2');assert.equal(f.income.value.profit,null);assert.equal(f.income.value.expenseConnection,'not_linked');
    });
    await run('JST month and year boundaries use one reference',async()=>{
      for(const iso of ['2026-12-31T14:59:59Z','2026-12-31T15:00:00Z']) {
        const reference=new RealDate(iso);reset(reference);const s=await getHomeSummary('viewer',reference);const expected=iso.includes('14:59')?'2026-12':'2027-01';assert.equal(s.finance.month,expected);assert.equal(s.generatedAt,iso.replace('Z','.000Z'));assert.equal(s.trend.at(-1).month,expected);assert.equal(s.finance.income.value.revenue.scheduled,100);
      }
    });
    await run('billing actions reach both UI and agent through existing read',async()=>{
      current.tables.incomeInvoice=[{id:'inv',organizationId:'i1',invoiceNo:'SYNTHETIC',status:'sent',totalInclTax:110,paidAmount:0,dueDate:date('2026-10-01'),client:{name:'Synthetic Client'}}];
      current.tables.incomeRevenueSchedule.push({id:'leak',organizationId:'i1',period:date('2026-10-01'),status:'planned',amountExclTax:50,plannedIssueDate:date('2026-10-01'),client:{name:'Synthetic Client'},contract:{title:'Synthetic Contract'}});
      const s=await getHomeSummary('viewer',at);assert.equal(s.finance.income.value.billing.overdue,1);assert.equal(s.finance.income.value.billing.leaks,1);assert.equal(s.finance.income.value.revenue.scheduled,100);assert.equal(s.finance.income.value.todo[0].kind,'leak');
      assert.equal(s.finance.income.value.trend.find(point=>point.month==='2026-10').revenue,50);
      assert.equal(s.finance.income.value.trend.find(point=>point.month==='2026-11').revenue,100);
      for(const name of ['HomeDashboard','HomeDashboardLegacy']) {
        const doc=rendered(s,name);const text=doc.body.textContent;assert.ok(text.includes('入金遅延 Synthetic Client'));assert.ok(text.includes('請求漏れ Synthetic Client'));
        const chart=doc.querySelector('[aria-label="収入管理の今月の数字"] figure');
        const series=JSON.parse(chart.getAttribute('data-series'));
        assert.equal(series.length,1);assert.equal(series[0].name,'売上予定（税抜）');assert.deepEqual(series[0].values.slice(-2),[50,100]);
        assert.deepEqual(JSON.parse(chart.getAttribute('data-labels')).slice(-2),['2026-10','2026-11']);
      }
      assert.ok(planAgent('今日やること',s).rows.some(x=>x.value==='入金遅延 Synthetic Client'));
    });
    await run('GET executes the actual summary and leaves all writes forbidden',async()=>{
      const {GET}=source('src/app/api/home/summary/route.ts');const response=await GET({nextUrl:new URL('https://example.test/api/home/summary?expectedActor=viewer')});assert.equal(response.status,200);const data=await response.json();assert.equal(data.finance.income.value.profit,60);assert.equal(data.finance.expense.organization.id,'e1');assert.ok(response.headers.get('cache-control').includes('private'));
    });
    assert.equal(results.length,28);assert.deepEqual(writes,[]);assert.deepEqual(network,[]);
    const inputs=['src/lib/home/finance-read.ts','src/lib/home/summary.ts','src/lib/income/summary-read.ts','src/lib/income/expense-source.ts','src/lib/expense/expense-read.ts','src/lib/expense/income-source.ts','src/lib/expense/aggregate.ts','src/app/(shell)/home/HomeDashboard.tsx','src/app/(shell)/home/HomeDashboardLegacy.tsx','src/app/(shell)/home/FinanceOverview.tsx','src/app/(shell)/home/today.ts','src/app/(shell)/home/agent.ts'];
    console.log(JSON.stringify({passed:true,cases:results.length,results,databaseWrites:writes.length,networkCalls:network.length,hashes:Object.fromEntries(inputs.map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]))},null,2));
  } finally {global.fetch=oldFetch;global.Date=oldDate;if(oldTZ===undefined)delete process.env.TZ;else process.env.TZ=oldTZ;}
});
