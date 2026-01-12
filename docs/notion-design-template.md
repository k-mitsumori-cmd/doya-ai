# Notion MCP 設計ドキュメントテンプレート

このドキュメントは、Notionページ上で設計を記載する際のテンプレート構造です。Notionのページ構造に対応した形式で記載してください。

---

## 📋 プロジェクト概要

### 目的
- CursorからNotionを編集・操作できるようにする
- AIアシスタントを活用してNotionの作業を効率化する
- テンプレートプロンプトの管理と追加を自動化する

### 対象範囲
- Notion MCPサーバーの設定
- Cursor IDEとの統合
- Notion APIの活用

### 前提条件
- ✅ Notionアカウントを持っている
- ✅ Cursor IDEをインストール済み
- ✅ インターネット接続が利用可能
- ⏳ Notion APIトークンを取得する必要がある
- ⏳ MCP設定ファイルの場所を特定する必要がある

---

## 🏗️ アーキテクチャ設計

### システム構成図

```
┌─────────────────────────────────────────┐
│          Cursor IDE                     │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │      MCP Client                 │   │
│  │  (JSON-RPC プロトコル)          │   │
│  └──────────────┬──────────────────┘   │
└─────────────────┼───────────────────────┘
                  │
                  │ MCP Protocol
                  │ (JSON-RPC over stdio)
                  │
┌─────────────────▼───────────────────────┐
│    Notion MCP Server                    │
│    (@notionhq/notion-mcp-server)        │
│    - npxで実行                          │
│    - 環境変数でトークン管理             │
└──────────────┬──────────────────────────┘
               │
               │ Notion API
               │ (REST API over HTTPS)
               │
┌──────────────▼──────────────────────────┐
│         Notion API                      │
│    (api.notion.com)                     │
│                                         │
│  - ページの読み書き                     │
│  - データベース操作                     │
│  - ブロック操作                         │
│  - コメント操作                         │
└─────────────────────────────────────────┘
```

### データフロー

1. **リクエスト**: Cursor IDE → MCP Client → MCP Server
2. **認証**: MCP Server → Notion API（Bearer Token）
3. **処理**: Notion API → ページ・データベース操作
4. **レスポンス**: Notion API → MCP Server → MCP Client → Cursor IDE

---

## 🔧 設定要素と不足している項目

### ✅ 確認済み項目

- [x] Notion MCPサーバーパッケージの存在確認（`@notionhq/notion-mcp-server`）
- [x] 基本的な設定構造の理解
- [x] Notion APIの基本的な使用方法

### ⚠️ 不足している項目・未確認項目

#### 1. 設定ファイルの場所
- [ ] Cursor MCP設定ファイル（`mcp.json`）の正確な場所
- [ ] macOS環境での標準設定ディレクトリ
- [ ] 設定ファイルの優先順位（グローバル vs ワークスペース固有）

**確認方法**:
```
# 確認コマンド例
find ~ -name "mcp.json" 2>/dev/null
ls -la ~/.cursor/
ls -la ~/.config/cursor/
ls -la ~/Library/Application\ Support/Cursor/
```

#### 2. Notion API認証情報
- [ ] Notion Internal Integration Tokenの取得
- [ ] Notionワークスペースでのインテグレーション作成
- [ ] 対象ページへの権限付与

**必要な情報**:
- Notion Internal Integration Token（`secret_`で始まる）
- 対象とするNotionページ/データベースのID
- 必要な権限の範囲（読み取り、書き込み、コメント）

#### 3. 環境変数の設定方法
- [ ] 環境変数の設定場所（`~/.zshrc` vs `~/.bash_profile`）
- [ ] 環境変数の読み込み方法（Cursor再起動の必要性）
- [ ] セキュアなトークン管理方法（環境変数 vs 設定ファイル）

#### 4. MCPサーバーの動作確認
- [ ] パッケージの実行可能確認（`npx -y @notionhq/notion-mcp-server --help`）
- [ ] 接続テスト方法
- [ ] エラーログの確認方法

#### 5. 実装詳細
- [ ] 利用可能なMCPツール（Tools）の一覧
- [ ] 利用可能なリソース（Resources）の一覧
- [ ] プロンプトテンプレートの保存形式

---

## 📝 実装手順（詳細チェックリスト）

### Phase 1: 準備フェーズ

#### 1.1 Notion側の準備

- [ ] **ステップ1**: Notion開発者ポータルにアクセス
  - URL: https://www.notion.so/my-integrations
  - 必要なアカウントでログイン

- [ ] **ステップ2**: 新しいインテグレーションを作成
  - 「新しいインテグレーション」をクリック
  - 名前: `Cursor MCP Integration`（任意）
  - ワークスペース: 使用するワークスペースを選択
  - 機能選択:
    - ✅ コンテンツの読み取り
    - ✅ コンテンツの挿入
    - ✅ コンテンツの更新
    - ✅ コメントの表示
    - ✅ コメントの追加
  - 「送信」をクリック

