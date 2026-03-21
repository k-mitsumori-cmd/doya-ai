import type { LpSectionDef, LpSectionType } from './types'

interface WireframeOptions {
  width?: number
  baseHeight?: number
  accentColor?: string
}

/** セクションタイプ別の日本語ラベル */
const SECTION_LABELS: Record<string, string> = {
  hero: 'ファーストビュー',
  problem: '課題・悩み',
  empathy: '共感セクション',
  solution: '解決策の提示',
  features: '特徴・強み',
  proof: '実績・証拠',
  testimonial: 'お客様の声',
  pricing: '料金プラン',
  faq: 'よくある質問',
  cta: 'CTA（行動喚起）',
  company: '会社情報',
  footer: 'フッター',
}

/** セクションタイプ別のデフォルト推奨コンテンツ */
const DEFAULT_CONTENT: Record<string, string[]> = {
  hero: ['キャッチコピー（数字 or 疑問形）', 'サブキャッチ', 'CTA ボタン', 'メインビジュアル画像'],
  problem: ['ターゲットの悩み 3 つ', '具体的な数字で痛みを可視化', '「こんなお悩みありませんか？」'],
  empathy: ['「あなたのせいではありません」', '多くの人が同じ悩みを持っている', '希望の光を暗示する文言'],
  solution: ['サービス名を英雄として登場', 'Before → After の対比', 'なぜこの方法が最適かの根拠'],
  features: ['特徴を 3〜4 つのカードで表示', '各カードにアイコン＋タイトル＋説明', 'ベネフィット重視（機能 < 効果）'],
  proof: ['導入企業数・満足度等の数字', 'メディア掲載・受賞歴', '権威づけの要素'],
  testimonial: ['顧客の具体的な成果（数字）', '業種・役職を明示', '星評価・写真・実名'],
  pricing: ['3 段階の料金プラン比較', 'おすすめプランを強調', '「1日あたり〇円」の割り算表示'],
  faq: ['「本当に効果ある？」→ 数字で回答', '「解約できる？」→ 簡単さを強調', 'ターゲットの不安を先回りで解消'],
  cta: ['行動を促す見出し（命令形 or 疑問形）', '限定性・保証で後押し', 'ボタン下に安心材料（※カード不要 等）'],
  company: ['企業ロゴ・ミッション', '実績数字（創業〇年・〇社サポート）'],
  footer: ['ナビゲーションリンク', 'お問い合わせ情報', 'コピーライト'],
}

/** CTAボタンのデフォルトテキスト */
const DEFAULT_CTA: Record<string, string> = {
  hero: '無料で始める',
  cta: '今すぐ申し込む',
  problem: '詳しく見る',
  solution: '詳しく見る',
  default: '資料請求する',
}

function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** 番号付きセクションマーカー */
function sectionMarker(x: number, y: number, num: number, accent: string): string {
  return `<circle cx="${x}" cy="${y}" r="10" fill="${accent}"/>
    <text x="${x}" y="${y + 4}" font-size="10" fill="white" font-family="system-ui,sans-serif" font-weight="700" text-anchor="middle">${num}</text>`
}

/** テキスト行プレースホルダー */
function textRect(x: number, y: number, w: number, h: number, color: string, opacity: number): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${color}" opacity="${opacity}"/>`
}

