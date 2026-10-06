const assert=require('node:assert/strict'),{load}=require('./load-typescript.cjs');const {isQuoteProductProfile,isQuoteSuggestedItem}=load('src/lib/quote/response-shape.ts');const checks=[];
const item={itemName:'Consulting',spec:'Monthly support',qty:1,unit:'式',unitPrice:100,taxRate:10,priceSource:'manual',sourceRef:'Human input',rangeMin:null,rangeMax:null};
assert.ok(isQuoteSuggestedItem(item));assert.ok(isQuoteSuggestedItem({...item,priceSource:'unknown',unitPrice:null}));assert.ok(isQuoteProductProfile({}));assert.ok(isQuoteProductProfile({companyName:'Company',publishedPrices:['100円']}));checks.push('Normal complete item, unpriced item and optional profiles accepted');
for(const value of [null,{},[],{...item,itemName:{}},{...item,spec:[]},{...item,qty:0},{...item,qty:1.5},{...item,qty:2147483648},{...item,unitPrice:-1},{...item,unitPrice:'100'},{...item,taxRate:[10]},{...item,priceSource:['manual']},{...item,sourceRef:{}},{...item,rangeMin:-1},{...item,rangeMin:200,rangeMax:100}]){assert.equal(isQuoteSuggestedItem(value),false);checks.push('Malformed item rejected #'+checks.length)}
for(const value of [null,[],{companyName:{}},{summary:'x'.repeat(601)},{publishedPrices:[{}]},{optionCandidates:Array(21).fill('x')},{pricingAxis:null}]){assert.equal(isQuoteProductProfile(value),false);checks.push('Malformed profile rejected #'+checks.length)}

const {isQuoteProductAcknowledgement}=load('src/lib/quote/response-shape.ts');const submission={name:'  Product  ',sourceUrl:'https://example.invalid/?q='+ 'a'.repeat(600),profile:{companyName:'Company',summary:'Summary',publishedPrices:['100']}};const acknowledgement={id:'product-id',name:'Product',sourceUrl:submission.sourceUrl,profile:{publishedPrices:['100'],summary:'Summary',companyName:'Company'}};assert.ok(isQuoteProductAcknowledgement(acknowledgement,submission));checks.push('Product acknowledgement accepts exact service fields regardless of JSONB key order');for(const value of [{...acknowledgement,id:''},{...acknowledgement,name:'Different'},{...acknowledgement,sourceUrl:submission.sourceUrl.slice(0,500)},{...acknowledgement,profile:{companyName:'Company',summary:'Wrong',publishedPrices:['100']}},{...acknowledgement,profile:null}]){assert.equal(isQuoteProductAcknowledgement(value,submission),false);checks.push('Product acknowledgement rejects malformed or changed submitted service fields')}
(async()=>{
 let provider=item;
 const engine=load('src/lib/quote/analyze.ts',{
  '@/lib/net/safe-fetch':{safeFetchText:async()=>'',htmlToText:html=>html},
  '@seo/lib/gemini':{geminiGenerateJson:async()=>provider,GEMINI_TEXT_MODEL_DEFAULT:'synthetic'},
  './market':{lookupMarket:()=>null,marketTableForPrompt:()=>''},
  './response-shape':{isQuoteSuggestedItem},
 });
 const normal=await engine.estimateItem({itemName:'Human item'});assert.equal(normal.itemName,'Human item');assert.ok(isQuoteSuggestedItem(normal));checks.push('Actual estimate engine normal output matches shared client contract');
 for(const value of [{...item,qty:2147483648},{...item,unitPrice:2147483648}]) {provider=value;await assert.rejects(engine.estimateItem({itemName:'Human item'}));checks.push('Actual estimate engine rejects out-of-range quantity or money instead of returning unusable item');}
console.log(JSON.stringify({passed:checks.length,checks,scope:'Actual quote response validator; synthetic provider shapes. Does not establish source truth, server persistence or authenticated production flow.'},null,2));

})().catch(e=>{console.error(e);process.exitCode=1});
