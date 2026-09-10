# 17サービスの生成画像つきFV本体への更新

## 現在の状態

目標は全17サービスのFV本体・専用画像・演出・操作デモ・新旧比較までの公開。現時点で未完了。公開中のmainはe5a00494（全17サービスの青いオープニング＋バナーのみ新FV）であり、この作業はまだ公開していない。

- 共通のServiceCinematicHeroを作成し、RenewalHeroの対象をバナーから17サービスへ拡張。
- 全17サービス専用の見出し・説明・操作デモ導入文をcinematic-scenes.tsに設定。
- 青いオープニングの後に2.6秒のズームアウト、コピーの段階表示、スクロールによる奥行き変化が始まる。既存の停止・再開・OSモーション軽減に対応。
- 業務別の3ステップをFV直下に表示し、既存のServiceMotionを各サービスの操作デモとして接続。
- 完成画像：既存bannerに加えてseo / interview / persona / hr / kintai / promane / doyaslideの7枚。
- 未生成：doyalist / cunning / sfa / shodan / aio / mensetsu / quote / aishodan / adimageの9枚。
- 8枚目のdoyalistで画像生成ツールが429 usage_limit_reachedを返した。再試行を繰り返していない。
- 残り9枚のGPT Image 2.5 API（別途従量課金）への切替許可を非同期質問で確認中。承認前の有料API実行は行っていない。

## 画像

内蔵image_genで生成。モデルを固定・検証できる引数はない。7枚はすべて1672×941。用途に合う業務のオブジェクトとドヤくんを右側に、HTML見出し用の余白を左側に配置。画像内の数値実績・コピーを使わない。WebPへ変換しpublic/renewal/cinematicに保存。

- prompts.json：全16枚の確定制作指示。
- assets.json：完成した生成元PNGと採用先WebPの対応。
- pending-images.json：未生成の9枚の制作指示。
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
- 本番ビルド成功（SKIP_DB_PUSH=1）。9画像未生成のため、ビルド成功だけでは完了・公開可能と扱わない。
- operation-51-frames.json：全17サービス×3段階の切り替え、ネイティブ画面の読込、横はみ出しなしを実ブラウザで確認。
- スマホ390pxで広告画像デモを拡大し、ダイアログが画面内に収まることとEscapeで閉じることを確認。
- pending-api-jobs.jsonl：承認待ちのGPT Image 2.5 Sunburst・1536×1024・high・9枚のAPI生成計画。dry-runのみで有料呼び出しは未実行。

## 完了前に残っている確認

1. 未生成9画像の制作・目視検査・WebP採用。
2. 全17サービスのPC/スマホ、新しい操作デモ全51ステップ、拡大/閉じる、導線の確認。
3. 全17サービスの比較ページと比較用ルート、旧画像読込、iframeの動作。
4. 最終の型・lint・ビルドと差分確認。
5. remote mainと実際の最新Vercel本番ソースの再照合後、公開。全17公開URLの画像・新FV・演出・比較を確認。

## 参照

- Next.js 14 Dynamic Routes: https://nextjs.org/docs/14/app/building-your-application/routing/dynamic-routes
- GPT Image 2.5 Sunburst API: https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst
