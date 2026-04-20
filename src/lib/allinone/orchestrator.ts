/**
 * ドヤマーケAI オーケストレーター
 *
 * URL を受け取り、並列で分析を走らせて SSE で段階的に結果を返す。
 * 各ステップは Promise.allSettled で独立に実行し、1つが失敗しても全体は止めない。
 *
 * 使い方:
 *   await runAnalysis({
 *     url, targetKeyword, analysisId,
 *     send: (evt) => ctrl.send(evt),
 *     save: async (patch) => prisma.allinoneAnalysis.update({ ... }),
 *   })
 */

import { scrapeUrl } from './scrape'
import { fetchPageSpeed } from './pagespeed'
import { callClaude } from './claude'
import { generateImage } from './imageGen'
import {
  SYSTEM_ANALYST,
  SYSTEM_PERSONA,
  SYSTEM_BRANDING,
  SYSTEM_VISUAL,
  SYSTEM_ACTION,
  SYSTEM_SUMMARY,
  buildSitePrompt,
  buildSeoPrompt,
  buildPersonaPrompt,
  buildBrandingPrompt,
  buildVisualPrompt,
  buildActionPrompt,
  buildSummaryPrompt,
} from './prompts'
import type {
  ActionItem,
  AnalyzeSseEvent,
  BrandingAnalysis,
  FullAnalysisResult,
  KeyVisual,
  Persona,
  ScrapeResult,
  SeoAnalysis,
  SiteAnalysis,
  AnalysisSummary,
} from './types'

export interface RunAnalysisParams {
  url: string
  targetKeyword?: string
  analysisId: string
  send: (evt: AnalyzeSseEvent) => void
  save: (patch: {
    progress?: any
    title?: string
    description?: string
    favicon?: string
    heroImage?: string
    ogImage?: string
    siteAnalysis?: SiteAnalysis
    seoAnalysis?: SeoAnalysis
    personas?: Persona[]
    branding?: BrandingAnalysis
    keyVisuals?: KeyVisual[]
    actionPlan?: ActionItem[]
    summary?: AnalysisSummary
    overallScore?: number
    radar?: any
    status?: string
    errorMessage?: string
  }) => Promise<void>
  saveAsset?: (asset: {
    kind: string
    url: string
    label?: string
    mimeType?: string
    prompt?: string
    meta?: any
    width?: number
    height?: number
  }) => Promise<void>
}

export async function runAnalysis(params: RunAnalysisParams): Promise<FullAnalysisResult | null> {
  const { url, targetKeyword, send, save, saveAsset } = params
  const progress: Record<string, 'pending' | 'running' | 'done' | 'error'> = {
    scrape: 'pending',
    pagespeed: 'pending',
    site: 'pending',
    seo: 'pending',
    persona: 'pending',
    branding: 'pending',
    visual: 'pending',
    action: 'pending',
    summary: 'pending',
  }

  const mark = (step: string, status: 'running' | 'done' | 'error', detail?: string) => {
    progress[step] = status
    send({ type: 'progress', step: step as any, status, detail })
    // 非同期保存（例外は無視）
    save({ progress }).catch(() => {})
  }

  // ============================================
  // Step 1: scrape（同期で必要。以降全てがこれに依存）
  // ============================================
  send({ type: 'status', message: 'サイトを読み取っています…' })
  mark('scrape', 'running')
  let scrape: ScrapeResult
  try {
    scrape = await scrapeUrl(url)
  } catch (err) {
    mark('scrape', 'error', err instanceof Error ? err.message : String(err))
    send({ type: 'error', message: `サイト取得に失敗: ${err instanceof Error ? err.message : 'unknown'}` })
    await save({
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : 'scrape failed',
      progress,
    })
    return null
  }
  mark('scrape', 'done', `${scrape.headings.h1.length} 見出し / ${scrape.imageCount} 画像検出`)
  send({
    type: 'scrape_done',
    scrape: {
      title: scrape.title,
      description: scrape.description,
      favicon: scrape.favicon,
      ogImage: scrape.ogImage,
      heroImage: scrape.heroImage,
      mainColors: scrape.mainColors,
      fonts: scrape.fonts,
      mainImages: scrape.mainImages,
      socialLinks: scrape.socialLinks,
      ctaTexts: scrape.ctaTexts,
      internalLinks: scrape.internalLinks,
      externalLinks: scrape.externalLinks,
    },
  })
  await save({
    title: scrape.title,
    description: scrape.description,
    favicon: scrape.favicon,
    ogImage: scrape.ogImage,
    heroImage: scrape.heroImage,
    progress,
  })

  // ============================================
  // Step 2: 並列実行
  // ============================================
  send({ type: 'status', message: 'AI に分析を依頼しています…' })

  const pagespeedPromise = (async () => {
    mark('pagespeed', 'running')
    const [mobile, desktop] = await Promise.all([
      fetchPageSpeed(scrape.finalUrl, 'mobile'),
      fetchPageSpeed(scrape.finalUrl, 'desktop'),
    ])
    mark(
      'pagespeed',
      'done',
      mobile
        ? `Mobile Perf: ${mobile.performanceScore ?? '?'} / SEO: ${mobile.seoScore ?? '?'}`
        : 'APIキー未設定のためスキップ'
    )
    return { mobile, desktop }
  })()

  // サイト分析（PageSpeed 待ちで並列）
  const sitePromise = (async (): Promise<SiteAnalysis | null> => {
    mark('site', 'running')
    try {
      const ps = await pagespeedPromise
      const prompt = buildSitePrompt(scrape, ps)
      const { json } = await callClaude({
        systemPrompt: SYSTEM_ANALYST,
        messages: [{ role: 'user', content: prompt }],
        model: 'power',
        maxTokens: 3500,
        jsonMode: true,
        temperature: 0.4,
      })
      if (!json) throw new Error('サイト分析 JSON 取得に失敗')
      const site: SiteAnalysis = {
        firstImpression: String(json.firstImpression || ''),
        firstImpressionScore: Number(json.firstImpressionScore || 60),
        strengths: json.strengths || [],
        weaknesses: json.weaknesses || [],
        issues: json.issues || [],
        mobileFriendly: Boolean(json.mobileFriendly ?? scrape.hasViewport),
        hasHttps: scrape.finalUrl.startsWith('https://'),
        pageSpeedMobile: ps.mobile,
        pageSpeedDesktop: ps.desktop,
        mainColors: (json.mainColors && json.mainColors.length ? json.mainColors : scrape.mainColors) || [],
        fonts: (json.fonts && json.fonts.length ? json.fonts : scrape.fonts) || [],
        ctaEvaluation: String(json.ctaEvaluation || ''),
        trustSignals: json.trustSignals || [],
      }
      mark('site', 'done', `課題 ${site.issues.length} 件`)
      send({ type: 'site_done', site })
      await save({ siteAnalysis: site })
      return site
    } catch (err) {
      mark('site', 'error', err instanceof Error ? err.message : 'unknown')
      return null
    }
  })()

  const seoPromise = (async (): Promise<SeoAnalysis | null> => {
    mark('seo', 'running')
    try {
      const prompt = buildSeoPrompt(scrape, targetKeyword)
      const { json } = await callClaude({
        systemPrompt: SYSTEM_ANALYST,
        messages: [{ role: 'user', content: prompt }],
        model: 'power',
        maxTokens: 3500,
        jsonMode: true,
        temperature: 0.5,
      })
      if (!json) throw new Error('SEO 分析 JSON 取得に失敗')
      const seo: SeoAnalysis = {
        estimatedTargetKeywords: json.estimatedTargetKeywords || [],
        missingKeywords: json.missingKeywords || [],
        topicClusters: json.topicClusters || [],
        headingIssues: json.headingIssues || [],
        contentGaps: json.contentGaps || [],
        internalLinkScore: Number(json.internalLinkScore || 50),
        quickWins: json.quickWins || [],
      }
      mark('seo', 'done', `ギャップ ${seo.contentGaps.length} 件`)
      send({ type: 'seo_done', seo })
      await save({ seoAnalysis: seo })
      return seo
    } catch (err) {
      mark('seo', 'error', err instanceof Error ? err.message : 'unknown')
      return null
    }
  })()

  const personaPromise = (async (): Promise<Persona[]> => {
    mark('persona', 'running')
    try {
      const prompt = buildPersonaPrompt(scrape, targetKeyword)
      const { json } = await callClaude({
        systemPrompt: SYSTEM_PERSONA,
        messages: [{ role: 'user', content: prompt }],
        model: 'power',
        maxTokens: 3000,
        jsonMode: true,
        temperature: 0.8,
      })
      const rawList: any[] = json?.personas || []
      const personas: Persona[] = rawList.slice(0, 3).map((p: any, i: number) => ({
        id: String(p.id || `persona-${i + 1}`),
        name: String(p.name || `ペルソナ${i + 1}`),
        age: Number(p.age || 30),
        gender: p.gender,
        occupation: String(p.occupation || ''),
        lifestyle: String(p.lifestyle || ''),
        motivation: String(p.motivation || ''),
        painPoint: String(p.painPoint || ''),
        buyingTrigger: String(p.buyingTrigger || ''),
        objection: String(p.objection || ''),
        informationSource: p.informationSource || [],
        quote: String(p.quote || ''),
        palette: p.palette,
      }))
      mark('persona', 'done', `${personas.length} 名生成`)
      send({ type: 'persona_done', personas })
      await save({ personas })

      // 肖像画像（非同期・順次）— 失敗しても本体は継続
      for (const p of personas) {
        generateImage({
          prompt: `Portrait photo of a Japanese ${p.gender || 'adult'} around age ${p.age}, ${p.occupation}. Mood: ${p.lifestyle.slice(0, 80)}. Confident expression, soft natural daylight, neutral modern background, high-end editorial photography quality, shallow depth of field, 85mm lens, 4k.`,
          aspectRatio: '1:1',
          style: 'portrait',
        })
          .then(async (img) => {
            p.portraitUrl = img.dataUrl
            await save({ personas })
            if (saveAsset) {
              await saveAsset({
                kind: 'persona',
                url: img.dataUrl,
                label: p.name,
                mimeType: img.mimeType,
                prompt: img.prompt,
                width: img.width,
                height: img.height,
                meta: { personaId: p.id, provider: img.provider },
              })
            }
            send({ type: 'persona_done', personas })
          })
          .catch(() => {})
      }
      return personas
    } catch (err) {
      mark('persona', 'error', err instanceof Error ? err.message : 'unknown')
      return []
    }
  })()

  const brandingPromise = (async (): Promise<BrandingAnalysis | null> => {
    mark('branding', 'running')
    try {
      const prompt = buildBrandingPrompt(scrape)
      const { json } = await callClaude({
        systemPrompt: SYSTEM_BRANDING,
        messages: [{ role: 'user', content: prompt }],
        model: 'power',
        maxTokens: 1800,
        jsonMode: true,
        temperature: 0.5,
      })
      if (!json) throw new Error('ブランディング分析に失敗')
      const branding: BrandingAnalysis = {
        tone: String(json.tone || ''),
        toneTags: json.toneTags || [],
        palette: (json.palette && json.palette.length ? json.palette : scrape.mainColors).slice(0, 6),
        fontImpression: String(json.fontImpression || ''),
        visualStyle: String(json.visualStyle || ''),
        consistency: Number(json.consistency || 65),
        improvements: json.improvements || [],
      }
      mark('branding', 'done', `トーン: ${branding.tone.slice(0, 30)}`)
      send({ type: 'branding_done', branding })
      await save({ branding })
      return branding
    } catch (err) {
      mark('branding', 'error', err instanceof Error ? err.message : 'unknown')
      return null
    }
  })()

  // キービジュアル（ブランディング待ち）
  const visualPromise = (async (): Promise<KeyVisual[]> => {
    mark('visual', 'running')
    try {
      const branding = await brandingPromise
      const prompt = buildVisualPrompt(
        scrape,
        branding?.tone || '',
        branding?.palette || scrape.mainColors || []
      )
      const { json } = await callClaude({
        systemPrompt: SYSTEM_VISUAL,
        messages: [{ role: 'user', content: prompt }],
        model: 'power',
        maxTokens: 2500,
        jsonMode: true,
        temperature: 0.85,
      })
      const rawList: any[] = json?.visuals || []
      const visuals: KeyVisual[] = rawList.slice(0, 3).map((v: any, i: number) => ({
        id: String(v.id || String.fromCharCode(65 + i)),
        concept: String(v.concept || ''),
        headline: String(v.headline || ''),
        subcopy: String(v.subcopy || ''),
        palette: v.palette || [],
        prompt: String(v.prompt || ''),
      }))
      mark('visual', 'done', `${visuals.length} 案を設計`)

      // 画像を 1案ずつ順番に生成（SSE で「ビュン」演出に合わせて順次出す）
      for (let i = 0; i < visuals.length; i++) {
        const kv = visuals[i]
        try {
          const img = await generateImage({
            prompt: kv.prompt || `Marketing key visual for "${scrape.title}". ${kv.concept}. Style: modern, aspirational, clean composition, professional photography, natural lighting.`,
            aspectRatio: '16:9',
            style: 'brand',
          })
          kv.imageUrl = img.dataUrl
          if (saveAsset) {
            await saveAsset({
              kind: 'keyVisual',
              url: img.dataUrl,
              label: `${kv.id} ${kv.concept.slice(0, 40)}`,
              mimeType: img.mimeType,
              width: img.width,
              height: img.height,
              prompt: kv.prompt,
              meta: { visualId: kv.id, provider: img.provider },
            })
          }
        } catch {
          /* 画像失敗でもレイアウトは維持 */
        }
        send({ type: 'key_visual', visual: kv, index: i })
        await save({ keyVisuals: visuals })
      }
      return visuals
    } catch (err) {
      mark('visual', 'error', err instanceof Error ? err.message : 'unknown')
      return []
    }
  })()

  // ============================================
  // Step 3: アクション + サマリー（他全ての結果を待つ）
  // ============================================
  const [site, seo, personas, branding, visuals] = await Promise.all([
    sitePromise,
    seoPromise,
    personaPromise,
    brandingPromise,
    visualPromise,
  ])

  const contextForSummary = buildContextString({ scrape, site, seo, personas, branding })

  const actionPromise = (async (): Promise<ActionItem[]> => {
    mark('action', 'running')
    try {
      const { json } = await callClaude({
        systemPrompt: SYSTEM_ACTION,
        messages: [{ role: 'user', content: buildActionPrompt(contextForSummary) }],
        model: 'power',
        maxTokens: 3500,
        jsonMode: true,
        temperature: 0.5,
      })
      const rawList: any[] = json?.actions || []
      const actions: ActionItem[] = rawList.map((a: any, i: number) => {
        const rel = a.relatedService
        const deepLink = buildDeepLink(rel, { siteUrl: scrape.finalUrl, seo, personas })
        return {
          id: String(a.id || `act-${i + 1}`),
          priority: Number(a.priority || 3) as any,
          title: String(a.title || ''),
          description: String(a.description || ''),
          expectedImpact: String(a.expectedImpact || ''),
          effort: (a.effort || '中') as any,
          durationDays: Number(a.durationDays || 7),
          relatedService: rel,
          deepLink,
        }
      })
      mark('action', 'done', `${actions.length} アクション`)
      await save({ actionPlan: actions })
      return actions
    } catch (err) {
      mark('action', 'error', err instanceof Error ? err.message : 'unknown')
      return []
    }
  })()

  const actions = await actionPromise

  const summaryPromise = (async (): Promise<AnalysisSummary | null> => {
    mark('summary', 'running')
    try {
      const { json } = await callClaude({
        systemPrompt: SYSTEM_SUMMARY,
        messages: [{ role: 'user', content: buildSummaryPrompt(contextForSummary) }],
        model: 'power',
        maxTokens: 2000,
        jsonMode: true,
        temperature: 0.4,
      })
      if (!json) throw new Error('サマリ生成に失敗')
      const summary: AnalysisSummary = {
        headline: String(json.headline || ''),
        overallScore: Number(json.overallScore || 60),
        radar: {
          site: Number(json.radar?.site || 60),
          seo: Number(json.radar?.seo || 60),
          content: Number(json.radar?.content || 60),
          targeting: Number(json.radar?.targeting || 60),
          appeal: Number(json.radar?.appeal || 60),
        },
        topThreeActions: json.topThreeActions || [],
        elevatorPitch: String(json.elevatorPitch || ''),
        competitorHint: String(json.competitorHint || ''),
      }
      mark('summary', 'done', `総合スコア: ${summary.overallScore}`)
      send({ type: 'summary_done', summary, actionPlan: actions })
      await save({
        summary,
        overallScore: summary.overallScore,
        radar: summary.radar,
        status: 'completed',
      })
      return summary
    } catch (err) {
      mark('summary', 'error', err instanceof Error ? err.message : 'unknown')
      await save({ status: 'completed', actionPlan: actions })
      return null
    }
  })()

  const summary = await summaryPromise

  return {
    summary,
    siteAnalysis: site,
    seoAnalysis: seo,
    personas,
    branding,
    keyVisuals: visuals,
    actionPlan: actions,
  }
}

