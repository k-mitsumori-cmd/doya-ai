# Notion MCP 設定・設計チェックリスト

このドキュメントは、Notion MCPサーバーの設定と設計を進める際の**不足要素の確認**と**実装手順のチェックリスト**です。

---

## 🔴 不足している要素（未完了項目）

### 1. 設定ファイルの場所
**状態**: ❌ 未確認

**必要な作業**:
- [ ] Cursor MCP設定ファイル（`mcp.json`）の正確な場所を特定
- [ ] macOS環境での標準設定ディレクトリを確認
- [ ] 設定ファイルの優先順位を確認（グローバル vs ワークスペース固有）

**確認コマンド**:
```bash
# 設定ファイルの検索
find ~ -name "mcp.json" 2>/dev/null

# 想定される場所の確認
ls -la ~/.cursor/ 2>/dev/null
ls -la ~/.config/cursor/ 2>/dev/null
ls -la ~/Library/Application\ Support/Cursor/User/ 2>/dev/null
```

**想定される場所**:
- `~/.cursor/mcp.json`
- `~/.config/cursor/mcp.json`
- `~/Library/Application Support/Cursor/User/mcp.json`
- `{workspace}/.cursor/mcp.json`（ワークスペース固有）

---

### 2. Notion API認証情報
**状態**: ❌ 未取得

**必要な作業**:
- [ ] Notion開発者ポータルにアクセス
  - URL: https://www.notion.so/my-integrations
- [ ] 新しいインテグレーションを作成
  - 名前: `Cursor MCP Integration`（任意）
  - ワークスペース: 使用するワークスペースを選択
  - 機能:
    - ✅ コンテンツの読み取り
    - ✅ コンテンツの挿入
    - ✅ コンテンツの更新
    - ✅ コメントの表示・追加
- [ ] Internal Integration Tokenをコピー
  - `secret_`で始まる文字列
  - 安全な場所に一時保存
- [ ] 対象ページに権限付与
  - 操作したいNotionページを開く
  - 「共有」ボタン → インテグレーションを追加
  - 権限: 「編集」または「完全アクセス」

**取得した情報**:
- [ ] Notion API Token: `secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- [ ] 対象ページID: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- [ ] ワークスペース名: `_________________`

---

### 3. 環境変数の設定
**状態**: ⏳ 要設定

**必要な作業**:
- [ ] 環境変数の設定場所を決定
  - オプション1: `~/.zshrc`（推奨、zshを使用している場合）
  - オプション2: `~/.bash_profile`（bashを使用している場合）
- [ ] 環境変数を追加
  ```bash
  export NOTION_API_KEY="secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  ```
- [ ] 環境変数を読み込み
  ```bash
  source ~/.zshrc  # または source ~/.bash_profile
  ```
- [ ] 環境変数の確認
  ```bash
  echo $NOTION_API_KEY
  ```

**設定状況**:
- [ ] 環境変数が設定されている
- [ ] 環境変数が正しく読み込まれている
- [ ] トークンが正しい形式である（`secret_`で始まる）

---

### 4. MCPサーバーパッケージの確認
**状態**: ⏳ 要確認

**必要な作業**:
- [ ] パッケージの存在確認
  ```bash
  npm search @notionhq/notion-mcp-server
  ```
- [ ] パッケージの動作確認
  ```bash
  npx -y @notionhq/notion-mcp-server --help
  ```
- [ ] 環境変数付きでの実行テスト
  ```bash
  NOTION_API_KEY="secret_xxxxx" npx -y @notionhq/notion-mcp-server
  ```

**確認結果**:
- [ ] パッケージが存在する
- [ ] パッケージが正常に実行できる
- [ ] エラーが発生しない

---

### 5. MCP設定ファイルの作成
**状態**: ⏳ 未作成

**必要な作業**:
- [ ] 設定ファイルの場所を特定（上記1.を参照）
- [ ] 設定ファイルを作成または編集
- [ ] 設定内容を記述（下記の設定例を参照）
- [ ] JSON構文をチェック
  ```bash
  cat mcp.json | python3 -m json.tool
  # または
  jq . mcp.json
  ```

**設定ファイルの内容**（環境変数を使用する場合）:
```json
{
  "mcpServers": {
    "notion": {
      "command": "npx",
      "args": [
        "-y",
        "@notionhq/notion-mcp-server"
      ],
      "env": {
        "NOTION_API_KEY": "${NOTION_API_KEY}"
      }
    }
  }
}
```

**作成状況**:
- [ ] 設定ファイルが作成された
- [ ] 設定内容が正しい
- [ ] JSON構文エラーがない

---

### 6. Cursorの再起動と接続テスト
**状態**: ⏳ 未実施

