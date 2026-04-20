'use client'

import { useState } from 'react'
import { articleTemplates } from '../data'

export default function GenerateBannersPage() {
  const [generating, setGenerating] = useState(false)
  const [results, setResults] = useState<Array<{ templateId: string; imageUrl: string | null; error?: string }>>([])
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([])

  const handleGenerateAll = async () => {
    setGenerating(true)
    setResults([])

    try {
      const response = await fetch('/api/seo/test/banners', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateIds: selectedTemplateIds.length > 0 ? selectedTemplateIds : undefined }),
      })

      const data = await response.json()

      if (data.success) {
        setResults(data.results)
        
        // 成功した結果をコンソールに出力（data.tsに反映用）
        const successResults = data.results.filter((r: any) => r.imageUrl)
        console.log('\n📝 Success results (copy to data.ts):')
        console.log(JSON.stringify(successResults, null, 2))
        
        // クリップボードにコピー用のテキストを生成
        const dataTsUpdate = generateDataTsUpdate(successResults)
        console.log('\n📋 data.ts update code:')
        console.log(dataTsUpdate)
      } else {
        alert(`エラー: ${data.error}`)
      }
    } catch (error: any) {
      alert(`エラーが発生しました: ${error.message}`)
    } finally {
      setGenerating(false)
    }
  }

  const handleGenerateSingle = async (templateId: string) => {
    try {
      const response = await fetch('/api/seo/test/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      })

      const data = await response.json()

      if (data.success) {
        setResults(prev => {
          const filtered = prev.filter(r => r.templateId !== templateId)
          return [...filtered, { templateId, imageUrl: data.imageUrl }]
        })
        alert('バナー生成に成功しました')
      } else {
        alert(`エラー: ${data.error}`)
      }
    } catch (error: any) {
      alert(`エラーが発生しました: ${error.message}`)
    }
  }

  const generateDataTsUpdate = (successResults: Array<{ templateId: string; imageUrl: string }>) => {
    let code = '\n// バナー画像URLを追加\n'
    
    successResults.forEach(result => {
      const template = articleTemplates.find(t => t.id === result.templateId)
      if (template) {
        code += `  { id: '${result.templateId}', title: '${template.title}', phase: '${template.phase}', category: '${template.category}', usage: '${template.usage}', imageUrl: '${result.imageUrl}' },\n`
      }
    })
    
    return code
  }

  const toggleTemplateSelection = (templateId: string) => {
    setSelectedTemplateIds(prev =>
      prev.includes(templateId)
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">記事テンプレート用バナー生成</h1>

        <div className="mb-6 space-y-4">
          <div className="bg-gray-900 rounded-lg p-4">
            <h2 className="text-xl font-bold mb-4">一括生成</h2>
            <div className="mb-4">
              <label className="block text-sm mb-2">
                選択されたテンプレート: {selectedTemplateIds.length} / {articleTemplates.length}
              </label>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setSelectedTemplateIds(articleTemplates.map(t => t.id))}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
                >
                  すべて選択
                </button>
                <button
                  onClick={() => setSelectedTemplateIds([])}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
                >
                  選択解除
                </button>
              </div>
            </div>
            <button
              onClick={handleGenerateAll}
              disabled={generating}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg font-bold disabled:opacity-50"
            >
              {generating ? '生成中...' : '選択したテンプレートのバナーを一括生成'}
            </button>
          </div>

          {results.length > 0 && (
            <div className="bg-gray-900 rounded-lg p-4">
              <h2 className="text-xl font-bold mb-4">
                生成結果: {results.filter(r => r.imageUrl).length} / {results.length} 成功
              </h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {results.map(result => {
                  const template = articleTemplates.find(t => t.id === result.templateId)
                  return (
                    <div key={result.templateId} className="bg-gray-800 rounded p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-bold">{template?.title || result.templateId}</p>
                          {result.imageUrl ? (
                            <p className="text-sm text-green-400">✅ 成功</p>
                          ) : (
                            <p className="text-sm text-red-400">❌ 失敗: {result.error}</p>
                          )}
                        </div>
                        {result.imageUrl && (
                          <img
                            src={result.imageUrl}
                            alt={template?.title}
                            className="w-32 h-20 object-cover rounded"
                          />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-900 rounded-lg p-4">
          <h2 className="text-xl font-bold mb-4">個別生成</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
            {articleTemplates.map(template => (
              <div
                key={template.id}
                className={`bg-gray-800 rounded p-3 cursor-pointer border-2 ${
                  selectedTemplateIds.includes(template.id) ? 'border-blue-500' : 'border-transparent'
                }`}
                onClick={() => toggleTemplateSelection(template.id)}
              >
                <p className="text-sm font-bold mb-2 line-clamp-2">{template.title}</p>
                <div className="flex gap-1 mb-2">
                  <span className="text-xs px-2 py-0.5 bg-blue-500/80 rounded">{template.phase}</span>
                  <span className="text-xs px-2 py-0.5 bg-purple-500/80 rounded">{template.category}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleGenerateSingle(template.id)
                  }}
                  className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                >
                  個別生成
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
