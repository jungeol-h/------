import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import TaskFormModal from '../../components/tasks/TaskFormModal.jsx'

// 교과강사/컨설턴트 과제 탭 — 상단 부여 버튼 + 본인이 부여한 과제 목록.
export default function EducatorTaskTab() {
  const { currentUser } = useAuth()
  const { data, deleteTask } = useData()
  const [showForm, setShowForm] = useState(false)
  const [editTask, setEditTask] = useState(null)

  const students = data.students.filter((s) => s.status !== 'inactive')

  const myTasks = data.tasks
    .filter((t) => t.assignerId === currentUser?.id)
    .slice()
    .sort((a, b) => (b.dueDate > a.dueDate ? 1 : -1))

  const studentName = (id) => data.students.find((s) => s.id === id)?.name ?? '학생'

  const handleDelete = async (id) => {
    if (!window.confirm('이 과제를 삭제할까요?')) return
    try {
      await deleteTask(id)
    } catch {
      // 실패는 전역 Toast가 표면화한다.
    }
  }

  return (
    <div className="py-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">과제 부여</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 bg-emerald-500 text-white text-sm font-bold px-3 py-2 rounded-xl hover:bg-emerald-600 active:scale-95 transition-all"
        >
          <Plus size={16} /> 과제 부여
        </button>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-bold text-gray-500">내가 부여한 과제 ({myTasks.length})</h3>
        {myTasks.length === 0 ? (
          <div className="text-center text-gray-400 py-12">부여한 과제가 없어요 📋</div>
        ) : (
          <div className="space-y-3">
            {myTasks.map((t) => (
              <div key={t.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{studentName(t.studentId)}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        t.status === 'done'
                          ? 'bg-green-100 text-green-600'
                          : 'bg-orange-100 text-orange-600'
                      }`}
                    >
                      {t.status === 'done' ? '완료' : '미완료'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditTask(t)}
                      className="text-gray-400 hover:text-blue-600 p-0.5"
                      aria-label="과제 수정"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="text-gray-400 hover:text-red-600 p-0.5"
                      aria-label="과제 삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-700 font-medium">{t.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {t.subject ? `${t.subject} · ` : ''}마감 {t.dueDate}
                  {t.dueTime && t.dueTime !== '23:59' ? ` ${t.dueTime}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {showForm && (
        <TaskFormModal students={students} onClose={() => setShowForm(false)} />
      )}
      {editTask && (
        <TaskFormModal task={editTask} onClose={() => setEditTask(null)} />
      )}
    </div>
  )
}
