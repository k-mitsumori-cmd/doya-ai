const assert = require('node:assert/strict')
const { load, check } = require('../../../scripts/security-regression/load-typescript.cjs')

const manager = load('src/lib/kintai/manager-admission.ts')

function fixture({ actorRole = 'hr_admin', employeeCount = 0 } = {}) {
  const rows = new Map([['rule', { id: 'rule', organizationId: 'org', name: 'Standard' }]])
  const order = []
  const receipts = new Map()
  let writes = 0
  const tx = {
    $executeRaw: async () => 1,
    systemSetting: { findUnique: async ({where}) => receipts.get(where.key) || null, create: async ({data}) => { receipts.set(data.key,data); return data } },
    $queryRaw: async () => { order.push('actor'); return [{ role: actorRole, status: 'ACTIVE', isActive: true }] },
    kintaiWorkRule: {
      findFirst: async ({ where }) => rows.get(where.id)?.organizationId === where.organizationId ? rows.get(where.id) : null,
      create: async ({ data }) => { writes++; const row = { id: 'new', ...data }; rows.set('new', row); return row },
      update: async ({ where, data }) => { writes++; const row = { ...rows.get(where.id), ...data }; rows.set(where.id, row); return row },
      delete: async ({ where }) => { writes++; rows.delete(where.id); return { id: where.id } },
    },
    kintaiEmployee: { count: async () => employeeCount },
  }
  const prisma = { $transaction: async work => work(tx) }
  const deps = {
    '@/lib/kintai/work-rule-operation': load('src/lib/kintai/work-rule-operation.ts', {'node:crypto': require('node:crypto')}),
    '@/lib/kintai/work-rule-input': load('src/lib/kintai/work-rule-input.ts'),
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/kintai/access': {
      getKintaiContext: async () => ({ organizationId: 'org', userId: 'actor', memberId: 'actor-member', role: 'hr_admin' }),
      hasMinRole: () => true,
    },
    '@/lib/kintai/employee-admission': { lockKintaiEmployeeAdmission: async () => { order.push('organization') } },
    '@/lib/kintai/manager-admission': manager,
  }
  const list = load('src/app/api/kintai/work-rules/route.ts', deps)
  const item = load('src/app/api/kintai/work-rules/[id]/route.ts', deps)
  const request = body => ({ url: 'https://example.invalid/api/kintai/work-rules', json: async () => ({ operationId:'10000000-0000-4000-8000-000000000001', organizationId:'org', ...body }) })
  const context = id => ({ params: Promise.resolve({ id }) })
  return { list, item, request, context, rows, order, get writes() { return writes } }
}

const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path'),cases=[],failures=[];
const samples=[['negative-break',{breakMinutes:-1},400],['excessive-break',{breakMinutes:1441},400],['fractional-break',{breakMinutes:1.5},400],['invalid-hour',{workStart:'99:00'},400],['invalid-minute',{workEnd:'18:99'},400],['invalid-method',{overtimeCalcMethod:'unknown'},400],['invalid-flex-type',{flexEnabled:'false'},400],['invalid-time-type',{workStart:123},400],['day',{name:'Standard',workStart:'09:00',workEnd:'18:00',breakMinutes:60,overtimeCalcMethod:'daily',flexEnabled:false},200],['night',{name:'Night',workStart:'22:00',workEnd:'06:00',breakMinutes:0},200],['defaults',{},200],['blank-name',{name:'   '},400],['long-name',{name:'x'.repeat(121)},400],['invalid-core',{coreStart:'25:00'},400],['clear-core',{coreStart:null,coreEnd:''},200],['valid-core',{coreStart:'00:00',coreEnd:'23:59'},200],['break-string',{breakMinutes:'60'},400],['valid-flex',{flexEnabled:true},200],['noncanonical-time',{workStart:'9:00'},400],['invalid-name-type',{name:123},400]];
;(async()=>{for(const method of ['POST','PATCH'])for(const [scenario,body,status] of samples){const f=fixture();try{const r=method==='POST'?await f.list.POST(f.request(body)):await f.item.PATCH(f.request(body),f.context('rule'));assert.equal(r.status,status===200&&method==='POST'?201:status);assert.equal(f.writes,status===400?0:1);cases.push({method,scenario})}catch(e){failures.push({method,scenario,error:e.message})}}const files=['src/app/api/kintai/work-rules/route.ts','src/app/api/kintai/work-rules/[id]/route.ts','src/lib/kintai/work-rule-input.ts'];fs.writeFileSync('docs/audits/2026-10-06-all-services-recheck/kintai-work-rule-input-results.json',JSON.stringify({checkedAt:new Date().toISOString(),passed:cases.length,cases,failures,sourceHashes:Object.fromEntries(files.map(file=>{const p=process.env.DOYA_TEST_BASELINE&&fs.existsSync(path.join(process.env.DOYA_TEST_BASELINE,file))?path.join(process.env.DOYA_TEST_BASELINE,file):file;return[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]})),scope:'Actual POST/PATCH and real manager-admission helper with synthetic transaction sink. Valid day/night/default behavior; invalid inputs must fail before writes. Real PostgreSQL types and attendance downstream impact not covered.'},null,2)+'\n');console.log(JSON.stringify({passed:cases.length,failures}));if(failures.length)process.exitCode=1})().catch(e=>{console.error(e);process.exitCode=1});
