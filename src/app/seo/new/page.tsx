'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Stepper } from '@seo/components/ui/Stepper'
import { Card, CardBody, CardHeader, CardTitle, CardDesc } from '@seo/components/ui/Card'
import { Button } from '@seo/components/ui/Button'
import { Toggle } from '@seo/components/ui/Toggle'
import { Badge } from '@seo/components/ui/Badge'
import { Sparkles, Wand2, Save, UploadCloud } from 'lucide-react'

const TARGETS = [10000, 20000, 30000, 40000, 50000, 60000]
const TONES = ['丁寧', 'フランク', 'ビジネス', '専門的'] as const
const STORAGE_KEY = 'doya_seo_new_draft_v1'

export default function SeoNewPage() {
  const router = useRouter()
  const steps = ['基本', '読者/意図', '参考/制約', 'LLMO要素', '確認']
  const [step, setStep] = useState(0)

  const [title, setTitle] = useState('')
  const [keywords, setKeywords] = useState('')
  const [persona, setPersona] = useState('')
  const [searchIntent, setSearchIntent] = useState('')
  const [targetChars, setTargetChars] = useState<number>(20000)
  const [referenceUrls, setReferenceUrls] = useState('')
  const [tone, setTone] = useState<(typeof TONES)[number]>('丁寧')
  const [forbidden, setForbidden] = useState('')
  const [llmo, setLlmo] = useState({
    tldr: true,
    conclusionFirst: true,
    faq: true,
    glossary: true,
    comparison: true,
    quotes: true,
    templates: true,
    objections: true,
  })

  const [loading, setLoading] = useState(false)
  const [predicting, setPredicting] = useState(false)
  const [predictedOnce, setPredictedOnce] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function fillSample() {
    setTitle('採用代行（RPO）徹底比較！おすすめ50社の特徴・料金、委託できる業務内容')
    setKeywords('採用代行, RPO, 採用アウトソーシング, 人事, 採用支援')
    setPersona('中堅企業の人事責任者。採用工数が逼迫しており、母集団形成〜面接調整を外注したい。失敗例や相場、選び方を知りたい。')
    setSearchIntent('定義/できること・できないこと/料金相場/比較表/選び方/失敗例/チェックリスト/FAQが欲しい')
    setTargetChars(50000)
    setReferenceUrls('')
    setTone('ビジネス')
    setForbidden('誇大表現NG, 競合名の断定的批判NG')
    setLlmo({
      tldr: true,
      conclusionFirst: true,
      faq: true,
      glossary: true,
      comparison: true,
      quotes: true,
      templates: true,
      objections: true,
    })
    setStep(0)
    setNotice('サンプルを入力しました（そのまま「ジョブ作成して開始」で生成できます）')
    setTimeout(() => setNotice(null), 3500)
  }

  const keywordList = useMemo(
    () =>
      keywords
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
    [keywords]
  )

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const d = JSON.parse(raw)
      setTitle(d.title || '')
      setKeywords(d.keywords || '')
      setPersona(d.persona || '')
      setSearchIntent(d.searchIntent || '')
      setTargetChars(Number(d.targetChars || 20000))
      setReferenceUrls(d.referenceUrls || '')
      setTone(d.tone || '丁寧')
      setForbidden(d.forbidden || '')
      setLlmo({ ...llmo, ...(d.llmo || {}) })
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function predictFromTitle(opts?: { silent?: boolean }) {
    const t = title.trim()
    if (t.length < 3) return

    setPredicting(true)
    if (!opts?.silent) setNotice(null)
    setError(null)
    try {
      const res = await fetch('/api/seo/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: t,
          seedKeywords: keywordList,
          tone,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || '推定に失敗しました')

      const p = json.predicted || {}
      const personaText = String(p.persona || '').trim()
      const intentText = String(p.searchIntent || '').trim()
      const kws = Array.isArray(p.keywords) ? p.keywords.map((s: any) => String(s).trim()).filter(Boolean) : []

      // 既にユーザーが書いたものは基本尊重（空のときだけ自動入力）
      if (!persona.trim() && personaText) setPersona(personaText)
      if (!searchIntent.trim() && intentText) setSearchIntent(intentText)
      if (!keywords.trim() && kws.length) setKeywords(kws.slice(0, 12).join(', '))

      setPredictedOnce(true)
      if (!opts?.silent) {
        setNotice('タイトルから読者/意図を推定して入力しました')
        setTimeout(() => setNotice(null), 2500)
      }
    } catch (e: any) {
      if (!opts?.silent) setError(e?.message || '不明なエラー')
    } finally {
      setPredicting(false)
    }
  }

  // タイトル入力後、ペルソナ/意図が空なら一度だけ自動推定（コスト暴発を防ぐ）
  useEffect(() => {
    if (predictedOnce) return
    if (!title.trim()) return
    if (persona.trim() || searchIntent.trim()) return

    const timer = setTimeout(() => {
      predictFromTitle({ silent: true })
    }, 900)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title])

  function saveDraft() {
    const payload = {
      title,
      keywords,
      persona,
      searchIntent,
      targetChars,
      referenceUrls,
      tone,
      forbidden,
      llmo,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    setNotice('下書きを保存しました')
    setTimeout(() => setNotice(null), 2500)
  }

  function clearDraft() {
    localStorage.removeItem(STORAGE_KEY)
    setNotice('下書きを削除しました')
    setTimeout(() => setNotice(null), 2500)
  }

  async function submit() {
    setLoading(true)
    setError(null)
    try {
      const payload = {
        title,
        keywords: keywordList,
        persona,
        searchIntent,
        targetChars,
        referenceUrls: referenceUrls
          .split(/\n/)
          .map((s) => s.trim())
          .filter(Boolean),
        tone,
        forbidden: forbidden
          .split(/[,\n]/)
          .map((s) => s.trim())
          .filter(Boolean),
        llmoOptions: llmo,
      }
      const res = await fetch('/api/seo/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || '作成に失敗しました')
      // シンプル導線: 記事ページへ移動し、裏で自動生成を開始（素材も生成される）
      router.push(`/seo/articles/${json.articleId}?auto=1`)
    } catch (e: any) {
      setError(e?.message || '不明なエラー')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">新規作成（SEO Studio）</h1>
          <p className="text-gray-600 mt-1">
            条件を入力して「作成して生成」を押すだけで、記事本文と素材を自動生成します（記事ページで進捗を確認できます）。
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" size="sm" onClick={fillSample}>
            <Sparkles className="w-4 h-4" />
            サンプル入力
          </Button>
          <Button variant="secondary" size="sm" onClick={saveDraft}>
            <Save className="w-4 h-4" />
            下書き保存
          </Button>
          <Button variant="ghost" size="sm" onClick={clearDraft}>
            破棄
          </Button>
        </div>
      </div>

      <div className="mt-5">
        <Stepper steps={steps} currentIndex={step} />
      </div>

      {notice ? (
        <div className="mt-4 p-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800">
          {notice}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm">
          <p className="font-bold">エラー</p>
          <p className="mt-1 whitespace-pre-wrap">{error}</p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6">
        {step === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>基本情報</CardTitle>
              <CardDesc>タイトルとキーワード、目標文字数とトーンを決めます。</CardDesc>
            </CardHeader>
            <CardBody className="grid gap-5">
              <div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="block text-sm font-bold text-gray-800">記事タイトル（仮でも可）*</label>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => predictFromTitle()}
                    disabled={predicting || !title.trim()}
                  >
                    <Wand2 className="w-4 h-4" />
                    {predicting ? '推定中...' : '読者/意図を自動入力'}
                  </Button>
                </div>
                <input
                  className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例）LLMOとは？SEOとの違いと実務で勝つための設計"
                />
                <p className="text-xs text-gray-500 mt-1">
                  タイトルを入れると、ペルソナ/検索意図/キーワード候補を推定して入力します（自動は初回のみ、ボタンで再実行可）。
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-800">取りたいキーワード（複数可）*</label>
                <input
                  className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="例）LLMO, AI検索最適化, SEO"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {keywordList.slice(0, 10).map((k) => (
                    <Badge key={k} tone="blue">
                      {k}
                    </Badge>
                  ))}
                  {keywordList.length > 10 ? <Badge tone="gray">+{keywordList.length - 10}</Badge> : null}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-800">目標文字数*</label>
                  <select
                    className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200"
                    value={targetChars}
                    onChange={(e) => setTargetChars(Number(e.target.value))}
                  >
                    {TARGETS.map((n) => (
                      <option key={n} value={n}>
                        {n.toLocaleString('ja-JP')}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">長文は分割生成で安定化します。</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-800">トーン*</label>
                  <select
                    className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200"
                    value={tone}
                    onChange={(e) => setTone(e.target.value as any)}
                  >
                    {TONES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">統合時に口調を揃えます。</p>
                </div>
              </div>
            </CardBody>
          </Card>
        ) : null}

        {step === 1 ? (
          <Card>
            <CardHeader>
              <CardTitle>読者・検索意図</CardTitle>
              <CardDesc>AIっぽさを抜くために、現場の状況・制約・判断基準を書きます。</CardDesc>
            </CardHeader>
            <CardBody className="grid gap-5">
              <div>
                <label className="block text-sm font-bold text-gray-800">想定読者（ペルソナ）</label>
                <textarea
                  className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 min-h-28"
                  value={persona}
                  onChange={(e) => setPersona(e.target.value)}
                  placeholder="例）BtoBマーケ担当。AI検索の影響が不安。社内稟議が必要。"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-800">検索意図</label>
                <textarea
                  className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 min-h-24"
                  value={searchIntent}
                  onChange={(e) => setSearchIntent(e.target.value)}
                  placeholder="例）定義/比較/手順/失敗例/チェックリスト/FAQが欲しい"
                />
              </div>
              <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50">
                <p className="font-bold text-amber-900">コツ</p>
                <ul className="text-sm text-amber-900 mt-1 space-y-1">
                  <li>・「なぜそう判断したか」「やって失敗した話」を入れると一気に人間味が出ます。</li>
                  <li>・社内稟議/予算/体制などの制約を書くと、具体例が作れます。</li>
                </ul>
              </div>
            </CardBody>
          </Card>
        ) : null}

        {step === 2 ? (
          <Card>
            <CardHeader>
              <CardTitle>参考URL・制約</CardTitle>
              <CardDesc>参考URLを要点化して“より良い記事”にします（丸写しはしません）。</CardDesc>
            </CardHeader>
            <CardBody className="grid gap-5">
              <div>
                <label className="block text-sm font-bold text-gray-800">参考URL（複数入力可）</label>
                <textarea
                  className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 min-h-28"
                  value={referenceUrls}
                  onChange={(e) => setReferenceUrls(e.target.value)}
                  placeholder={`https://example.com/article\nhttps://example.com/another`}
                />
                <p className="text-xs text-gray-500 mt-1">
                  可能なら主要な競合記事/公式ドキュメント/一次情報を混ぜるのが強いです。
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-800">禁止事項（競合名を出さない等）</label>
                <textarea
                  className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 min-h-20"
                  value={forbidden}
                  onChange={(e) => setForbidden(e.target.value)}
                  placeholder="例）競合A社名を出さない, 誇大表現NG"
                />
              </div>
            </CardBody>
          </Card>
        ) : null}

        {step === 3 ? (
          <Card>
            <CardHeader>
              <CardTitle>LLMO要素（ON/OFF）</CardTitle>
              <CardDesc>AI検索に強い記事構造をスイッチで制御します。</CardDesc>
            </CardHeader>
            <CardBody className="grid gap-3">
              <div className="grid md:grid-cols-2 gap-3">
                <Toggle checked={llmo.tldr} onChange={(v) => setLlmo({ ...llmo, tldr: v })} label="TL;DR" description="冒頭に要点を箇条書きで出力" />
                <Toggle
                  checked={llmo.conclusionFirst}
                  onChange={(v) => setLlmo({ ...llmo, conclusionFirst: v })}
                  label="結論ファースト＋根拠"
                  description="結論→理由→補足で迷子を防ぐ"
                />
                <Toggle checked={llmo.faq} onChange={(v) => setLlmo({ ...llmo, faq: v })} label="FAQ" description="構造化を意識したQ/A" />
                <Toggle checked={llmo.glossary} onChange={(v) => setLlmo({ ...llmo, glossary: v })} label="用語集" description="定義を固めて誤解を減らす" />
                <Toggle checked={llmo.comparison} onChange={(v) => setLlmo({ ...llmo, comparison: v })} label="比較表" description="意思決定を支える表を追加" />
                <Toggle checked={llmo.quotes} onChange={(v) => setLlmo({ ...llmo, quotes: v })} label="引用・根拠（言い換え）" description="参考URLの要点をオリジナルに整理" />
                <Toggle checked={llmo.templates} onChange={(v) => setLlmo({ ...llmo, templates: v })} label="実務テンプレ" description="チェックリスト/手順/例文" />
                <Toggle checked={llmo.objections} onChange={(v) => setLlmo({ ...llmo, objections: v })} label="反論に答える" description="読者の不安を先回りで潰す" />
              </div>

              <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50">
                <p className="font-bold text-gray-900 flex items-center gap-2">
                  <Wand2 className="w-4 h-4" /> 推奨セット
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setLlmo({
                        tldr: true,
                        conclusionFirst: true,
                        faq: true,
                        glossary: true,
                        comparison: true,
                        quotes: true,
                        templates: true,
                        objections: true,
                      })
                    }
                  >
                    フル装備
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setLlmo({
                        tldr: true,
                        conclusionFirst: true,
                        faq: true,
                        glossary: false,
                        comparison: true,
                        quotes: true,
                        templates: true,
                        objections: true,
                      })
                    }
                  >
                    実務寄り
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setLlmo({
                        tldr: true,
                        conclusionFirst: true,
                        faq: true,
                        glossary: true,
                        comparison: false,
                        quotes: true,
                        templates: false,
                        objections: false,
                      })
                    }
                  >
                    読み物寄り
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        ) : null}

        {step === 4 ? (
          <Card>
            <CardHeader>
              <CardTitle>確認</CardTitle>
              <CardDesc>この内容でジョブを作成します。</CardDesc>
            </CardHeader>
            <CardBody className="grid gap-4">
              <div className="grid md:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl border border-gray-200">
                  <p className="text-xs text-gray-500 font-bold">キーワード</p>
                  <p className="mt-2 font-bold text-gray-900">{keywordList.join(', ') || '未入力'}</p>
                </div>
                <div className="p-4 rounded-2xl border border-gray-200">
                  <p className="text-xs text-gray-500 font-bold">文字数/トーン</p>
                  <p className="mt-2 font-bold text-gray-900">
                    {targetChars.toLocaleString('ja-JP')} / {tone}
                  </p>
                </div>
                <div className="p-4 rounded-2xl border border-gray-200">
                  <p className="text-xs text-gray-500 font-bold">LLMO要素</p>
                  <p className="mt-2 text-sm text-gray-700">
                    {Object.entries(llmo)
                      .filter(([, v]) => v)
                      .map(([k]) => k)
                      .join(', ')}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50">
                <p className="font-bold text-amber-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> 重要
                </p>
                <ul className="text-sm text-amber-900 mt-1 space-y-1">
                  <li>・参考URLの文章は丸写ししません（要点化・言い換え・独自化）。</li>
                  <li>・生成結果は必ずユーザー最終確認を前提にしています。</li>
                </ul>
              </div>
            </CardBody>
          </Card>
        ) : null}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Button variant="ghost" onClick={() => router.push('/seo')}>
            キャンセル
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              戻る
            </Button>
            {step < steps.length - 1 ? (
              <Button
                variant="primary"
                onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
                disabled={step === 0 && (!title.trim() || keywordList.length === 0)}
              >
                次へ
              </Button>
            ) : (
              <Button variant="primary" onClick={submit} disabled={loading || !title.trim() || keywordList.length === 0}>
                <UploadCloud className="w-4 h-4" />
                    {loading ? '作成中...' : '作成して生成'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}


