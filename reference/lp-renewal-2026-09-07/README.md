# ドヤマーケAI LPリニューアル — 2026-09-07

## 対象と承認範囲

総合トップと17サービスの公開LP。ユーザーから「17サイトを完成させて公開まで」の指示を受け、既存本番ドメイン doya-ai.surisuta.jp に反映する。

対象：banner / seo / interview / persona / hr / kintai / doyalist / promane / doyaslide / cunning / sfa / shodan / aio / mensetsu / quote / aishodan / adimage。

4サービス（mensetsu / quote / aishodan / adimage）は一覧除外とLPのnoindexを解除。認証後の操作画面、課金ロジック、利用上限、DBスキーマは変更しない。

## 実装

- 既存サービス定義を継続使用し、共通LPキットをリニューアル。
- オリジナルのドヤくんを参照し、Codex内蔵 image_gen で3素材を生成。原稿は image-prompts.json。公開用は public/renewal/ のWebP、元PNGは納品素材フォルダに保持。
- 操作イメージを大きく見せるヒーロー、青のグラデーション、3ステップの切り替え、業務別サービス絞り込み、資料カードのhover、スクロール表示、浮遊アニメーション。
- キーボード操作、prefers-reduced-motion、ページ内の動作停止ボタンに対応。常時点滅は使用しない。停止中も新しく表示される内容が薄くならないようにする。
- 資料3点（サービス紹介／はじめ方／導入チェックリスト）は登録不要のHTML。17サービスを収録し、印刷・PDF保存可能。
- 相談キャンペーンは自動で画面を覆わず、利用者が案内ボタンから既存の相談フォームを開く。フォームの公開先を実際に確認し、キャンペーンの閉じた状態や読み込み成否に依存しないリンクとする。
- 未ログイン時のseo/interview/persona/cunningはアプリのサイドバーを除去。認証済みユーザーには既存アプリ枠を維持。
- FAQの料金・利用枠はservices.tsとUNIFIED_PRO_PRICEから参照。廃止したライト／スターター表記、誤った使い放題表記を修正。
- サービスアイコンはApp Routerのicon.pngとpublic同名パスが衝突しないよう、公開用のWebPをpublic/renewal/iconsへ配置。

## 検証

- tsc --noEmit：エラー0。
- SKIP_DB_PUSH=1 npm run build：本番ビルド。DB反映は実行しない。
- verify-interactions.cjs：手順クリック、矢印/Homeキー、カードhover、reduced motion、停止、FAQ、17サービス表示、営業6サービス絞り込み、17アイコンのデコード、18ページのモバイル横はみ出しとH1数、資料3点の17項目、JavaScript例外を確認。
- 本番検証時は DOYA_QA_URL=https://doya-ai.surisuta.jp node reference/lp-renewal-2026-09-07/verify-interactions.cjs。
- 実際の課金や生成APIはLPの表示・操作検証に含まない。

## 新旧比較

変更前の36組（18ページ×PC/スマートフォン）を保存済み。元のPNG・ハッシュ・内部スクロール記録は変更しない。

本番公開後に同条件で36組を撮影し、build-comparison.cjsにbefore/afterの格納先を指定して公開用比較ビューを作成する。公開版はWebP/JPEGに最適化。元のPNGは比較資料フォルダに保持する。

公開比較ビュー：/renewal-comparison/index.html（並列、スライダー、ページ全体の3モード）。

## 資料の更新

リポジトリルートで python3 reference/lp-renewal-2026-09-07/build-resources.py を実行すると、現在のservices.tsから資料を再生成する。生成ファイルはpublic/resources/doya-aiに配置される。

## 復旧

変更前のソースは f3e803d4。変更前の本番デプロイは doya-95m1vsl77-surisutas-projects.vercel.app（着手時にReady・Productionを確認）。必要な場合はVercelの対象プロジェクトと現状を再確認してロールバックする。
