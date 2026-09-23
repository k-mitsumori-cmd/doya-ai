export type CommentKind = 'good' | 'concern' | 'mixed' | 'steady' | 'zero' | 'healthy' | 'pending' | 'first' | 'error' | 'recovered' | 'test' | 'signup' | 'purchase' | 'purchase_start' | 'purchase_stop' | 'share' | 'click' | 'saved' | 'activity' | 'report' | 'feedback' | 'mention' | 'published' | 'info';
export const commentBank: Record<CommentKind, readonly string[]> = {
 good:['いい感じ！確認できた数字は良い方向に動いてるね。この流れが続くか見てこ！','お、良くなってる！うれしい変化だね。何が効いたか内訳もチェックしよ。','これは良かった！良い変化が数字に出てるね。次の集計も楽しみに追ってこ。','良い動きが見えてるよ！比較期間をそろえて、続いているかも見てこ。'],
 concern:['ここはちょっと気になる動き。どの数字が変わったか、内訳から確認しよ。','今回は改善ポイントがありそう。原因は決めつけず、変化したところを見てこ。','気になる変化をキャッチしたよ。集計条件と対象の動きを先にチェックしよ。','この変化は見逃さずに確認したいね。次の一手につながる原因を探してこ。'],
 mixed:['良い動きも、気になる動きもあるね！伸びたところを活かしつつ、下がったところも見てこ。','うれしい変化と要チェックな変化が両方あるよ。数字ごとに分けて見てね。','今回は明暗あり！良かった点は続けて、気になる点は順番に確認しよ。','全部をひとまとめにせず見たい日だね。良い変化と改善ポイントをそれぞれ拾ってこ！'],
 steady:['比較できた数字は横ばいだね。次の小さな変化も拾ってこ！','今回は大きく変わらず。安定しているか、次の集計も見てこ。','数字は前回と同じ水準だよ。内訳に変化がないかもチェックしよ。','今回は横ばい。ここを基準に、次の動きを追ってこ！'],
 zero:['この項目は今回は0件だったよ。次の一件につながる入口を見直してこ！','今回はまだ動きがない数字だね。計測できているかも含めてチェックしよ。','この集計は静かな結果だったよ。掲載状況や利用の入口も見てこ。','0件も大事な記録だね。未取得とは分けて、次につながる確認をしよ！'],
 healthy:['確認できた問題は0件。そこは良かった！見ていない範囲まで問題なしとは決めつけず、引き続き見守ろ。','今回チェックした範囲では問題なし、良かったね！次の確認も続けてこ。','確認範囲では問題を検知していないよ。ひとまず良かった、引き続きチェックしよ！','このチェックは問題なしだったよ！確認できた範囲を押さえて、次も見てこ。'],
 pending:['ここはまだ判断材料が足りないよ。0件や悪化とは扱わず、データがそろってから見よ！','まだ確認待ちの情報があるね。良い・悪いを決めつけず、取得状況をチェックしよ。','今回はデータ待ち。数字がないことと、実績が0件なことは分けて見てね！','まだ結論はお預けだね。確認できた情報から順番に見てこ。'],
 first:['実績が確認できたね！比較データがないので、増えたかどうかは次から見てこ。','まずは今回の数字を基準にしよ！良い・悪いの増減判定は比較がそろってから。','今回の実績はここだよ。前回との比較はまだできないので、次の変化を追ってこ！','基準になる数字がそろったね。伸びたかどうかは次の集計で確認しよ。'],
 error:['ここは要対応だね。影響と確認手順から順番に見てこ。','うまく進まなかった処理があるよ。慌てて再実行せず、結果を確認してから対応しよ。','このつまずきは確認したいね。発生時刻と対象の処理をチェックしよ。','ここは放置せず見ておきたいところ。下の対応手順から進めてこ。'],
 recovered:['応答が戻ってよかった！確認できた範囲を押さえて、引き続き様子を見よ。','復旧の確認が取れたね、良かった！対象の操作まで問題ないかは別途見てこ。','正常な応答に戻ったよ、ひとまず良かったね！再発しないかも見てこ。','戻ってきてくれて良かった！復旧確認の範囲と、残っている確認を見てね。'],
 test:['これはテストだよ。動作確認の記録として見て、本番の実績とは分けてね！','確認用の通知だよ！実際の売上・利用・障害が発生した意味ではないから、分けて見てね。','テストの内容を届けたよ。本番の良し悪しを判断する材料には含めないでね！','今回は動作確認用！テストと本番を分けて、表示内容をチェックしよ。'],
 signup:['新しい仲間が来てくれたね、うれしい！最初の利用につながるかも見てこ。','登録してくれたよ、いいね！どこから来てくれたかと、その後の動きもチェックしよ。','新規登録、良かったね！登録だけで終わらず使ってもらえるか、ここから見守ろ。','仲間が増えたよ！最初の体験まで気持ちよく進めているか見てこ。'],
 purchase:['本番の購入を確認できたよ、うれしいね！商品や利用枠の反映もセットで見てこ。','購入につながったね、良かった！決済結果と商品反映まで確認しよ。','本番の購入が届いたよ、いいね！反映漏れがないかもチェックしてこ。','購入してもらえたね、うれしい！支払いと提供内容がそろっているかも見てね。'],
 purchase_start:['購入を検討してくれてるね！まだ売上ではないので、完了まで進めたか見てこ。','購入の入口まで来てくれたよ。手続きの途中で困っていないかもチェックしよ。','購入前の動きがあったね！ここから完了につながるかを見てこ。','購入に向けた操作を確認したよ。完了とは分けて、その先の動きを追ってね。'],
 purchase_stop:['購入手続きはここで止まったね。理由はまだ分からないので、決済結果とエラーの有無を確認しよ。','今回は購入完了まで確認できていないよ。キャンセルか不具合かは決めつけず見てこ。','途中で終了した記録だね。請求や商品反映を確認してから、次の対応を考えよ。','購入途中のストップを確認したよ。利用者の意思か処理の問題か、分けて調べたいね。'],
 share:['共有するところまで進んでくれたね、いい感じ！実際の投稿完了とは分けて見てね。','シェアの操作があったよ、うれしいね！公開されたかどうかは別の確認だよ。','誰かに見せようとしてくれた動きだね！共有操作として記録しておこ。','共有ボタンまで来てくれたよ、いいね！SNSへの投稿完了とは区別して見てこ。'],
 click:['リンクに興味を持ってくれたね、いい感じ！クリックと申込・報酬は分けて見てこ。','紹介先を見ようとしてくれたよ！この先の成果があるかは別で確認しよ。','クリックの動きがあったね！押された場所を見て、使いやすい案内につなげよ。','入口への反応があったよ、いいね！成果確定とは分けて追ってこ。'],
 saved:['記録を残してくれたね、うれしい！使い続けてもらえるかも見てこ。','保存まで進めたよ、いい感じ！この先の利用にもつながるといいね。','ひとつ記録が増えたね！使ってくれた動きをちゃんと追ってこ。','記録の完了を確認できたよ、良かった！次の利用も見守ろ。'],
 activity:['使ってくれた動きがあったね、うれしい！どの機能が使われたか見てこ。','利用の記録が届いたよ、いいね！使い続けてもらえるかも追ってこ。','サービスを使ってくれたね！今回の操作と、その先の動きを見てこ。','利用してくれたよ、うれしいね！繰り返し使ってもらえる体験につなげよ。'],
 report:['今回の数字をまとめたよ！比べられる項目から、良かった点と気になる点を見てこ。','数字の確認タイム！比較できない項目は決めつけず、内訳を見てね。','今回の結果はこちら！判断に必要な比較や対象期間もセットで見てこ。','レポートが届いたよ。良し悪しを決める前に、対象期間と取得状況を確認しよ！'],
 mention:['サービスについての投稿が見つかったよ、うれしいね！内容を読んで、反応や困りごとを確かめよ。','話題にしてもらえたよ！好意的かどうかは本文を確認してから見てね。','サービスへの言及をキャッチしたよ。どんな文脈で話されているか確認しよ！','投稿で触れてもらえたね！内容に合わせて、必要な対応につなげよ。'],
 published:['公開・配信が完了したよ、良かった！届いた後の反応も見てこ。','発信できたね、いい感じ！この先の閲覧や反応もチェックしよ。','公開まで進めたよ！反応があったかは別の数字で追ってこ。','配信の完了を確認できたね。届いた先の動きも見守ろ！'],
 info:['お知らせが届いたよ！内容を確認して、必要な対応につなげよ。','今回の記録はこちら！確認できた事実から順番に見てこ。','動きがあったのでお届けするね。対象と結果をチェックしよ！','確認用のお知らせだよ。内容に合わせて次の動きを決めよ！'],
 feedback:['声を届けてもらえたね、ありがたい！内容を確認して、必要な対応につなげよ。','フィードバックが届いたよ！困りごとや要望を読み取って、次に活かしてこ。','利用者からの声だよ。内容に応じて優先度を決めて、丁寧に対応しよ。','意見をもらえたね！まず内容を確認して、改善や返答につなげてこ。'],
};
export type CommentOptions={mood?:string;current?:number|null;previous?:number|null;seed?:string;day?:string};
const badMetric=/エラー|失敗|費用|コスト|解約|返金|未対応|未完了|遅延|不一致/;
const metricLabel=/(?:エラー(?:数)?|失敗(?:数)?|費用|コスト|解約|返金|ダウンロード|DL数|アクセス|検索流入|クリック|利用人数|利用者|利用した方|売上|登録(?:者|数)?|表示数)/;
export function selectCommentKind(text:string,opts:CommentOptions={}):CommentKind {
 text=text.replace(/\*/g,'').replace(/([：:])\n(?=[¥￥\d])/g,'$1 ');
 const title=text.split('\n').find(x=>x.trim())||'';
 if(/区分.*未確認|本番.*テスト.*未確認/.test(title))return 'pending';
 if(/テスト|sandbox/i.test(title))return 'test';
 if(/復旧|正常.*戻|recovered/i.test(title)&&!/復旧.*(?:失敗|未確認|未完了|予定|見込み)/.test(title))return 'recovered';
 if(/フィードバック|お問い合わせ|不具合報告|ご意見/.test(title))return 'feedback';
 if(/購入.*(?:中断|終了|完了せず)|purchase_abort/.test(title))return 'purchase_stop';
 if(/エラー|要対応|要確認|警告|重大|異常|失敗|障害|停止|未着|到達不可|ERROR|WARN/.test(title)&&!/エラー(?:数)?[：:]?\s*0|異常なし|問題なし/.test(title))return 'error';
 if(/復旧.*(?:未確認|未完了|予定|見込み)/.test(title))return 'pending';
 if(/登録方法|流入情報/.test(title))return 'report';
 if(/新規登録|新規ユーザー|新しい.*登録|新しい仲間|新しいユーザー/.test(title))return 'signup';
 if(/購入.*(?:開始|始め|画面|検討)|購入手続き|マイルパック.*(?:見|画面)/.test(title))return 'purchase_start';
 if(/購入.*(?:完了|記録)|課金.*完了/.test(title))return /本番|PRODUCTION|本番の購入/.test(text)?'purchase':'pending';
 if(/共有操作|共有.*操作|シェア.*操作/.test(title))return 'share';
 if(/リンク.*(?:押|クリック)|紹介.*クリック/.test(title))return 'click';
 if(/記録.*(?:保存|完了)|支出.*保存|予定.*登録/.test(title))return 'saved';
 if(/フィードバック|お問い合わせ|不具合報告|ご意見/.test(title))return 'feedback';
 if(/言及|投稿.*見つ|Xで.*投稿|ブランド.*投稿/.test(title))return 'mention';
 if(/投稿.*完了|配信.*完了|公開.*完了/.test(title))return 'published';
 if(/問題なし|異常なし|不一致なし|すべて正常/.test(title))return 'healthy';
 if(/確定データがまだ生成されていない|Apple側の集計待ち/.test(text))return 'pending';
 const directions:number[]=[];
 for(const line of text.split('\n')) {
  if(!metricLabel.test(line)||/未取得|未確認|比較.*なし|未算出|\d{4}[-/]\d\d[-/]\d\d.*未/.test(line))continue;
  if(/前(?:日|回|週|月).*比べ/.test(line)){
   const signed=[...line.matchAll(/(ダウンロード|売上|利用者|クリック|エラー|費用|コスト)\s*([+＋\-−－±])\s*[¥￥]?([\d,]+(?:\.\d+)?)/g)];
   if(signed.length){for(const m of signed){const d=Number(m[3]!.replace(/,/g,''))===0?0:/[\-−－]/.test(m[2]!)?-1:1;directions.push(badMetric.test(m[1]!)?-d:d);}continue;}
  }
  const bad=badMetric.test(line.match(metricLabel)?.[0]||'');
  const ratio=line.match(/前(?:日|回|週(?:同曜日)?|月)比\s*([+＋\-−－±]?\d+(?:\.\d+)?)\s*[%％]/);
  const pair=line.match(/(?:昨日|今回|本日|初回ダウンロード|利用人数)?[：:]?\s*[¥￥]?([\d,]+(?:\.\d+)?)\s*(?:人|件|回|円|セッション|クリック|PV)?[^\n]*?(?:直前7日平均|前日|前回)[：:]?\s*[¥￥]?([\d,]+(?:\.\d+)?)/);
  let d:number|undefined;
  if(ratio)d=Math.sign(Number(ratio[1]!.replace(/[＋]/g,'+').replace(/[−－]/g,'-').replace('±','')));
  else if(pair)d=Math.sign(Number(pair[1]!.replace(/,/g,''))-Number(pair[2]!.replace(/,/g,'')));
  if(d!==undefined)directions.push(bad?-d:d);
 }
 if(directions.some(d=>d>0)&&directions.some(d=>d<0))return 'mixed';
 if(directions.some(d=>d>0))return 'good';
 if(directions.some(d=>d<0))return 'concern';
 if(directions.length)return /(?:エラー|失敗|不一致)[数：:\s]*0\s*件/.test(text)&&badMetric.test(title)?'healthy':'steady';
 if('current' in opts){const n=opts.current;if(n==null||!Number.isFinite(n))return 'pending';if(opts.previous!=null&&Number.isFinite(opts.previous)){const sign=Math.sign(n-opts.previous)*(badMetric.test(title)?-1:1);return sign>0?'good':sign<0?'concern':'steady';}if(n===0)return badMetric.test(title)?'healthy':'zero';return 'first';}
 if(opts.mood==='up')return badMetric.test(title)?'concern':'good';
 if(opts.mood==='down')return badMetric.test(title)?'good':'concern';
 if(['pending','first','zero','error','recovered','test'].includes(opts.mood||''))return opts.mood as CommentKind;
 const primary=text.split('\n').slice(1).find(line=>metricLabel.test(line)&&!/^[\s■・]*[^：:0-9]+$/.test(line));
 if(primary){if(/未取得|未集計|未確認|記録なし|データ待ち/.test(primary))return 'pending';const m=primary.match(/[：:]\s*[¥￥]?([\d,]+(?:\.\d+)?)\s*(?:人|件|回|円|セッション|クリック|PV)/) || primary.match(/(?:ダウンロード|利用者|登録|売上)\s*[¥￥]?([\d,]+(?:\.\d+)?)/);if(m)return Number(m[1]!.replace(/,/g,''))===0?(badMetric.test(primary)?'healthy':'zero'):'first';}
 if(/未取得|未集計|データ待ち|未確認|確認待ち|取得でき/.test(title))return 'pending';
 if(/日報|レポート|報告|朝刊|集計|まとめ|流入|きのうの数値/.test(title))return 'report';
 if(/利用|起動|使|チェックイン|ガチャ|OCR|生成.*完了|機能/.test(title))return 'activity';
 return 'info';
}
function flatten(value:unknown):string {if(typeof value==='string')return value;if(Array.isArray(value))return value.map(flatten).join('\n');if(value&&typeof value==='object')return Object.entries(value).filter(([k])=>['text','fields','elements','blocks'].includes(k)).map(([,v])=>flatten(v)).join('\n');return '';}
export function contextualComment(text:string,opts:CommentOptions={}):{kind:CommentKind;text:string} {
 const kind=selectCommentKind(text,opts);const bank=commentBank[kind];const day=opts.day||new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});let hash=2166136261;for(const ch of opts.seed||text)hash=Math.imul(hash^ch.charCodeAt(0),16777619);const index=Math.floor(Date.parse(day+'T00:00:00Z')/86400000)||0;
 return {kind,text:bank[((hash>>>0)+index)%bank.length]!};
}
export function applyContextComment<T>(payload:T,opts:CommentOptions={}):T {
 if(!payload||typeof payload!=='object')return payload;const p=payload as Record<string,unknown>;if(typeof p.text!=='string')return payload;
 const isComment=(b:unknown)=>/^(?:今日のひとこと|ひとこと)：/.test(flatten(b).trim());
 const blocks=Array.isArray(p.blocks)?p.blocks.filter(b=>!isComment(b)):undefined;
 const original=p.text.split('\n').filter(l=>!/^(?:今日のひとこと|ひとこと)：/.test(l)).join('\n');
 const evidence=original+'\n'+flatten(blocks);const line='今日のひとこと：'+contextualComment(evidence,opts).text;
 const lines=original.split('\n');lines.splice(1,0,line);
 if(blocks){const pos=blocks.findIndex(b=>b&&typeof b==='object'&&(b as Record<string,unknown>).type==='header');if(blocks.length<50)blocks.splice(pos<0?0:pos+1,0,{type:'context',elements:[{type:'plain_text',text:line}]});else { /* Keep all existing evidence; the text fallback contains the comment. */ }}
 return {...p,text:lines.join('\n'),...(blocks?{blocks}:{})} as T;
}
