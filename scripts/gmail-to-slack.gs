/**
 * 受信メール → Slack 通知（Google Apps Script）
 * ============================================
 * info@surisuta.jp などに届いたお問い合わせメールを、ドヤマーケAI の
 * /api/inbound-email に転送して Slack へ流す。
 *
 * なぜ Apps Script か:
 *   受信箱を外部から読みに行く方式（サービスアカウント＋ドメイン全体の委任）は、
 *   認可が切れた瞬間に**また無音で止まる**。2026-08 の障害と同じ壊れ方になる。
 *   Apps Script はご自身の Google アカウント権限で動くので、委任設定が要らず、
 *   止まったときも Apps Script の実行履歴に残る。
 *
 * ----------------------------------------------------------------
 * 設置手順（5分）
 * ----------------------------------------------------------------
 * 1. https://script.google.com/ を開き「新しいプロジェクト」
 * 2. このファイルの中身を全部貼り付ける
 * 3. 下の SECRET を、Vercel の INBOUND_EMAIL_SECRET と同じ値に書き換える
 * 4. 「実行」で run() を1回動かし、Googleの権限確認を承認する
 *    （初回は過去メールを拾わないよう、直近10分のみが対象）
 * 5. 左メニュー「トリガー」→「トリガーを追加」
 *      実行する関数: run / イベントのソース: 時間主導型
 *      時間ベースのタイマー: 分ベース / 5分おき
 * 6. 自分宛にテストメールを送り、Slackに届くことを確認する
 * ----------------------------------------------------------------
 */

// ⚠️ Vercel の INBOUND_EMAIL_SECRET と同じ値にすること
var SECRET = 'ここに INBOUND_EMAIL_SECRET を貼る';
var ENDPOINT = 'https://doya-ai.surisuta.jp/api/inbound-email';

// 監視するアドレス。ここに宛てられたメールだけ通知する
var WATCH = ['info@surisuta.jp', 'support@surisuta.jp'];

// 何分前までを対象にするか（トリガー間隔より少し長めにして取りこぼしを防ぐ）
var LOOKBACK_MINUTES = 10;

function run() {
  var props = PropertiesService.getScriptProperties();
  var query = 'newer_than:1d (' + WATCH.map(function (a) { return 'to:' + a; }).join(' OR ') + ')';
  var threads = GmailApp.search(query, 0, 50);
  var cutoff = Date.now() - LOOKBACK_MINUTES * 60 * 1000;
  var sent = 0;

  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    for (var j = 0; j < messages.length; j++) {
      var m = messages[j];
      if (m.getDate().getTime() < cutoff) continue;

      // 一度通知したメッセージは二度送らない
      var key = 'sent_' + m.getId();
      if (props.getProperty(key)) continue;

      // 自分が送ったメール（返信・自動送信）は通知しない
      var from = m.getFrom();
      if (from.indexOf('noreply@surisuta.jp') !== -1) continue;

      var payload = {
        messageId: m.getId(),
        from: from,
        to: m.getTo(),
        subject: m.getSubject(),
        body: m.getPlainBody().slice(0, 1500),
        receivedAt: m.getDate().toISOString(),
        link: 'https://mail.google.com/mail/u/0/#inbox/' + threads[i].getId()
      };

      try {
        var res = UrlFetchApp.fetch(ENDPOINT, {
          method: 'post',
          contentType: 'application/json',
          headers: { 'x-inbound-secret': SECRET },
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        });
        if (res.getResponseCode() === 200) {
          props.setProperty(key, '1');
          sent++;
        } else {
          // ⚠️ ここで黙って握り潰すと、また「通知が来ないことに気づけない」状態になる
          console.error('通知に失敗: ' + res.getResponseCode() + ' ' + res.getContentText());
        }
      } catch (e) {
        console.error('通知に失敗: ' + e);
      }
    }
  }
  console.log('通知したメール: ' + sent + '件');
}
