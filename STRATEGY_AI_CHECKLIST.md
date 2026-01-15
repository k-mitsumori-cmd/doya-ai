# ドヤ戦略AI 実装チェックリスト

## ✅ Phase 1: サービス定義・基本設定

### 1.0 プラン設計
- [x] プランごとの機能制限を設計
  - GUEST: 基本的な機能のみ、使用制限なし（ゲストIDで識別）
  - FREE: すべての機能、使用制限3回/日
  - PRO: すべての機能、使用制限100回/日
  - ENTERPRISE: すべての機能、使用制限無制限
- [x] プランごとの使用制限を設計
  - FREE: 1日3回まで
  - PRO: 1日100回まで
- [x] プラン設計を `services.ts` に反映

### 1.1 サービス定義
- [x] `SERVICES` 配列にサービスを追加
- [x] 必須フィールドが全て設定されている
- [x] サービスID: `strategy`
- [x] プランの dailyLimit が適切に設定されている

### 1.2 ベータ版サービス対応
- [x] `status: 'active'` を設定（ベータ版ではない）
- [x] ベータ版バッジは不要

## ✅ Phase 2: ナビゲーション・UI統合

### 2.1 ToolSwitcherMenu
- [x] `ToolSwitcherMenu.tsx` の `TOOLS` 配列に追加
- [x] 必須フィールドが設定されている
- [x] アイコンとグラデーションがサービス定義と一致

### 2.2 サイドバー実装
- [x] `StrategySidebar.tsx` を作成
- [x] サイドバーの必須要素が実装されている
- [x] プラン判定ロジックが正しく実装されている
- [x] レスポンシブデザインが実装されている
- [x] LocalStorage で折りたたみ状態を保存

### 2.3 レイアウト実装
- [x] `StrategyAppLayout.tsx` を作成
- [x] モバイル対応（オーバーレイ表示）
- [x] デスクトップ対応（固定表示）
- [x] プラン表示が実装されている

## ✅ Phase 3: ページ実装

### 3.1 メインページ
- [x] `/strategy/page.tsx` を作成
- [x] ダッシュボードUI（TVer風）を実装
- [x] プロジェクト一覧表示
- [x] カテゴリフィルター

### 3.2 作成ページ
- [x] `/strategy/create/page.tsx` を作成
- [x] 入力フォームを実装
- [x] 多層プロンプト設計に基づく生成フロー

### 3.3 詳細ページ
- [x] `/strategy/[id]/page.tsx` を作成
- [x] 戦略データの表示
- [x] 再生成機能

## ✅ Phase 4: API実装

### 4.1 APIエンドポイント
- [x] `/api/strategy/generate` を作成
- [x] 多層プロンプト設計を実装
  - [x] System Prompt
  - [x] Strategy Kernel Prompt
  - [x] Phase Generator Prompt
  - [x] Visualization Prompt
  - [x] External Research Prompt
- [x] 認証チェックを実装
- [x] 使用量チェックを実装
- [x] 日次リセット処理を実装
- [x] エラーハンドリングを実装

### 4.2 プロンプトライブラリ
- [x] `src/lib/strategy/prompts.ts` を作成
- [x] 各プロンプト関数を実装

## ✅ Phase 5: データベース

### 5.1 Prismaスキーマ
- [x] `StrategyProject` モデルを追加
- [x] Userモデルにリレーションを追加
- [x] インデックスを適切に設定

### 5.2 マイグレーション
- [ ] マイグレーションを実行（`npx prisma migrate dev --name add_strategy_ai`）

## ✅ Phase 6: 課金連携（Stripe）

### 6.1 価格ID登録
- [x] `STRIPE_PRICE_IDS` に `strategy` を追加
- [x] `PlanId` 型に `strategy-pro` と `strategy-enterprise` を追加
- [x] `ServiceId` 型に `strategy` を追加
- [x] `getPlanIdFromStripePriceId` にマッピングを追加

### 6.2 Webhook対応
- [x] Webhook処理で `strategy` サービスを処理できることを確認
- [x] `planFromPlanId` 関数が `strategy-pro` と `strategy-enterprise` を処理できることを確認

## ✅ Phase 7: サービス分離

### 7.1 ディレクトリ構成
- [x] `src/app/strategy/` を新規作成
- [x] `src/app/api/strategy/` を新規作成
- [x] 他サービスのディレクトリを変更していない

### 7.2 コンポーネント
- [x] `StrategySidebar.tsx` を新規作成
- [x] `StrategyAppLayout.tsx` を新規作成
- [x] 他サービスのコンポーネントを変更していない

### 7.3 API
- [x] `/api/strategy/` 配下にのみAPIを追加
- [x] 他サービスのAPIを呼び出していない

### 7.4 DB
- [x] サービス専用のテーブル（`StrategyProject`）を使用
- [x] 他サービスのテーブルを直接参照していない

## ✅ Phase 8: テスト

### 8.1 機能テスト
- [ ] 戦略作成フローが正常に動作する
- [ ] 多層プロンプト生成が正常に動作する
- [ ] ダッシュボード表示が正常に動作する
- [ ] 詳細ページ表示が正常に動作する
- [ ] 再生成機能が正常に動作する

### 8.2 プランテスト
- [ ] FREEプランで使用制限が正しく動作する
- [ ] PROプランで使用制限が正しく動作する
- [ ] 日次リセットが正しく動作する

### 8.3 レスポンシブテスト
- [ ] モバイル表示が正常に動作する
- [ ] デスクトップ表示が正常に動作する
- [ ] サイドバーの折りたたみが正常に動作する

### 8.4 エラーハンドリングテスト
- [ ] APIエラーが適切に処理される
- [ ] 使用上限エラーが適切に表示される
- [ ] 認証エラーが適切に処理される

## ✅ Phase 9: デプロイ準備

### 9.1 環境変数
- [x] `GOOGLE_GEMINI_API_KEY` が設定されている（確認済み）
- [ ] Stripe価格IDの環境変数が設定されている（本番環境）

### 9.2 ドキュメント
- [x] 実装が完了
- [ ] 動作確認が完了

## 注意事項

1. **データベースマイグレーション**: 実装完了後、必ずマイグレーションを実行してください
2. **Stripe価格ID**: 本番環境でStripe価格IDを設定してください
3. **動作確認**: デプロイ前にすべての機能をテストしてください