// ============================================
// ヘルパー: ディープリンク構築
// ============================================

function buildDeepLink(
  service: string | undefined,
  ctx: { siteUrl: string; seo: SeoAnalysis | null; personas: Persona[] }
): string | undefined {
  if (!service) return undefined
  const enc = encodeURIComponent
  switch (service) {
    case 'seo': {
      const topic = ctx.seo?.topicClusters?.[0]?.theme
      const kws = ctx.seo?.missingKeywords?.slice(0, 6).join(',')
      const q = new URLSearchParams()
      if (topic) q.set('topic', topic)
      if (kws) q.set('keywords', kws)
      if (ctx.personas[0]) q.set('targetPersona', ctx.personas[0].id)
      const qs = q.toString()
      return qs ? `/seo?${qs}` : '/seo'
    }
    case 'banner':
      return `/banner?siteUrl=${enc(ctx.siteUrl)}`
    case 'lp':
      return `/lp?siteUrl=${enc(ctx.siteUrl)}`
    case 'persona':
      return `/persona?siteUrl=${enc(ctx.siteUrl)}`
    case 'copy':
      return `/copy?siteUrl=${enc(ctx.siteUrl)}`
    case 'adsim':
      return `/adsim?siteUrl=${enc(ctx.siteUrl)}`
    case 'movie':
      return `/movie?siteUrl=${enc(ctx.siteUrl)}`
    case 'voice':
      return `/voice?siteUrl=${enc(ctx.siteUrl)}`
    default:
      return undefined
  }
}

