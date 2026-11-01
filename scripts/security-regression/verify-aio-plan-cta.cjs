// ドヤAIO のプランの案内（2026-10-24 に古いサイドバー AioSidebar を消したあと）。
// 新しい見た目では、プランと残りは共通の枠の左下（SidebarUsagePanel）が組織ごとに出す。
// - 組織のページは AioShellFrame（ToolFrame）だけで包み、旧来のサイドバーのレイアウトに戻らない
// - 枠の利用量は URL の組織（org: 'path'）で数える。別の組織のプランを出さない
// 合成のデータだけ。DB・課金・AI には触れない。
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),{load}=require('./load-typescript.cjs');
const root=path.resolve(__dirname,'../..');
const read=(f)=>fs.readFileSync(path.join(root,f),'utf8');
const layout=read('src/app/(shell)/aio/[orgSlug]/layout.tsx');
assert.match(layout,/return <AioShellFrame orgSlug=\{orgSlug\}>\{children\}<\/AioShellFrame>/);
assert.doesNotMatch(layout,/AioAppLayout|AioSidebar|isShellEnabled/);
// 組織の確認（他組織は解決されない）は残す
assert.match(layout,/const ctx = await getAioContext\(orgSlug\)/);
assert.match(layout,/if \(!ctx \|\| ctx\.organizationSlug !== orgSlug\) redirect\('\/aio'\)/);
for(const f of ['src/components/aio/AioSidebar.tsx','src/components/aio/AioAppLayout.tsx'])assert.equal(fs.existsSync(path.join(root,f)),false,f);
const {SHELL_SERVICES,shouldShowShell}=load('src/components/shell/registry.ts',{'@/lib/ui/guest-path':load('src/lib/ui/guest-path.ts')});
const aio=SHELL_SERVICES.find((s)=>s.id==='aio');
assert.ok(aio&&aio.usage,'aio usage');
assert.equal(aio.usage.service,'aio');
assert.equal(aio.usage.org,'path');
assert.equal(shouldShowShell('/aio/test',{signedIn:true}),true);
assert.equal(shouldShowShell('/aio/test',{signedIn:false}),false);
assert.equal(shouldShowShell('/aio/invite/tok',{signedIn:true}),false);
console.log('PASS aio plan CTA is organization-scoped in the shell usage panel; legacy sidebar removed');
