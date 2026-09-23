const assert=require('node:assert/strict'),{load}=require('./load-typescript.cjs'),fixture=require('./fixtures/persona-result.cjs')
const {parsePersonaResult,PersonaResultValidationError}=load('src/lib/persona/result-schema.ts',{zod:require('zod')})
const grants=load('src/lib/persona/image-entitlements.ts')
const good=fixture();good.persona.quote='Literal commas, } and ] remain intact';good.extra='discard me'
const parsed=parsePersonaResult(good);assert.equal(parsed.extra,undefined);assert.equal(parsed.persona.quote,good.persona.quote);assert.equal(grants.includedPersonaImages(parsed).length,16)
console.log('PASS complete result preserves text, drops unknown fields and grants sixteen images')
const consumer=fixture();delete consumer.persona.industry;delete consumer.persona.companySize;assert.equal(parsePersonaResult(consumer).persona.industry,undefined);consumer.persona.industry='';consumer.persona.companySize='';assert.equal(parsePersonaResult(consumer).persona.companySize,'');console.log('PASS consumer personas do not require invented employer fields')
const cases={
  'missing persona':v=>delete v.persona,
  'string instead of array':v=>v.persona.challenges='not an array',
  'object instead of string':v=>v.persona.quote={private:'SECRET'},
  'string age':v=>v.persona.age='35',
  'out of range age':v=>v.persona.age=300,
  'blank required text':v=>v.persona.name='   ',
  'oversized text':v=>v.persona.diary.content='x'.repeat(8001),
  'missing diary':v=>delete v.persona.diary,
  'missing deep dive':v=>delete v.deepDive,
  'missing summary':v=>delete v.summary,
  'missing creative':v=>delete v.creatives.lpStructure,
  'missing schedule fields':v=>delete v.persona.schedule[0].activity,
  'incomplete schedule':v=>v.persona.schedule.pop()&&v.persona.schedule.pop(),
  'missing schedule image':v=>delete v.persona.schedule[0].imagePrompt,
  'missing painpoint image':v=>delete v.persona.painPoints[0].imagePrompt,
  'empty nested row':v=>v.summary.contentIdeas[0]={},
  'invalid rank order':v=>v.summary.topChallenges[0].rank=2,
  'invalid checklist priority':v=>v.marketingChecklist[0].items[0].priority='SECRET',
  'too many nested rows':v=>v.persona.goals=Array(41).fill('item'),
  'truncated adoption':v=>v.deepDive.adoptionStory.timeline.pop(),
  'large unknown output':v=>v.extra='x'.repeat(262144),
}
for(const [name,mutate] of Object.entries(cases)){const value=fixture();mutate(value);assert.throws(()=>parsePersonaResult(value),error=>error instanceof PersonaResultValidationError && error.message==='Invalid persona result'&&!error.message.includes('SECRET'));console.log('PASS',name)}
for(const value of [null,[],undefined,42])assert.throws(()=>parsePersonaResult(value),PersonaResultValidationError)
