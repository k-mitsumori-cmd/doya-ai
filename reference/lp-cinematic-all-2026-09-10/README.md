# 17サービスの生成画像つきFV本体への更新

## 現在の状態

全17サービスのFV本体・専用画像・演出・操作デモ・新旧比較を実装。2026年9月10日、残り9枚も内蔵image_genで生成でき、専用画像17枚が揃った。ローカル最終検証完了。本番反映結果はpublication.jsonに記録する。

- 共通のServiceCinematicHeroを作成し、RenewalHeroの対象をバナーから17サービスへ拡張。
- 全17サービス専用の見出し・説明・操作デモ導入文をcinematic-scenes.tsに設定。
- 青いオープニングの後に2.6秒のズームアウト、コピーの段階表示、スクロールによる奥行き変化が始まる。既存の停止・再開・OSモーション軽減に対応。
- 業務別の3ステップをFV直下に表示し、既存のServiceMotionを各サービスの操作デモとして接続。
- 完成画像：既存bannerと、内蔵image_genによる新規16枚。全17サービスに専用画像を接続済み。
- 未生成：0枚。internal-final-assets.jsonに後半9枚の原本・採用先・寸法・容量を記録。
- 8枚目のdoyalistで画像生成ツールが429 usage_limit_reachedを返した。再試行を繰り返していない。
- ユーザーから「APIは決して使わず内部の画像生成」と明示指示。API代替案は撤回し、内蔵機能のみ使用。API生成・APIキー読込・課金リセットの実行は一切なし。内蔵機能の再確認で成功し、9枚すべて制作した。

## 画像

内蔵image_genで生成。モデルを固定・検証できる引数はない。新規16枚はすべて1672×941。用途に合う業務のオブジェクトとドヤくんを右側に、HTML見出し用の余白を左側に配置。画像内の数値実績・コピーを使わない。WebPへ変換しpublic/renewal/cinematicに保存。

- prompts.json：全16枚の確定制作指示。
- assets.json：完成した生成元PNGと採用先WebPの対応。
- pending-images.json：未生成0枚（空配列）。全16枚の制作指示はprompts.jsonに保持。
- 生成原本はCodexのgenerated_imagesに保持し、採用アセットはリポジトリ内に保存。

## 比較

public/renewal-comparison/cinematic.htmlに17サービスのセレクター、9月7日/8日の旧版切替、PC/スマホ切替を実装。左は保存画像、右は現在のLPと同じコンポーネントを使う/renewal-preview/[service]。左右独立に全体をスクロールできる。

比較用ルートは認証後のアプリ画面をマウントせず、ログイン状態によらず公開LPを表示。noindexとcanonicalを付与。既存のDENYを全体では変更せず、新しい比較用ルートに限りSAMEORIGINとframe-ancestors 'self'を許可する。従来のbanner-cinematic.htmlと保存済みbefore/after画像は保持。

## 関連の修正

ドヤAIOの「ログインして診断を始める」がCTA=#startを参照して同じ節に戻っていたため、/auth/signin?callbackUrl=/aioへ変更。その他のログイン先・料金・利用上限は既存のpropsとサービスレジストリを継承。

## 検証

- desktop-partial.json：画像が揃った8サービスの1280×900表示。画像読込、h1が1件、横はみ出しなし、CTAのhref。
- mobile-partial.json：同じ8サービスの390×844表示。画像読込、見出しの収まり、横はみ出しなし。
- seo-mobile.png / doyaslide-desktop.png / comparison-seo-desktop.png：実ブラウザの表示記録。
- 変更したTSXのESLint成功、TypeScript成功。
- 先行実装の本番ビルド成功（SKIP_DB_PUSH=1）。全画像の採用・スマホの3件の位置調整後の最終ビルド・型チェック・ESLintも成功。
- operation-51-frames.json：全17サービス×3段階の切り替え、ネイティブ画面の読込、横はみ出しなしを実ブラウザで確認。
- preview-http.json：全17比較用ルートのHTTP 200、サービス固有FV、h1が1件、SAMEORIGIN・noindex・canonicalを確認。旧版2種類×端末2種類×17サービスの保存画像68件が存在。AIOのログイン導線もHTMLで確認。これは未生成9枚のFV画像の表示確認とは別。
- スマホ390pxで広告画像デモを拡大し、ダイアログが画面内に収まることとEscapeで閉じることを確認。
- pending-api-jobs.jsonl：撤回済みのAPI代替案の履歴。実行禁止。dry-runのみで有料呼び出しは未実行。

## 公開前後の検証項目

1. 全17枚の生成・目視検査・WebP採用済み。remaining-nine-browser.jsonに後半9サービスのPC1280px／スマホ390px検証を記録。スマホでAIO・見積もり・AI商談の右端の切れを調整。
2. PC/スマホ全17サービスの画像読込・h1・横はみ出し確認済み。操作デモ51ステップの既存検証に影響するコード変更なし。motion-final.jsonで開幕中のFV停止、開幕後のズーム完了、再生ボタンの動作を確認。
3. comparison-17-browser.jsonで全17サービスの旧画像とiframe内のサービスID・見出しを確認。local-public-routes.jsonで全17公開用ルートのHTTP200・固有FV・画像ハッシュ一致を確認。ローカルNextAuth秘密値の未設定を一時的なローカル専用値で補い、認証設定の500を解消して匿名LPを検証した。実認証・本番秘密値は使っていない。
4. 最終の型・lint・ビルド・差分確認成功。
5. remote mainと実際の最新Vercel本番ソースの再照合後、公開。全17公開URLの画像・新FV・演出・比較を確認。

## 参照

- Next.js 14 Dynamic Routes: https://nextjs.org/docs/14/app/building-your-application/routing/dynamic-routes
- GPT Image 2.5 Sunburst API: https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst
