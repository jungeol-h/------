// 학생 과제 탭 (/student/task) — 부여받은 과제를 미완료/완료로 나눠 보여주고 완료 토글(toggleTask).
// 강사가 첨부한 문제/자료 파일 열람 + 학생 본인의 과제 제출 파일 업로드/제거를 지원한다.

import { useState, useRef } from 'react'
import { CheckCircle2, Circle, ClipboardList, Upload, Paperclip, FileText, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import {
  uploadTaskFiles, removeTaskFiles, taskFileUrl, validateTaskFile,
  MAX_TASK_FILES, MAX_TASK_FILE_MB,
} from '../../lib/taskFiles.js'

function sizeLabel(bytes) {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)}MB` : `${Math.ceil(bytes / 1024)}KB`
}

// 강사가 첨부한 문제/자료 — 열람 링크 칩.
function TeacherAttachments({ attachments }) {
  if (!attachments?.length) return null
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {attachments.map((a) => (
        <a
          key={a.path}
          href={taskFileUrl(a.path)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5 hover:bg-blue-100"
        >
          <FileText size={11} />
          {a.name}
        </a>
      ))}
    </div>
  )
}

// 학생 제출 파일 영역 — 목록 + 업로드/제거. submissions 전체를 새 배열로 저장한다.
function SubmissionArea({ task, onError }) {
  const { setTaskSubmissions } = useData()
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null) // { done, total } — 대용량 업로드 체감용
  const submissions = task.submissions ?? []

  const handlePick = async (e) => {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = '' // 같은 파일 재선택 허용
    if (picked.length === 0) return
    const valid = []
    for (const file of picked) {
      if (submissions.length + valid.length >= MAX_TASK_FILES) {
        alert(`제출 파일은 최대 ${MAX_TASK_FILES}개까지 가능해요.`)
        break
      }
      const problem = validateTaskFile(file)
      if (problem) {
        alert(`${file.name}: ${problem}`)
        continue
      }
      valid.push(file)
    }
    if (valid.length === 0) return
    setBusy(true)
    try {
      const uploaded = await uploadTaskFiles(valid, task.studentId, (done, total) => setProgress({ done, total }))
      await setTaskSubmissions(task.id, [...submissions, ...uploaded])
    } catch {
      onError?.()
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const handleRemove = async (path) => {
    const next = submissions.filter((s) => s.path !== path)
    setBusy(true)
    try {
      await setTaskSubmissions(task.id, next)
      removeTaskFiles([path]) // 실파일 정리 (best-effort)
    } catch {
      onError?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 space-y-2">
      {submissions.length > 0 && (
        <ul className="space-y-1">
          {submissions.map((s) => (
            <li key={s.path} className="flex items-center gap-2 bg-emerald-50/70 rounded-lg px-2.5 py-1.5">
              <FileText size={13} className="text-emerald-500 flex-shrink-0" />
              <a href={taskFileUrl(s.path)} target="_blank" rel="noreferrer" className="text-xs text-gray-700 truncate flex-1 hover:underline">
                {s.name}
              </a>
              <span className="text-[10px] text-gray-400 flex-shrink-0">{sizeLabel(s.size)}</span>
              <button
                type="button"
                onClick={() => handleRemove(s.path)}
                disabled={busy}
                className="p-0.5 text-gray-400 hover:text-red-500 disabled:opacity-40"
                aria-label="제출 파일 제거"
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy || submissions.length >= MAX_TASK_FILES}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40"
      >
        {busy ? <Upload size={13} className="animate-pulse" /> : <Paperclip size={13} />}
        {busy
          ? progress && progress.total > 1 ? `업로드 중... ${progress.done}/${progress.total}` : '업로드 중...'
          : submissions.length > 0 ? '파일 추가 제출' : '과제 제출하기'}
      </button>
      {submissions.length === 0 && (
        <p className="text-[10px] text-gray-400 text-center">이미지·PDF · 최대 {MAX_TASK_FILES}개 · 개당 {MAX_TASK_FILE_MB}MB</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        multiple
        onChange={handlePick}
        className="hidden"
      />
    </div>
  )
}

export default function TaskTab() {
  const { currentUser } = useAuth()
  const { data, toggleTask } = useData()
  const tasks = data.tasks.filter(t => t.studentId === currentUser?.id)
  const pending = tasks.filter(t => t.status === 'pending')
  const done = tasks.filter(t => t.status === 'done')

  const [toast, setToast] = useState('')

  const handleToggleTask = async (id) => {
    try {
      await toggleTask(id)
    } catch {
      // 저장 실패는 전역 Toast가 표면화한다.
    }
  }

  const showError = () => {
    setToast('파일 처리에 실패했어요. 잠시 후 다시 시도해주세요.')
    setTimeout(() => setToast(''), 2500)
  }

  return (
    <div className="py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">과제 목록</h2>
        <span className="text-sm text-gray-500">미완료 {pending.length}개</span>
      </div>
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
          <ClipboardList size={40} strokeWidth={1.2} />
          <p className="text-sm">과제가 없어요</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-2">
              {pending.map(t => (
                <div key={t.id} className="bg-white rounded-2xl p-4 shadow-sm border border-red-100">
                  <div className="flex items-center gap-3">
                    <button onClick={() => handleToggleTask(t.id)} className="flex-shrink-0 text-red-300 hover:text-blue-400 transition-colors">
                      <Circle size={24} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800">{t.title}</p>
                      {t.content && (
                        <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap leading-relaxed">{t.content}</p>
                      )}
                      {t.method && (
                        <p className="text-xs text-gray-500 mt-1">수행방법: {t.method}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-gray-400">{t.subject}</span>
                        {t.assignerName && (
                          <span className="text-xs text-gray-400">출제: {t.assignerName}</span>
                        )}
                        <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium ml-auto">
                          마감 {t.dueDate}{t.dueTime ? ` ${t.dueTime}` : ''}
                        </span>
                      </div>
                      <TeacherAttachments attachments={t.attachments} />
                    </div>
                  </div>
                  <SubmissionArea task={t} onError={showError} />
                </div>
              ))}
            </div>
          )}
          {done.length > 0 && (
            <>
              <p className="text-xs text-gray-400 font-medium pt-1">완료된 과제</p>
              <div className="space-y-2">
                {done.map(t => (
                  <div key={t.id} className="bg-gray-50 rounded-2xl p-4 opacity-70">
                    <div className="flex items-center gap-3">
                      <button onClick={() => handleToggleTask(t.id)} className="flex-shrink-0 text-green-500">
                        <CheckCircle2 size={24} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-500 line-through">{t.title}</p>
                        <p className="text-xs text-gray-400">{t.subject}{t.assignerName ? ` · 출제: ${t.assignerName}` : ''}</p>
                      </div>
                    </div>
                    {(t.attachments?.length > 0 || t.submissions?.length > 0) && (
                      <>
                        <TeacherAttachments attachments={t.attachments} />
                        {t.submissions?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {t.submissions.map((s) => (
                              <a
                                key={s.path}
                                href={taskFileUrl(s.path)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5 hover:bg-emerald-100"
                              >
                                <FileText size={11} />
                                {s.name}
                              </a>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-5 py-3 rounded-2xl shadow-lg z-50 whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  )
}
