import { useEffect, useMemo } from 'react'
import { X, Download } from 'lucide-react'
import { saveBlob } from '../utils/downloadPdf.js'

// PDF 미리보기 모달 — 모든 리포트가 저장 전에 거친다 (2026-07 클라이언트 요청).
// blob을 object URL로 iframe에 표시하고, [PDF 저장]으로 다운로드한다.
// 모바일 등 브라우저 내장 PDF 뷰어가 없는 환경은 안내문 + 저장 버튼만 노출.
export default function PdfPreviewModal({ blob, filename, onClose }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob])
  useEffect(() => () => URL.revokeObjectURL(url), [url])

  // pdfViewerEnabled가 false로 확정된 경우만 미리보기 불가로 판단
  // (undefined인 구형 브라우저는 일단 iframe을 시도한다).
  const canPreview = navigator.pdfViewerEnabled !== false

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
      <div className="bg-white rounded-3xl w-full max-w-3xl p-5 space-y-4 max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between flex-shrink-0">
          <h3 className="font-bold text-gray-900 text-base truncate pr-2">미리보기 — {filename}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0" aria-label="닫기">
            <X size={20} />
          </button>
        </div>

        {canPreview ? (
          <iframe
            src={url}
            title="PDF 미리보기"
            className="w-full h-[65vh] rounded-xl border border-gray-200 bg-gray-50"
          />
        ) : (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
            이 기기에서는 미리보기가 지원되지 않습니다.
            <br />
            아래 [PDF 저장]으로 내려받아 확인해 주세요.
          </div>
        )}

        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium"
          >
            닫기
          </button>
          <button
            onClick={() => saveBlob(blob, filename)}
            className="flex-1 py-3 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Download size={16} />
            PDF 저장
          </button>
        </div>
      </div>
    </div>
  )
}