/** 画像プレースホルダー（山アイコン） */
function imgPlaceholder(x: number, y: number, w: number, h: number): string {
  const cx = x + w / 2
  const cy = y + h / 2
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="0.8"/>
    <polygon points="${cx - 8},${cy + 5} ${cx - 3},${cy - 3} ${cx + 2},${cy + 2} ${cx + 5},${cy - 1} ${cx + 8},${cy + 5}" fill="#94a3b8" opacity="0.4"/>
    <circle cx="${cx + 4}" cy="${cy - 5}" r="2.5" fill="#94a3b8" opacity="0.35"/>`
}

/** ブレットポイント（・付きテキスト） */
function bulletText(x: number, y: number, text: string, maxW: number): string {
  // テキストを maxW に収まるよう切り詰め（概算: 1文字 ≈ 6px @ font-size 8）
  const maxChars = Math.floor(maxW / 5.5)
  const display = text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text
  return `<circle cx="${x + 3}" cy="${y + 3}" r="1.5" fill="#475569" opacity="0.5"/>
    <text x="${x + 8}" y="${y + 6}" font-size="7.5" fill="#475569" font-family="system-ui,sans-serif" opacity="0.7">${esc(display)}</text>`
}

/** ダークCTAボタン（ラベル付き） */
function ctaBtn(cx: number, y: number, label: string, accent: string, w: number = 110, h: number = 26): string {
  const maxChars = Math.floor(w / 8)
  const display = label.length > maxChars ? label.slice(0, maxChars - 1) + '…' : label
  return `<rect x="${cx - w / 2}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${accent}"/>
    <text x="${cx}" y="${y + h / 2 + 4}" font-size="9" fill="white" font-family="system-ui,sans-serif" font-weight="600" text-anchor="middle">${esc(display)}</text>`
}

/** セクション描画 */
function renderSection(
  sec: LpSectionDef,
  idx: number,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: string
): string {
  const pad = 14
  const cx = x + w / 2
  const cX = x + pad
  const cW = w - pad * 2
  const label = sec.name || SECTION_LABELS[sec.type] || sec.type
  const contents = (sec.recommendedContent && sec.recommendedContent.length > 0)
    ? sec.recommendedContent
    : DEFAULT_CONTENT[sec.type] || ['コンテンツを配置']
  const ctaText = DEFAULT_CTA[sec.type] || DEFAULT_CTA.default
  const markerX = x + w - 16
  let svg = ''

  switch (sec.type as string) {
    case 'hero': {
      // ダーク背景
      svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#1e293b"/>`
      // ナビゲーションバー
      svg += `<rect x="${x}" y="${y}" width="${w}" height="18" fill="#0f172a" opacity="0.5"/>`
      svg += textRect(cX, y + 6, 30, 5, '#ffffff', 0.5)
      // 小さなナビリンク
      for (let n = 0; n < 4; n++) {
        svg += textRect(x + w - pad - (4 - n) * 28, y + 7, 22, 4, '#ffffff', 0.25)
      }
      // セクション見出し
      svg += `<text x="${cx}" y="${y + 40}" font-size="13" fill="white" font-family="system-ui,sans-serif" font-weight="800" text-anchor="middle">${esc(label)}</text>`
      // CTAボタン
      svg += ctaBtn(cx - (w > 250 ? w * 0.1 : 0), y + 54, ctaText, accent, Math.min(120, w * 0.45))
      // サブテキスト
      svg += textRect(cx - 40, y + 84, 80, 4, '#ffffff', 0.25)
      // ブレットポイント（左側）
      const bulletY = y + 100
      contents.slice(0, 3).forEach((c, i) => {
        svg += bulletText(cX, bulletY + i * 12, c, cW * 0.55)
      })
      // 画像プレースホルダー（右側）
      if (w > 200) {
        const imgW = Math.min(w * 0.32, 130)
        const imgH = h * 0.4
        svg += imgPlaceholder(x + w - pad - imgW, y + 30, imgW, imgH)
      }
      // 番号マーカー
      svg += sectionMarker(markerX, y + 30, idx + 1, accent)
      return svg
    }

    case 'features': {
      svg += `<text x="${cx}" y="${y + 22}" font-size="11" fill="#1e293b" font-family="system-ui,sans-serif" font-weight="700" text-anchor="middle">${esc(label)}</text>`
      svg += `<rect x="${cx - 18}" y="${y + 26}" width="36" height="2" rx="1" fill="${accent}" opacity="0.4"/>`
      // ブレット
      contents.slice(0, 3).forEach((c, i) => {
        svg += bulletText(cX, y + 34 + i * 11, c, cW)
      })
      // 3カラムカード
      const cardTop = y + 34 + Math.min(contents.length, 3) * 11 + 6
      const cardCount = Math.min(3, Math.max(2, Math.floor(cW / 55)))
      const gap = 6
      const cardW = (cW - gap * (cardCount - 1)) / cardCount
      const cardH = Math.min(55, y + h - cardTop - 8)
      if (cardH > 20) {
        for (let i = 0; i < cardCount; i++) {
          const fcx = cX + (cardW + gap) * i
          svg += `<rect x="${fcx}" y="${cardTop}" width="${cardW}" height="${cardH}" rx="5" fill="white" stroke="#e2e8f0" stroke-width="0.8"/>`
          // アイコン
          svg += `<circle cx="${fcx + cardW / 2}" cy="${cardTop + 12}" r="7" fill="${accent}" opacity="0.12"/>`
          svg += `<circle cx="${fcx + cardW / 2}" cy="${cardTop + 12}" r="3" fill="${accent}" opacity="0.4"/>`
          // テキスト
          svg += textRect(fcx + 6, cardTop + 24, cardW - 12, 4, '#334155', 0.45)
          if (cardH > 35) svg += textRect(fcx + 6, cardTop + 32, cardW * 0.6, 3, '#94a3b8', 0.3)
        }
      }
      svg += sectionMarker(markerX, y + 22, idx + 1, accent)
      break
    }

    case 'testimonial': {
      svg += `<text x="${cx}" y="${y + 22}" font-size="11" fill="#1e293b" font-family="system-ui,sans-serif" font-weight="700" text-anchor="middle">${esc(label)}</text>`
      svg += `<rect x="${cx - 18}" y="${y + 26}" width="36" height="2" rx="1" fill="${accent}" opacity="0.4"/>`
      // ブレット
      contents.slice(0, 2).forEach((c, i) => {
        svg += bulletText(cX, y + 34 + i * 11, c, cW)
      })
      // 2枚のカード
      const tTop = y + 34 + Math.min(contents.length, 2) * 11 + 4
      const tCardW = (cW - 8) / 2
      const tCardH = Math.min(60, y + h - tTop - 8)
      if (tCardH > 20) {
        for (let i = 0; i < 2; i++) {
          const tcx = cX + (tCardW + 8) * i
          svg += `<rect x="${tcx}" y="${tTop}" width="${tCardW}" height="${tCardH}" rx="5" fill="white" stroke="#e2e8f0" stroke-width="0.8"/>`
          // 引用符
          svg += `<text x="${tcx + 6}" y="${tTop + 13}" font-size="12" fill="${accent}" opacity="0.25" font-family="Georgia,serif">\u201C</text>`
          // 星
          for (let s = 0; s < 5; s++) svg += `<circle cx="${tcx + 8 + s * 6}" cy="${tTop + 20}" r="2" fill="#fbbf24" opacity="0.6"/>`
          // テキスト
          svg += textRect(tcx + 6, tTop + 27, tCardW - 12, 3.5, '#64748b', 0.35)
          svg += textRect(tcx + 6, tTop + 33, tCardW * 0.5, 3, '#94a3b8', 0.25)
          // アバター
          if (tCardH > 45) {
            svg += `<circle cx="${tcx + 12}" cy="${tTop + tCardH - 10}" r="6" fill="#e2e8f0"/>`
            svg += textRect(tcx + 22, tTop + tCardH - 13, tCardW * 0.25, 3.5, '#334155', 0.4)
            svg += textRect(tcx + 22, tTop + tCardH - 7, tCardW * 0.18, 3, '#94a3b8', 0.25)
          }
        }
      }
      svg += sectionMarker(markerX, y + 22, idx + 1, accent)
      break
    }

    case 'pricing': {
      svg += `<text x="${cx}" y="${y + 22}" font-size="11" fill="#1e293b" font-family="system-ui,sans-serif" font-weight="700" text-anchor="middle">${esc(label)}</text>`
      svg += `<rect x="${cx - 18}" y="${y + 26}" width="36" height="2" rx="1" fill="${accent}" opacity="0.4"/>`
      // ブレット
      contents.slice(0, 2).forEach((c, i) => {
        svg += bulletText(cX, y + 34 + i * 11, c, cW)
      })
      // 3プランカード
      const pTop = y + 34 + Math.min(contents.length, 2) * 11 + 4
      const pCount = w > 220 ? 3 : 2
      const pGap = 5
      const pCardW = (cW - pGap * (pCount - 1)) / pCount
      const pCardH = Math.min(78, y + h - pTop - 8)
      if (pCardH > 25) {
        for (let i = 0; i < pCount; i++) {
          const pcx = cX + (pCardW + pGap) * i
          const isRec = i === 1
          svg += `<rect x="${pcx}" y="${pTop}" width="${pCardW}" height="${pCardH}" rx="5" fill="${isRec ? accent + '10' : 'white'}" stroke="${isRec ? accent : '#e2e8f0'}" stroke-width="${isRec ? 1.5 : 0.8}"/>`
          // おすすめバッジ
          if (isRec) {
            svg += `<rect x="${pcx + pCardW / 2 - 12}" y="${pTop - 4}" width="24" height="8" rx="4" fill="${accent}"/>`
            svg += `<text x="${pcx + pCardW / 2}" y="${pTop + 2}" font-size="5" fill="white" font-family="system-ui,sans-serif" font-weight="700" text-anchor="middle">おすすめ</text>`
          }
          // プラン名
          svg += textRect(pcx + 6, pTop + 8, pCardW - 12, 4, '#334155', 0.45)
          // 価格
          svg += textRect(pcx + 8, pTop + 18, pCardW * 0.5, 7, isRec ? accent : '#334155', isRec ? 0.7 : 0.4)
          // チェックリスト
          for (let c = 0; c < 3; c++) {
            const cy = pTop + 32 + c * 9
            if (cy + 5 > pTop + pCardH - 16) break
            svg += `<circle cx="${pcx + 8}" cy="${cy}" r="2" fill="#22c55e" opacity="0.45"/>`
            svg += textRect(pcx + 14, cy - 2, pCardW * 0.5, 3, '#64748b', 0.3)
          }
          // CTA
          const btnY = pTop + pCardH - 13
          if (btnY > pTop + 30) {
            svg += `<rect x="${pcx + 5}" y="${btnY}" width="${pCardW - 10}" height="9" rx="4.5" fill="${isRec ? accent : '#94a3b8'}" opacity="${isRec ? 1 : 0.25}"/>`
          }
        }
      }
      svg += sectionMarker(markerX, y + 22, idx + 1, accent)
      break
    }

    case 'faq': {
      svg += `<text x="${cx}" y="${y + 22}" font-size="11" fill="#1e293b" font-family="system-ui,sans-serif" font-weight="700" text-anchor="middle">${esc(label)}</text>`
      svg += `<rect x="${cx - 18}" y="${y + 26}" width="36" height="2" rx="1" fill="${accent}" opacity="0.4"/>`
      // ブレット
      contents.slice(0, 2).forEach((c, i) => {
        svg += bulletText(cX, y + 34 + i * 11, c, cW)
      })
      // FAQ行
      const fTop = y + 34 + Math.min(contents.length, 2) * 11 + 4
      const faqCount = Math.min(4, Math.floor((y + h - fTop - 4) / 20))
      for (let i = 0; i < faqCount; i++) {
        const fy = fTop + i * 20
        svg += `<rect x="${cX}" y="${fy}" width="${cW}" height="16" rx="4" fill="white" stroke="#e2e8f0" stroke-width="0.7"/>`
        // Qマーカー
        svg += `<circle cx="${cX + 10}" cy="${fy + 8}" r="5.5" fill="${accent}" opacity="0.12"/>`
        svg += `<text x="${cX + 10}" y="${fy + 11}" font-size="6.5" fill="${accent}" font-family="system-ui,sans-serif" font-weight="700" text-anchor="middle">Q</text>`
        // 質問テキスト
        svg += textRect(cX + 20, fy + 5, cW * 0.5, 4, '#334155', 0.4)
        // +アイコン
        svg += `<text x="${cX + cW - 8}" y="${fy + 11}" font-size="9" fill="#94a3b8" font-family="system-ui,sans-serif">+</text>`
      }
      svg += sectionMarker(markerX, y + 22, idx + 1, accent)
      break
    }

    case 'cta': {
      // グラデーション背景
      svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#ctaGrad)"/>`
      // 見出し
      svg += `<text x="${cx}" y="${y + h * 0.2 + 4}" font-size="12" fill="white" font-family="system-ui,sans-serif" font-weight="800" text-anchor="middle">${esc(label)}</text>`
      // ブレット（白文字）
      const bulletStartY = y + h * 0.2 + 14
      contents.slice(0, 2).forEach((c, i) => {
        const maxC = Math.floor(cW / 5.5)
        const d = c.length > maxC ? c.slice(0, maxC - 1) + '…' : c
        svg += `<circle cx="${cX + 3}" cy="${bulletStartY + i * 11 + 3}" r="1.5" fill="white" opacity="0.4"/>
          <text x="${cX + 8}" y="${bulletStartY + i * 11 + 6}" font-size="7" fill="white" font-family="system-ui,sans-serif" opacity="0.6">${esc(d)}</text>`
      })
      // CTAボタン（白背景）
      const ctaBtnW = Math.min(130, w * 0.55)
      const ctaBtnY = y + h * 0.6
      svg += `<rect x="${cx - ctaBtnW / 2}" y="${ctaBtnY}" width="${ctaBtnW}" height="24" rx="12" fill="white"/>
        <text x="${cx}" y="${ctaBtnY + 15}" font-size="9" fill="${accent}" font-family="system-ui,sans-serif" font-weight="700" text-anchor="middle">${esc(ctaText)}</text>`
      // 安心テキスト
      svg += textRect(cx - 25, ctaBtnY + 30, 50, 3, '#ffffff', 0.3)
      svg += sectionMarker(markerX, y + 18, idx + 1, '#ffffff')
      return svg
    }

    case 'footer': {
      svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#1e293b"/>`
      // ロゴ
      svg += textRect(cX, y + 10, 32, 8, '#94a3b8', 0.35)
      // リンクカラム
      const cols = Math.min(3, Math.floor(cW / 40))
      const colW = cW / cols
      for (let c = 0; c < cols; c++) {
        const lcx = cX + colW * c
        svg += textRect(lcx, y + 24, colW * 0.45, 3.5, '#94a3b8', 0.35)
        for (let l = 0; l < 3; l++) svg += textRect(lcx, y + 31 + l * 7, colW * 0.55, 2.5, '#94a3b8', 0.18)
      }
      svg += textRect(cx - 30, y + h - 9, 60, 2.5, '#94a3b8', 0.15)
      svg += sectionMarker(markerX, y + 14, idx + 1, '#475569')
      return svg
    }

    case 'problem':
    case 'empathy': {
      const dotColor = sec.type === 'problem' ? '#ef4444' : '#f59e0b'
      svg += `<text x="${cx}" y="${y + 22}" font-size="11" fill="#1e293b" font-family="system-ui,sans-serif" font-weight="700" text-anchor="middle">${esc(label)}</text>`
      svg += `<rect x="${cx - 18}" y="${y + 26}" width="36" height="2" rx="1" fill="${accent}" opacity="0.4"/>`
      // 推奨コンテンツ（ブレット）
      contents.slice(0, 3).forEach((c, i) => {
        const by = y + 36 + i * 12
        svg += `<circle cx="${cX + 4}" cy="${by + 3}" r="2.5" fill="${dotColor}" opacity="0.35"/>
          <text x="${cX + 10}" y="${by + 6}" font-size="7.5" fill="#475569" font-family="system-ui,sans-serif" opacity="0.65">${esc(c.length > Math.floor(cW / 5.5) ? c.slice(0, Math.floor(cW / 5.5) - 1) + '…' : c)}</text>`
      })
      // 画像プレースホルダー（幅に余裕がある場合）
      if (w > 200 && h > 90) {
        svg += imgPlaceholder(x + w - pad - cW * 0.35, y + 36, cW * 0.3, h * 0.35)
      }
      if (sec.hasCta) svg += ctaBtn(cx, y + h - 34, ctaText, accent, 100, 22)
      svg += sectionMarker(markerX, y + 22, idx + 1, accent)
      break
    }

    case 'solution': {
      svg += `<text x="${cx}" y="${y + 22}" font-size="11" fill="#1e293b" font-family="system-ui,sans-serif" font-weight="700" text-anchor="middle">${esc(label)}</text>`
      svg += `<rect x="${cx - 18}" y="${y + 26}" width="36" height="2" rx="1" fill="${accent}" opacity="0.4"/>`
      contents.slice(0, 3).forEach((c, i) => {
        svg += bulletText(cX, y + 34 + i * 11, c, cW * 0.6)
      })
      // 画像
      if (w > 200 && h > 80) {
        svg += imgPlaceholder(x + w - pad - cW * 0.35, y + 30, cW * 0.3, h * 0.4)
      }
      if (sec.hasCta) svg += ctaBtn(cx, y + h - 34, ctaText, accent, 100, 22)
      svg += sectionMarker(markerX, y + 22, idx + 1, accent)
      break
    }

    case 'proof': {
      svg += `<text x="${cx}" y="${y + 22}" font-size="11" fill="#1e293b" font-family="system-ui,sans-serif" font-weight="700" text-anchor="middle">${esc(label)}</text>`
      svg += `<rect x="${cx - 18}" y="${y + 26}" width="36" height="2" rx="1" fill="${accent}" opacity="0.4"/>`
      contents.slice(0, 2).forEach((c, i) => {
        svg += bulletText(cX, y + 34 + i * 11, c, cW)
      })
      // 3つの数値カード
      const prTop = y + 34 + Math.min(contents.length, 2) * 11 + 4
      const prCount = Math.min(3, Math.max(2, Math.floor(cW / 50)))
      const prGap = 6
      const prW = (cW - prGap * (prCount - 1)) / prCount
      const prH = Math.min(35, y + h - prTop - 8)
      if (prH > 15) {
        for (let i = 0; i < prCount; i++) {
          const px = cX + (prW + prGap) * i
          svg += `<rect x="${px}" y="${prTop}" width="${prW}" height="${prH}" rx="5" fill="white" stroke="#e2e8f0" stroke-width="0.8"/>`
          svg += textRect(px + prW / 2 - prW * 0.2, prTop + 6, prW * 0.4, 7, accent, 0.55)
          svg += textRect(px + 6, prTop + 18, prW - 12, 3, '#94a3b8', 0.3)
        }
      }
      svg += sectionMarker(markerX, y + 22, idx + 1, accent)
      break
    }

    case 'company': {
      svg += `<text x="${cx}" y="${y + 22}" font-size="11" fill="#1e293b" font-family="system-ui,sans-serif" font-weight="700" text-anchor="middle">${esc(label)}</text>`
      svg += `<rect x="${cx - 18}" y="${y + 26}" width="36" height="2" rx="1" fill="${accent}" opacity="0.4"/>`
      contents.slice(0, 2).forEach((c, i) => {
        svg += bulletText(cX, y + 34 + i * 11, c, cW)
      })
      // ロゴプレースホルダー
      svg += `<rect x="${cx - 18}" y="${y + 60}" width="36" height="14" rx="3" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="0.5"/>`
      svg += sectionMarker(markerX, y + 22, idx + 1, accent)
      break
    }

    default: {
      svg += `<text x="${cx}" y="${y + 22}" font-size="11" fill="#1e293b" font-family="system-ui,sans-serif" font-weight="700" text-anchor="middle">${esc(label)}</text>`
      svg += `<rect x="${cx - 18}" y="${y + 26}" width="36" height="2" rx="1" fill="${accent}" opacity="0.4"/>`
      contents.slice(0, 3).forEach((c, i) => {
        svg += bulletText(cX, y + 34 + i * 11, c, cW)
      })
      if (sec.hasCta) svg += ctaBtn(cx, y + h - 34, ctaText, accent, 100, 22)
      svg += sectionMarker(markerX, y + 22, idx + 1, accent)
      break
    }
  }

  // セクション名ラベル（ダーク系以外）
  svg += `<text x="${cX + 2}" y="${y + h - 4}" font-size="7" fill="#94a3b8" font-family="system-ui,sans-serif" opacity="0.4">${esc(label)}</text>`
  return svg
}

