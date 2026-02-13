'use client'

import { useState, RefObject } from 'react'
import { Download, Loader2 } from 'lucide-react'

interface PdfExportButtonProps {
  targetRef: RefObject<HTMLDivElement | null>
  fileName?: string
}

export default function PdfExportButton({ targetRef, fileName = 'doya-shindan-report' }: PdfExportButtonProps) {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    if (!targetRef.current || exporting) return
    setExporting(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      const canvas = await html2canvas(targetRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      })

      const imgData = canvas.toDataURL('image/png')
      const imgWidth = 210 // A4 width mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageHeight = 297 // A4 height mm
      let yOffset = 0

      while (yOffset < imgHeight) {
        if (yOffset > 0) pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, -yOffset, imgWidth, imgHeight)
        yOffset += pageHeight
      }

      pdf.save(`${fileName}.pdf`)
    } catch (err) {
      console.error('PDF export failed:', err)
      alert('PDF生成に失敗しました。もう一度お試しください。')
    } finally {
      setExporting(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-bold hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg disabled:opacity-50"
    >
      {exporting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      {exporting ? 'PDF生成中...' : 'PDFダウンロード'}
    </button>
  )
}
