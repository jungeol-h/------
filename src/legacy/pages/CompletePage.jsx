import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDiagnosis } from '../context/DiagnosisContext'
import PdfReport from '../components/result/PdfReport'
import './CompletePage.css'

export default function CompletePage() {
  const { state, dispatch } = useDiagnosis()
  const navigate = useNavigate()
  const reportRef = useRef(null)
  const scrollRef = useRef(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [previewScale, setPreviewScale] = useState(0.55)

  useEffect(() => {
    function updateScale() {
      if (scrollRef.current) {
        const containerW = scrollRef.current.clientWidth
        const scale = Math.min(1, containerW / 1122)
        setPreviewScale(scale)
      }
    }
    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  const { result } = state

  // result에 개인정보 병합
  const fullResult = result
    ? {
        ...result,
        studentName: state.studentName || result.studentName || '',
        school: state.school || '',
        grade: state.grade || '',
      }
    : null

  async function handleDownloadPdf() {
    if (!reportRef.current || isGenerating) return
    setIsGenerating(true)
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([
        import('html-to-image'),
        import('jspdf'),
      ])

      const dataUrl = await toPng(reportRef.current, {
        width: 1122,
        height: 794,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      })

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pdfW = pdf.internal.pageSize.getWidth()
      const pdfH = pdf.internal.pageSize.getHeight()
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfW, pdfH)

      const name = state.studentName || '학습자'
      pdf.save(`${name}_학습진단결과.pdf`)
    } catch (err) {
      console.error('[PDF 생성 실패]', err)
      alert('PDF 생성 중 오류가 발생했습니다.')
    } finally {
      setIsGenerating(false)
    }
  }

  function handleRestart() {
    dispatch({ type: 'RESET' })
    window.location.href = '/'
  }

  if (!fullResult) {
    navigate('/result')
    return null
  }

  return (
    <div className="complete-page">
      <div className="complete-inner">
        {/* 상단 완료 메시지 */}
        <div className="complete-hero">
          <div className="complete-check">✓</div>
          <h1 className="complete-title">진단이 완료되었습니다!</h1>
          <p className="complete-desc">
            {state.studentName}님의 학습 진단 결과를 PDF로 저장해 보세요.
          </p>
        </div>

        {/* PDF 미리보기 카드 */}
        <div className="complete-preview-wrap">
          <div className="complete-preview-label">결과지 미리보기</div>
          <div
            className="complete-preview-scroll"
            ref={scrollRef}
            style={{ height: `${794 * previewScale}px` }}
          >
            <div
              className="complete-preview-scaler"
              style={{
                transform: `scale(${previewScale})`,
                transformOrigin: 'top left',
                width: '1122px',
                height: '794px',
              }}
            >
              <PdfReport result={fullResult} reportRef={reportRef} />
            </div>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="complete-actions">
          <button
            className="complete-btn-pdf"
            onClick={handleDownloadPdf}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <span className="complete-btn-spinner" />
            ) : (
              <>
                <span className="complete-btn-icon">↓</span>
                PDF 다운로드
              </>
            )}
          </button>
          <button className="complete-btn-back" onClick={() => navigate('/result')}>
            결과 다시 보기
          </button>
          <button className="complete-btn-restart" onClick={handleRestart}>
            처음으로
          </button>
        </div>
      </div>
    </div>
  )
}