- [ ] **ステップ3**: Internal Integration Tokenをコピー
  - `secret_`で始まるトークンをコピー
  - 安全な場所に一時保存（後で環境変数に設定）

- [ ] **ステップ4**: 対象ページに権限付与
  - 操作したいNotionページを開く
  - 右上の「共有」ボタンをクリック
  - 作成したインテグレーションを検索して追加
  - 権限: 「編集」または「完全アクセス」を選択

#### 1.2 Cursor側の準備

- [ ] **ステップ1**: 設定ファイルの場所を特定
  ```bash
  # 確認コマンドを実行
  find ~ -name "mcp.json" 2>/dev/null
  ls -la ~/.cursor/ 2>/dev/null
  ls -la ~/.config/cursor/ 2>/dev/null
  ls -la ~/Library/Application\ Support/Cursor/User/ 2>/dev/null
  ```

- [ ] **ステップ2**: 環境変数の設定（推奨方法）
  ```bash
  # ~/.zshrc に追加
  echo 'export NOTION_API_KEY="secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"' >> ~/.zshrc
  source ~/.zshrc
  
  # 確認
  echo $NOTION_API_KEY
  ```

- [ ] **ステップ3**: MCPパッケージの動作確認
  ```bash
  # パッケージの存在確認
  npx -y @notionhq/notion-mcp-server --help
  
  # または直接実行テスト
  NOTION_API_KEY="secret_xxxxx" npx -y @notionhq/notion-mcp-server
  ```

### Phase 2: 設定フェーズ

#### 2.1 MCP設定ファイルの作成・編集

- [ ] **ステップ1**: 設定ファイルを作成（存在しない場合）
  - 特定した設定ディレクトリに`mcp.json`を作成

- [ ] **ステップ2**: 設定内容を記述

  **オプションA: 環境変数を使用（推奨）**
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

  **オプションB: 直接トークンを指定（非推奨）**
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

  **オプションC: ヘッダー形式（代替案）**
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

- [ ] **ステップ3**: 設定ファイルの構文チェック
  ```bash
  # JSON構文チェック
  cat mcp.json | python3 -m json.tool
  # または
  jq . mcp.json
  ```

#### 2.2 セキュリティ設定

- [ ] `.gitignore`に設定ファイルを追加（トークンが含まれる場合）
  ```
  # MCP設定ファイル（トークンが含まれる場合）
  mcp.json
  **/mcp.json
  ```

### Phase 3: テストフェーズ

#### 3.1 Cursorの再起動

- [ ] Cursor IDEを完全に終了
- [ ] Cursor IDEを再起動
- [ ] MCPサーバーの接続状態を確認

#### 3.2 接続テスト

- [ ] **テスト1**: MCPサーバーの接続確認
  - Cursorの開発者ツールを開く（`Help` > `Toggle Developer Tools` > `Console`）
  - MCP関連のエラーログがないか確認

- [ ] **テスト2**: Notionリソースの読み取りテスト
  - CursorからNotionページを読み取るコマンドを実行
  - エラーが発生しないか確認

- [ ] **テスト3**: Notionページへの書き込みテスト
  - 簡単なテストページを作成
  - ページにテキストを追加
  - 正常に書き込まれるか確認

#### 3.3 機能テスト

- [ ] **機能1**: ページの作成
  - [ ] ページタイトルの設定
  - [ ] ページコンテンツの追加
  - [ ] ページ構造の確認

- [ ] **機能2**: ページの更新
  - [ ] 既存ページの読み取り
  - [ ] コンテンツの追加・編集
  - [ ] 変更の反映確認

- [ ] **機能3**: データベース操作
  - [ ] データベースのクエリ
  - [ ] エントリの追加
  - [ ] エントリの更新

- [ ] **機能4**: テンプレートプロンプトの管理
  - [ ] プロンプトテンプレートの保存
  - [ ] テンプレートの読み取り
  - [ ] テンプレートの更新

---

## 🔍 トラブルシューティング

### 問題1: MCPサーバーに接続できない

**症状**:
- CursorでMCPサーバーが認識されない
- エラーメッセージ: "Failed to connect to MCP server"

**原因の可能性**:
1. 設定ファイルのパスが間違っている
2. 設定ファイルのJSON構文エラー
3. パッケージが見つからない
4. 権限の問題

**解決手順**:
1. [ ] 設定ファイルのパスを確認
   ```bash
   find ~ -name "mcp.json" 2>/dev/null
   ```

2. [ ] JSON構文をチェック
   ```bash
   cat ~/.cursor/mcp.json | python3 -m json.tool
   ```

3. [ ] パッケージを手動でインストール確認
   ```bash
   npx -y @notionhq/notion-mcp-server --help
   ```

4. [ ] Cursorのログを確認
   - `Help` > `Toggle Developer Tools` > `Console`
   - MCP関連のエラーを検索

5. [ ] Cursorを完全に再起動

### 問題2: Notion API認証エラー

**症状**:
- エラーメッセージ: "Unauthorized" または "401 Unauthorized"
- トークンが無効と表示される

