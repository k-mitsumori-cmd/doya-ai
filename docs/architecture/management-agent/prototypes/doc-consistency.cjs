// 付録 J の 28 キー: 正本語（required, >=1 回）と禁止語（forbidden, 付録 J 自身を除いて 0 回）を 3 ファイルで検査
const fs=require("fs");const dir=process.argv[2];
const files={README:fs.readFileSync(dir+"/README.md","utf8"),CHECKLIST:fs.readFileSync(dir+"/CHECKLIST.md","utf8"),draft:fs.readFileSync(dir+"/schema-draft.prisma","utf8")};
// 付録 J 自身を除外
const jStart=files.README.indexOf("### 付録 J.");const after=files.README.indexOf("\n### 付録 ",jStart+10);const jEnd=after<0?files.README.length:after;
const readmeNoJ=files.README.slice(0,jStart)+files.README.slice(jEnd);
const scan={README:readmeNoJ,CHECKLIST:files.CHECKLIST,draft:files.draft};
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
const keys=[
 {k:"1 除籍の意味論",req:["物理削除"],forb:["旧 Member 行も `INACTIVE`","旧 Member 行は INACTIVE","旧 Member 行も INACTIVE"]},
 {k:"2 Cron claim/フェンス",req:["'queued','planning','running'"],forb:["status IN ('queued','running')","status IN (queued,running)","status IN (queued, running)"]},
 {k:"3 冪等キー基底",req:["reservationId>:reserve"],forb:["<base>","base:reserve"]},
 {k:"4 ツール冪等キー",req:["runId>:<stepId>"],forb:["stepId>:<attempt>"]},
 {k:"5 Cookie 名",req:["__Host-next-auth.session-token"],forb:["__Secure-next-auth"]},
 {k:"6 pausedReason",req:["company_suspended"],forb:["pausedReason='unknown_outcome'","pausedReason=unknown_outcome","| 'unknown_outcome'\n  pausedReason"]},
 {k:"7 User.plan 書き手",req:["syncUserPlan"],forb:["syncUnifiedBilling` を併記","syncUnifiedBilling()` も併せて","owner の `syncUnifiedBilling`","syncUnifiedBilling` 併記"]},
 {k:"8 月次付与",req:["grant:<subId>:<P>","grant:<stripeSubscriptionId>:<period>"],reqAny:true,forb:["stripe:<eventId>:grant","idempotencyKey='stripe:<eventId>'"]},
 {k:"9 costClass 閾値",req:["4 回以上"],forb:["N はマニフェストで宣言"]},
 {k:"10 承認必須",req:["costClass=high` → **下書きでも","costClass=high` 全部"],reqAny:true,forb:["`external` は**常に承認","`external` 全部"]},
 {k:"11 既定端末数",req:["既定 **3 端末**","既定 3"],reqAny:true,forb:["既定 **2 端末**"]},
 {k:"12 未移行は登録不可",req:["登録できない","登録不可"],reqAny:true,forb:["未移行ツールは `costClass=high`","未移行なら high","high 扱い","未移行の lib を呼ぶツールは `costClass=high`"]},
 {k:"13 数値",req:["226"],forb:["27 件、新規 model 32","結合後 224","35→38","27 テーブル","新規 model 32 件","スロット化なら 45","スロット化 45"]},
 {k:"14 purge 定義",req:["匿名化"],forb:["Artifacts→Runs→Members→Links→旧組織→Company"]},
 {k:"15 名寄せ 3 条件",req:["3 条件"],forb:["linkedBy='slug'","第一キー","第二キー"]},
 {k:"16 owned マーカー",req:["ownedScope"],forb:["所有確認は呼び出し元クライアント（tx 可）を受け取る `owned(client, ctx)` で行っているか","乗らなくても正しく動く設計","tx に拡張が乗るかどうかに依存しない"]},
 {k:"17 advance の Cron 起動",req:["withCompanyAccessOrCron"],forb:["`?slot=` を 5 本登録","1 呼び出し 1 件（毎分 1 件で足りなければ","1 呼び出し 1 件"]},
 {k:"18 M-11 import 閉包",req:["import 閉包"],forb:["宣言どおり"]},
 {k:"19 Stripe 返金",req:["adjust:stripe:"],forb:["refund:<元 base>","Stripe 返金・運営補填"]},
 {k:"20 strictSharing pending",req:["__Host-doya_pending"],forb:["pendingPasskey"]},
 {k:"21 リース TTL",req:["360s"],forb:["executionToken, 300s","リース 300s"]},
 {k:"22 リスク区分の用語",req:["reversibility"],forb:["riskLevel","read / draft / external","external 承認","external を追加"]},
 {k:"23 walkData 契約",req:["assertRefsOwned"],forb:["その場で書き換え","戻り値なし","RecordNotFound → 拒否","複合条件に書き換え"]},
 {k:"24 書き込みは owned のみ",req:["書き込み全部"],forb:["`create / createMany` の data 検査 | query 拡張","拡張の `updateMany` 分岐で"]},
 {k:"25 分類数",req:["5 分類"],forb:["4 分類"]},
 {k:"26 walkData は DMMF 既定拒否",req:["許可リスト"],forb:["refs 対象は `connect / set / disconnect","テナントモデルに対して同じ契約"]},
 {k:"27 RLS の対象と方式",req:["機微テーブル"],forb:["RLS は新テーブル限定","新テーブルのみ Phase4","SET LOCAL"]},
 {k:"28 RLS 前提の起動時 DB 側検査",req:["pg_roles"],forb:["env のロール名検査","URL 文字列の一致"]},
];
let fail=0;const rows=[];
for(const key of keys){
  const reqCounts=key.req.map(r=>Object.values(scan).reduce((a,txt)=>a+(txt.split(r).length-1),0));
  const reqOk=key.reqAny?reqCounts.some(c=>c>0):reqCounts.every(c=>c>0);
  const forbCounts={};let forbTotal=0;for(const f of key.forb){for(const [name,txt] of Object.entries(scan)){const c=txt.split(f).length-1;if(c){forbCounts[name+":"+f]=c;forbTotal+=c;}}}
  if(!reqOk||forbTotal)fail++;
  rows.push(`${reqOk&&!forbTotal?"OK ":"NG "}${key.k} | 正本語出現 ${reqCounts.join("/")} | 禁止語残数 ${forbTotal}${forbTotal?" "+JSON.stringify(forbCounts):""}`);
}
console.log(rows.join("\n"));console.log("keys",keys.length,"NG",fail);process.exit(fail?1:0);
