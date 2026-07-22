import { FileText } from 'lucide-react'
import { taskFileUrl } from '../../lib/taskFiles.js'

// 과제 파일 칩 — 강사 첨부(파랑)·학생 제출(초록) 구분해 열람 링크로 표시.
// 학생 과제탭·강사 과제탭·학생상세 과제섹션이 공유한다.
export default function TaskFileChips({ attachments = [], submissions = [] }) {
  if (attachments.length === 0 && submissions.length === 0) return null
  return (
    <div className="mt-2 space-y-1.5">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] text-gray-400">첨부</span>
          {attachments.map((a) => (
            <a key={a.path} href={taskFileUrl(a.path)} target="_blank" rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5 hover:bg-blue-100">
              <FileText size={11} />{a.name}
            </a>
          ))}
        </div>
      )}
      {submissions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] text-emerald-600 font-semibold">제출</span>
          {submissions.map((s) => (
            <a key={s.path} href={taskFileUrl(s.path)} target="_blank" rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5 hover:bg-emerald-100">
              <FileText size={11} />{s.name}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
