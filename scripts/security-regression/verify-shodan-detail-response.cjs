const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),cache=new Map()
let generated
function load(file){if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(n==='@seo/lib/gemini')return{geminiGenerateJson:async()=>generated,geminiGenerateText:async()=>'',GEMINI_TEXT_MODEL_DEFAULT:'synthetic'};if(n.startsWith('.'))return load(path.join(path.dirname(file),n)+'.ts');throw Error(n)},URL,console,Date},{filename:file});return exports}
const protocol=load('src/lib/shodan/preparation-response.ts'),ai=load('src/lib/shodan/ai.ts'),research=require('./shodan-research-fixture.cjs')()
const analysis={currentStateAssessment:'assessment',firstMessage:'message',strengths:['strength'],weaknesses:[],talkingPoints:[],hypotheses:[{issue:'issue',basis:'basis',impact:'impact'}],solutions:[{title:'title',detail:'detail',expectedEffect:'effect'}]}
const prep={id:'one',targetUrl:'https://example.invalid',targetName:null,status:'done',errorMessage:null,research,analysis,proposalMarkdown:'# Proposal',slidesJson:[{title:'Slide',type:'cover',bullets:['point']}],slideImages:[{title:'Slide',imageUrl:'https://example.invalid/slide.png'}],createdAt:'2026-10-07T00:00:00.000Z',updatedAt:'2026-10-07T00:00:01.000Z'}
const copy=()=>JSON.parse(JSON.stringify(prep));let malformed=0
assert.equal(protocol.readPreparation({item:prep},'one').id,'one');assert.ok(protocol.completeProposal(prep));assert.ok(protocol.completeSlideImages(prep))
for(const mutate of [p=>p.id='foreign',p=>p.targetUrl='javascript:alert(1)',p=>p.targetUrl='https://user:pass@example.invalid',p=>p.status='deleted',p=>p.createdAt='invalid',p=>delete p.updatedAt,p=>p.targetName={},p=>p.errorMessage=2,p=>p.research.marketing.snsChannels=[{}],p=>p.analysis.strengths=[{}],p=>p.analysis.hypotheses=[{issue:'only'}],p=>p.analysis.solutions=[null],p=>p.slidesJson=[{title:{}}],p=>p.slidesJson[0].bullets=[{}],p=>p.slidesJson[0].type='unknown',p=>p.slideImages[0].imageUrl='javascript:evil()',p=>p.slideImages[0].role={},p=>p.proposalMarkdown=0,p=>p.slidesJson=Array(501).fill({title:'too many'})]){const p=copy();mutate(p);assert.throws(()=>protocol.readPreparation({item:p},'one'));malformed++}
const partial={...prep,slideImages:[{title:'Failed image',imageUrl:null}]};assert.equal(protocol.readPreparation({item:partial},'one').slideImages[0].imageUrl,null);assert.equal(protocol.completeSlideImages(partial),false);
assert.equal(protocol.completeProposal({...prep,analysis:null}),false);assert.equal(protocol.completeSlideImages({...prep,slideImages:[]}),false)
;(async()=>{generated=analysis;const actual=await ai.analyzeCompany(research);assert.deepEqual(JSON.parse(JSON.stringify(actual)),analysis)
 for(const bad of [{...analysis,strengths:[{}]},{...analysis,currentStateAssessment:{}},{...analysis,hypotheses:[{issue:'missing basis/impact'}]},{...analysis,solutions:[{title:'missing detail/effect'}]}]){generated=bad;await assert.rejects(()=>ai.analyzeCompany(research),/Invalid Shodan analysis/)}

 const route = require('./load-typescript.cjs').load('src/app/api/shodan/preparations/[id]/route.ts', {
  'next/server': { NextResponse: Response },
  ...require('./shodan-editor-test-helpers.cjs'),
 '@prisma/client': { Prisma: {} },
  '@/lib/prisma': { prisma: { shodanPreparation: { findFirst: async ({where}) => {
    assert.equal(where.id,'one'); assert.equal(where.organizationId,'synthetic-org');
    return { ...prep, createdAt:new Date(prep.createdAt),updatedAt:new Date(prep.updatedAt),slideImages:[{title:'Slide',role:'cover',imagePath:'synthetic-path'}] }
  } } } },
  '@/lib/shodan/access': { getShodanContext:async()=>({organizationId:'synthetic-org'}),orgSlugFrom:()=> 'synthetic-org' },
  '@/lib/shodan/types': { effectivePrepStatus:status=>status },
  '@/lib/shodan/slide-generation-lease': { shodanSlideLeaseKey:()=> 'synthetic-lease' },
  '@/lib/shodan/storage': { signedUrl:async imagePath=> { assert.equal(imagePath,'synthetic-path');return 'https://example.invalid/signed.png' } }
 })
 const response=await route.GET(new Request('https://example.invalid/api/shodan/preparations/one?org=synthetic-org'),{params:Promise.resolve({id:'one'})})
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('vary'),'Cookie')
 const dto=protocol.readPreparation(await response.json(),'one');assert.equal(dto.slideImages[0].imageUrl,'https://example.invalid/signed.png')
 console.log(JSON.stringify({status:'passed',malformedDTOCases:malformed,malformedActualAIOutputs:4,scope:'Actual pure DTO validator and actual analysis generator with synthetic provider; no provider/DB/network.'}))
})().catch(error=>{console.error(error);process.exitCode=1})
