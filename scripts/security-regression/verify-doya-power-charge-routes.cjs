// ドヤパワーを減らす API の入口の回帰テスト（2026-10-23）。動きの中身は src/lib/doya-power/charge.test.ts（memory-db）。
// - 札を置いた操作の有料の API は、すべて生成の前に減らす（withDoyaPowerCharge で包むか、処理の中で charge する）
// - 包みは、旗が off なら本文も読まずに今までの処理を呼ぶ
// - 残りの API は、旗が off なら台帳を読まずに 404
// ⚠️ git のコマンドは使わない。ファイルは fs で読む。DB・課金・AI には触れない。
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{check}=require('./load-typescript.cjs');
const root=path.resolve(__dirname,'../..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const code=f=>read(f).replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:])\/\/.*$/gm,'$1');
const WRAPPED={
  'mensetsu/templates':'text.generate','quote/documents/suggest':'text.generate','quote/documents/estimate-item':'text.generate',
  'interview/articles/generate':'interview.article','adimage/concepts/[id]/refine':'image.refine','shanai/interviews/[id]/article':'interview.article',
  'sfa/ai/score':'text.generate','sfa/ai/next-action':'text.generate','persona/generate':'persona.generate','seo/articles':'seo.article',
  'banner/test/generate':'banner.generate','banner/from-url':'banner.generate','banner/generate':'banner.generate','banner/refine':'image.refine',
  'tenjikai/image':'tenjikai.image','doyaslide/structure':'slide.generate',
};
// クライアントのキー（同じ操作をまとめる ID）を渡してよい API。どれも、処理の側が同じキーで結果を返し直すか、
// 食い違い（本文の違い）を断る作り（receipt・operation・reserve）。ここに無い API でキーを渡したら落とす
// 「作り直す」のボタンがある API。リクエストのヘッダーの前の操作のキー（retryOf）を見る（retry: true）。本文は読まない。
// 半分にするかは台帳が決める（同じ会社・同じ操作の名前・5分以内・戻していない前の操作）。ここに無い API で retry を付けたら落とす
const RETRY=new Set(['shanai/interviews/[id]/article','interview/articles/generate','banner/from-url','adimage/concepts/[id]/refine']);
const KEYED={'interview/articles/generate':'operationId','adimage/concepts/[id]/refine':'operationId','sfa/ai/score':'operationId','sfa/ai/next-action':'operationId','persona/generate':'requestKey','seo/articles':'operationId','banner/refine':'operationId'};
(async()=>{
  await check('Only routes whose handlers dedupe on the same key pass a client key',async()=>{
    for(const p of Object.keys(WRAPPED)){
      const src=code('src/app/api/'+p+'/route.ts');
      const m=src.match(/export const POST = withDoyaPowerCharge\(([\s\S]*?), postHandler\)/);
      assert.ok(m,p);
      const keyed=/key:/.test(m[1]);
      if(KEYED[p])assert.ok(m[1].includes('b?.'+KEYED[p]),p+' key '+KEYED[p]);
      else assert.equal(keyed,false,p+' must not pass a client key');
      assert.equal(/retry: true/.test(m[1]),RETRY.has(p),p+' retry');
      // 作り直しのあるルートは、サーバーが決める対象（target）を必ず渡す。無いルートは半分にならない
      if(RETRY.has(p)){assert.match(m[1],/target:/,p+' target');assert.doesNotMatch(m[1],/target: \(b\) => b\?\.(retryOf|target)\b/,p+' target must not be a raw client value');}
      // retryOf を本文から読まない（大きな本文のルートで包みが本文を読まないように）
      assert.doesNotMatch(m[1],/retryOf:/,p);
    }
    // 操作の ID には量も入る（同じキーで量だけ変えた呼び出しを、同じ操作にしない）
    assert.match(code('src/lib/doya-power/charge-core.ts'),/const opKey = key \?\? newKey\(\)\s*let operationId = `\$\{action\}:\$\{who\.companyId\}:\$\{opKey\}\$\{scope \? `:\$\{scope\}` : ''\}:\$\{amount\}`/);
    // 作り直しの retryOf はヘッダーから読む。本文を読む条件（needsBody）に retry を入れない
    const wrap=code('src/lib/doya-power/charge.ts');
    assert.match(wrap,/spec\.retry \? req\.headers\.get\(DOYA_POWER_RETRY_HEADER\) : undefined/);
    assert.doesNotMatch(wrap.match(/const needsBody = [^\n]*/)[0],/spec\.retry\b/);
    // 操作のキーは、戻さなかった応答にだけ付ける
    assert.match(code('src/lib/doya-power/charge-core.ts'),/if \(res\.status >= 400 && !consumed\) \{\s*await outcome\.refund\(\)\s*return res\s*\}[\s\S]*?res\.headers\.set\(DOYA_POWER_OP_HEADER, outcome\.opKey\)/);
    // クライアントのキーは、ルートの名前空間つきで台帳に渡す（別のルートに送って支払い済みの重複にさせない）
    assert.match(code('src/lib/doya-power/charge.ts'),/scope: routeScope\(req\)/);
  });
  await check('Every paid route behind a cost badge charges before generating',async()=>{
    for(const [p,action] of Object.entries(WRAPPED)){
      const src=code('src/app/api/'+p+'/route.ts');
      assert.match(src,/export const POST = withDoyaPowerCharge\(/,p);
      assert.ok(src.includes(`'${action}'`),p+' action '+action);
      assert.doesNotMatch(src,/export async function POST\(/,p);
    }
    const aio=code('src/app/api/aio/scans/route.ts');
    assert.match(aio,/const power = await doyaPowerCharger\.charge\('aio\.scan\.question', \{ units: prompts\.length \}\)\s*return doyaPowerCharger\.run\(power, scanAndRespond\)/);
    // スキャンの本体（有料の処理）は、減らしたあとの scanAndRespond の中だけで呼ぶ
    assert.ok(aio.indexOf('runAndPersistScan(')>aio.indexOf('const scanAndRespond'));
    const tr=code('src/app/api/interview/materials/[id]/transcribe/route.ts');
    // 長さが分かったあと、予約（reserveInterviewTranscription）の前に減らす。足りなければ予約せずに返す
    assert.ok(tr.indexOf("doyaPowerCharger.charge('transcribe.hour'")<tr.indexOf('reserveInterviewTranscription({'));
    assert.match(tr,/if \(charged\.kind === 'blocked'\) return charged\.response/);
    assert.match(tr,/if \(res\.status >= 400 && power\.outcome\.kind === 'charged'\) await power\.outcome\.refund\(\)/);
  });
  await check('The wrapper calls the original handler untouched when the flag is off',async()=>{
    const src=code('src/lib/doya-power/charge.ts');
    // 旗の判定のあとで、本文は上限つき（readOperationalJson）でだけ読む。req.json() をそのまま読まない（大きな本文で止められないように）
    assert.match(src,/if \(doyaPowerRollout\(\) === 'off'\) return handler\(req, \.\.\.rest\)[\s\S]*?readOperationalJson\(req\.clone\(\), spec\.bodyMaxBytes \?\? CHARGE_BODY_MAX_BYTES\)/);
    assert.doesNotMatch(src,/req\.clone\(\)\.json\(\)/);
    const core=code('src/lib/doya-power/charge-core.ts');
    assert.match(core,/if \(deps\.rollout\(\) === 'off'\) return null/);
  });
  await check('Balance API answers 404 without reading anything when the flag is off, and only for the session company',async()=>{
    const src=code('src/app/api/doya-power/balance/route.ts');
    assert.match(src,/export async function GET\(\) \{\s*if \(doyaPowerRollout\(\) === 'off'\) return NextResponse\.json/);
    assert.doesNotMatch(src,/searchParams|companyId|req\.json/);
    assert.match(code('src/lib/doya-power/charge.ts'),/prisma\.accountCompany\.findUnique\(\{ where: \{ userId \}/);
  });
  await check('Shell gauge reads the ledger only when the flag allows it',async()=>{
    assert.match(code('src/app/(shell)/layout.tsx'),/const doyaPowerState = doyaPower \? await doyaPowerCharger\.shellState\(\)\.catch\(\(\) => null\) : null/);
  });
  console.log(JSON.stringify({scope:'DoyaPower charge wiring in paid routes. Static source checks; behavior is covered by charge.test.ts with an in-memory ledger.'}));
})().catch(e=>{console.error(e);process.exitCode=1});
