const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(__dirname,'../..'),file='src/components/banner/BannerLimitModal.tsx';
const {load}=require('./load-typescript.cjs');const pricing=load('src/lib/pricing.ts',{'./unified-plan':load('src/lib/unified-plan.ts')});const contact=pricing.HIGH_USAGE_CONTACT_URL;
function fixture({limit=150,used=limit,upgradeUrl=contact,eligible=true}={}){
 const buttons=[],navigations=[];let closes=0;
 const fakeReact={...React,createElement:(type,props,...children)=>{if(type==='button'&&props?.onClick)buttons.push(props.onClick);return React.createElement(type,props,...children);}};
 const Motion=new Proxy({},{get:(_,tag)=>({children,initial,animate,exit,transition,...props})=>React.createElement(tag,props,children)});
 const exports={},empty=()=>null;
 const mocks={react:fakeReact,'next/navigation':{useRouter:()=>({push:url=>navigations.push(url)})},'framer-motion':{motion:Motion,AnimatePresence:({children})=>children},'lucide-react':{Sparkles:empty,Check:empty,X:empty,Rocket:empty,CalendarClock:empty},'@/lib/pricing':pricing,'@/components/TrialCallout':{useTrialEligible:()=>eligible,TRIAL_DAYS:30,TrialBadge:()=>eligible?React.createElement('span',null,'初月無料'):null,TrialNote:()=>eligible?React.createElement('span',null,'30日間無料'):null}};
 const source=fs.readFileSync(process.env.DOYA_TEST_BASELINE?path.join(process.env.DOYA_TEST_BASELINE,file):path.join(root,file),'utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,{exports,React:fakeReact,require:n=>{if(n in mocks)return mocks[n];throw Error('Unexpected import '+n)},window:{location:{assign:url=>navigations.push(url)}}});
 const html=renderToStaticMarkup(React.createElement(exports.default,{isOpen:true,onClose:()=>{closes++},monthlyUsed:used,monthlyLimit:limit,upgradeUrl}));
 return{html,navigations,closes:()=>closes,click:()=>buttons[1]()};
}
if(process.env.DOYA_CAPTURE_BASELINE==='1'){const f=fixture();f.click();console.log(JSON.stringify({limit:150,displayedEnterprisePrice:f.html.includes('49,800'),displayedEnterprisePurchase:f.html.includes('エンタープライズプランを確認する'),serverContact:contact,actualNavigation:f.navigations},null,2));process.exit(0);}
for(const limit of [150,1000]){
 const f=fixture({limit});assert.match(f.html,/追加の利用枠を相談する/);assert.doesNotMatch(f.html,/49,800|エンタープライズプランを確認する|30日間無料|初月無料/);f.click();assert.deepEqual(f.navigations,[contact]);assert.equal(f.closes(),1);
}
for(const eligible of [true,false]){
 const f=fixture({limit:15,upgradeUrl:'/banner/pricing',eligible});assert.match(f.html,/プロプラン/);assert.equal(f.html.includes('30日間無料でプロを試す'),eligible);if(!eligible)assert.doesNotMatch(f.html,/初月無料|30日間無料/);f.click();assert.deepEqual(f.navigations,['/banner/pricing']);
}
const light=fixture({limit:50,upgradeUrl:contact});assert.match(light.html,/追加の利用枠を相談する/);light.click();assert.deepEqual(light.navigations,[contact]);
const unsafe=fixture({limit:15,upgradeUrl:'https://external.invalid/payment'});unsafe.click();assert.deepEqual(unsafe.navigations,['/banner/pricing']);
const remaining=fixture({limit:15,used:14,upgradeUrl:'/banner/pricing'});assert.match(remaining.html,/今月はあと1枚生成できます/);
console.log('PASS Banner quota modal: actual rendering and CTA handlers; PRO/Enterprise/contact, free eligibility, legacy LIGHT, unsafe URL, remaining capacity');
