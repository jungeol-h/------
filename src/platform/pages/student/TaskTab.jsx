import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'

export default function TaskTab() {
  const { currentUser } = useAuth()
  const { data, toggleTask } = useData()
  const tasks = data.tasks.filter(t => t.studentId === currentUser?.id)
  const pending = tasks.filter(t => t.status === 'pending')
  const done = tasks.filter(t => t.status === 'done')

  return (
    <div className="py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">과제 목록</h2>
        <span className="text-sm text-gray-500">미완료 {pending.length}개</span>
      </div>
      {tasks.length === 0 ? (
        <div className="text-center text-gray-400 py-16">과제가 없어요 ✅</div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-2">
              {pending.map(t => (
                <div key={t.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
                  <button
                    onClick={() => toggleTask(t.id)}
                    className="w-6 h-6 rounded-full border-2 border-gray-300 flex-shrink-0"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{t.title}</p>
                    <p className="text-xs text-gray-400">{t.subject} · 마감 {t.dueDate}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {done.length > 0 && (
            <>
              <p className="text-xs text-gray-400 font-medium">완료된 과제</p>
              <div className="space-y-2">
                {done.map(t => (
                  <div key={t.id} className="bg-gray-50 rounded-2xl p-4 flex items-center gap-3 opacity-60">
                    <button
                      onClick={() => toggleTask(t.id)}
                      className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0"
                    >
                      <span className="text-white text-xs">✓</span>
                    </button>
                    <div className="flex-1">
                      <p className="font-medium text-gray-500 line-through">{t.title}</p>
                      <p className="text-xs text-gray-400">{t.subject}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
