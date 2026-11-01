// 支出管理を「1アカウント＝1会社」で始める流れの回帰テスト（2026-10-24）。
// - 画面を開く GET（page.tsx）では組織を作らない（先取りや他サイトからの読み込みで作られないため）
// - 作るのは「この会社で始める」の POST だけ。組織名はアカウントの会社から、氏名はセッションから、サーバーが決める
// ⚠️ git のコマンドは使わない。ファイルは fs で読む。DB・課金・AI には触れない。
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{check}=require('./load-typescript.cjs');
const root=path.resolve(__dirname,'../..');
const code=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:])\/\/.*$/gm,'$1');
(async()=>{
  await check('Opening /expense never creates an organization',async()=>{
    const page=code('src/app/(shell)/expense/page.tsx');
    assert.doesNotMatch(page,/createOrganization|saveOwnCompany|\.create\(|\.upsert\(/);
    assert.match(page,/companyName = \(await getOwnCompany\(userId\)\)\?\.name\?\.trim\(\) \|\| null/);
  });
  await check('Starting with the account company decides the names on the server',async()=>{
    const api=code('src/app/api/expense/organization/route.ts');
    const branch=api.slice(api.indexOf('body?.fromAccountCompany === true'),api.indexOf("const name = typeof body?.name"));
    assert.ok(branch.length>0,'fromAccountCompany branch');
    assert.match(branch,/const company = await getOwnCompany\(userId\)/);
    assert.match(branch,/status: 409/);
    assert.doesNotMatch(branch,/body\.(name|memberName)|body\?\.(name|memberName)/);
    // userId はセッションから（resolveUserId）。分岐は認証の確認より後
    assert.ok(api.indexOf('const userId = await resolveUserId()')<api.indexOf('body?.fromAccountCompany === true'));
    // 画面は押したときだけ送る（描いたときに送らない）
    const entry=code('src/app/(shell)/expense/Entry.tsx');
    assert.match(entry,/body: JSON\.stringify\(\{ fromAccountCompany: true \}\)/);
    assert.doesNotMatch(entry,/useEffect\([^)]*startWithCompany/);
  });
  console.log(JSON.stringify({scope:'Expense starts with the account company: no writes on GET; the POST takes names from the server. Static source checks only.'}));
})().catch(e=>{console.error(e);process.exitCode=1});
