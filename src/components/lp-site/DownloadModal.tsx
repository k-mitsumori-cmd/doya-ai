'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Download,
  Monitor,
  Smartphone,
  CheckCircle,
  Image as ImageIcon,
  Package,
  Loader2,
} from 'lucide-react'
import { LpGenerationResult, LpSection, SectionImage } from '@/lib/lp-site/types'

interface DownloadModalProps {
  open: boolean
  onClose: () => void
  result: LpGenerationResult
  onDownload: (type: string, sectionId?: string, imageData?: string) => void
}

type DownloadType = 'all_pc' | 'all_sp' | 'all_both' | 'single'

export function DownloadModal({ open, onClose, result, onDownload }: DownloadModalProps) {
  const [selectedType, setSelectedType] = useState<DownloadType>('all_both')
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set())
  const [isDownloading, setIsDownloading] = useState(false)

  const sections = result.sections
  const images = result.images

  // 画像があるセクションのみ
  const sectionsWithImages = sections.filter(section => {
    const img = images.find(i => i.section_id === section.section_id)
    return img?.image_pc || img?.image_sp
  })

  // 統計
  const stats = {
    totalSections: sections.length,
    withPc: images.filter(img => img.image_pc).length,
    withSp: images.filter(img => img.image_sp).length,
    withBoth: images.filter(img => img.image_pc && img.image_sp).length,
  }

  const handleSelectAll = () => {
    if (selectedSections.size === sectionsWithImages.length) {
      setSelectedSections(new Set())
    } else {
      setSelectedSections(new Set(sectionsWithImages.map(s => s.section_id)))
    }
  }

  const handleToggleSection = (sectionId: string) => {
    const newSet = new Set(selectedSections)
    if (newSet.has(sectionId)) {
      newSet.delete(sectionId)
    } else {
      newSet.add(sectionId)
    }
    setSelectedSections(newSet)
  }

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      if (selectedType === 'single' && selectedSections.size > 0) {
        // 選択したセクションを個別にダウンロード
        for (const sectionId of selectedSections) {
          const img = images.find(i => i.section_id === sectionId)
          if (img?.image_pc) {
            onDownload('single', sectionId, img.image_pc)
          }
          if (img?.image_sp) {
            onDownload('single', sectionId, img.image_sp)
          }
        }
      } else {
        onDownload(selectedType)
      }
      onClose()
    } finally {
      setIsDownloading(false)
    }
  }

  const getDownloadButtonText = () => {
    switch (selectedType) {
      case 'all_pc':
        return `PC画像をダウンロード (${stats.withPc}枚)`
      case 'all_sp':
        return `SP画像をダウンロード (${stats.withSp}枚)`
      case 'all_both':
        return `全画像をダウンロード (${stats.withPc + stats.withSp}枚)`
      case 'single':
        return selectedSections.size > 0
          ? `選択した画像をダウンロード (${selectedSections.size}セクション)`
          : 'セクションを選択してください'
    }
  }

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* ヘッダー */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Download className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">画像ダウンロード</h2>
                <p className="text-sm text-slate-500">ダウンロードする画像を選択してください</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* コンテンツ */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            {/* 統計情報 */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-slate-900">{stats.totalSections}</div>
                <div className="text-xs text-slate-500">セクション</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.withPc}</div>
                <div className="text-xs text-blue-600">PC画像</div>
              </div>
              <div className="bg-purple-50 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.withSp}</div>
                <div className="text-xs text-purple-600">SP画像</div>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{stats.withBoth}</div>
                <div className="text-xs text-green-600">両方完了</div>
              </div>
            </div>

            {/* ダウンロードタイプ選択 */}
            <div className="mb-6">
              <h3 className="text-sm font-bold text-slate-700 mb-3">ダウンロード方法を選択</h3>
              <div className="grid grid-cols-2 gap-3">
                {/* 全PC画像 */}
                <button
                  onClick={() => setSelectedType('all_pc')}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    selectedType === 'all_pc'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Monitor className={`w-6 h-6 ${selectedType === 'all_pc' ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className={`font-bold ${selectedType === 'all_pc' ? 'text-blue-900' : 'text-slate-700'}`}>
                      PC画像のみ
                    </span>
                    {selectedType === 'all_pc' && <CheckCircle className="w-5 h-5 text-blue-500 ml-auto" />}
                  </div>
                  <p className="text-xs text-slate-500">横長のPC用画像をまとめてダウンロード</p>
                  <div className="mt-2 text-sm font-medium text-blue-600">{stats.withPc}枚</div>
                </button>

                {/* 全SP画像 */}
                <button
                  onClick={() => setSelectedType('all_sp')}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    selectedType === 'all_sp'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Smartphone className={`w-6 h-6 ${selectedType === 'all_sp' ? 'text-purple-600' : 'text-slate-400'}`} />
                    <span className={`font-bold ${selectedType === 'all_sp' ? 'text-purple-900' : 'text-slate-700'}`}>
                      SP画像のみ
                    </span>
                    {selectedType === 'all_sp' && <CheckCircle className="w-5 h-5 text-purple-500 ml-auto" />}
                  </div>
                  <p className="text-xs text-slate-500">縦長のスマホ用画像をまとめてダウンロード</p>
                  <div className="mt-2 text-sm font-medium text-purple-600">{stats.withSp}枚</div>
                </button>

                {/* 全画像 */}
                <button
                  onClick={() => setSelectedType('all_both')}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    selectedType === 'all_both'
                      ? 'border-green-500 bg-green-50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Package className={`w-6 h-6 ${selectedType === 'all_both' ? 'text-green-600' : 'text-slate-400'}`} />
                    <span className={`font-bold ${selectedType === 'all_both' ? 'text-green-900' : 'text-slate-700'}`}>
                      全画像（PC+SP）
                    </span>
                    {selectedType === 'all_both' && <CheckCircle className="w-5 h-5 text-green-500 ml-auto" />}
                  </div>
                  <p className="text-xs text-slate-500">PC・SP両方の画像をまとめてダウンロード</p>
                  <div className="mt-2 text-sm font-medium text-green-600">{stats.withPc + stats.withSp}枚</div>
                </button>

                {/* 個別選択 */}
                <button
                  onClick={() => setSelectedType('single')}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    selectedType === 'single'
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <ImageIcon className={`w-6 h-6 ${selectedType === 'single' ? 'text-amber-600' : 'text-slate-400'}`} />
                    <span className={`font-bold ${selectedType === 'single' ? 'text-amber-900' : 'text-slate-700'}`}>
                      個別選択
                    </span>
                    {selectedType === 'single' && <CheckCircle className="w-5 h-5 text-amber-500 ml-auto" />}
                  </div>
                  <p className="text-xs text-slate-500">ダウンロードするセクションを選択</p>
                  <div className="mt-2 text-sm font-medium text-amber-600">
                    {selectedSections.size > 0 ? `${selectedSections.size}件選択中` : '選択してください'}
                  </div>
                </button>
              </div>
            </div>

            {/* 個別選択時のセクション一覧 */}
            {selectedType === 'single' && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-700">セクションを選択</span>
                  <button
                    onClick={handleSelectAll}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    {selectedSections.size === sectionsWithImages.length ? 'すべて解除' : 'すべて選択'}
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {sectionsWithImages.map((section, index) => {
                    const img = images.find(i => i.section_id === section.section_id)
                    const isSelected = selectedSections.has(section.section_id)
                    return (
                      <div
                        key={section.section_id}
                        onClick={() => handleToggleSection(section.section_id)}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-slate-100 last:border-b-0 ${
                          isSelected ? 'bg-amber-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* チェックボックス */}
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-amber-500 border-amber-500' : 'border-slate-300'
                        }`}>
                          {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                        </div>

                        {/* プレビュー画像 */}
                        <div className="flex gap-1">
                          {img?.image_pc && (
                            <div className="w-12 h-8 rounded overflow-hidden border border-slate-200 bg-slate-100">
                              <img src={img.image_pc} alt="PC" className="w-full h-full object-cover" />
                            </div>
                          )}
                          {img?.image_sp && (
                            <div className="w-6 h-10 rounded overflow-hidden border border-slate-200 bg-slate-100">
                              <img src={img.image_sp} alt="SP" className="w-full h-full object-cover" />
                            </div>
                          )}
                        </div>

                        {/* セクション情報 */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">
                            {index + 1}. {section.headline || section.section_type}
                          </div>
                          <div className="text-xs text-slate-500">
                            {img?.image_pc && img?.image_sp ? 'PC + SP' : img?.image_pc ? 'PCのみ' : 'SPのみ'}
                          </div>
                        </div>

                        {/* バッジ */}
                        <div className="flex gap-1">
                          {img?.image_pc && (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded">PC</span>
                          )}
                          {img?.image_sp && (
                            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded">SP</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* プレビュー（全体ダウンロード時） */}
            {selectedType !== 'single' && sectionsWithImages.length > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <span className="text-sm font-bold text-slate-700">ダウンロード対象のプレビュー</span>
                </div>
                <div className="p-4 grid grid-cols-4 gap-3 max-h-48 overflow-y-auto">
                  {sectionsWithImages.slice(0, 8).map((section, index) => {
                    const img = images.find(i => i.section_id === section.section_id)
                    const showPc = selectedType === 'all_pc' || selectedType === 'all_both'
                    const showSp = selectedType === 'all_sp' || selectedType === 'all_both'
                    return (
                      <div key={section.section_id} className="space-y-1">
                        <div className="flex gap-1">
                          {showPc && img?.image_pc && (
                            <div className="flex-1 aspect-video rounded overflow-hidden border border-slate-200 bg-slate-100">
                              <img src={img.image_pc} alt="PC" className="w-full h-full object-cover" />
                            </div>
                          )}
                          {showSp && img?.image_sp && (
                            <div className="w-8 aspect-[9/16] rounded overflow-hidden border border-slate-200 bg-slate-100">
                              <img src={img.image_sp} alt="SP" className="w-full h-full object-cover" />
                            </div>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">{index + 1}. {section.section_type}</div>
                      </div>
                    )
                  })}
                  {sectionsWithImages.length > 8 && (
                    <div className="flex items-center justify-center text-sm text-slate-400">
                      +{sectionsWithImages.length - 8}件
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* フッター */}
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleDownload}
              disabled={isDownloading || (selectedType === 'single' && selectedSections.size === 0)}
              className={`px-6 py-2.5 text-sm font-bold rounded-xl flex items-center gap-2 transition-all ${
                isDownloading || (selectedType === 'single' && selectedSections.size === 0)
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 shadow-lg'
              }`}
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  ダウンロード中...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  {getDownloadButtonText()}
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

