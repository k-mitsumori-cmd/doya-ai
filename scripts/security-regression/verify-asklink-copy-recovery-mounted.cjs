process.env.NODE_ENV='test';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto'),{createRequire}=require('module');
const root=path.resolve(__dirname,'../..'),req=createRequire(path.join(root,'package.json'));
const React=req('react'),{JSDOM}=req('jsdom'),ts=req('typescript'),act=React.act;
const dom=new JSDOM('<body><main id="host"></main></body>',{url:'https://synthetic.invalid'});
global.window=dom.window;global.document=dom.window.document;global.navigator=dom.window.navigator;global.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=req('react-dom/client'),host=document.getElementById('host'),mounted=createRoot(host);
const rel='src/components/asklink/RunResult.tsx',source=fs.readFileSync(process.env.DOYA_TEST_BASELINE&&fs.existsSync(path.join(process.env.DOYA_TEST_BASELINE,rel))?path.join(process.env.DOYA_TEST_BASELINE,rel):path.join(root,rel),'utf8');
const compiled=ts.transpileModule(source+'\nexport { LinkCard, BannerCard, bannerHtml };',{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
let failCopy=true,writes=[],clicked=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{writes.push(text);if(failCopy)throw new Error('synthetic clipboard denied')}}});
const exportsAudit={};vm.runInNewContext(compiled,{exports:exportsAudit,require:name=>{
 if(name==='react'||name==='react/jsx-runtime')return req(name);
 if(name==='lucide-react')return new Proxy({},{get:()=>()=>null});
 if(name==='@/lib/asklink/link')return {QUESTION_MAX_CHARS:450,URL_MAX_LENGTH:4000,buildLink:()=>{throw Error('unexpected editing')}};
 if(name==='./AskLinkErrorNotice')return {default:()=>null};
 if(name==='./errors')return {statusError:()=>new Error('unused'),statusOf:()=>0};
 throw Error('unexpected dependency '+name);
},window,document,navigator,URL:{createObjectURL:()=>{throw Error('unexpected blob')}},Blob,setTimeout:()=>1,clearTimeout:()=>{},console});
const link={key:'understand',title:'Synthetic',buttonLabel:'Synthetic link',question:'Synthetic question & 日本語',url:'https://chatgpt.com/?q=Synthetic%20question',check:{ok:true,chars:25,urlLength:48,issues:[]}};
const banner={kind:'landscape',label:'Synthetic banner',w:1200,h:672,use:'Synthetic',url:'https://synthetic.invalid/banner.png',status:'done',remaining:0,verify:{ok:true,missing:[]}};
const cases=[];
async function render(component,props){await act(async()=>mounted.render(React.createElement(component,props)))}
function button(label){const b=[...host.querySelectorAll('button')].find(x=>x.textContent===label);assert(b,label);return b}
async function click(b){await act(async()=>b.dispatchEvent(new window.MouseEvent('click',{bubbles:true})))}
function manual(label,text){const field=host.querySelector(`textarea[aria-label="${label}（手動コピー）"]`);assert(field);assert.equal(field.value,text);assert.equal(document.activeElement,field);assert.equal(field.value.slice(field.selectionStart,field.selectionEnd),text);assert(host.querySelector('[role=status]').textContent.includes('コピーできませんでした'));return field}
const linkProps={link,index:0,allowedUrls:[],onSave:async()=>{throw Error('no writes allowed')}};
(async()=>{
 await render(exportsAudit.LinkCard,linkProps);const urlButton=button('URLをコピー');await click(urlButton);manual('URL',link.url);assert.equal(host.querySelector('#asklink-q-understand').value,link.question);cases.push('URL denial selects exact requested URL and preserves question');
 await click(button('質問文をコピー'));manual('質問文',link.question);cases.push('Question denial selects exact question');
 const field=manual('質問文',link.question);field.setSelectionRange(0,0);await click(button('質問文をコピー'));manual('質問文',link.question);cases.push('Repeated rejection reselects complete text');
 failCopy=false;await click(urlButton);assert(!host.querySelector('textarea[aria-label="URL（手動コピー）"]'));assert(host.textContent.includes('コピーしました'));cases.push('Success clears fallback and announces success');
 failCopy=true;await click(urlButton);manual('URL',link.url);assert(!host.textContent.includes('コピーしました'));cases.push('Failure after success clears stale success announcement');
 await render(exportsAudit.LinkCard,{...linkProps,link:{...link,url:'https://chatgpt.com/?q=Changed'}});assert(!host.querySelector('textarea[aria-label$="（手動コピー）"]'));cases.push('Changed link clears stale fallback');
 const bannerProps={banner,linkUrl:link.url,alt:'Synthetic <banner> & "quote"',busy:false,onGenerate:()=>{throw Error('provider call forbidden')}};await render(exportsAudit.BannerCard,bannerProps);const htmlButton=button('コードをコピー');await click(htmlButton);const html=exportsAudit.bannerHtml(link.url,banner,bannerProps.alt);manual('設置用HTML',html);assert(html.includes('&lt;banner> &amp; &quot;quote&quot;'));cases.push('HTML denial selects exact escaped installation code');
 failCopy=false;await click(htmlButton);assert(!host.querySelector('textarea'));assert(host.textContent.includes('コピーしました'));failCopy=true;await click(htmlButton);manual('設置用HTML',html);assert(!host.textContent.includes('コピーしました'));cases.push('HTML success and subsequent rejection reset correctly');
 await render(exportsAudit.BannerCard,{...bannerProps,linkUrl:'https://chatgpt.com/?q=Changed'});assert(!host.querySelector('textarea'));cases.push('Changed banner link clears stale installation code');
 const output={checkedAt:new Date().toISOString(),scope:'Actual candidate LinkCard/BannerCard mounted in React/jsdom with synthetic clipboard;not native permission or production verification. No network/provider/storage/real clipboard/customer records.',source:{path:rel,sha256:crypto.createHash('sha256').update(source).digest('hex')},cases,passed:cases.length,failed:0};fs.writeFileSync(path.join(root,'docs/audits/2026-10-06-all-services-recheck/asklink-copy-recovery-mounted-results.json'),JSON.stringify(output,null,2)+'\n');for(const name of cases)console.log('PASS AskLink copy recovery: '+name);console.log(JSON.stringify({passed:cases.length,failed:0}));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await act(async()=>mounted.unmount());dom.window.close()});
