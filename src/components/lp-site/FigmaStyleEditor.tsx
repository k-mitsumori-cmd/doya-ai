'use client'

import React, { useState } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GripVertical,
  Edit,
  Image as ImageIcon,
  RefreshCw,
  Download,
  X,
  Monitor,
  Smartphone,
  Loader2,
  Link2,
  Eye,
  EyeOff,
  Layers,
  MousePointer2,
  ZoomIn,
  ExternalLink,
  Globe,
  FileDown,
  Settings,
} from 'lucide-react'
import { LpGenerationResult, LpSection, SectionImage } from '@/lib/lp-site/types'
import toast from 'react-hot-toast'

interface FigmaStyleEditorProps {
  result: LpGenerationResult
  selectedDevice: 'pc' | 'sp'
  onDeviceChange: (device: 'pc' | 'sp') => void
  onSectionsReorder: (newSections: LpSection[]) => void
  onSectionRegenerate: (sectionId: string) => Promise<void>
  onDownload: (type: string, sectionId?: string, imageData?: string) => void
  onSectionUpdate?: (sectionId: string, field: string, value: string) => void
  onPreview?: () => void
  onPublish?: () => void
  isGeneratingImages?: boolean
  sectionProgress?: Record<string, number>
  generatingSections?: Set<string>
}

interface LayerItemProps {
  section: LpSection
  index: number
  image?: SectionImage
  selectedDevice: 'pc' | 'sp'
  isSelected: boolean
  isVisible: boolean
  isRegenerating: boolean
  onSelect: () => void
  onToggleVisibility: () => void
  onRegenerate: () => void
}

