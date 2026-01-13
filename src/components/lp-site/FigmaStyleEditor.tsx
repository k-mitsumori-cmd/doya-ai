'use client'

import React, { useState, useEffect } from 'react'
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
  Target,
  Package,
  Users,
  Trash2,
  Plus,
  CheckCircle,
  AlertCircle,
  LayoutGrid,
} from 'lucide-react'
import { LpGenerationResult, LpSection, SectionImage } from '@/lib/lp-site/types'
import { CompetitorPanel } from './CompetitorPanel'
import toast from 'react-hot-toast'

interface FigmaStyleEditorProps {
  result: LpGenerationResult
  selectedDevice: 'pc' | 'sp'
  onDeviceChange: (device: 'pc' | 'sp') => void
  onSectionsReorder: (newSections: LpSection[]) => void
  onSectionRegenerate: (sectionId: string) => Promise<void>
  onDownload: (type: string, sectionId?: string, imageData?: string) => void
  onSectionUpdate?: (sectionId: string, field: string, value: string) => void
  onSectionDelete?: (sectionId: string) => void // セクション削除
  onPreview?: () => void
  onPublish?: () => void
  isGeneratingImages?: boolean
  sectionProgress?: Record<string, number>
  generatingSections?: Set<string>
  onAutoRegenerate?: (sectionIds: string[]) => void // 未生成画像の自動再生成
}

interface SectionItemProps {
  section: LpSection
  index: number
  image?: SectionImage
  selectedDevice: 'pc' | 'sp'
  isSelected: boolean
  isVisible: boolean
  isGenerating?: boolean
  onSelect: () => void
  onToggleVisibility: () => void
  onRegenerate: () => void
  onDelete: () => void
  onEdit: () => void
}