**原因の可能性**:
1. トークンが無効または期限切れ
2. トークンの形式が間違っている
3. 環境変数が正しく読み込まれていない
4. トークンに適切な権限がない

**解決手順**:
1. [ ] トークンの形式を確認
   - `secret_`で始まる必要がある
   - トークンに空白や改行が含まれていないか確認

2. [ ] 環境変数が設定されているか確認
   ```bash
   echo $NOTION_API_KEY
   ```

3. [ ] トークンを再生成
   - Notion開発者ポータルで新しいトークンを生成
   - 環境変数を更新
   - シェルを再起動（`exec zsh`）

4. [ ] 設定ファイルを確認
   - 環境変数の参照が正しいか（`${NOTION_API_KEY}`）
   - 直接指定する場合はトークンが正しいか

### 問題3: ページが見つからない / アクセス権限エラー

**症状**:
- エラーメッセージ: "Not found" または "403 Forbidden"
- ページにアクセスできない

**原因の可能性**:
1. ページにインテグレーションの権限が付与されていない
2. ページIDが間違っている
3. ワークスペースが異なる

**解決手順**:
1. [ ] Notionページの「共有」設定を確認
   - 作成したインテグレーションが追加されているか
   - 適切な権限（「編集」以上）が付与されているか

2. [ ] ページIDを確認
   - ページURLからページIDを抽出
   - ページIDの形式が正しいか確認

3. [ ] ワークスペースを確認
   - インテグレーションが作成されたワークスペースと
   - アクセスしようとしているページのワークスペースが一致しているか

### 問題4: パッケージが実行できない

**症状**:
- エラーメッセージ: "Command not found" または "Package not found"
- npxコマンドが失敗する

**原因の可能性**:
1. npm/npxがインストールされていない
2. ネットワーク接続の問題
3. パッケージ名が間違っている

**解決手順**:
1. [ ] Node.jsとnpmのインストール確認
   ```bash
   node --version
   npm --version
   npx --version
   ```

2. [ ] パッケージを手動で実行
   ```bash
   npx -y @notionhq/notion-mcp-server --help
   ```

3. [ ] ネットワーク接続を確認
   ```bash
   ping npmjs.com
   ```

4. [ ] パッケージ名を確認
   - 公式ドキュメントで正しいパッケージ名を確認

---

## 📚 参考資料

### 公式ドキュメント

- [Notion MCP公式ドキュメント](https://www.notion.com/ja/help/notion-mcp)
- [Notion API ドキュメント](https://developers.notion.com/)
- [Notion開発者ポータル](https://www.notion.so/my-integrations)
- [Model Context Protocol 仕様](https://modelcontextprotocol.io/)

### 関連リソース

- Notion API リファレンス
- MCP プロトコル仕様
- Cursor IDE ドキュメント

---

## 📊 進捗管理

### 実装ステータス

| 項目 | ステータス | 完了日 | 備考 |
|------|-----------|--------|------|
| 設計ドキュメント作成 | ✅ 完了 | - | 本ドキュメント |
| 設定ファイルの場所特定 | ⏳ 未完了 | - | - |
| Notion APIトークン取得 | ⏳ 未完了 | - | - |
| MCP設定ファイル作成 | ⏳ 未完了 | - | - |
| 接続テスト | ⏳ 未完了 | - | - |
| 基本操作テスト | ⏳ 未完了 | - | - |
| テンプレート機能実装 | ⏳ 未完了 | - | - |

### 次のアクション

1. [ ] 設定ファイルの場所を特定する
2. [ ] Notion APIトークンを取得する
3. [ ] MCP設定ファイルを作成する
4. [ ] 接続テストを実行する
5. [ ] 基本的な操作をテストする

---

## 💡 設計に関するメモ

### 検討事項

1. **トークン管理方法**
   - 環境変数 vs 設定ファイル
   - セキュリティのバランス
   - 複数環境での管理方法

2. **エラーハンドリング**
   - 認証エラーの適切な処理
   - ネットワークエラーの処理
   - ユーザーフレンドリーなエラーメッセージ

3. **パフォーマンス**
   - リクエストの最適化
   - キャッシュの活用
   - バッチ処理の検討

4. **拡張性**
   - 複数Notionワークスペースの対応
   - カスタムツールの追加
   - プラグイン機能の検討

### 今後の改善案

- [ ] 設定ウィザードの作成
- [ ] エラーメッセージの改善
- [ ] ログ機能の追加
- [ ] テストスイートの作成
- [ ] ドキュメントの充実

---

## 📝 更新履歴

| 日付 | バージョン | 変更内容 | 作成者 |
|------|-----------|---------|--------|
| 2025-01-XX | 1.0.0 | 初版作成（設計テンプレート） | - |

---

**このドキュメントは、Notionページ上で設計を記載する際のテンプレートとして使用してください。各セクションをNotionのブロック構造（見出し、チェックボックス、コードブロック、テーブルなど）に適応させて記載してください。**

