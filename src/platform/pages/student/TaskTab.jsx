import { useState } from 'react'
import { CheckCircle2, Circle, ClipboardList, Upload } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'

export default function TaskTab() {
  const { currentUser } = useAuth()
  const { data, toggleTask } = useData()
  const tasks = data.tasks.filter(t => t.studentId === currentUser?.id)
  const pending = tasks.filter(t => t.status === 'pending')
  const done = tasks.filter(t => t.status === 'done')

  const [toast, setToast] = useState(false)

  const showToast = () => {
    setToast(true)
    setTimeout(() => setToast(false), 2000)
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
                    <button onClick={() => toggleTask(t.id)} className="flex-shrink-0 text-red-300 hover:text-blue-400 transition-colors">
                      <Circle size={24} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800">{t.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-gray-400">{t.subject}</span>
                        {t.assignerName && (
                          <span className="text-xs text-gray-400">출제: {t.assignerName}</span>
                        )}
                        <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium ml-auto">
                          마감 {t.dueDate}{t.dueTime ? ` ${t.dueTime}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={showToast}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    <Upload size={13} />
                    과제 제출하기
                  </button>
                </div>
              ))}
            </div>
          )}
          {done.length > 0 && (
            <>
              <p className="text-xs text-gray-400 font-medium pt-1">완료된 과제</p>
              <div className="space-y-2">
                {done.map(t => (
                  <div key={t.id} className="bg-gray-50 rounded-2xl p-4 flex items-center gap-3 opacity-60">
                    <button onClick={() => toggleTask(t.id)} className="flex-shrink-0 text-green-500">
                      <CheckCircle2 size={24} />
                    </button>
                    <div className="flex-1">
                      <p className="font-medium text-gray-500 line-through">{t.title}</p>
                      <p className="text-xs text-gray-400">{t.subject}{t.assignerName ? ` · 출제: ${t.assignerName}` : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* 파일 업로드 안내 토스트 */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-5 py-3 rounded-2xl shadow-lg z-50 whitespace-nowrap">
          파일 업로드는 정식 버전에서 지원됩니다
        </div>
      )}
    </div>
  )
}