function SectionItem({ 
  section, 
  index, 
  image, 
  selectedDevice, 
  isSelected, 
  isVisible, 
  isGenerating, 
  onSelect, 
  onToggleVisibility,
  onRegenerate,
  onDelete,
  onEdit,
}: SectionItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.section_id,
  })
  const [showActions, setShowActions] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const hasImagePc = !!image?.image_pc
  const hasImageSp = !!image?.image_sp
  const hasBothImages = hasImagePc && hasImageSp

  // 画像生成状態を判定
  const getImageStatus = () => {
    if (isGenerating) return 'generating' // 生成中
    if (hasBothImages) return 'complete' // PC/SP両方完了
    if (hasImagePc || hasImageSp) return 'partial' // 片方のみ完了
    return 'pending' // 未生成
  }
  const imageStatus = getImageStatus()

  // セクションタイプの日本語表示
  const getSectionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      hero: 'ヒーロー',
      stats: '実績・数値',
      problem: '課題提起',
      solution: '解決策',
      features: '特徴',
      benefit: 'ベネフィット',
      trust: '信頼性',
      testimonial: 'お客様の声',
      case_study: '導入事例',
      faq: 'よくある質問',
      pricing: '料金',
      cta: 'CTA',
      comparison: '比較',
      process: '導入フロー',
      guarantee: '保証',
    }
    return labels[type.toLowerCase()] || type
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group rounded-lg border transition-all ${
        isSelected
          ? 'bg-blue-50 border-blue-300 shadow-sm'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
      } ${!isVisible ? 'opacity-50' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* ヘッダー部分 */}
      <div 
        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        onClick={onSelect}
      >
        <div
          {...attributes}
          {...listeners}
          className="w-5 h-5 flex items-center justify-center cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
              {index + 1}
            </span>
            <span className="text-xs font-semibold text-slate-700 truncate">
              {section.headline || `セクション ${index + 1}`}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {getSectionTypeLabel(section.section_type)}
          </div>
        </div>

        {/* 画像ステータスバッジ */}
        <div className="flex items-center gap-1">
          {imageStatus === 'complete' && (
            <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              完了
            </span>
          )}
          {imageStatus === 'partial' && (
            <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {hasImagePc ? 'PC' : 'SP'}のみ
            </span>
          )}
          {imageStatus === 'generating' && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              生成中
            </span>
          )}
          {imageStatus === 'pending' && (
            <span className="px-2 py-1 bg-red-100 text-red-600 text-[10px] font-bold rounded-full flex items-center gap-1">
              <ImageIcon className="w-3 h-3" />
              未生成
            </span>
          )}
        </div>
      </div>

      {/* アクションボタン（ホバー時または選択時に表示） */}
      {(showActions || isSelected) && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="border-t border-slate-100 px-3 py-2 flex items-center gap-1"
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleVisibility()
            }}
            className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded flex items-center justify-center gap-1 transition-colors ${
              isVisible 
                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
            }`}
            title={isVisible ? '非表示にする' : '表示する'}
          >
            {isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {isVisible ? '表示中' : '非表示'}
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            className="flex-1 px-2 py-1.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded hover:bg-slate-200 flex items-center justify-center gap-1 transition-colors"
            title="編集"
          >
            <Edit className="w-3 h-3" />
            編集
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRegenerate()
            }}
            disabled={isGenerating}
            className="flex-1 px-2 py-1.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
            title="画像を再生成"
          >
            {isGenerating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            再生成
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (confirm('このセクションを削除しますか？')) {
                onDelete()
              }
            }}
            className="px-2 py-1.5 text-[10px] font-medium bg-red-100 text-red-600 rounded hover:bg-red-200 flex items-center justify-center gap-1 transition-colors"
            title="削除"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </motion.div>
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
        <div className="pt-4 border-t border-slate-200 space-y-3">
          {/* メイン再生成ボタン */}
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRegenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>生成中...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                <span>修正内容で再生成</span>
              </>
            )}
          </button>

          {/* 補足テキスト */}
          <p className="text-[10px] text-slate-500 text-center">
            上記の見出し・サブ見出し・目的を修正後、ボタンを押すと新しい画像が生成されます
          </p>

          {/* ダウンロードボタン */}
          {hasImage && (
            <button
              onClick={onDownload}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
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
  onSectionDelete,
  onPreview,
  onPublish,
  isGeneratingImages = false,
  sectionProgress = {},
  generatingSections = new Set(),
  onAutoRegenerate,
}: FigmaStyleEditorProps) {
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [regeneratingSectionId, setRegeneratingSectionId] = useState<string | null>(null)
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set(result.sections.map(s => s.section_id)))
  const [zoom, setZoom] = useState(100)
  const [rightPanelTab, setRightPanelTab] = useState<'property' | 'product' | 'competitor'>('property')
  const [isAutoRegenerating, setIsAutoRegenerating] = useState(false)

  // セクション削除ハンドラー
  const handleSectionDelete = (sectionId: string) => {
    if (onSectionDelete) {
      onSectionDelete(sectionId)
      // 削除したセクションが選択されていた場合は選択を解除
      if (selectedSectionId === sectionId) {
        setSelectedSectionId(null)
      }
      toast.success('セクションを削除しました')
    }
  }

  // セクション再生成ハンドラー
  const handleSectionRegenerateFromList = async (sectionId: string) => {
    setRegeneratingSectionId(sectionId)
    try {
      await onSectionRegenerate(sectionId)
      toast.success('画像を再生成しました')
    } catch (error) {
      toast.error('再生成に失敗しました')
    } finally {
      setRegeneratingSectionId(null)
    }
  }

  // 未生成の画像があるセクションを取得
  const getMissingSections = () => {
    return result.sections.filter(section => {
      if (!section.image_required) return false
      const image = result.images.find(img => img.section_id === section.section_id)
      // PC/SP両方とも未生成の場合のみ
      return !image || (!image.image_pc && !image.image_sp)
    })
  }

  // 部分的に生成されているセクション（PC/SPどちらか一方のみ）
  const getPartialSections = () => {
    return result.sections.filter(section => {
      if (!section.image_required) return false
      const image = result.images.find(img => img.section_id === section.section_id)
      if (!image) return false
      // PC/SPどちらか一方のみ生成されている場合
      return (image.image_pc && !image.image_sp) || (!image.image_pc && image.image_sp)
    })
  }

  const missingSections = getMissingSections()
  const partialSections = getPartialSections()
  const hasIncompleteImages = missingSections.length > 0 || partialSections.length > 0

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const sections = result.sections
  const selectedSection = sections.find(s => s.section_id === selectedSectionId) || null
  const selectedImage = result.images.find(img => img.section_id === selectedSectionId)
  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/15de686c-5b2c-46c4-b310-69b34571ae07',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FigmaStyleEditor.tsx:render',message:'FigmaStyleEditor状態',data:{isGeneratingImages,generatingSectionsCount:generatingSections?.size||0,sectionProgressKeys:Object.keys(sectionProgress||{}).length,imagesCount:result.images.length,sectionsCount:sections.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
  }, [isGeneratingImages, generatingSections, sectionProgress, result.images.length, sections.length]);
  // #endregion

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
          {/* 画像生成中の表示 */}
          {isGeneratingImages && (
            <div className="px-4 py-2 text-sm font-medium bg-blue-100 text-blue-700 rounded-lg flex items-center gap-2 border border-blue-200">
              <Loader2 className="w-4 h-4 animate-spin" />
              画像生成中...
            </div>
          )}
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
        {/* 左サイドバー：セクションパネル */}
        <div className="w-72 bg-slate-50 border-r border-slate-200 flex flex-col flex-shrink-0">
          {/* ヘッダー */}
          <div className="h-14 border-b border-slate-200 flex items-center justify-between px-4 bg-white">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-bold text-slate-900">セクション</span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                {sections.length}
              </span>
            </div>
          </div>

          {/* セクション統計 */}
          <div className="px-4 py-3 bg-white border-b border-slate-200">
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-slate-600">完了: {sections.filter(s => {
                  const img = result.images.find(i => i.section_id === s.section_id)
                  return img?.image_pc && img?.image_sp
                }).length}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                <span className="text-slate-600">部分: {partialSections.length}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                <span className="text-slate-600">未生成: {missingSections.length}</span>
              </div>
            </div>
          </div>

          {/* セクションリスト */}
          <div className="flex-1 overflow-y-auto p-3">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sections.map(s => s.section_id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                    {sections.map((section, index) => {
                      const image = result.images.find(img => img.section_id === section.section_id)
                      const isGeneratingThisSection = generatingSections?.has(section.section_id) || regeneratingSectionId === section.section_id
                      return (
                        <SectionItem
                          key={section.section_id}
                          section={section}
                          index={index}
                          image={image}
                          selectedDevice={selectedDevice}
                          isSelected={selectedSectionId === section.section_id}
                          isVisible={visibleSections.has(section.section_id)}
                          isGenerating={isGeneratingThisSection}
                          onSelect={() => setSelectedSectionId(section.section_id)}
                          onToggleVisibility={() => handleToggleVisibility(section.section_id)}
                          onRegenerate={() => handleSectionRegenerateFromList(section.section_id)}
                          onDelete={() => handleSectionDelete(section.section_id)}
                          onEdit={() => {
                            setSelectedSectionId(section.section_id)
                            setRightPanelTab('property')
                          }}
                        />
                      )
                    })}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* 一括アクション */}
          {hasIncompleteImages && !isGeneratingImages && onAutoRegenerate && (
            <div className="p-3 border-t border-slate-200 bg-white">
              <button
                onClick={() => {
                  const sectionIds = [...missingSections, ...partialSections].map(s => s.section_id)
                  setIsAutoRegenerating(true)
                  onAutoRegenerate(sectionIds)
                }}
                disabled={isAutoRegenerating}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
              >
                {isAutoRegenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    再生成中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    未生成画像を一括再生成 ({missingSections.length + partialSections.length})
                  </>
                )}
              </button>
            </div>
          )}
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
                      const isRegenerating = regeneratingSectionId === section.section_id || (isGeneratingImages && !imageData)
                      
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
                                    animate={{
                                      x: ['-100%', '100%'],
                                    }}
                                    transition={{
                                      duration: 1.5,
                                      repeat: Infinity,
                                      ease: 'linear',
                                    }}
                                    style={{
                                      width: '40%',
                                    }}
                                  />
                                </div>
                              )}
                              <p className="text-xs text-slate-600 leading-relaxed">
                                {isRegenerating ? (
                                  <>
                                    <span className="font-bold text-teal-700">AIが画像を生成しています...</span>
                                    <br />
                                    この処理には30秒〜2分程度かかる場合があります。
                                    <br />
                                    完了次第、自動的に表示されます。
                                  </>
                                ) : (
                                  <>
                                    この場所に{section.section_type}セクションの画像が表示されます。
                                    <br />
                                    生成完了次第、自動的に表示されます。
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
                      const isRegenerating = regeneratingSectionId === section.section_id || (isGeneratingImages && !imageData)
                  
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
                                    animate={{
                                      x: ['-100%', '100%'],
                                    }}
                                    transition={{
                                      duration: 1.5,
                                      repeat: Infinity,
                                      ease: 'linear',
                                    }}
                                    style={{
                                      width: '40%',
                                    }}
                                  />
                                </div>
                              )}
                              <p className="text-sm text-slate-700 leading-relaxed">
                                {isRegenerating ? (
                                  <>
                                    <span className="font-bold text-teal-700">AIが画像を生成しています...</span>
                                    <br />
                                    この処理には30秒〜2分程度かかる場合があります。
                                    <br />
                                    完了次第、自動的に表示されます。
                                  </>
                                ) : (
                                  <>
                                    この場所に<span className="font-bold text-teal-700">{section.section_type}</span>セクションの画像が表示されます。
                                    <br />
                                    生成完了次第、自動的に表示されます。
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

        {/* 右サイドバー：タブ切り替え（プロパティ / 商品情報 / 競合情報） */}
        <div className="w-80 bg-white border-l border-slate-200 flex flex-col flex-shrink-0">
          {/* タブヘッダー */}
          <div className="h-12 border-b border-slate-200 flex items-center px-2 gap-1">
            <button
              onClick={() => setRightPanelTab('property')}
              className={`flex-1 h-9 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                rightPanelTab === 'property'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              プロパティ
            </button>
            <button
              onClick={() => setRightPanelTab('product')}
              className={`flex-1 h-9 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                rightPanelTab === 'product'
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              商品情報
            </button>
            <button
              onClick={() => setRightPanelTab('competitor')}
              className={`flex-1 h-9 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                rightPanelTab === 'competitor'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              競合
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {/* プロパティパネル */}
            {rightPanelTab === 'property' && (
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
            )}
            
            {/* 商品情報パネル */}
            {rightPanelTab === 'product' && (
              <div className="h-full overflow-y-auto p-4">
                <div className="space-y-4">
                  {/* 商品名 */}
                  <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-4 border border-teal-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="w-4 h-4 text-teal-600" />
                      <span className="text-xs font-bold text-teal-700">商品名</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">{result.product_info.product_name}</p>
                  </div>
                  
                  {/* ターゲット */}
                  <div className="bg-white rounded-xl p-4 border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-bold text-slate-700">ターゲット</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{result.product_info.target}</p>
                  </div>
                  
                  {/* 課題 */}
                  <div className="bg-white rounded-xl p-4 border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-slate-700">🎯 解決する課題</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{result.product_info.problem}</p>
                  </div>
                  
                  {/* 提供価値 */}
                  <div className="bg-white rounded-xl p-4 border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-slate-700">💡 提供価値</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{result.product_info.solution}</p>
                  </div>
                  
                  {/* ベネフィット */}
                  {result.product_info.benefit && (
                    <div className="bg-white rounded-xl p-4 border border-slate-200">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-slate-700">✨ ベネフィット</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{result.product_info.benefit}</p>
                    </div>
                  )}
                  
                  {/* 差別化ポイント */}
                  {result.product_info.differentiation && (
                    <div className="bg-white rounded-xl p-4 border border-slate-200">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-slate-700">🚀 差別化ポイント</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{result.product_info.differentiation}</p>
                    </div>
                  )}
                  
                  {/* トーン・LPタイプ */}
                  <div className="flex gap-2">
                    <div className="flex-1 bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <div className="text-xs font-bold text-slate-500 mb-1">トーン</div>
                      <div className="text-xs font-bold text-slate-900">{result.product_info.tone}</div>
                    </div>
                    <div className="flex-1 bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <div className="text-xs font-bold text-slate-500 mb-1">LPタイプ</div>
                      <div className="text-xs font-bold text-slate-900">{result.product_info.lp_type}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* 競合情報パネル */}
            {rightPanelTab === 'competitor' && (
              <CompetitorPanel
                competitorResearch={result.competitor_research}
                productName={result.product_info.product_name}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

