const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),ts=require('typescript');
const {load,check,results}=require('./load-typescript.cjs');
const unified=load('src/lib/unified-plan.ts');
const {SERVICES}=load('src/lib/services.ts',{'./unified-plan':unified});
const lib=load('src/lib/service-limit-ui.ts',{'./services':{SERVICES}},{URL,Request,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail}}});
const {classifyServiceLimit:classify,observeServiceLimits:observe}=lib;
const fixtureMessages=[
 ['cunning',403,'ナレッジベースは3個までです。プロにアップグレードしてください。'],
 ['doyalist',403,'現在のプランでは企業生成を利用できません'],
 ['interview',403,'ゲストユーザーは合計5分までの文字起こしが可能です。無料登録で月30分に拡大できます。'],
 ['seo',403,'無料プランでは3000字までの記事を作成できます。10000字を作成するにはプランのアップグレードが必要です。'],
 ['tenkai',403,'APIアクセスはPro以上のプランで利用可能です'],
 ['tenkai',403,'現在のプランでは最大3プラットフォームまでです'],
 ['voice',403,'クラウド録音は上位プランが必要です'],
 ['voice',403,'このスピーカーは上位プラン限定です'],
 ['banner',429,'今月の生成上限に達しました。'],['persona',429,'本日の生成上限（3回）に達しました'],
 ['seo',429,'ゲストは1回まで作成できます。ログインすると継続して使えます。'],
 ['seo',429,'今月の生成回数の上限に達しました（3回/月）。プランをアップグレードすると増やせます。'],
 ['adimage',429,'プロプランは月150枚までです（今月150枚）。たくさんお使いいただく場合は、お問い合わせより枠の追加をご相談ください。'],
 ['adimage',429,'無料プランは1日5枚までです（本日5枚）。プロプランにご登録いただくと上限が広がります。'],
 ['hr',403,'AI機能の月間利用回数（50回）に達しています。プランをアップグレードしてください。'],
 ['doyalist',403,'現在のプランではプロジェクトを作成できません'],
 ['doyalist',403,'月間上限（100社）を超えます。残り5社です。'],
 ['cunning',403,'今月の利用時間の上限（30分）に達しました。プロにアップグレードしてください。'],
 ['doyaslide',403,'今月の生成枚数の上限（10枚）に達しました。生成・再生成・チャット修正はそれぞれ1枚分を消費します。プロにアップグレードしてください。'],
 ['quote',402,'無料プランでご利用いただける上限（3件）に達しました。プロプランにご登録いただくと上限が広がります。'],
 ['mensetsu',402,'今月の上限（30件）に達しました。来月1日に枠が戻ります。追加をご希望の場合はお問い合わせよりご相談ください。'],
 ['movie',429,'利用上限に達しました'],
 ['kintai',403,'従業員数が上限（10名）に達しています。プランをアップグレードしてください。'],
 ['shodan',402,'提案資料の生成はプロプランの機能です。プロプランにアップグレードするとご利用いただけます。'],
 ['interview',429,'今月の作成上限に達しました。'],
];
(async()=>{
 for(const s of SERVICES) await check(s.id+' has a real pricing destination and quota path',async()=>{
  const r=classify('/api/'+s.id+'/generate',429,{code:'MONTHLY_LIMIT_REACHED',error:'今月の上限に達しました'});assert.equal(r.service,s.id);const href=r.pricingHref;assert.ok(fs.existsSync(path.join('src/app',href,'page.tsx')),href);
 });
 for(const [s,status,error] of fixtureMessages)await check(s+' actual quota wording: '+error.slice(0,20),async()=>assert.ok(classify('/api/'+s+'/generate',status,{error})));
 await check('billing-independent workspace cap offers cleanup',async()=>assert.equal(classify('/api/aio/quick-start',402,{code:'LIMIT',error:'登録できるワークスペースの上限（3件）に達しました。不要なワークスペースを整理してください。'}).kind,'capacity'));
 await check('public participant is directed to contract owner',async()=>assert.equal(classify('/api/aishodan/room/token/start',429,{error:fixtureMessages[19][2]}).kind,'owner'));
 for(const [status,error] of [[429,'リクエストが多すぎます。しばらくしてからお試しください。'],[429,'現在の解析が完了してから、もう一度お試しください。'],[429,'接続の試行回数が上限に達しました。採用ご担当者にお問い合わせください。'],[400,'ファイルサイズが上限 (500MB) を超えています'],[403,'アクセス権限がありません'],[500,'今月の上限に達しました'],[410,'このサービスは提供を終了しました'],[429,'APIの使用量制限に達しました。Google AI Studioでプランをご確認ください']])await check('non-billing error stays non-billing: '+error.slice(0,15),async()=>assert.equal(classify('/api/banner/generate',status,{error}),null));
 await check('external APIs and successful JSON do not produce prompts; response bodies remain readable',async()=>{
  const notices=[];const original=async()=>Response.json({code:'LIMIT',error:'今月の上限に達しました'},{status:429});const fn=observe(original,'http://localhost',x=>notices.push(x));let r=await fn('/api/persona/generate');assert.equal((await r.json()).code,'LIMIT');await new Promise(r=>setTimeout(r,20));assert.equal(notices.length,1);await fn('https://external.invalid/api/persona/generate');await new Promise(r=>setTimeout(r,10));assert.equal(notices.length,1);
  const success=observe(async()=>Response.json({code:'LIMIT'}),'http://localhost',x=>notices.push(x));await success('/api/persona/generate');assert.equal(notices.length,1);
 });
 await check('Request input and malformed/non-JSON errors retain original behavior',async()=>{
  let n=0;const fn=observe(async()=>new Response('broken',{status:429,headers:{'content-type':'application/json'}}),'http://localhost',()=>n++);assert.equal(await(await fn(new Request('http://localhost/api/banner/generate'))).text(),'broken');await new Promise(r=>setTimeout(r,10));assert.equal(n,0);
 });
 // Static inventory of actual API response literals. Dynamic helper messages are covered above.
 const literals=[];
 function visitFile(file){const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);function value(n){if(!n)return undefined;if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))return n.text;if(ts.isNumericLiteral(n))return Number(n.text);if(n.kind===ts.SyntaxKind.TrueKeyword)return true;if(ts.isTemplateExpression(n))return n.head.text+n.templateSpans.map(s=>'3'+s.literal.text).join('');if(ts.isObjectLiteralExpression(n))return Object.fromEntries(n.properties.filter(ts.isPropertyAssignment).map(p=>[p.name.getText(source).replace(/['"]/g,''),value(p.initializer)]));}
 function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(source)==='NextResponse.json'){let body=value(n.arguments[0]),init=value(n.arguments[1]);if(body&&init&&[400,402,403,429].includes(init.status)){const route='/api/'+file.split('src/app/api/')[1].replace(/\/route.ts$/,'');literals.push({file,status:init.status,error:body.error,code:body.code,classified:!!classify(route,init.status,body)});}}ts.forEachChild(n,visit)}visit(source)}
 function walk(dir){for(const x of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,x.name);if(x.isDirectory())walk(p);else if(x.name==='route.ts')visitFile(p)}}walk('src/app/api');
 const out='docs/audits/2026-09-19-all-service-limits';if(fs.existsSync(out)){fs.writeFileSync(path.join(out,'api-error-inventory.json'),JSON.stringify(literals,null,2));fs.writeFileSync(path.join(out,'service-matrix.json'),JSON.stringify(SERVICES.map(s=>({id:s.id,name:s.name,status:s.status,pricingHref:lib.SERVICE_LIMIT_DESTINATIONS[s.id].pricingHref,classifiedResponses:literals.filter(x=>x.classified&&x.file.startsWith('src/app/api/'+s.id+'/')).map(x=>x.file)})),null,2));}
 console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