**必要な作業**:
- [ ] Cursor IDEを完全に終了
- [ ] Cursor IDEを再起動
- [ ] 開発者ツールを開く（`Help` > `Toggle Developer Tools` > `Console`）
- [ ] MCP関連のエラーログがないか確認
- [ ] 接続状態を確認

**テスト項目**:
- [ ] MCPサーバーへの接続が成功している
- [ ] エラーログが表示されていない
- [ ] Notionリソースが読み取れる
- [ ] Notionページへの書き込みができる

---

## 🟡 要確認項目（設計に関わる部分）

### 7. 利用可能な機能の確認
**状態**: ⏳ 要調査

**確認すべき項目**:
- [ ] 利用可能なMCPツール（Tools）の一覧
- [ ] 利用可能なリソース（Resources）の一覧
- [ ] プロンプトテンプレートの保存形式
- [ ] データベース操作のサポート範囲

**確認方法**:
- MCPサーバーのドキュメントを確認
- 実際に接続して利用可能なツールを確認
- サンプル操作を実行

---

### 8. セキュリティ設定
**状態**: ⏳ 要設定

**必要な作業**:
- [ ] `.gitignore`に設定ファイルを追加（トークンが含まれる場合）
  ```
  # MCP設定ファイル（トークンが含まれる場合）
  mcp.json
  **/mcp.json
  ```
- [ ] 環境変数の使用方法を決定（推奨: 環境変数）
- [ ] トークンの漏洩防止対策を確認

**設定状況**:
- [ ] `.gitignore`に設定ファイルを追加した
- [ ] トークンが環境変数で管理されている
- [ ] 設定ファイルにトークンが直接記載されていない（環境変数参照を使用）

---

## 🟢 設計仕様（実装時に参照）

### アーキテクチャ
```
Cursor IDE → MCP Client → Notion MCP Server → Notion API → Notion
```

### 設定ファイルの構造
```json
{
  "mcpServers": {
    "notion": {
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"],
      "env": {
        "NOTION_API_KEY": "${NOTION_API_KEY}"
      }
    }
  }
}
```

### 環境変数の設定
```bash
# ~/.zshrc または ~/.bash_profile に追加
export NOTION_API_KEY="secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

---

## 📋 実装手順の簡易チェックリスト

### 準備フェーズ
- [ ] 1.1 Notion開発者ポータルにアクセス
- [ ] 1.2 インテグレーションを作成
- [ ] 1.3 APIトークンを取得
- [ ] 1.4 対象ページに権限付与
- [ ] 1.5 環境変数を設定

### 設定フェーズ
- [ ] 2.1 設定ファイルの場所を特定
- [ ] 2.2 設定ファイルを作成
- [ ] 2.3 設定内容を記述
- [ ] 2.4 JSON構文をチェック
- [ ] 2.5 セキュリティ設定（.gitignore）

### テストフェーズ
- [ ] 3.1 Cursorを再起動
- [ ] 3.2 接続テスト
- [ ] 3.3 読み取りテスト
- [ ] 3.4 書き込みテスト
- [ ] 3.5 エラーログの確認

---

## 🔍 トラブルシューティング（よくある問題）

### 問題1: MCPサーバーに接続できない
**チェック項目**:
- [ ] 設定ファイルのパスが正しいか
- [ ] JSON構文エラーがないか
- [ ] パッケージが存在するか
- [ ] Cursorを再起動したか

### 問題2: 認証エラー
**チェック項目**:
- [ ] トークンが正しい形式か（`secret_`で始まる）
- [ ] 環境変数が設定されているか
- [ ] 環境変数が正しく読み込まれているか
- [ ] トークンが有効か（再生成が必要な場合）

### 問題3: ページが見つからない
**チェック項目**:
- [ ] ページにインテグレーションの権限が付与されているか
- [ ] ページIDが正しいか
- [ ] ワークスペースが一致しているか

---

## 📊 進捗サマリー

| 項目 | 状態 | 優先度 |
|------|------|--------|
| 1. 設定ファイルの場所特定 | ❌ 未完了 | 高 |
| 2. Notion API認証情報取得 | ❌ 未完了 | 高 |
| 3. 環境変数の設定 | ⏳ 要設定 | 高 |
| 4. MCPサーバーパッケージの確認 | ⏳ 要確認 | 高 |
| 5. MCP設定ファイルの作成 | ⏳ 未作成 | 高 |
| 6. Cursorの再起動と接続テスト | ⏳ 未実施 | 高 |
| 7. 利用可能な機能の確認 | ⏳ 要調査 | 中 |
| 8. セキュリティ設定 | ⏳ 要設定 | 中 |

**次のアクション**: 
1. 設定ファイルの場所を特定する
2. Notion APIトークンを取得する
3. 環境変数を設定する

---

**更新日**: 2025-01-XX
**バージョン**: 1.0.0

