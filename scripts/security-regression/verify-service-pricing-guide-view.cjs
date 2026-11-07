const fs=require('fs'),cp=require('child_process'),vm=require('vm'),crypto=require('crypto'),path=require('path');
const repo=process.cwd(),root=repo;const head='checked-out-source';
const React=require(repo+'/node_modules/react'),server=require(repo+'/node_modules/react-dom/server'),ts=require(repo+'/node_modules/typescript');
if(fs.realpathSync(__filename)!==fs.realpathSync(path.join(root,'scripts/security-regression/verify-service-pricing-guide-view.cjs')))throw Error('Execute the checked-out verifier from the project root');
const sourceHashes={};let scenario;
const candidateRoot=root;
function source(p){const b=fs.readFileSync(path.join(candidateRoot,p));sourceHashes[p]=crypto.createHash('sha256').update(b).digest('hex');return b.toString()}
function load(p,imports){const module={exports:{}};const js=ts.transpileModule(source(p),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText;vm.runInThisContext('(function(require,module,exports){'+js+'\n})',{filename:p})((n)=>{if(Object.hasOwn(imports,n))return imports[n];if(n==='react'||n==='react/jsx-runtime')return require(repo+'/node_modules/'+n);throw Error('Unexpected import '+n)},module,module.exports);return module.exports}
const unified=load('src/lib/unified-plan.ts',{}),plans=load('src/lib/plan-utils.ts',{}),fixture={id:'promane',name:'Synthetic promane',order:1,dashboardHref:'/promane',features:['synthetic project management'],pricing:{free:{limit:'3案件まで'},pro:{limit:'無制限',price:9980}}};
function link({href,children,...props}){return React.createElement('a',{href,...props},children)}
const component=load('src/components/UnifiedPricingPlans.tsx',{'next-auth/react':{useSession:()=>scenario.session},'next/link':{default:link},'next/navigation':{usePathname:()=>'/promane/pricing'},'@/lib/pricing':{ENTERPRISE_CONTACT_MAILTO:'mailto:info@example.invalid'},'@/components/CheckoutButton':{CheckoutButton:({children,billingOrganization,planId,loginCallbackUrl})=>React.createElement('button',{'data-old-checkout':'true','data-plan':planId,'data-organization':JSON.stringify(billingOrganization),'data-return':loginCallbackUrl},children)},'@/components/pricing/useNewPricing':{useNewPricing:()=>scenario.newPricing},'@/components/TrialCallout':{TrialBadge:()=>null,TrialNote:()=>null,useTrialEligible:()=>false},'@/lib/services':{getServiceById:()=>fixture,getPublicServices:()=>[fixture]},'@/lib/plan-utils':plans,'@/hooks/useBillingPlanResync':{useBillingPlanResync:()=>({run:()=>{},busy:false,disabled:true,message:''})},'@/lib/unified-plan':unified}).UnifiedPricingPlans;
const cases=[];
for(const enabled of [null,true,false]) {
 for(const plan of [null,'FREE','LIGHT','PRO'])cases.push([String(enabled)+'-'+String(plan),enabled,plan,{}]);
 for(const canPurchase of [true,false])cases.push([String(enabled)+'-org-'+canPurchase,enabled,'FREE',{planSource:'organization',currentPlan:'FREE',canPurchase,billingOrganization:{actor:'synthetic-actor',organizationId:'synthetic-org'}}]);
}
const observations=[];
for(const [name,enabled,plan,props] of cases){
 scenario={newPricing:enabled,session:plan?{status:'authenticated',data:{user:{id:'synthetic-user',email:'synthetic@example.invalid',plan}}}:{status:'unauthenticated',data:null}};
 const html=server.renderToStaticMarkup(React.createElement(component,{serviceId:'promane',...props}));
 const row={name,newPricing:enabled,sessionPlan:plan,legacyPriceShown:html.includes('¥9,980'),noAdditionalChargeClaimShown:html.includes('追加課金なし'),canonicalPricingLinkShown:html.includes('href="/pricing"'),legacyCheckoutShown:html.includes('data-old-checkout="true"'),ownerGuidanceShown:html.includes('組織の契約変更はオーナーにご相談ください'),orgActorRetained:!props.billingOrganization||!html.includes('data-old-checkout="true"')||html.includes('synthetic-actor')&&html.includes('synthetic-org')};
 if(enabled!==false){if(row.legacyPriceShown||row.noAdditionalChargeClaimShown||row.legacyCheckoutShown)throw Error('Misleading legacy pricing '+name);if(props.canPurchase===false?(!row.ownerGuidanceShown||row.canonicalPricingLinkShown):!row.canonicalPricingLinkShown)throw Error('Purchase permission guide '+name)}
 else {if(!row.legacyPriceShown||!row.noAdditionalChargeClaimShown)throw Error('Legacy view removed '+name);if(props.canPurchase===false?(!row.ownerGuidanceShown||row.legacyCheckoutShown):plan==='PRO'?row.legacyCheckoutShown:!row.legacyCheckoutShown)throw Error('Legacy actor/checkout semantics '+name);if(!row.orgActorRetained)throw Error('Org actor lost '+name)}
 observations.push({...row,passed:true});
}
const report={marker:'service-pricing-guide-view',conditions:observations.length,observations,sourceHashes,allPassed:true,scope:'Actual full shared component and actual plan/legacy price modules SSR; synthetic session, service metadata, resolution and Next/checkout/trial/resync adapters. Actual hook effects tested separately. No live auth or billing.'};
if(process.env.SERVICE_PRICING_VIEW_OUTPUT)fs.writeFileSync(process.env.SERVICE_PRICING_VIEW_OUTPUT,JSON.stringify(report,null,2)+'\n',{flag:'wx'});process.stdout.write(JSON.stringify(report)+'\n');