/** LP構成からワイヤーフレームSVGを生成 */
export function generateWireframeSvg(
  sections: LpSectionDef[],
  options?: WireframeOptions
): string {
  const width = options?.width ?? 400
  const baseH = options?.baseHeight ?? 120
  const accent = options?.accentColor ?? '#1e40af'

  const sectionHeights = sections.map((s) => {
    const ratio = s.heightRatio || 0.8
    return Math.max(80, Math.round(baseH * ratio))
  })
  const totalHeight = sectionHeights.reduce((a, b) => a + b, 0) + 2

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${totalHeight}" width="${width}" height="${totalHeight}">
  <defs>
    <filter id="wf-shadow" x="-4%" y="-4%" width="108%" height="112%">
      <feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.05"/>
    </filter>
    <linearGradient id="ctaGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accent}"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${totalHeight}" fill="#f8fafc" rx="4" stroke="#e2e8f0" stroke-width="0.5"/>`

  let currentY = 1
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i]
    const h = sectionHeights[i]
    const isEven = i % 2 === 0
    const t = sec.type as string

    if (t !== 'hero' && t !== 'cta' && t !== 'footer') {
      svg += `<rect x="1" y="${currentY}" width="${width - 2}" height="${h}" fill="${isEven ? '#ffffff' : '#f8fafc'}"/>`
      if (i > 0) svg += `<line x1="1" y1="${currentY}" x2="${width - 1}" y2="${currentY}" stroke="#e2e8f0" stroke-width="0.5"/>`
    }

    svg += renderSection(sec, i, 1, currentY, width - 2, h, accent)
    currentY += h
  }

  svg += '</svg>'
  return svg
}
