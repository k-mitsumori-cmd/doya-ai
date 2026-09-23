const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const source=fs.readFileSync(path.join(__dirname,'../../src/app/quote/documents/[id]/page.tsx'),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const base={id:'d',quoteNo:'Q',status:'draft',lineItems:[{id:'i',itemName:'original',spec:null,qty:1,unit:'式',unitPrice:100,taxRate:10,priceSource:'manual',sourceRef:null,rangeMin:null,rangeMax:null}],clientCompany:'company',clientPerson:'person',discountType:'amount',discountValue:1,notes:'notes',paymentTerms:'payment',deliveryTerms:'delivery',totalExclTax:99,taxAmount:9,totalInclTax:108};
const results=[];
for(const scenario of ['saved','confirmed','saving','error','company','person','discountType','discountValue','notes','payment','delivery','items']) {
 const doc={...base,status:scenario==='confirmed'?'confirmed':'draft'};
 const states=[doc,{companyName:'issuer'},false,scenario==='saving',scenario==='error'?'保存失敗':'',structuredClone(doc.lineItems),doc.clientCompany,doc.clientPerson,doc.discountType,String(doc.discountValue),doc.notes,doc.paymentTerms,doc.deliveryTerms];
 const indexes={company:6,person:7,discountType:8,discountValue:9,notes:10,payment:11,delivery:12};
 if(scenario in indexes)states[indexes[scenario]]+='changed';
 if(scenario==='items')states[5][0].unitPrice=200;
 const deps={'react':{...React,useState:()=>[states.shift(),()=>{}],useCallback:f=>f,useEffect:()=>{}},'react/jsx-runtime':require('react/jsx-runtime'),'next/link':{default:({href,children,...p})=>React.createElement('a',{href,...p},children)},'next/navigation':{useParams:()=>({id:'d'})},'@/components/org/OrgSwitcher':{withOrg:(_,p)=>p},'@/lib/quote/money':{yen:n=>'¥'+n},'@/lib/quote/types':{PRICE_SOURCE_LABEL:{},QUOTE_STATUS_LABEL:{}},'@/lib/ui/notify':{notifyError:()=>{}},'@/components/lp':{DoyaKun:()=>null}};
 const exported={};vm.runInNewContext(code,{exports:exported,require:n=>{assert(n in deps,n);return deps[n];}});
 const html=renderToStaticMarkup(React.createElement(exported.default));
 const allowed=['saved','confirmed'].includes(scenario);
 assert.equal(html.includes('href="/api/quote/documents/d/pdf"'),allowed,scenario);
 assert.equal(html.includes('aria-describedby="quote-pdf-status"'),!allowed,scenario);
 if(!allowed)assert.match(html,/<button disabled="" aria-describedby="quote-pdf-status"/);
 results.push({scenario,pdfLinkPresent:allowed,outcome:'PASS'});
}
console.log(JSON.stringify(results,null,2));
