# 📚 ドヤAI 開発リファレンス

新しいサービスを追加する際に参照するドキュメント集です。

## ドキュメント一覧

| ファイル | 内容 |
|----------|------|
| [development-guide.md](./development-guide.md) | **開発ガイド（メイン）** - 新サービス追加手順・デプロイ手順・検索系API活用 |
| [implementation-patterns.md](./implementation-patterns.md) | **実装パターン集** - API・ファイルアップロード・GCS・プラン管理などの実装例 |
| [design-system.md](./design-system.md) | デザインシステム・UIガイドライン |
| [sidebar-pattern.md](./sidebar-pattern.md) | サイドバー実装パターン |
| [service-isolation.md](./service-isolation.md) | サービス分離ルール（他機能に影響を与えない） |
| [animation-spec.md](./animation-spec.md) | アニメーション仕様（Party Mode / Minimal） |
| [beta-services.md](./beta-services.md) | 製作中サービス（ベータ版）管理ガイド |

## クイックスタート（新サービス追加）

```bash
# 1. サービス定義を追加
#    → src/lib/services.ts の SERVICES 配列に追加

# 2. ページを作成
#    → src/app/<service-id>/page.tsx

# 3. サイドバーを作成（既存パターンをコピー）
#    → src/components/<Service>Sidebar.tsx
#    参考: InterviewSidebar.tsx（最新実装例）

# 4. レイアウトを作成
#    → src/components/<Service>AppLayout.tsx
#    参考: InterviewAppLayout.tsx（最新実装例）

# 5. APIを作成
#    → src/app/api/<service-id>/...
#    参考: implementation-patterns.md の「API実装パターン」

# 6. プラン管理を実装
#    → UserServiceSubscription で管理
#    参考: implementation-patterns.md の「プラン管理パターン」

# 7. デプロイ（変更を反映）
#    → development-guide.md の「デプロイ手順」を参照
```

## 原則

1. **サービス分離**: 他サービスのAPI/DB/課金に絶対に触れない
2. **共通部品活用**: ToolSwitcherMenu, 認証, 決済は共通
3. **デザイン統一**: CSS変数・Tailwindテーマを使用
4. **アニメーション統一**: Party Mode対応
5. **外部API活用**: SerpAPI, Sora APIなどの検索系APIを積極的に活用

## デプロイ

変更を本番環境に反映する方法：

- **詳細**: [development-guide.md](./development-guide.md#デプロイ手順) の「デプロイ手順」セクション
- **手順**: `git push origin main` でVercelが自動デプロイ
- **確認**: Vercelダッシュボードでビルドログを確認

---

*最終更新: 2026年1月*

