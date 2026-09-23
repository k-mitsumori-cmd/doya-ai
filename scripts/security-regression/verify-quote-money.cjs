const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function load(p,deps={}) { const exports={}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../../',p),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{assert(n in deps,n);return deps[n];}});return exports; }
const money=load('src/lib/quote/money.ts');
let cases=0;
function check(lines,kind,value) {
 const raw=lines.reduce((s,l)=>s+l.qty*l.unitPrice,0);
 const discount=kind==='amount'?Math.min(raw,Math.max(0,Math.floor(value))):kind==='rate'?Math.floor(raw*Math.max(0,Math.min(100,value))/100):0;
 const t=money.calcTotals(lines,kind,value);cases++;
 assert.equal(t.totalExclTax,raw-discount);assert.equal(t.discountAmount,discount);
 assert.equal(t.totalInclTax,t.totalExclTax+t.taxAmount);
 assert.equal(t.taxAmount,Object.values(t.taxByRate).reduce((a,b)=>a+b,0));
 assert(Number.isInteger(t.totalInclTax)&&t.totalInclTax>=0);
 const reversed=money.calcTotals([...lines].reverse(),kind,value);
 assert.equal(JSON.stringify(t.taxByRate),JSON.stringify(reversed.taxByRate));
 return t;
}
for(let raw=1;raw<=500;raw++) for(let d=0;d<=raw;d++)check([{qty:1,unitPrice:raw,taxRate:10}],'amount',d);
for(let a=1;a<=100;a++)for(let b=1;b<=100;b++)for(const d of [1,Math.floor((a+b)/3),a+b])check([{qty:1,unitPrice:a,taxRate:8},{qty:1,unitPrice:b,taxRate:10}],'amount',d);
for(let a=0;a<=100;a++)for(const d of [-1,0,1,10,33,99,100,101])check([{qty:1,unitPrice:a,taxRate:8},{qty:1,unitPrice:a+1,taxRate:10}],'rate',d);
check([],null,0);
assert.equal(check([{qty:1,unitPrice:22,taxRate:10}],'amount',7).totalExclTax,15);
const mixed=check([{qty:1,unitPrice:100,taxRate:8},{qty:1,unitPrice:100,taxRate:10}],'amount',1);
assert.equal(mixed.totalExclTax,199);assert.equal(mixed.taxByRate[8],8);assert.equal(mixed.taxByRate[10],9);
const large=check([{qty:1,unitPrice:2000000000,taxRate:8},{qty:1,unitPrice:2000000000,taxRate:10}],'amount',1);
assert.equal(large.taxByRate[8],160000000);assert.equal(large.taxByRate[10],199999999);
const pdf=load('src/lib/quote/pdf.ts',{'./money':money,'@/lib/pdf/japanese-font':{PDF_FONT_STACK:'sans-serif',registerJapaneseFonts:async()=>{}}});
const html=pdf.renderQuoteHtml({quoteNo:'Q-test',title:'test',status:'draft',issueDate:new Date(),expiryDate:new Date(),clientCompany:null,clientDept:null,clientPerson:null,issuer:{companyName:"合成会社"},discountType:'amount',discountValue:1,lineItems:[8,10].map(taxRate=>({itemName:'item',qty:1,unitPrice:100,unit:'式',taxRate,priceSource:'manual'}))});
assert.match(html,/<th>小計<\/th><td>¥200<\/td>/);assert.match(html,/<th>税抜合計<\/th><td>¥199<\/td>/);assert.match(html,/<th>値引き<\/th><td>-¥1<\/td>/);
console.log(JSON.stringify({outcome:'PASS',calculationCases:cases,pdfSubtotal:true,pdfDiscount:true,pdfExclTax:true},null,2));
