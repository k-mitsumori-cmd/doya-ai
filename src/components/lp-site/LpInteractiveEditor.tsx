'use client'

import React, { useState, useEffect } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion, AnimatePresence } from 'framer-motion'
import { GripVertical, Edit, Image as ImageIcon, RefreshCw, Download, X, Monitor, Smartphone, Loader2, Link2 } from 'lucide-react'
import { LpGenerationResult, LpSection, SectionImage } from '@/lib/lp-site/types'
import toast from 'react-hot-toast'

interface LpInteractiveEditorProps {
  result: LpGenerationResult
  selectedDevice: 'pc' | 'sp'
  onSectionsReorder: (newSections: LpSection[]) => void
  onSectionRegenerate: (sectionId: string) => Promise<void>
  onDownload: (type: string, sectionId?: string, imageData?: string) => void
  onSectionUpdate?: (sectionId: string, field: string, value: string) => void
}

interface SortableSectionItemProps {
  section: LpSection
  index: number
  image?: SectionImage
  selectedDevice: 'pc' | 'sp'
  isSelected: boolean
  isRegenerating: boolean
  onSelect: () => void
  onRegenerate: () => void
  onDownload: () => void
}

function SortableSectionItem({
  section,
  index,
  image,
  selectedDevice,
  isSelected,
  isRegenerating,
  onSelect,
  onRegenerate,
  onDownload,
}: SortableSectionItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.section_id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const imageData = selectedDevice === 'pc' ? image?.image_pc : image?.image_sp
  const hasImage = !!imageData

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group bg-white rounded-xl border-2 transition-all cursor-pointer ${
        isSelected
          ? 'border-teal-500 shadow-lg shadow-teal-500/20'
          : 'border-slate-200 hover:border-teal-300 hover:shadow-md'
      } ${isDragging ? 'z-50' : ''}`}
      onClick={onSelect}
    >
      {/* ドラッグハンドル */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4 text-slate-600" />
      </div>

      {/* セクション番号 */}
      <div className="absolute left-12 top-4 w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white font-black text-sm shadow-md">
        {index + 1}
      </div>

      {/* コンテンツ */}
      <div className="p-4 pl-20">
        {/* ヘッダー */}
        <div className="mb-3">
          <h3 className="text-lg font-bold text-slate-900 mb-1">{section.headline}</h3>
          {section.sub_headline && (
            <p className="text-sm text-slate-600 mb-2">{section.sub_headline}</p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-md">
              {section.section_type}
            </span>
            <span className="px-2 py-1 bg-teal-50 text-teal-700 text-xs font-semibold rounded-md">
              {section.purpose}
            </span>
          </div>
        </div>

        {/* 画像プレビュー */}
        <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50 min-h-[200px] flex items-center justify-center">
          {hasImage ? (
            <img
              src={imageData}
              alt={section.headline}
              className="w-full h-auto max-h-[400px] object-contain"
            />
          ) : (
            <div className="text-center text-slate-400 py-8">
              <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p className="text-sm">画像が生成されていません</p>
            </div>
          )}
        </div>

        {/* アクションボタン（選択時のみ表示） */}
        <AnimatePresence>
          {isSelected && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-4 flex items-center gap-2 flex-wrap"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={onRegenerate}
                disabled={isRegenerating}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg text-sm font-semibold hover:from-teal-600 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRegenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>生成中...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>再生成</span>
                  </>
                )}
              </button>
              {hasImage && (
                <button
                  onClick={onDownload}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>ダウンロード</span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 選択時のハイライト */}
      {isSelected && (
        <div className="absolute inset-0 border-2 border-teal-500 rounded-xl pointer-events-none" />
      )}
    </div>
  )
}

interface SectionEditorPanelProps {
  section: LpSection | null
  image?: SectionImage
  selectedDevice: 'pc' | 'sp'
  isRegenerating: boolean
  onClose: () => void
  onRegenerate: () => void
  onFieldUpdate: (field: string, value: string) => void
  onSectionUpdate?: (sectionId: string, field: string, value: string) => void
}

function SectionEditorPanel({
  section,
  image,
  selectedDevice,
  isRegenerating,
  onClose,
  onRegenerate,
  onFieldUpdate,
  onSectionUpdate,
}: SectionEditorPanelProps) {
  if (!section) return null

  const imageData = selectedDevice === 'pc' ? image?.image_pc : image?.image_sp
  const hasImage = !!imageData

  const handleFieldUpdate = (field: string, value: string) => {
    onFieldUpdate(field, value)
    if (onSectionUpdate) {
      onSectionUpdate(section.section_id, field, value)
    }
  }

  return (
    <motion.div
      initial={{ x: 400 }}
      animate={{ x: 0 }}
      exit={{ x: 400 }}
      className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <h2 className="text-lg font-bold text-slate-900">セクション編集</h2>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
        >
          <X className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* セクション情報 */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">見出し</label>
          <input
            type="text"
            value={section.headline}
            onChange={(e) => handleFieldUpdate('headline', e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">サブ見出し</label>
          <input
            type="text"
            value={section.sub_headline || ''}
            onChange={(e) => handleFieldUpdate('sub_headline', e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">目的</label>
          <textarea
            value={section.purpose}
            onChange={(e) => handleFieldUpdate('purpose', e.target.value)}
            rows={3}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">セクションタイプ</label>
          <div className="px-4 py-2 bg-slate-50 rounded-lg text-sm text-slate-600">
            {section.section_type}
          </div>
        </div>

        {/* CTAリンク設定（全てのセクションで設定可能） */}
        <div className="space-y-4 p-4 bg-teal-50 rounded-lg border border-teal-200">
          <h3 className="text-sm font-bold text-teal-900 mb-3 flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            CTAボタン設定
          </h3>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">ボタンテキスト</label>
            <input
              type="text"
              value={section.cta_text || ''}
              onChange={(e) => handleFieldUpdate('cta_text', e.target.value)}
              placeholder="例: 今すぐ始める、資料請求、お問い合わせ"
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">リンクURL</label>
            <input
              type="url"
              value={section.cta_link || ''}
              onChange={(e) => handleFieldUpdate('cta_link', e.target.value)}
              placeholder="https://example.com"
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <p className="text-xs text-slate-500 mt-1">外部リンクを設定できます。画像にCTAボタンが表示されます。</p>
          </div>
        </div>

        {/* 画像プレビュー */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">
            画像 ({selectedDevice === 'pc' ? 'PC' : 'スマホ'}版)
          </label>
          <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50 min-h-[200px] flex items-center justify-center">
            {hasImage ? (
              <img
                src={imageData}
                alt={section.headline}
                className="w-full h-auto max-h-[300px] object-contain"
              />
            ) : (
              <div className="text-center text-slate-400 py-8">
                <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-40" />
                <p className="text-sm">画像が生成されていません</p>
              </div>
            )}
          </div>
        </div>

        {/* アクションボタン */}
        <div className="space-y-3">
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg font-semibold hover:from-teal-600 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRegenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>画像を再生成中...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                <span>画像を再生成</span>
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

export function LpInteractiveEditor({
  result,
  selectedDevice,
  onSectionsReorder,
  onSectionRegenerate,
  onDownload,
  onSectionUpdate,
}: LpInteractiveEditorProps) {
  const [sections, setSections] = useState(result.sections)
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [regeneratingSectionId, setRegeneratingSectionId] = useState<string | null>(null)

  // resultが更新されたらsectionsも更新
  useEffect(() => {
    setSections(result.sections)
  }, [result])

  // result.imagesが更新されたら選択中のセクションの画像も更新
  const [currentResult, setCurrentResult] = useState(result)
  useEffect(() => {
    setCurrentResult(result)
  }, [result])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setSections((items) => {
        const oldIndex = items.findIndex((item) => item.section_id === active.id)
        const newIndex = items.findIndex((item) => item.section_id === over.id)
        const newItems = arrayMove(items, oldIndex, newIndex)
        onSectionsReorder(newItems)
        return newItems
      })
    }
  }

  const handleSectionRegenerate = async (sectionId: string) => {
    setRegeneratingSectionId(sectionId)
    try {
      await onSectionRegenerate(sectionId)
    } catch (error: any) {
      toast.error(error.message || '再生成に失敗しました')
      throw error
    } finally {
      setRegeneratingSectionId(null)
    }
  }

  const selectedSection = sections.find((s) => s.section_id === selectedSectionId) || null
  const selectedImage = currentResult.images.find((img) => img.section_id === selectedSectionId)

  return (
    <div className="flex gap-4 h-full">
      {/* メインエディタエリア */}
      <div className="flex-1 min-w-0">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sections.map((s) => s.section_id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {sections.map((section, index) => {
                const image = currentResult.images.find((img) => img.section_id === section.section_id)
                return (
                  <SortableSectionItem
                    key={section.section_id}
                    section={section}
                    index={index}
                    image={image}
                    selectedDevice={selectedDevice}
                    isSelected={selectedSectionId === section.section_id}
                    isRegenerating={regeneratingSectionId === section.section_id}
                    onSelect={() => setSelectedSectionId(section.section_id)}
                    onRegenerate={() => handleSectionRegenerate(section.section_id)}
                    onDownload={() => {
                      const imageData = selectedDevice === 'pc' ? image?.image_pc : image?.image_sp
                      if (imageData) {
                        onDownload('single', section.section_id, imageData)
                      }
                    }}
                  />
                )
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* 右サイドバー（エディタパネル） */}
      <AnimatePresence>
        {selectedSection && (
          <>
            <SectionEditorPanel
              section={selectedSection}
              image={selectedImage}
              selectedDevice={selectedDevice}
              isRegenerating={regeneratingSectionId === selectedSectionId}
              onClose={() => setSelectedSectionId(null)}
              onRegenerate={() => handleSectionRegenerate(selectedSectionId)}
              onFieldUpdate={() => {}}
              onSectionUpdate={onSectionUpdate}
            />
            {/* オーバーレイ */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSectionId(null)}
              className="fixed inset-0 bg-black/20 z-40"
            />
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

