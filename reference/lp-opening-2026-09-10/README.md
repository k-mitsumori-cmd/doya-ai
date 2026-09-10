# 全17サービス：青い幕と縦書き筆文字のオープニング

## 実装

ブランドブルーの全面表示 → 右列・左列の順に筆文字が現れる → 左右に幕が開く → FVの登場演出へ。書き出しから2.2秒で開幕、3.15秒でオーバーレイを除去。フォント待ちは最大350ms。幕が開き始めるまで既存FVのCSSアニメーションと操作デモを停止する。

対象：banner / seo / interview / persona / hr / kintai / doyalist / promane / doyaslide / cunning / sfa / shodan / aio / mensetsu / quote / aishodan / adimage。各サービス専用の2列コピーは `src/components/lp/renewal/OpeningCurtain.tsx` に集約。総合トップおよびログイン後のアプリには追加しない。

- スキップ、Escape、Tabの操作、再生ボタン、動きの停止・再開。
- 演出中は背面をinertにし、スクロールを一時停止。終了・スキップ・アンマウントで元に戻す。
- OSの動きを減らす設定では演出を省略。アンカーリンクやスクロール復元時も本文を優先する。
- JavaScript無効時のnoscriptスタイルで幕を除去。フォント失敗時もページを止めない。
- 比較のbefore・after保存画像は変更しない。保存画像の日付を明記し、17サービスの現行LPを開く導線を更新。ファイルとして開かれた比較HTMLは、動作するHTTPS比較ページへ移動する。

## 書体

書家・片岡裕司氏の原字をもとにしたYuji Syukuを使用。SIL Open Font License 1.1。

- 公式原典：https://github.com/Kinutafontfactory/Yuji
- 配布元：https://github.com/google/fonts/tree/main/ofl/yujisyuku
- ライセンス同梱：`public/renewal/fonts/OFL-Yuji.txt`
- 使用98文字をWOFF2にサブセット、縦書きのOpenType機能を維持。56,804 bytes。変更版の内部名はDoya Opening Brush。

## 確認記録

- `services-browser.json`：全17ルートの専用コピー、スキップ後の幕の除去・inert解除・h1が1件・横はみ出しなし。
- PC 1280×900、スマホ390×844、小型320×568、横向き844×390の実ブラウザ表示。
- `small-mobile.json`：最初の7サービスを320×568で追加確認。文字がサービス署名より16px以上離れて収まる。フォント確認は初期DOMの瞬間値で、待機中はfalseになりうる。実際の筆文字描画はPC・スマホのスクリーンショットで確認。
- 実ブラウザでTab→スキップにフォーカス、Escape→幕が消え再生ボタンへフォーカス復帰、動きの停止→再開で幕が勝手に再開しないことを確認。
- 自動の幕開きからFVへの切り替え、再生ボタン、スキップ後にタイマーで幕が復活しないことを確認。
- OSのモーション軽減はCSSとmatchMedia分岐の実装確認。OS設定変更による実機検証は行っていない。
- Next.js本番ビルド、TypeScript、変更TSXのESLintを実行。公開結果はpublication.jsonに記録。

既存の通知・監視関連の本番ソースを保持した0f64dbc4を起点とし、API・DB・通知関連の変更は行っていない。
