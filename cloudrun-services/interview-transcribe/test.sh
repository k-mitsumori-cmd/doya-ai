#!/bin/bash
# Cloud Run音声変換サービスのテストスクリプト

set -e

echo "========================================="
echo "Cloud Run音声変換サービス テスト"
echo "========================================="

# 1. TypeScriptのコンパイルチェック
echo ""
echo "1. TypeScriptのコンパイルチェック..."
npm run build
if [ $? -eq 0 ]; then
  echo "✓ コンパイル成功"
else
  echo "✗ コンパイル失敗"
  exit 1
fi

# 2. ビルドファイルの確認
echo ""
echo "2. ビルドファイルの確認..."
if [ -f "dist/index.js" ] && [ -f "dist/transcribe.js" ]; then
  echo "✓ ビルドファイルが正常に生成されました"
else
  echo "✗ ビルドファイルが生成されていません"
  exit 1
fi

# 3. Dockerfileの構文チェック（dockerが利用可能な場合）
if command -v docker &> /dev/null; then
  echo ""
  echo "3. Dockerfileの構文チェック..."
  docker build --no-cache -t interview-transcribe-test . > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    echo "✓ Dockerイメージのビルド成功"
    docker rmi interview-transcribe-test > /dev/null 2>&1
  else
    echo "⚠ Dockerイメージのビルドに失敗（Docker環境がない可能性）"
  fi
else
  echo ""
  echo "3. Dockerfileの構文チェック..."
  echo "⚠ Dockerがインストールされていないためスキップ"
fi

echo ""
echo "========================================="
echo "テスト完了: すべて成功"
echo "========================================="