function LayerItem({ section, index, image, selectedDevice, isSelected, isVisible, isRegenerating, onSelect, onToggleVisibility, onRegenerate }: LayerItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.section_id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const hasImage = selectedDevice === 'pc' ? !!image?.image_pc : !!image?.image_sp

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
        isSelected
          ? 'bg-blue-100 text-blue-900'
          : 'hover:bg-slate-100 text-slate-700'
      } ${!isVisible ? 'opacity-40' : ''}`}
      onClick={onSelect}
    >
      <div
        {...attributes}
        {...listeners}
        className="w-3.5 h-3.5 flex items-center justify-center cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-3 h-3" />
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleVisibility()
        }}
        className="w-3.5 h-3.5 flex items-center justify-center text-slate-400 hover:text-slate-600"
      >
        {isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{section.headline || `セクション ${index + 1}`}</div>
        <div className="text-[10px] text-slate-500 truncate">{section.section_type}</div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRegenerate()
        }}
        disabled={isRegenerating}
        className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="画像を再生成"
      >
        {isRegenerating ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <RefreshCw className="w-3 h-3" />
        )}
      </button>
      {hasImage && (
        <div className="w-3.5 h-3.5 rounded border border-slate-300 bg-white flex-shrink-0">
          <ImageIcon className="w-2.5 h-2.5 text-slate-400" />
        </div>
      )}
    </div>
  )
}

interface PropertyPanelProps {
  section: LpSection | null
  image?: SectionImage
  selectedDevice: 'pc' | 'sp'
  isRegenerating: boolean
  onRegenerate: () => void
  onDownload: () => void
  onFieldUpdate: (field: string, value: string) => void
  onSectionUpdate?: (sectionId: string, field: string, value: string) => void
}

function PropertyPanel({
  section,
  image,
  selectedDevice,
  isRegenerating,
  onRegenerate,
  onDownload,
  onFieldUpdate,
  onSectionUpdate,
}: PropertyPanelProps) {
  if (!section) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-sm">
        <div className="text-center">
          <MousePointer2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>セクションを選択してください</p>
        </div>
      </div>
    )
  }

  const imageData = selectedDevice === 'pc' ? image?.image_pc : image?.image_sp
  const hasImage = !!imageData

  const handleFieldUpdate = (field: string, value: string) => {
    onFieldUpdate(field, value)
    if (onSectionUpdate) {
      onSectionUpdate(section.section_id, field, value)
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* セクション情報 */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900">セクション {section.section_id.slice(0, 8)}</h3>
          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">{section.section_type}</span>
        </div>
      </div>

      {/* 画像プレビュー */}
      {hasImage && (
        <div className="p-4 border-b border-slate-200">
          <div className="rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
            <img src={imageData} alt={section.headline} className="w-full h-auto" />
          </div>
        </div>
      )}

      {/* プロパティ */}
      <div className="p-4 space-y-4">
        {/* 見出し */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">見出し</label>
          <input
            type="text"
            value={section.headline}
            onChange={(e) => handleFieldUpdate('headline', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        {/* サブ見出し */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">サブ見出し</label>
          <input
            type="text"
            value={section.sub_headline || ''}
            onChange={(e) => handleFieldUpdate('sub_headline', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        {/* 目的 */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">目的</label>
          <textarea
            value={section.purpose}
            onChange={(e) => handleFieldUpdate('purpose', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
          />
        </div>

        {/* CTA設定 */}
        <div className="pt-2 border-t border-slate-200">
          <label className="block text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5" />
            CTAボタン
          </label>
          <div className="space-y-2">
            <input
              type="text"
              value={section.cta_text || ''}
              onChange={(e) => handleFieldUpdate('cta_text', e.target.value)}
              placeholder="例: 今すぐ申し込む"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            <input
              type="url"
              value={section.cta_link || ''}
              onChange={(e) => handleFieldUpdate('cta_link', e.target.value)}
              placeholder="https://example.com/cta"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
        </div>

        {/* アクション */}
        <div className="pt-2 border-t border-slate-200 space-y-2">
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRegenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>生成中...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>画像を再生成</span>
              </>
            )}
          </button>
          {hasImage && (
            <button
              onClick={onDownload}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>画像をダウンロード</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function FigmaStyleEditor({
  result,
  selectedDevice,
  onDeviceChange,
  onSectionsReorder,
  onSectionRegenerate,
  onDownload,
  onSectionUpdate,
  onPreview,
  onPublish,
  isGeneratingImages = false,
  sectionProgress = {},
  generatingSections = new Set(),
}: FigmaStyleEditorProps) {
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [regeneratingSectionId, setRegeneratingSectionId] = useState<string | null>(null)
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set(result.sections.map(s => s.section_id)))
  const [zoom, setZoom] = useState(100)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const sections = result.sections
  const selectedSection = sections.find(s => s.section_id === selectedSectionId) || null
  const selectedImage = result.images.find(img => img.section_id === selectedSectionId)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex(s => s.section_id === active.id)
      const newIndex = sections.findIndex(s => s.section_id === over.id)
      const newSections = arrayMove(sections, oldIndex, newIndex)
      onSectionsReorder(newSections)
      toast.success('セクションの順序を変更しました')
    }
  }

  const handleSectionRegenerate = async (sectionId: string) => {
    setRegeneratingSectionId(sectionId)
    try {
      await onSectionRegenerate(sectionId)
      toast.success('画像を再生成しました')
    } catch (error) {
      toast.error('画像の再生成に失敗しました')
    } finally {
      setRegeneratingSectionId(null)
    }
  }

  const handleToggleVisibility = (sectionId: string) => {
    const newVisible = new Set(visibleSections)
    if (newVisible.has(sectionId)) {
      newVisible.delete(sectionId)
    } else {
      newVisible.add(sectionId)
    }
    setVisibleSections(newVisible)
  }

  // 表示可能なセクションのみをフィルタリング
  const visibleSectionsList = sections.filter(s => visibleSections.has(s.section_id))

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* 上部ツールバー */}
      <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          {/* デバイス切り替え */}
          <div className="flex items-center gap-1 border-r border-slate-200 pr-4">
            <button
              onClick={() => onDeviceChange('pc')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                selectedDevice === 'pc'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDeviceChange('sp')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                selectedDevice === 'sp'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>

          {/* ズーム */}
          <div className="flex items-center gap-1 border-r border-slate-200 pr-4">
            <button
              onClick={() => setZoom(Math.max(25, zoom - 25))}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 text-slate-600"
            >
              <ZoomIn className="w-4 h-4 rotate-180" />
            </button>
            <span className="text-xs font-medium text-slate-700 min-w-[3rem] text-center">{zoom}%</span>
            <button
              onClick={() => setZoom(Math.min(200, zoom + 25))}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 text-slate-600"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* アクションボタン */}
        <div className="flex items-center gap-2">
          {onPreview && (
            <button
              onClick={onPreview}
              className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition-colors flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              プレビュー
            </button>
          )}
          {onPublish && (
            <button
              onClick={onPublish}
              className="px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center gap-1.5"
            >
              <Globe className="w-3.5 h-3.5" />
              公開
            </button>
          )}
          <button
            onClick={() => onDownload(selectedDevice === 'pc' ? 'all_pc' : 'all_sp')}
            className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition-colors flex items-center gap-1.5"
          >
            <FileDown className="w-3.5 h-3.5" />
            ダウンロード
          </button>
        </div>
      </div>

      {/* メインエリア */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左サイドバー：レイヤーパネル */}
        <div className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
          <div className="h-12 border-b border-slate-200 flex items-center px-4">
            <Layers className="w-4 h-4 text-slate-600 mr-2" />
            <span className="text-sm font-semibold text-slate-900">レイヤー</span>
            <span className="ml-auto text-xs text-slate-500">{sections.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sections.map(s => s.section_id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-0.5">
                    {sections.map((section, index) => {
                      const image = result.images.find(img => img.section_id === section.section_id)
                      return (
                        <LayerItem
                          key={section.section_id}
                          section={section}
                          index={index}
                          image={image}
                          selectedDevice={selectedDevice}
                          isSelected={selectedSectionId === section.section_id}
                          isVisible={visibleSections.has(section.section_id)}
                          isRegenerating={regeneratingSectionId === section.section_id}
                          onSelect={() => setSelectedSectionId(section.section_id)}
                          onToggleVisibility={() => handleToggleVisibility(section.section_id)}
                          onRegenerate={() => handleSectionRegenerate(section.section_id)}
                        />
                      )
                    })}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>

        {/* 中央キャンバス */}
        <div className="flex-1 overflow-auto bg-slate-100 flex items-center justify-center p-8">
          <div
            className="bg-white rounded-lg shadow-2xl"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'center',
              width: selectedDevice === 'pc' ? '1200px' : '414px',
              maxHeight: selectedDevice === 'pc' ? 'none' : '896px',
              transition: 'transform 0.2s',
            }}
          >
            {/* デバイスフレーム */}
            {selectedDevice === 'sp' && (
              <div className="relative bg-slate-900 rounded-[2.5rem] p-2">
                <div className="bg-white rounded-[2rem] overflow-hidden">
                  {/* ノッチ */}
                  <div className="h-8 bg-slate-900 rounded-t-[2rem] flex items-center justify-center">
                    <div className="w-32 h-6 bg-slate-900 rounded-full"></div>
                  </div>
                  <div className="overflow-y-auto" style={{ maxHeight: '896px' }}>
                    {visibleSectionsList.map((section, index) => {
                      const image = result.images.find(img => img.section_id === section.section_id)
                      const imageData = image?.image_sp
                      const isSelected = selectedSectionId === section.section_id
                      const isRegenerating = regeneratingSectionId === section.section_id || generatingSections.has(section.section_id) || (isGeneratingImages && !imageData)
                      const sectionGenProgress = sectionProgress[section.section_id] ?? 0
                      
                      return (
                        <div
                          key={section.section_id}
                          className={`cursor-pointer transition-all border-b border-slate-200 ${
                            isSelected
                              ? 'ring-4 ring-blue-500 ring-offset-2'
                              : 'hover:opacity-90'
                          }`}
                          onClick={() => setSelectedSectionId(section.section_id)}
                        >
                      {imageData ? (
                        <img src={imageData} alt={section.headline} className="w-full block" />
                      ) : (
                        <div className={`w-full bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 border-4 border-dashed min-h-[700px] flex flex-col items-center justify-center p-6 relative overflow-hidden ${
                          isRegenerating 
                            ? 'border-teal-500 animate-pulse' 
                            : 'border-slate-400'
                        }`}>
                          {/* 背景パターン（生成中はアニメーション） */}
                          <div className={`absolute inset-0 ${isRegenerating ? 'opacity-10' : 'opacity-5'}`}>
                            <motion.div 
                              className="absolute inset-0"
                              animate={isRegenerating ? {
                                backgroundPosition: ['0% 0%', '100% 100%'],
                              } : {}}
                              transition={isRegenerating ? {
                                duration: 3,
                                repeat: Infinity,
                                ease: 'linear',
                              } : {}}
                              style={{
                                backgroundImage: 'repeating-linear-gradient(45deg, #64748b 0, #64748b 20px, transparent 20px, transparent 40px)',
                                backgroundSize: '40px 40px',
                              }}
                            />
                          </div>
                          {/* 生成中の波紋エフェクト */}
                          {isRegenerating && (
                            <div className="absolute inset-0 overflow-hidden">
                              {[0, 1, 2].map((i) => (
                                <motion.div
                                  key={i}
                                  className="absolute inset-0 rounded-full border-4 border-teal-400/30"
                                  animate={{
                                    scale: [1, 1.5, 2],
                                    opacity: [0.5, 0.2, 0],
                                  }}
                                  transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    delay: i * 0.7,
                                    ease: 'easeOut',
                                  }}
                                  style={{
                                    left: '50%',
                                    top: '50%',
                                    width: '200px',
                                    height: '200px',
                                    marginLeft: '-100px',
                                    marginTop: '-100px',
                                  }}
                                />
                              ))}
                            </div>
                          )}
                          <div className="relative z-10 text-center max-w-sm w-full">
                            <motion.div 
                              className={`w-28 h-28 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-teal-100 via-cyan-100 to-blue-100 flex items-center justify-center border-4 shadow-xl ${
                                isRegenerating ? 'border-teal-500 shadow-teal-500/50' : 'border-teal-300'
                              }`}
                              animate={isRegenerating ? {
                                scale: [1, 1.05, 1],
                                boxShadow: [
                                  '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                                  '0 20px 25px -5px rgb(20 184 166 / 0.5)',
                                  '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                                ],
                              } : {}}
                              transition={isRegenerating ? {
                                duration: 2,
                                repeat: Infinity,
                                ease: 'easeInOut',
                              } : {}}
                            >
                              {isRegenerating ? (
                                <Loader2 className="w-14 h-14 text-teal-600 animate-spin" />
                              ) : (
                                <ImageIcon className="w-14 h-14 text-teal-600" />
                              )}
                            </motion.div>
                            <h3 className="text-2xl font-black text-slate-900 mb-3 leading-tight">{section.headline}</h3>
                            {section.sub_headline && (
                              <p className="text-base text-slate-700 mb-5 leading-relaxed">{section.sub_headline}</p>
                            )}
                            <div className="inline-block px-4 py-2 bg-gradient-to-r from-teal-100 to-cyan-100 text-teal-800 text-sm font-bold rounded-xl mb-5 border-2 border-teal-300">
                              {section.section_type}
                            </div>
                            <p className="text-sm text-slate-600 mb-8 leading-relaxed bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-slate-300">
                              {section.purpose}
                            </p>
                            <div className={`bg-white/95 backdrop-blur-md rounded-2xl p-5 border-2 shadow-xl ${
                              isRegenerating ? 'border-teal-400 shadow-teal-500/30' : 'border-teal-300'
                            }`}>
                              <div className="flex items-center justify-center gap-2 mb-3">
                                {isRegenerating ? (
                                  <>
                                    <Loader2 className="w-5 h-5 text-teal-600 animate-spin" />
                                    <p className="text-sm font-bold text-teal-700">画像生成中...</p>
                                  </>
                                ) : (
                                  <>
                                    <ImageIcon className="w-5 h-5 text-teal-600" />
                                    <p className="text-sm font-bold text-slate-800">画像生成予定</p>
                                  </>
                                )}
                              </div>
                              {isRegenerating && (
                                <div className="w-full bg-slate-200 rounded-full h-2 mb-3 overflow-hidden">
                                  <motion.div
                                    className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full"
                                    initial={{ width: '0%' }}
                                    animate={{
                                      width: sectionGenProgress > 0 ? `${sectionGenProgress}%` : ['0%', '40%', '0%'],
                                      x: sectionGenProgress > 0 ? 0 : ['-100%', '100%'],
                                    }}
                                    transition={
                                      sectionGenProgress > 0
                                        ? { duration: 0.3, ease: 'easeOut' }
                                        : {
                                            duration: 1.5,
                                            repeat: Infinity,
                                            ease: 'linear',
                                          }
                                    }
                                  />
                                  {sectionGenProgress > 0 && (
                                    <div className="text-center mt-1 text-xs font-bold text-teal-700">
                                      {sectionGenProgress}%
                                    </div>
                                  )}
                                </div>
                              )}
                              <p className="text-xs text-slate-600 leading-relaxed">
                                {isRegenerating ? (
                                  <>
                                    <span className="font-bold text-teal-700">✨ AIが画像を生成しています...</span>
                                    <br />
                                    <span className="text-slate-500">
                                      通常30秒〜2分程度かかります
                                      {sectionGenProgress > 0 && `（進捗: ${sectionGenProgress}%）`}
                                    </span>
                                    <br />
                                    <span className="text-slate-400 text-[10px]">
                                      完了次第、自動的に表示されます
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className="font-medium text-slate-700">
                                      {section.section_type}セクションの画像を生成中です
                                    </span>
                                    <br />
                                    <span className="text-slate-500 text-[10px]">
                                      生成完了次第、自動的に表示されます
                                    </span>
                                  </>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                  </div>
                </div>
              </div>
            )}

            {/* PC表示 */}
            {selectedDevice === 'pc' && (
              <div className="overflow-y-auto" style={{ maxHeight: '80vh' }}>
                {visibleSectionsList.map((section, index) => {
                      const image = result.images.find(img => img.section_id === section.section_id)
                      const imageData = image?.image_pc
                      const isSelected = selectedSectionId === section.section_id
                      const isRegenerating = regeneratingSectionId === section.section_id || generatingSections.has(section.section_id) || (isGeneratingImages && !imageData)
                      const sectionGenProgress = sectionProgress[section.section_id] ?? 0
                  
                  return (
                    <div
                      key={section.section_id}
                      className={`cursor-pointer transition-all border-b-4 border-slate-200 ${
                        isSelected
                          ? 'ring-4 ring-blue-500 ring-offset-2'
                          : 'hover:opacity-90'
                      }`}
                      onClick={() => setSelectedSectionId(section.section_id)}
                    >
                      {imageData ? (
                        <img src={imageData} alt={section.headline} className="w-full block" />
                      ) : (
                        <div className={`w-full bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 border-4 border-dashed min-h-[900px] flex flex-col items-center justify-center p-16 relative overflow-hidden ${
                          isRegenerating 
                            ? 'border-teal-500 animate-pulse' 
                            : 'border-slate-400'
                        }`}>
                          {/* 背景パターン（生成中はアニメーション） */}
                          <div className={`absolute inset-0 ${isRegenerating ? 'opacity-10' : 'opacity-5'}`}>
                            <motion.div 
                              className="absolute inset-0"
                              animate={isRegenerating ? {
                                backgroundPosition: ['0% 0%', '100% 100%'],
                              } : {}}
                              transition={isRegenerating ? {
                                duration: 3,
                                repeat: Infinity,
                                ease: 'linear',
                              } : {}}
                              style={{
                                backgroundImage: 'repeating-linear-gradient(45deg, #64748b 0, #64748b 30px, transparent 30px, transparent 60px)',
                                backgroundSize: '60px 60px',
                              }}
                            />
                          </div>
                          {/* 生成中の波紋エフェクト */}
                          {isRegenerating && (
                            <div className="absolute inset-0 overflow-hidden">
                              {[0, 1, 2].map((i) => (
                                <motion.div
                                  key={i}
                                  className="absolute inset-0 rounded-full border-4 border-teal-400/30"
                                  animate={{
                                    scale: [1, 1.8, 2.5],
                                    opacity: [0.5, 0.2, 0],
                                  }}
                                  transition={{
                                    duration: 2.5,
                                    repeat: Infinity,
                                    delay: i * 0.8,
                                    ease: 'easeOut',
                                  }}
                                  style={{
                                    left: '50%',
                                    top: '50%',
                                    width: '300px',
                                    height: '300px',
                                    marginLeft: '-150px',
                                    marginTop: '-150px',
                                  }}
                                />
                              ))}
                            </div>
                          )}
                          <div className="relative z-10 text-center max-w-3xl w-full">
                            <motion.div 
                              className={`w-40 h-40 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-teal-100 via-cyan-100 to-blue-100 flex items-center justify-center border-4 shadow-2xl ${
                                isRegenerating ? 'border-teal-500 shadow-teal-500/50' : 'border-teal-300'
                              }`}
                              animate={isRegenerating ? {
                                scale: [1, 1.05, 1],
                                boxShadow: [
                                  '0 25px 50px -12px rgb(0 0 0 / 0.25)',
                                  '0 25px 50px -12px rgb(20 184 166 / 0.5)',
                                  '0 25px 50px -12px rgb(0 0 0 / 0.25)',
                                ],
                              } : {}}
                              transition={isRegenerating ? {
                                duration: 2,
                                repeat: Infinity,
                                ease: 'easeInOut',
                              } : {}}
                            >
                              {isRegenerating ? (
                                <Loader2 className="w-20 h-20 text-teal-600 animate-spin" />
                              ) : (
                                <ImageIcon className="w-20 h-20 text-teal-600" />
                              )}
                            </motion.div>
                            <h3 className="text-4xl font-black text-slate-900 mb-4 leading-tight">{section.headline}</h3>
                            {section.sub_headline && (
                              <p className="text-xl text-slate-700 mb-6 leading-relaxed">{section.sub_headline}</p>
                            )}
                            <div className="inline-block px-6 py-3 bg-gradient-to-r from-teal-100 to-cyan-100 text-teal-800 text-base font-bold rounded-xl mb-6 border-2 border-teal-300">
                              {section.section_type}
                            </div>
                            <p className="text-lg text-slate-600 mb-10 leading-relaxed bg-white/70 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-300">
                              {section.purpose}
                            </p>
                            <div className={`bg-white/95 backdrop-blur-md rounded-3xl p-8 border-4 shadow-2xl ${
                              isRegenerating ? 'border-teal-400 shadow-teal-500/30' : 'border-teal-300'
                            }`}>
                              <div className="flex items-center justify-center gap-3 mb-4">
                                {isRegenerating ? (
                                  <>
                                    <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
                                    <p className="text-lg font-black text-teal-700">画像生成中...</p>
                                  </>
                                ) : (
                                  <>
                                    <ImageIcon className="w-6 h-6 text-teal-600" />
                                    <p className="text-lg font-black text-slate-900">画像生成予定</p>
                                  </>
                                )}
                              </div>
                              {isRegenerating && (
                                <div className="w-full bg-slate-200 rounded-full h-3 mb-4 overflow-hidden">
                                  <motion.div
                                    className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full"
                                    initial={{ width: '0%' }}
                                    animate={{
                                      width: sectionGenProgress > 0 ? `${sectionGenProgress}%` : ['0%', '40%', '0%'],
                                      x: sectionGenProgress > 0 ? 0 : ['-100%', '100%'],
                                    }}
                                    transition={
                                      sectionGenProgress > 0
                                        ? { duration: 0.3, ease: 'easeOut' }
                                        : {
                                            duration: 1.5,
                                            repeat: Infinity,
                                            ease: 'linear',
                                          }
                                    }
                                  />
                                  {sectionGenProgress > 0 && (
                                    <div className="text-center mt-2 text-sm font-black text-teal-700">
                                      {sectionGenProgress}%
                                    </div>
                                  )}
                                </div>
                              )}
                              <p className="text-sm text-slate-700 leading-relaxed">
                                {isRegenerating ? (
                                  <>
                                    <span className="font-bold text-teal-700">✨ AIが画像を生成しています...</span>
                                    <br />
                                    <span className="text-slate-600">
                                      通常30秒〜2分程度かかります
                                      {sectionGenProgress > 0 && `（進捗: ${sectionGenProgress}%）`}
                                    </span>
                                    <br />
                                    <span className="text-slate-400 text-xs">
                                      完了次第、自動的に表示されます
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className="font-medium text-slate-700">
                                      {section.section_type}セクションの画像を生成中です
                                    </span>
                                    <br />
                                    <span className="text-slate-500 text-xs">
                                      生成完了次第、自動的に表示されます
                                    </span>
                                  </>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* 右サイドバー：プロパティパネル */}
        <div className="w-80 bg-white border-l border-slate-200 flex flex-col flex-shrink-0">
          <div className="h-12 border-b border-slate-200 flex items-center px-4">
            <Settings className="w-4 h-4 text-slate-600 mr-2" />
            <span className="text-sm font-semibold text-slate-900">プロパティ</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <PropertyPanel
              section={selectedSection}
              image={selectedImage}
              selectedDevice={selectedDevice}
              isRegenerating={regeneratingSectionId === selectedSectionId}
              onRegenerate={() => handleSectionRegenerate(selectedSectionId!)}
              onDownload={() => {
                const imageData = selectedDevice === 'pc' ? selectedImage?.image_pc : selectedImage?.image_sp
                if (imageData) {
                  onDownload('single', selectedSectionId!, imageData)
                }
              }}
              onFieldUpdate={() => {}}
              onSectionUpdate={onSectionUpdate}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

