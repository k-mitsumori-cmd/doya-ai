'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

interface ArticleTemplate {
  id: string
  title: string
  genre: string
  genreLabel: string
  industry: string
  description: string
  sampleTitle: string
  sampleExcerpt: string
  tags: string[]
  icon: string
  gradient: string
  estimatedLength: string
}

// カテゴリ別の静的サムネイル画像パス
// scripts/generate-interview-category-images.mjs で事前生成
const CATEGORY_IMAGES: Record<string, string> = {
  'IT・テクノロジー': '/interview/templates/it-technology.png',
  '医療・ヘルスケア': '/interview/templates/medical-healthcare.png',
  'スタートアップ': '/interview/templates/startup.png',
  '金融・保険': '/interview/templates/finance.png',
  '製造業': '/interview/templates/manufacturing.png',
  '教育': '/interview/templates/education.png',
  '小売・EC': '/interview/templates/retail-ec.png',
  '不動産': '/interview/templates/realestate.png',
}

const ARTICLE_TEMPLATES: ArticleTemplate[] = [
  {
    id: 'case-study-it',
    title: 'IT企業 導入事例',
    genre: 'CASE_STUDY',
    genreLabel: '導入事例',
    industry: 'IT・テクノロジー',
    description: 'SaaSプロダクトの導入事例インタビュー。課題→導入→成果の構成。',
    sampleTitle: 'クラウド会計ソフト導入で経理業務を80%削減——株式会社テックイノベーション',
    sampleExcerpt: '「以前は月末の経理処理に丸3日かかっていました」と語るのは、株式会社テックイノベーションの経理部長・田中氏。クラウド会計ソフトの導入により...',
    tags: ['SaaS', '導入事例', 'BtoB'],
    icon: 'computer',
    gradient: 'from-blue-500 to-indigo-600',
    estimatedLength: '約3,000文字',
  },
  {
    id: 'case-study-medical',
    title: '医療・ヘルスケア 導入事例',
    genre: 'CASE_STUDY',
    genreLabel: '導入事例',
    industry: '医療・ヘルスケア',
    description: '医療機関でのシステム導入事例。患者満足度や業務効率の改善を中心に。',
    sampleTitle: '電子カルテ刷新で診察時間を30%短縮——〇〇クリニック院長インタビュー',
    sampleExcerpt: '地域密着型のクリニックとして20年以上の歴史を持つ〇〇クリニック。院長の佐藤先生に、電子カルテシステムの刷新について...',
    tags: ['医療', 'DX', '業務効率化'],
    icon: 'local_hospital',
    gradient: 'from-emerald-500 to-teal-600',
    estimatedLength: '約3,500文字',
  },
  {
    id: 'founder-startup',
    title: 'スタートアップ 創業者インタビュー',
    genre: 'FOUNDER_INTERVIEW',
    genreLabel: '創業者インタビュー',
    industry: 'スタートアップ',
    description: '創業の想い、事業の成長ストーリー、今後のビジョンを語る。',
    sampleTitle: '「世界を変える」と決めた23歳の挑戦——AIスタートアップCEOインタビュー',
    sampleExcerpt: '大学在学中に起業し、わずか2年で従業員50名を超える規模に成長させた山田CEO。「きっかけは大学の研究室で...',
    tags: ['起業', 'ビジョン', 'スタートアップ'],
    icon: 'rocket_launch',
    gradient: 'from-purple-500 to-violet-600',
    estimatedLength: '約4,000文字',
  },
  {
    id: 'expert-finance',
    title: '金融 専門家インタビュー',
    genre: 'EXPERT_INTERVIEW',
    genreLabel: '専門家インタビュー',
    industry: '金融・保険',
    description: '業界の専門家に聞く最新トレンドと今後の展望。',
    sampleTitle: '2024年の投資トレンドを読む——ファンドマネージャー鈴木氏に聞く',
    sampleExcerpt: '20年以上にわたり機関投資家向けファンドを運用してきた鈴木氏。「今年の市場は大きな転換点を迎えている」と語る...',
    tags: ['金融', '投資', 'トレンド'],
    icon: 'account_balance',
    gradient: 'from-amber-500 to-orange-600',
    estimatedLength: '約3,000文字',
  },
  {
    id: 'employee-manufacturing',
    title: '製造業 社員インタビュー',
    genre: 'EMPLOYEE_INTERVIEW',
    genreLabel: '社員インタビュー',
    industry: '製造業',
    description: '現場で働く社員の声を記事に。採用広報やブランディングに最適。',
    sampleTitle: '「ものづくりの現場から」——入社3年目エンジニアが語るやりがい',
    sampleExcerpt: '朝7時半、工場の大きな扉が開く。入社3年目の高橋さんは、今日も製造ラインの最終チェックを担当する。「毎日同じ製品を作っているように...',
    tags: ['採用広報', '社員紹介', '製造業'],
    icon: 'precision_manufacturing',
    gradient: 'from-slate-500 to-zinc-600',
    estimatedLength: '約2,500文字',
  },
  {
    id: 'case-study-education',
    title: '教育 導入事例',
    genre: 'CASE_STUDY',
    genreLabel: '導入事例',
    industry: '教育',
    description: '教育機関でのICT活用事例。学習効果の向上を数値で示す。',
    sampleTitle: 'オンライン授業で出席率95%を実現——〇〇大学の挑戦',
    sampleExcerpt: 'コロナ禍をきっかけにオンライン授業を本格導入した〇〇大学。当初は「対面授業に比べて質が下がるのでは」という懸念も...',
    tags: ['教育', 'EdTech', 'オンライン'],
    icon: 'school',
    gradient: 'from-cyan-500 to-blue-600',
    estimatedLength: '約3,000文字',
  },
  {
    id: 'product-retail',
    title: '小売・EC プロダクトインタビュー',
    genre: 'PRODUCT_INTERVIEW',
    genreLabel: 'プロダクトインタビュー',
    industry: '小売・EC',
    description: '商品やサービスの開発背景、こだわりを深掘り。',
    sampleTitle: '累計10万個突破のヒット商品はこうして生まれた——開発責任者に聞く',
    sampleExcerpt: '発売からわずか半年で累計10万個を突破した「〇〇シリーズ」。SNSでの口コミが爆発的に広がり、一時は在庫が...',
    tags: ['EC', '商品開発', 'D2C'],
    icon: 'shopping_bag',
    gradient: 'from-pink-500 to-rose-600',
    estimatedLength: '約2,500文字',
  },
  {
    id: 'expert-realestate',
    title: '不動産 専門家インタビュー',
    genre: 'EXPERT_INTERVIEW',
    genreLabel: '専門家インタビュー',
    industry: '不動産',
    description: '不動産市場の動向や投資戦略を専門家に聞く。',
    sampleTitle: '都心マンション市場の行方——不動産アナリスト山本氏が予測する2024年',
    sampleExcerpt: '「東京都心のマンション価格は、この10年で約1.5倍に上昇しました」。不動産リサーチ会社でチーフアナリストを務める...',
    tags: ['不動産', '投資', '市場分析'],
    icon: 'apartment',
    gradient: 'from-green-500 to-emerald-600',
    estimatedLength: '約3,500文字',
  },
]

