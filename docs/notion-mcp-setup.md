# Notion MCP設定・設計ドキュメント

## 概要

Notion MCP（Model Context Protocol）サーバーをCursorに接続し、CursorからNotionを編集・操作できるようにするための設定と設計ドキュメントです。

## 現在の課題と不足している要素

### 1. 設定ファイルの場所が不明確
- CursorのMCP設定ファイル（`mcp.json`）の正確な場所が特定できていない
- macOS環境での標準的な設定ディレクトリの確認が必要

### 2. Notion APIトークンが未取得
- Notion Internal Integration Tokenが必要
- Notionワークスペースへの権限設定が必要

### 3. MCPサーバーパッケージの確認
- `@notionhq/notion-mcp-server`パッケージの存在確認
- パッケージのバージョンと互換性の確認

### 4. 環境変数の設定方法が不明
- 環境変数の設定場所（グローバル or プロジェクト固有）
- セキュアなトークン管理方法

## 必要な設定要素

### 1. Notion側の設定

#### ステップ1: Notionインテグレーションの作成
1. [Notion開発者ポータル](https://www.notion.so/my-integrations)にアクセス
2. 「新しいインテグレーション」をクリック
3. 以下の情報を設定：
   - **名前**: `Cursor MCP Integration`（任意）
   - **ワークスペース**: 使用するNotionワークスペースを選択
   - **機能**: 
     - ✅ コンテンツの読み取り
     - ✅ コンテンツの挿入
     - ✅ コンテンツの更新
     - ✅ コメントの表示・追加
4. 「送信」をクリックしてインテグレーションを作成
5. **Internal Integration Token**をコピー（`secret_`で始まる文字列）

#### ステップ2: Notionページへの権限付与
1. 操作したいNotionページを開く
2. 右上の「共有」ボタンをクリック
3. 作成したインテグレーションを検索して追加
4. 適切な権限（「編集」または「完全アクセス」）を付与

### 2. Cursor側の設定

#### 設定ファイルの場所（推測）
CursorのMCP設定ファイルは以下のいずれかの場所にある可能性があります：

```
# オプション1: Cursor設定ディレクトリ
~/.cursor/mcp.json
~/.config/cursor/mcp.json

# オプション2: アプリケーションサポートディレクトリ
~/Library/Application Support/Cursor/User/mcp.json

# オプション3: ワークスペース固有の設定
{workspace}/.cursor/mcp.json
```

#### 設定ファイルの構造

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
        "NOTION_API_KEY": "secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

### 3. 環境変数による設定（推奨）

より安全な方法として、環境変数を使用：

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

環境変数の設定（`~/.zshrc` または `~/.bash_profile`）：
```bash
export NOTION_API_KEY="secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### 4. ヘッダー形式での設定（代替案）

一部の実装では、ヘッダー形式での設定が可能：

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
        "OPENAPI_MCP_HEADERS": "{\"Authorization\":\"Bearer secret_XXXXXX\",\"Notion-Version\":\"2022-06-28\"}"
      }
    }
  }
}
```

## 設計仕様

### アーキテクチャ

```
┌─────────────────┐
│   Cursor IDE    │
│                 │
│  ┌───────────┐  │
│  │ MCP Client│  │
│  └─────┬─────┘  │
└────────┼────────┘
         │ MCP Protocol
         │ (JSON-RPC)
         ▼
┌─────────────────┐
│ Notion MCP      │
│ Server          │
│ (npx実行)       │
└─────┬───────────┘
      │ Notion API
      │ (REST)
      ▼
┌─────────────────┐
│ Notion API      │
│ (api.notion.com)│
└─────────────────┘
```

### 利用可能な機能（期待される）

1. **ページ操作**
   - ページの作成
   - ページの読み取り
   - ページの更新
   - ページの削除

2. **データベース操作**
   - データベースのクエリ
   - データベースの更新
   - エントリの追加・編集・削除

3. **ブロック操作**
   - ブロックの追加
   - ブロックの更新
   - ブロックの削除

4. **コメント操作**
   - コメントの追加
   - コメントの読み取り

### セキュリティ考慮事項

1. **トークン管理**
   - Internal Integration Tokenは機密情報
   - 環境変数またはセキュアな設定ファイルで管理
   - `.gitignore`に設定ファイルを追加

2. **権限管理**
   - 必要最小限の権限のみを付与
   - 定期的に権限を見直し

3. **ネットワーク**
   - Notion APIへの通信はHTTPS
   - ファイアウォール設定の確認

## 実装手順

### ステップ1: パッケージの確認

```bash
# Notion MCPサーバーパッケージの存在確認
npm search @notionhq/notion-mcp-server

# または直接インストール確認
npx -y @notionhq/notion-mcp-server --version
```

### ステップ2: 設定ファイルの作成・編集

1. Cursorの設定ディレクトリを特定
2. `mcp.json`ファイルを作成または編集
3. 上記の設定構造を適用

### ステップ3: 環境変数の設定（オプション）

```bash
# ~/.zshrc または ~/.bash_profile に追加
echo 'export NOTION_API_KEY="secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"' >> ~/.zshrc
source ~/.zshrc
```

### ステップ4: Cursorの再起動

設定ファイルを変更した後、Cursorを完全に再起動する必要があります。

### ステップ5: 接続テスト

Cursorで以下の操作を試行：
1. MCPサーバーへの接続確認
2. Notionページの読み取りテスト
3. Notionページへの書き込みテスト

## トラブルシューティング

### 問題1: MCPサーバーに接続できない

**原因**:
- 設定ファイルのパスが間違っている
- パッケージが見つからない
- 権限の問題

**解決策**:
1. Cursorのログを確認（`Help` > `Toggle Developer Tools` > `Console`）
2. パッケージを手動でインストール: `npm install -g @notionhq/notion-mcp-server`
3. 設定ファイルのパスと内容を再確認

### 問題2: Notion API認証エラー

**原因**:
- トークンが無効
- トークンの形式が間違っている
- トークンに適切な権限がない

**解決策**:
1. Notion開発者ポータルでトークンを再生成
2. トークンの形式を確認（`secret_`で始まる）
3. ページにインテグレーションの権限が付与されているか確認

### 問題3: ページが見つからない

**原因**:
- ページにインテグレーションの権限が付与されていない
- ページIDが間違っている

**解決策**:
1. Notionページの「共有」設定を確認
2. インテグレーションをページに追加
3. 適切な権限を付与

## 参考リソース

- [Notion MCP公式ドキュメント](https://www.notion.com/ja/help/notion-mcp)
- [Notion API ドキュメント](https://developers.notion.com/)
- [Notion開発者ポータル](https://www.notion.so/my-integrations)
- [Model Context Protocol 仕様](https://modelcontextprotocol.io/)

## 次のステップ

1. ✅ 設定ファイルの場所を特定
2. ✅ Notion APIトークンを取得
3. ⏳ MCP設定ファイルを作成・編集
4. ⏳ 接続テストを実行
5. ⏳ 基本的な操作をテスト（読み取り、書き込み）

## 更新履歴

- 2025-01-XX: 初版作成

