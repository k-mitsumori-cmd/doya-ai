# 📚 ドヤAI 開発リファレンス

新しいサービスを追加する際に参照するドキュメントです。

## 📖 メインドキュメント

**👉 [DEVELOPMENT_REFERENCE.md](./DEVELOPMENT_REFERENCE.md)** - **完全開発ガイド（統合版）**

全ての開発情報を1つのドキュメントにまとめた統合版です。以下の内容が含まれています：

- ✅ 新サービス追加手順
- ✅ 実装パターン集（API、ファイルアップロード、GCS、プラン管理など）
- ✅ デザインシステム・UIガイドライン
- ✅ サイドバー実装パターン
- ✅ サービス分離ルール
- ✅ アニメーション仕様
- ✅ ベータ版サービス管理
- ✅ デプロイ手順・トラブルシューティング

## 📁 個別ドキュメント（参考用）

以下のドキュメントは参考用として残していますが、メインの情報は上記の統合ドキュメントを参照してください。

| ファイル | 内容 | 状態 |
|----------|------|------|
| [development-guide.md](./development-guide.md) | 開発ガイド（個別版） | 統合済み |
| [implementation-patterns.md](./implementation-patterns.md) | 実装パターン集（個別版） | 統合済み |
| [design-system.md](./design-system.md) | デザインシステム（個別版） | 統合済み |
| [sidebar-pattern.md](./sidebar-pattern.md) | サイドバー実装パターン（個別版） | 統合済み |
| [service-isolation.md](./service-isolation.md) | サービス分離ルール（個別版） | 統合済み |
| [animation-spec.md](./animation-spec.md) | アニメーション仕様（個別版） | 統合済み |
| [beta-services.md](./beta-services.md) | ベータ版サービス管理（個別版） | 統合済み |

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