function buildContextString(input: {
  scrape: ScrapeResult
  site: SiteAnalysis | null
  seo: SeoAnalysis | null
  personas: Persona[]
  branding: BrandingAnalysis | null
}): string {
  const { scrape, site, seo, personas, branding } = input
  return [
    `# サイト基本情報`,
    `URL: ${scrape.finalUrl}`,
    `タイトル: ${scrape.title}`,
    `説明: ${scrape.description}`,
    ``,
    `# サイト診断`,
    site
      ? `第一印象: ${site.firstImpression} (score ${site.firstImpressionScore})\n強み: ${site.strengths.join(' / ')}\n弱み: ${site.weaknesses.join(' / ')}\n課題数: ${site.issues.length} / 高重要度: ${site.issues.filter((i) => i.severity === 'high').length}\nCTA評価: ${site.ctaEvaluation}`
      : '(取得失敗)',
    ``,
    `# SEO 診断`,
    seo
      ? `想定キーワード: ${seo.estimatedTargetKeywords.slice(0, 6).join(' / ')}\n不足キーワード: ${seo.missingKeywords.slice(0, 6).join(' / ')}\nコンテンツギャップ: ${seo.contentGaps.map((g) => g.title).slice(0, 6).join(' / ')}\n内部リンクスコア: ${seo.internalLinkScore}`
      : '(取得失敗)',
    ``,
    `# ペルソナ (${personas.length} 名)`,
    personas
      .map(
        (p) =>
          `- ${p.name}/${p.age}歳/${p.occupation} | 動機: ${p.motivation} | 痛み: ${p.painPoint}`
      )
      .join('\n'),
    ``,
    `# ブランディング`,
    branding
      ? `トーン: ${branding.tone}\nパレット: ${branding.palette.join(', ')}\n整合性: ${branding.consistency}/100\n改善: ${branding.improvements.join(' / ')}`
      : '(取得失敗)',
  ].join('\n')
}
