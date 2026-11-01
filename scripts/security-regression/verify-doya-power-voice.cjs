// 音声（AI商談・AI面接）のドヤパワーと、「足りない」の知らせの配線の回帰テスト（2026-10-23）。
// 動きの中身は src/lib/doya-power/voice.test.ts と insufficient.test.ts（memory-db・DOM なし）。
// - AI面接は URL の発行の前、AI商談は商談を作る前に、最大の分数ぶんを仮に減らす（作れなかったら戻す）
// - 相手側の鍵の API は、発行した会社の台帳だけを見て、仮に減らした分数を超えない・戻したあとは続けない
// - 終わり・担当者の終了・放置の自動完了で清算する。清算で戻した面接は、同じ URL に戻さない
// - 旗が off なら、自動完了の cron は追加の読み込みをしない
// - 知らせは共通の枠で1か所。旗が出すと決めた人だけ fetch を見る
// ⚠️ git のコマンドは使わない。DB・課金・AI には触れない。
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{check}=require('./load-typescript.cjs');
const root=path.resolve(__dirname,'../..');
const code=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:])\/\/.*$/gm,'$1');
const before=(src,a,b,msg)=>{const i=src.indexOf(a),j=src.indexOf(b);assert.ok(i>=0&&j>=0&&i<j,msg||`${a} before ${b}`)};
(async()=>{
  await check('Interview URL issuance holds the maximum minutes before creating the URL and releases on failure',async()=>{
    const s=code('src/app/api/mensetsu/sessions/route.ts');
    before(s,"voiceCharger.hold('mensetsu'",'tx.mensetsuSession.create(');
    assert.match(s,/if \(voice\.kind === 'blocked'\) return voice\.response/);
    assert.match(s,/if \(result\?\.kind !== 'created'\) await releaseVoice\(\)/);
    assert.match(s,/voiceTokenKey\('mensetsu', token\)/);
    assert.match(s,/^\s*token,$/m);
  });
  await check('AI shodan holds per conversation (not per room URL) before creating it',async()=>{
    const s=code('src/app/api/aishodan/room/[token]/start/route.ts');
    before(s,"voiceCharger.hold('aishodan'",'tx.aishodanSession.create(');
    assert.match(s,/`session-\$\{sessionId\}`/);
    assert.match(s,/id: sessionId,/);
    assert.match(s,/if \(result\?\.kind !== 'created'\) await releaseVoice\(\)/);
  });
  await check('Counterpart token routes look only at the issuing company ledger and stop at the held minutes',async()=>{
    for(const [f,svc,key] of [['src/app/api/mensetsu/live/[token]/token/route.ts','mensetsu',"voiceTokenKey('mensetsu', s.token)"],['src/app/api/aishodan/room/[token]/token/route.ts','aishodan','`session-${s.id}`']]){
      const s=code(f);
      assert.ok(s.includes(`voiceCharger.allowance('${svc}', s.organizationId, ${key}`),f);
      assert.match(s,/if \(voice === 'closed'\)/,f);
      assert.match(s,/voice\.minutes \* 60 \* 1000/,f);
      // 鍵を出す（有料の処理）前に見る
      before(s,'voiceCharger.allowance(','client_secrets',f);
    }
  });
  await check('Every end path settles the difference once',async()=>{
    assert.match(code('src/app/api/mensetsu/live/[token]/end/route.ts'),/voiceCharger\.settle\('mensetsu', s\.organizationId, voiceTokenKey\('mensetsu', s\.token\)/);
    const close=code('src/app/api/mensetsu/sessions/[id]/close/route.ts');
    assert.match(close,/voiceCharger\.settle\('mensetsu', c\.organizationId/);
    assert.match(close,/ドヤパワーの清算が済んでいるため戻せません/);
    const cron=code('src/app/api/cron/mensetsu-purge/route.ts');
    assert.match(cron,/if \(doyaPowerRollout\(\) !== 'off'\) \{/);
    assert.match(cron,/if \(closed\.count === 1\) await voiceCharger\.settle\('mensetsu'/);
    assert.match(code('src/app/api/aishodan/room/[token]/end/route.ts'),/voiceCharger\.settle\('aishodan', s\.organizationId, `session-\$\{s\.id\}`/);
    assert.match(code('src/lib/aishodan/recover-stale-sessions.ts'),/voiceCharger\.settle\('aishodan', a\.organizationId, `session-\$\{row\.id\}`/);
    // 始まらなかった商談の仮に減らした分は、中止にしてから0分で戻す（旗が off なら何も読まない）
    const rec=code('src/lib/aishodan/recover-stale-sessions.ts');
    assert.match(rec,/export async function releaseUnstartedAishodanHolds\(\) \{\n  const stats = \{ checked: 0, released: 0 \}\n  if \(doyaPowerRollout\(\) === 'off'\) return stats/);
    before(rec,"data: { status: 'aborted', endedAt: new Date() }","voiceCharger.settle('aishodan', row.organizationId, `session-${row.id}`, 0)");
    // 記録の無い商談で先頭が埋まっても、続きから見る（どこまで見たかを保存する）
    assert.match(rec,/key: UNSTARTED_CURSOR_KEY/);
    assert.match(rec,/\.\.\.\(cursor \? \{ id: \{ gt: cursor \} \} : \{\}\)/);
    assert.ok(!/7 \* 24 \* 3600_000/.test(rec));
    assert.match(code('src/app/api/cron/aishodan-work-cleanup/route.ts'),/await releaseUnstartedAishodanHolds\(\)\.catch\(/);
  });
  await check('The guest-facing AI商談 start never shows the issuing company balance',async()=>{
    const s=code('src/app/api/aishodan/room/[token]/start/route.ts');
    assert.ok(!s.includes('return voice.response'));
    assert.match(s,/voice\.reason === 'insufficient'\n\s+\? NextResponse\.json\(\{ error: unavailable \}, \{ status: 429 \}\)/);
  });
  await check('The insufficient notice is one shared watcher, active only when the flag allows it',async()=>{
    const w=code('src/components/shell/low-power.tsx');
    assert.match(w,/if \(!enabled \|\| typeof window === 'undefined'\) return/);
    assert.match(w,/isOwnApiRequest\(input, window\.location\.origin\)/);
    assert.match(w,/if \(window\.fetch === watched\) window\.fetch = original/);
    const gate=code('src/components/shell/ShellGate.tsx');
    assert.match(gate,/<DoyaPowerFetchWatcher \/>/);
    assert.match(gate,/<ShellLowPowerNotice(?: handledByNotice=\{[^}]*\})? \/>/);
    assert.match(code('src/lib/doya-power/charge-core.ts'),/recoveryAmount: DAILY_RECOVERY_AMOUNT/);
  });
  console.log(JSON.stringify({scope:'DoyaPower voice wiring and the shared insufficient notice. Static checks; behavior in voice.test.ts and insufficient.test.ts.'}));
})().catch(e=>{console.error(e);process.exitCode=1});
