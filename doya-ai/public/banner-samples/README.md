# Banner sample assets

このフォルダの画像は、`/banner` ダッシュボードの **業種 / 用途 / サイズ** で表示する「バナーサンプル画像」です。

## 生成方法（Nano Banana Pro / Gemini 2.0 Flash Exp）

まず、SVGのプレースホルダー（**文字入りバナー**）は常に生成できます。
Nano Banana Pro（PNG生成）まで行う場合は、環境変数 `GOOGLE_GENAI_API_KEY` が必要です。

```bash
cd doya-ai
node ./scripts/generate-banner-samples.mjs
```

生成された画像は `public/banner-samples/*.svg` と `public/banner-samples/*.png` に保存されます。

- **PNGが存在する場合**: UIはPNGを優先表示
- **PNGが無い場合**: UIはSVGへフォールバック（画像が壊れない）


