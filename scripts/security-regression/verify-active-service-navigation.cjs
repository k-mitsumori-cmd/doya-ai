// Independent regression process; production parent environment is unchanged.
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.resolve(__dirname, '../..')
const source = fs.readFileSync(path.join(root, 'src/lib/services.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText
const moduleExports = {}
vm.runInNewContext(compiled, {
  exports: moduleExports,
  process: { env: {} },
  require(name) {
    if (name === './unified-plan') return { UNIFIED_PRO_PRICE: 9980 }
    throw new Error(`Unexpected services dependency: ${name}`)
  },
})

const services = moduleExports.getActiveServices()
assert(services.length > 0, 'No active services were loaded')
assert.equal(new Set(services.map(service => service.id)).size, services.length, 'Duplicate active service ID')

const routeGroups = fs.readdirSync(path.join(root, 'src/app'), { withFileTypes: true })
  .filter(entry => entry.isDirectory() && /^\(.+\)$/.test(entry.name))
  .map(entry => entry.name)

const links = new Set()
for (const service of services) {
  for (const field of ['href', 'dashboardHref', 'pricingHref', 'guideHref']) {
    const href = service[field]
    assert.match(href, /^\/[a-z0-9/-]+$/, `${service.id}.${field} must be a local path`)
    assert(!href.includes('//') && !href.includes('..'), `${service.id}.${field} contains an unsafe path`)
    links.add(href)
    // ルートグループ（src/app/(shell) など）は URL に出ないので、その下も同じ URL のページとして探す
    const dirs = [path.join(root, 'src/app', href.slice(1)), ...routeGroups.map(group => path.join(root, 'src/app', group, href.slice(1)))]
    assert(
      dirs.some(dir => ['page.tsx', 'page.ts', 'page.jsx', 'page.js'].some(file => fs.existsSync(path.join(dir, file)))),
      `${service.id}.${field} points to a missing page: ${href}`,
    )
  }
}

console.log(`PASS ${services.length} active services, ${links.size} distinct navigation pages exist`)


// Semantic navigation: actual shell/sidebar/switcher components, synthetic session/DOM only.
// Route existence alone cannot distinguish a public LP from the authenticated work entry.
async function checkWorkEntries() {
  const Module = require('node:module')
  const React = require('react')
  const { JSDOM } = require('jsdom')
  const dom = new JSDOM('<div id="navigation-root"></div>', {url:'https://example.test/home'})
  const previous = Object.fromEntries(['window','document','navigator','IS_REACT_ACT_ENVIRONMENT','fetch'].map(key=>[key,Object.getOwnPropertyDescriptor(global,key)]))
  for (const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true,fetch:async()=>{throw Error('No external requests allowed')}})) Object.defineProperty(global,key,{configurable:true,writable:true,value})
  const { createRoot } = require('react-dom/client')
  const expected = {
    banner:'/banner/dashboard',seo:'/seo',interview:'/interview',persona:'/persona',hr:'/hr/dashboard',kintai:'/kintai/dashboard',
    doyalist:'/doyalist',promane:'/promane',doyaslide:'/doyaslide/new',sfa:'/sfa',shodan:'/shodan',aio:'/aio',mensetsu:'/mensetsu',
    quote:'/quote',aishodan:'/aishodan',adimage:'/adimage',asklink:'/asklink',popup:'/popup',tenjikai:'/tenjikai',shanai:'/shanai',income:'/income',expense:'/expense',
  }
  const navigations=[], results=[], cache=new Map(); let navDataCoverage=null
  let pathname='/home', authenticated=true
  const Link=({href,children,onClick,prefetch,...props})=>React.createElement('a',{...props,href,onClick:event=>{onClick?.(event);if(!event.defaultPrevented)navigations.push(href);event.preventDefault()}},children)
  const motion=new Proxy({}, {get:(_,tag)=>({children,initial,animate,exit,transition,whileHover,whileTap,layout,layoutId,...props})=>React.createElement(tag,props,children)})
  const empty=()=>null, Wrap=({children})=>React.createElement(React.Fragment,null,children)
  const mocks={
    '@/lib/services':moduleExports,
    'next/link':{__esModule:true,default:Link},
    'next/image':{__esModule:true,default:({fill,priority,...props})=>React.createElement('img',props)},
    'next/navigation':{usePathname:()=>pathname,useRouter:()=>({push:href=>navigations.push(href)})},
    'next-auth/react':{useSession:()=>({status:authenticated?'authenticated':'unauthenticated',data:authenticated?{user:{id:'synthetic-actor',name:'Synthetic'}}:null}),signOut:()=>{throw Error('Signout forbidden')}},
    'lucide-react':new Proxy({}, {get:(_,key)=>key==='__esModule'?false:()=>React.createElement('svg')}),
    'framer-motion':{motion,AnimatePresence:Wrap},
    'react-hot-toast':{__esModule:true,default:{error:()=>{throw Error('No error toast expected')}}},
    '@/components/shell/ShellUsage':{ShellUsageProvider:Wrap,ShellUsageArea:empty},
    '@/components/shell/ShellCompanyCard':{__esModule:true,default:empty,ShellCompanyTag:empty},
    '@/components/shell/icons':{ShellIcon:empty},
    '@/components/TrialCallout':{TrialInlineSuffix:empty},
  }
  function load(file) {
    if(cache.has(file))return cache.get(file).exports
    const mod=new Module(file);mod.filename=file;mod.paths=Module._nodeModulePaths(path.dirname(file));cache.set(file,mod)
    mod.require=id=>{
      const normalized=id.startsWith('.')?'@/'+path.relative(path.join(root,'src'),path.resolve(path.dirname(file),id)).replaceAll(path.sep,'/'):id
      if(mocks[id]||mocks[normalized])return mocks[id]||mocks[normalized]
      if(id.endsWith('.css'))return {__esModule:true,default:new Proxy({}, {get:(_,key)=>String(key)})}
      if(id.startsWith('@/')||id.startsWith('.')){
        const base=id.startsWith('@/')?path.join(root,'src',id.slice(2)):path.resolve(path.dirname(file),id)
        for(const ext of ['.ts','.tsx','/index.ts'])if(fs.existsSync(base+ext))return load(base+ext)
      }
      return require(id)
    }
    mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file)
    return mod.exports
  }
  const source=relative=>load(path.join(root,relative))
  const {ALL_SHELL_TOOLS,shellGroups}=source('src/components/shell/tools.ts')
  const {UiNextContext,ShellToolHrefsContext}=source('src/components/shell/ui-next-context.tsx')
  const AppShell=source('src/components/shell/AppShell.tsx').default
  const {ToolSwitcherMenu}=source('src/components/ToolSwitcherMenu.tsx')
  const {default:ServiceNav,OtherServicesCard}=source('src/components/ServiceNav.tsx')
  const {AdminSidebar}=source('src/components/AdminSidebar.tsx')
  const {SidebarUserProfile}=source('src/components/sidebar/SidebarUserProfile.tsx')
  const {SidebarNavLink}=source('src/components/sidebar/SidebarNavLink.tsx')
  mocks['@/components/sidebar']={SidebarShell:Wrap,SidebarNavLink,SidebarSectionTitle:Wrap,SidebarUserProfile,SidebarCollapseToggle:empty,SidebarBrandingFooter:empty,SidebarHelpContact:empty,SidebarLogoutDialog:empty,useSidebarState:({forceExpanded,isMobile})=>({isCollapsed:false,showLabel:true,toggle:empty})}
  const SlideSidebar=source('src/components/doyaslide/DoyaSlideSidebar.tsx').default
  async function check(name,fn){try{await fn();results.push({name,passed:true})}catch(error){results.push({name,passed:false,error:error.message})}}
  async function mount(element,run){let mounted;try{await React.act(async()=>{mounted=createRoot(document.getElementById('navigation-root'));mounted.render(element)});await run()}finally{if(mounted)await React.act(async()=>mounted.unmount())}}
  const click=async el=>{assert.ok(el,'Expected actual navigation control');await React.act(async()=>el.click())}
  const findButton=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text)
  try {
    await check('all active registry work entries are explicit, with no retired/hidden additions',()=>{
      assert.deepEqual(Array.from(services,s=>s.id).sort(),Object.keys(expected).sort())
      for(const s of services)assert.equal(s.dashboardHref,expected[s.id],s.id)
      assert.equal(moduleExports.getServiceById('doyaslide').href,'/doyaslide','Public LP URL must remain unchanged')
      assert.equal(moduleExports.getServiceById('doyaslide').dashboardHref,'/doyaslide/new')
      for(const id of ['tenjikai','shanai','income','expense']){assert.ok(moduleExports.UNLISTED_SERVICE_IDS.has(id));assert.ok(!moduleExports.getPublicServices().some(s=>s.id===id));assert.ok(ALL_SHELL_TOOLS.find(t=>t.id===id).beta)}
    })
    for(const uiNext of [false,true]) {
      await check((uiNext?'next':'legacy')+' shell groups use authenticated work entry for all active services',()=>{
        for(const tool of shellGroups(uiNext).flatMap(g=>g.tools))assert.equal(tool.href,expected[tool.id],tool.id)
      })
      await check((uiNext?'next':'legacy')+' actual desktop/drawer/recent/mobile tabs use work entry; selecting closes drawer',async()=>{
        pathname='/home';window.localStorage.setItem('doya-shell-recent-v1',JSON.stringify(['doyaslide','banner']))
        const map={sfa:'/sfa/owned-org',shodan:'/shodan/owned-org',aio:'/aio/owned-org/scan'}
        await mount(React.createElement(UiNextContext.Provider,{value:uiNext?'preview':null},React.createElement(ShellToolHrefsContext.Provider,{value:map},React.createElement(AppShell,{initialRecent:['doyaslide','banner']},'Synthetic content'))),async()=>{
          const sidebar=document.querySelector('nav[aria-label="ツール一覧"]')
          for(const tool of ALL_SHELL_TOOLS.filter(t=>t.id!=='home'))for(const anchor of sidebar.querySelectorAll('a[title="'+tool.name+'"]'))assert.equal(anchor.getAttribute('href'),map[tool.id]||expected[tool.id],tool.id)
          const slideLinks=[...sidebar.querySelectorAll('a[title="スライド"]')];assert.ok(slideLinks.length>=(uiNext?2:1),'Recent/sidebar must use actual tool references')
          const tabs=document.querySelector('nav[aria-label="よく使うツール"]');assert.equal([...tabs.querySelectorAll('a')].find(a=>a.textContent==='スライド').getAttribute('href'),'/doyaslide/new')
          await click(document.querySelector('button[aria-label="メニューを開く"]'));assert.equal(sidebar.getAttribute('data-open'),'true')
          await click(slideLinks[0]);assert.equal(navigations.at(-1),'/doyaslide/new');assert.equal(sidebar.getAttribute('data-open'),'false')
        })
      })
      await check((uiNext?'next':'legacy')+' actual command palette navigates every active tool to the work entry with org overrides intact',async()=>{
        const map={sfa:'/sfa/owned-org',shodan:'/shodan/owned-org',aio:'/aio/owned-org/scan'}
        await mount(React.createElement(UiNextContext.Provider,{value:uiNext?'preview':null},React.createElement(ShellToolHrefsContext.Provider,{value:map},React.createElement(AppShell,{initialRecent:[]},'Synthetic content'))),async()=>{
          for(const tool of ALL_SHELL_TOOLS.filter(t=>t.id!=='home')){
            await click(document.querySelector('button[aria-label="ツールを探す"]'))
            const choice=[...document.querySelectorAll('[role="dialog"] button')].find(b=>b.querySelector('b')?.textContent===tool.name)
            await click(choice);assert.equal(navigations.at(-1),map[tool.id]||expected[tool.id],tool.id)
          }
        })
      })
    }
    for(const mobile of [false,true])await check((mobile?'mobile':'desktop')+' per-service tool switcher already links all active services to work entries',async()=>{
      await mount(React.createElement(ToolSwitcherMenu,{currentService:'not-a-service',showLabel:true,isCollapsed:false,isMobile:mobile}),async()=>{
        await click(document.querySelector('button[title="他のツールを使う"]'))
        for(const s of services){const anchor=[...document.querySelectorAll('a[role="menuitem"]')].find(a=>a.textContent.includes(s.name));assert.ok(anchor,s.id);assert.equal(anchor.getAttribute('href'),expected[s.id],s.id)}
      })
    })
    await check('ServiceNav existing switcher uses registry work paths',async()=>{await mount(React.createElement(ServiceNav,{}),async()=>{await click(document.querySelector('button'));for(const s of services)assert.ok([...document.querySelectorAll('a')].some(a=>a.getAttribute('href')===expected[s.id]),s.id)})})
    await check('latent service card returns to authenticated tool home, not public site',async()=>{await mount(React.createElement(OtherServicesCard,{currentService:'hr'}),async()=>{const home=[...document.querySelectorAll('a')].find(a=>a.textContent.includes('ツールのホームへ'));assert.ok(home);assert.equal(home.getAttribute('href'),'/home');assert.ok(![...document.querySelectorAll('a')].some(a=>a.getAttribute('href')==='/'))})})
    await check('unused unified promo keeps its rendered pricing CTA and no public-LP work link',async()=>{const Promo=source('src/components/UnifiedPlanPromo.tsx').default;await mount(React.createElement(Promo,{}),async()=>{const anchors=[...document.querySelectorAll('a')];assert.deepEqual(anchors.map(a=>a.getAttribute('href')),['/all-in-one'])})})
    for(const guest of [false,true])await check((guest?'guest':'authenticated')+' slide local sidebar/profile/login returns to real workspace without changing public LP',async()=>{
      authenticated=!guest;pathname='/doyaslide/new'
      await mount(React.createElement(SlideSidebar,{isMobile:true,forceExpanded:true,plan:guest?'GUEST':'FREE'}),async()=>{
        assert.ok(![...document.querySelectorAll('a')].some(a=>a.getAttribute('href')==='/doyaslide'),'Local work sidebar must not send profile to LP')
        if(guest)assert.ok([...document.querySelectorAll('a')].some(a=>a.getAttribute('href')==='/auth/signin?callbackUrl=%2Fdoyaslide%2Fnew'))
        assert.ok([...document.querySelectorAll('a')].some(a=>a.getAttribute('href')==='/doyaslide/new'))
        assert.ok([...document.querySelectorAll('a')].some(a=>a.getAttribute('href')==='/doyaslide/projects'))
      })
    })
    for(const mobile of [false,true])await check((mobile?'mobile':'desktop')+' admin service links reach existing work screens',async()=>{
      pathname='/admin'
      await mount(React.createElement(AdminSidebar,{isMobile:mobile}),async()=>{
        const home=[...document.querySelectorAll('a')].find(a=>a.textContent.includes('ツールのホームへ'));assert.ok(home);assert.equal(home.getAttribute('href'),'/home')
        for(const [label,href]of [['ドヤバナーAI','/banner/dashboard'],['ドヤライティングAI','/seo'],['ドヤ勤怠','/kintai/dashboard']]){
          const anchor=[...document.querySelectorAll('a')].find(a=>a.textContent.includes(label));assert.ok(anchor);assert.equal(anchor.getAttribute('href'),href)
        }
      })
    })
    await check('all active service nav data point to existing work/setting/pricing routes, including org builders',()=>{
      const routes=[]
      function walk(dir,segments=[]){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(entry.isDirectory())walk(path.join(dir,entry.name),/^\(.+\)$/.test(entry.name)?segments:[...segments,entry.name]);else if(/^page\.[jt]sx?$/.test(entry.name))routes.push(segments)}}
      walk(path.join(root,'src/app'))
      const exists=href=>{const parts=href.split(/[?#]/)[0].split('/').filter(Boolean);return routes.some(route=>route.length===parts.length&&route.every((segment,i)=>/^\[.+\]$/.test(segment)||segment===parts[i]))}
      const navBuilders={sfa:m=>m.sfaNav('owned-org'),shodan:m=>m.shodanNav('owned-org'),aio:m=>m.buildAioNav('owned-org'),promane:m=>m.promaneNav('owned-workspace'),expense:m=>m.expenseNav('owned-org','owner'),kintai:m=>m.buildKintaiNav('owner',true),hr:m=>m.hrShellNav(true)}
      let count=0
      for(const service of services){
        const m=source('src/lib/'+service.id+'/nav.ts')
        const items=navBuilders[service.id]?navBuilders[service.id](m):Object.values(m).filter(Array.isArray).flat().filter(item=>typeof item?.href==='string')
        assert.ok(items.length>0,'No nav entries inspected: '+service.id)
        for(const item of items){assert.ok(exists(item.href),service.id+' missing nav page '+item.href);assert.ok(!['/doyaslide','/hr','/kintai'].includes(item.href),'Work navigation entered a pure LP: '+item.href);count++}
      }
      navDataCoverage={services:services.length,links:count}
    })
    console.log(JSON.stringify({scope:'Actual client navigation components in synthetic DOM/session; no browser or HTTP; route existence retained',cases:results.length,navDataCoverage,passed:results.every(r=>r.passed),results},null,2))
    assert.ok(results.every(r=>r.passed),'Every authenticated navigation path must use the work entry')
  } finally {dom.window.close();for(const [key,descriptor]of Object.entries(previous)){if(descriptor)Object.defineProperty(global,key,descriptor);else delete global[key]}}
}
checkWorkEntries().catch(error=>{console.error(error);process.exitCode=1})