const INDUSTRY_FILTERS = [
  { value: 'all', label: 'すべて' },
  { value: 'IT・テクノロジー', label: 'IT' },
  { value: '医療・ヘルスケア', label: '医療' },
  { value: 'スタートアップ', label: 'スタートアップ' },
  { value: '金融・保険', label: '金融' },
  { value: '製造業', label: '製造業' },
  { value: '教育', label: '教育' },
  { value: '小売・EC', label: '小売・EC' },
  { value: '不動産', label: '不動産' },
]

export default function TemplatesPage() {
  const router = useRouter()
  const [selectedIndustry, setSelectedIndustry] = useState('all')
  const [selectedTemplate, setSelectedTemplate] = useState<ArticleTemplate | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const filteredTemplates = selectedIndustry === 'all'
    ? ARTICLE_TEMPLATES
    : ARTICLE_TEMPLATES.filter(t => t.industry === selectedIndustry)

  const handleCreateFromTemplate = async (template: ArticleTemplate) => {
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/interview/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: template.sampleTitle,
          genre: template.genre,
          intervieweeName: '',
          description: template.description,
        }),
      })
      const data = await res.json()
      if (data.success && data.project?.id) {
        router.push(`/interview/projects/${data.project.id}`)
      } else {
        setCreateError(data.error || 'プロジェクトの作成に失敗しました')
      }
    } catch (e) {
      console.error('Template project creation error:', e)
      setCreateError('通信エラーが発生しました。もう一度お試しください。')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-black text-slate-900">テンプレートギャラリー</h1>
        <p className="text-sm text-slate-500 mt-1">業種別のサンプル記事テンプレートから、ワンクリックでプロジェクトを作成できます</p>
      </div>

      {/* 業種フィルタ */}
      <div className="flex flex-wrap gap-2">
        {INDUSTRY_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setSelectedIndustry(f.value)}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
              selectedIndustry === f.value
                ? 'bg-[#7f19e6] text-white shadow-lg shadow-[#7f19e6]/20'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-[#7f19e6]/30 hover:text-[#7f19e6]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* テンプレートグリッド */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTemplates.map((template, index) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:border-[#7f19e6]/20 transition-all group cursor-pointer"
              onClick={() => setSelectedTemplate(template)}
            >
              {/* カードヘッダー（画像 or グラデーション） */}
              <div className={`h-36 bg-gradient-to-r ${template.gradient} relative overflow-hidden`}>
                <img
                  src={CATEGORY_IMAGES[template.industry]}
                  alt={template.industry}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                <div className="absolute bottom-3 left-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-white text-2xl drop-shadow-lg">{template.icon}</span>
                  <div>
                    <p className="text-white text-xs font-bold opacity-80 drop-shadow">{template.genreLabel}</p>
                    <p className="text-white text-sm font-black drop-shadow-lg">{template.industry}</p>
                  </div>
                </div>
                <div className="absolute top-3 right-3">
                  <span className="px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded-full text-white text-[10px] font-bold">{template.estimatedLength}</span>
                </div>
              </div>

              {/* カードボディ */}
              <div className="p-4">
                <h3 className="text-base font-black text-slate-900 mb-1 group-hover:text-[#7f19e6] transition-colors">{template.title}</h3>
                <p className="text-xs text-slate-500 mb-3 line-clamp-2">{template.description}</p>

                {/* サンプルタイトル */}
                <div className="bg-slate-50 rounded-xl p-3 mb-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">サンプル記事</p>
                  <p className="text-sm font-bold text-slate-800 line-clamp-2">{template.sampleTitle}</p>
                </div>

                {/* タグ */}
                <div className="flex flex-wrap gap-1.5">
                  {template.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
        ))}
      </div>

      {/* テンプレート詳細モーダル */}
      <AnimatePresence>
        {selectedTemplate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedTemplate(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* モーダルヘッダー */}
              <div className={`h-40 bg-gradient-to-r ${selectedTemplate.gradient} relative overflow-hidden`}>
                <img
                  src={CATEGORY_IMAGES[selectedTemplate.industry]}
                  alt={selectedTemplate.industry}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors"
                >
                  <span className="material-symbols-outlined text-white text-[16px]">close</span>
                </button>
                <div className="absolute bottom-4 left-6 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-2xl">{selectedTemplate.icon}</span>
                  </div>
                  <div>
                    <p className="text-white/80 text-xs font-bold">{selectedTemplate.genreLabel} / {selectedTemplate.industry}</p>
                    <h2 className="text-white text-xl font-black drop-shadow">{selectedTemplate.title}</h2>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-5">
                <p className="text-sm text-slate-600">{selectedTemplate.description}</p>

                {/* サンプル記事プレビュー */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-[16px] text-[#7f19e6]">article</span>
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">サンプル記事</span>
                  </div>
                  <h3 className="text-base font-black text-slate-900 mb-2">{selectedTemplate.sampleTitle}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{selectedTemplate.sampleExcerpt}</p>
                </div>

                {/* メタ情報 */}
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">text_fields</span>
                    <span className="font-bold">{selectedTemplate.estimatedLength}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">category</span>
                    <span className="font-bold">{selectedTemplate.genreLabel}</span>
                  </div>
                </div>

                {/* タグ */}
                <div className="flex flex-wrap gap-2">
                  {selectedTemplate.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">{tag}</span>
                  ))}
                </div>

                {/* エラー表示 */}
                {createError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <span className="material-symbols-outlined text-red-500 text-[16px]">error</span>
                    <p className="text-sm text-red-600 font-bold">{createError}</p>
                  </div>
                )}

                {/* CTA */}
                <div className="space-y-3 pt-2">
                  <button
                    onClick={() => handleCreateFromTemplate(selectedTemplate)}
                    disabled={creating}
                    className="w-full py-4 px-6 rounded-2xl font-bold text-white bg-gradient-to-r from-[#7f19e6] to-blue-600 hover:from-[#152e70] hover:to-blue-700 shadow-lg shadow-[#7f19e6]/30 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:transform-none"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[20px]">{creating ? 'sync' : 'add_circle'}</span>
                      {creating ? 'プロジェクト作成中...' : 'このテンプレートで記事を作成'}
                    </span>
                  </button>
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    className="w-full py-3 px-6 rounded-2xl text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    閉じる
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
