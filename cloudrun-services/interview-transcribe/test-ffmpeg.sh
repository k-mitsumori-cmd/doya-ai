#!/bin/bash
# FFmpeg音声抽出機能のテストスクリプト

set -e

echo "========================================="
echo "FFmpeg音声抽出機能 テスト"
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
if [ -f "dist/index.js" ] && [ -f "dist/transcribe.js" ] && [ -f "dist/audio-extractor.js" ]; then
  echo "✓ ビルドファイルが正常に生成されました"
  echo "  - dist/index.js"
  echo "  - dist/transcribe.js"
  echo "  - dist/audio-extractor.js"
else
  echo "✗ ビルドファイルが生成されていません"
  exit 1
fi

# 3. audio-extractor.tsの構文チェック
echo ""
echo "3. audio-extractor.tsの構文チェック..."
if [ -f "src/audio-extractor.ts" ]; then
  echo "✓ audio-extractor.ts が存在します"
  
  # import/exportの確認
  if grep -q "export.*extractAudioFromMP4" src/audio-extractor.ts; then
    echo "✓ extractAudioFromMP4 が正しくエクスポートされています"
  else
    echo "✗ extractAudioFromMP4 がエクスポートされていません"
    exit 1
  fi
  
  # GCS Storageの使用確認
  if grep -q "@google-cloud/storage" src/audio-extractor.ts; then
    echo "✓ @google-cloud/storage が使用されています"
  else
    echo "✗ @google-cloud/storage が使用されていません"
    exit 1
  fi
else
  echo "✗ audio-extractor.ts が存在しません"
  exit 1
fi

# 4. transcribe.tsの更新確認
echo ""
echo "4. transcribe.tsの更新確認..."
if grep -q "extractAudioFromMP4" src/transcribe.ts; then
  echo "✓ transcribe.ts で extractAudioFromMP4 が使用されています"
else
  echo "✗ transcribe.ts で extractAudioFromMP4 が使用されていません"
  exit 1
fi

# 5. DockerfileのFFmpeg確認
echo ""
echo "5. DockerfileのFFmpeg確認..."
if grep -q "ffmpeg" Dockerfile; then
  echo "✓ Dockerfile に FFmpeg が追加されています"
else
  echo "✗ Dockerfile に FFmpeg が追加されていません"
  exit 1
fi

# 6. package.jsonの依存関係確認
echo ""
echo "6. package.jsonの依存関係確認..."
if grep -q "@google-cloud/storage" package.json; then
  echo "✓ @google-cloud/storage が依存関係に含まれています"
else
  echo "✗ @google-cloud/storage が依存関係に含まれていません"
  exit 1
fi

echo ""
echo "========================================="
echo "テスト完了: すべて成功"
echo "========================================="
echo ""
echo "実装内容:"
echo "  - DockerfileにFFmpegを追加"
echo "  - audio-extractor.tsでMP4から音声を抽出してFLACに変換"
echo "  - transcribe.tsでMP4ファイルを自動処理"
echo "  - GCSからファイルをダウンロード・変換・再アップロード"
echo ""

