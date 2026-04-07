/**
 * 三ツ星アプリ ナグサメ ペルソナ画像生成スクリプト
 *
 * Gemini Nano Banana (gemini-2.5-flash-image-preview) で
 * 各キャラの 1024x1024 アニメ調ポートレートを生成し
 * public/mitsuboshi/personas/{personaId}.png に保存する。
 *
 * 使い方:
 *   GOOGLE_GENAI_API_KEY=xxx node scripts/generate-mitsuboshi-personas.mjs
 *
 * オプション環境変数:
 *   ONLY=nagusame-default-haru,nagusame-default-momo  特定IDだけ生成
 *   FORCE=1                                            既存ファイルを上書き
 *   MODEL=gemini-2.5-flash-image-preview               使用モデル指定
 */

import { mkdir, writeFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const OUTPUT_DIR = join(REPO_ROOT, 'public', 'mitsuboshi', 'personas')

const API_KEY =
  process.env.GOOGLE_GENAI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY
if (!API_KEY) {
  console.error('❌ GOOGLE_GENAI_API_KEY (or GEMINI_API_KEY) が必要です')
  process.exit(1)
}

const MODEL = process.env.MODEL || 'gemini-2.5-flash-image-preview'
const FORCE = process.env.FORCE === '1' || process.env.FORCE === 'true'
const ONLY = process.env.ONLY ? process.env.ONLY.split(',').map((s) => s.trim()) : null

// 各キャラの生成パラメータ
// id は src/lib/mitsuboshi/nagusame/personas/default.ts と一致させる
const PERSONAS = [
  // ────────── 包容系 ──────────
  {
    id: 'nagusame-default-haru',
    name: 'ハル',
    description: 'A warm, kind 80-year-old Japanese grandmother (obaachan), short silver hair tied back, gentle smile, light pink kimono cardigan',
    mood: 'serene, comforting',
  },
  {
    id: 'nagusame-default-maria',
    name: 'シスター・マリア',
    description: 'A serene Catholic nun in her 30s with calm closed eyes, white headdress and simple dark habit, soft hands clasped in prayer',
    mood: 'peaceful, holy',
  },
  {
    id: 'nagusame-default-akane',
    name: 'あかね先生',
    description: 'A gentle 30-year-old Japanese nursery school teacher woman, soft brown shoulder-length hair, warm smile, wearing a peach-colored apron over a white blouse',
    mood: 'warm, motherly',
  },
  {
    id: 'nagusame-default-yuki',
    name: 'ユウキ',
    description: 'A 25-year-old Japanese male same-age coworker, short black hair, casual hoodie and t-shirt, slightly tired but friendly expression',
    mood: 'relatable, empathetic',
  },
  {
    id: 'nagusame-default-otoha',
    name: '音羽',
    description: 'A calm 28-year-old Japanese woman, long straight black hair, warm dark eyes, simple beige cardigan, very gentle listening expression',
    mood: 'tranquil, listening',
  },
  // ────────── 魅力派キャラ（女性） ──────────
  {
    id: 'nagusame-default-momo',
    name: 'モモ',
    description: 'A cute 22-year-old Japanese cafe waitress, soft pink wavy shoulder-length hair, big gentle eyes, wearing a beige cafe apron over a white blouse, holding an empty saucer, fluffy and shy aura',
    mood: 'fluffy, kind',
  },
  // ────────── ユーモア系 ──────────
  {
    id: 'nagusame-default-toyokawa',
    name: '豊川',
    description: 'A friendly Japanese male comedian in his 30s from Osaka, short messy black hair, big laughing smile, wearing a casual loud-colored jacket, expressive Kansai energy',
    mood: 'humorous, lively',
  },
  {
    id: 'nagusame-default-mike',
    name: 'ミケ',
    description: 'An anthropomorphized calico cat character with big sleepy eyes, sitting upright, mischievous and chill expression, japanese anime mascot style',
    mood: 'lazy, ironic',
  },
  {
    id: 'nagusame-default-miraijin',
    name: '未来人2099',
    description: 'A mysterious androgynous person from the year 2099, sleek silver futuristic hood, glowing blue eyes, soft cyber clothing, calm and slightly amused expression',
    mood: 'futuristic, calm',
  },
  // ────────── 叱咤激励系 ──────────
  {
    id: 'nagusame-default-kantaro',
    name: 'カンタロウ部長',
    description: 'A strong but kind Japanese middle-aged male manager (40s), short black hair, sharp eyebrows, white dress shirt with rolled-up sleeves, big enthusiastic smile, supportive aura',
    mood: 'enthusiastic, supportive',
  },
  {
    id: 'nagusame-default-soichiro',
    name: '宗一郎',
    description: 'An Edo-period Japanese samurai man, traditional dark blue kimono and hakama, top knot hairstyle, serious but compassionate eyes, holding a katana sheathed at his side',
    mood: 'noble, stoic',
  },
  // ────────── 論破系 ──────────
  {
    id: 'nagusame-default-ren',
    name: 'レン',
    description: 'A 27-year-old Japanese intellectual man, short tidy black hair, round glasses, button-up shirt and cardigan, calm rational expression, holding an open notebook',
    mood: 'rational, calm',
  },
  // ────────── 方言系 ──────────
  {
    id: 'nagusame-default-midori',
    name: '博多のミドリさん',
    description: 'A cheerful Japanese big-sister type woman from Hakata Fukuoka in her 30s, short brown bob, bright open smile, casual stylish blouse, warm and direct',
    mood: 'cheerful, motherly',
  },
  {
    id: 'nagusame-default-oji',
    name: '沖縄のおじぃ',
    description: 'A calm Okinawan grandfather (60s), tan skin, gray short hair, traditional Kariyushi shirt with tropical pattern, peaceful smile sitting on a porch',
    mood: 'peaceful, easygoing',
  },
  // ────────── ファンタジー系 ──────────
  {
    id: 'nagusame-default-eldia',
    name: 'エルディア',
    description: 'A mysterious anime fantasy mage girl with long silver hair, light purple robe with stars, holding a small glowing crystal, gentle confident smile',
    mood: 'magical, protective',
  },
  {
    id: 'nagusame-default-zero',
    name: 'AI管制官ZERO',
    description: 'A friendly humanoid AI control room operator, sleek white visor, smooth synthetic blue hair, modern dark uniform with glowing accents, soft calm expression',
    mood: 'precise, kind',
  },
  // ────────── 魅力派キャラ（男性） ──────────
  {
    id: 'nagusame-default-kyoya',
    name: 'キョウヤ',
    description: 'A handsome cool 28-year-old Japanese man, slightly long black hair parted, sharp dark eyes, dark navy shirt, mature confident expression, prince-like aura',
    mood: 'cool, mature',
  },
  {
    id: 'nagusame-default-sota',
    name: 'ソウタ',
    description: 'A handsome cheerful 24-year-old Japanese sporty male, short fluffy brown hair, bright honest smile, white t-shirt with a green hoodie tied around the waist',
    mood: 'fresh, sporty',
  },
  {
    id: 'nagusame-default-towa',
    name: 'トワ',
    description: 'A handsome gentle 30-year-old Japanese man, soft black hair, kind eyes, wearing a beige knit sweater, big-brother caring expression',
    mood: 'gentle, protective',
  },
  {
    id: 'nagusame-default-aki',
    name: 'アキ',
    description: 'A handsome quiet 26-year-old Japanese male woodworker, short messy black hair, slight stubble, white t-shirt under a brown apron, focused but kind eyes',
    mood: 'quiet, sturdy',
  },
  // ────────── 魅力派キャラ（女性追加） ──────────
  {
    id: 'nagusame-default-noel',
    name: 'ノエル',
    description: 'A super cute innocent 19-year-old Japanese girl, light strawberry-pink twin-tails, big sparkling eyes, white frilly blouse, energetic younger-sister vibe',
    mood: 'innocent, energetic',
  },
  {
    id: 'nagusame-default-rin',
    name: 'リン',
    description: 'A beautiful cool 24-year-old Japanese woman, long straight jet-black hair, sharp intelligent eyes, elegant white turtleneck, dignified gentle expression',
    mood: 'elegant, dignified',
  },
  {
    id: 'nagusame-default-aira',
    name: 'アイラ',
    description: 'A super cute 21-year-old Japanese idol girl, pastel pink-and-blue medium length hair, star-shaped hair clip, white-and-blue idol outfit with frills, bright supportive smile',
    mood: 'sparkly, supportive',
  },
]

function buildPrompt(persona) {
  return `Anime / manga style portrait illustration of a single character.

Character: ${persona.name}
Description: ${persona.description}
Mood: ${persona.mood}

Art style: 高品質な日本のアニメ調イラスト, soft cel-shading, clean line art, gentle warm lighting, very expressive eyes, beautiful detailed face, looking directly at viewer, friendly and approachable.
Composition: Bust-up portrait, character centered, simple soft midnight-blue gradient background with subtle small stars (no text, no logo, no watermark).
Color palette: Dreamy night sky tones with warm champagne gold accents.
Aspect ratio: 1:1 square. High quality, no text in the image.`
}

async function generateOne(persona) {
  const outputPath = join(OUTPUT_DIR, `${persona.id}.jpg`)
  if (!FORCE) {
    try {
      await access(outputPath)
      console.log(`⏭  ${persona.id}: 既存をスキップ（FORCE=1 で再生成）`)
      return { id: persona.id, status: 'skipped' }
    } catch {
      // 存在しないので生成する
    }
  }

  const prompt = buildPrompt(persona)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseModalities: ['IMAGE'],
    },
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`HTTP ${res.status}: ${errText.slice(0, 400)}`)
    }

    const data = await res.json()
    const parts = data?.candidates?.[0]?.content?.parts || []
    const imagePart = parts.find((p) => p.inlineData?.data)
    if (!imagePart) {
      throw new Error(
        `画像が含まれていません: ${JSON.stringify(data).slice(0, 500)}`
      )
    }

    const buf = Buffer.from(imagePart.inlineData.data, 'base64')
    await writeFile(outputPath, buf)
    console.log(`✅ ${persona.id}: ${(buf.length / 1024).toFixed(0)}KB`)
    return { id: persona.id, status: 'ok', bytes: buf.length }
  } catch (err) {
    console.error(`❌ ${persona.id}:`, err.message || err)
    return { id: persona.id, status: 'error', error: String(err) }
  }
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true })
  console.log(`📁 出力先: ${OUTPUT_DIR}`)
  console.log(`🤖 モデル: ${MODEL}`)
  console.log(`🔢 対象: ${ONLY ? ONLY.length : PERSONAS.length} キャラ`)
  console.log()

  const targets = ONLY ? PERSONAS.filter((p) => ONLY.includes(p.id)) : PERSONAS

  const results = []
  for (const persona of targets) {
    const r = await generateOne(persona)
    results.push(r)
    // レート制限を避けるため軽く待つ
    await new Promise((res) => setTimeout(res, 800))
  }

  console.log()
  console.log('━━━━━━━━━━━━━━━━━━')
  const ok = results.filter((r) => r.status === 'ok').length
  const skipped = results.filter((r) => r.status === 'skipped').length
  const error = results.filter((r) => r.status === 'error').length
  console.log(`✅ 成功: ${ok}  ⏭ スキップ: ${skipped}  ❌ 失敗: ${error}`)
  if (error > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
