import { useState, useMemo } from 'react'
import { X, Plus, Pencil, Trash2, Search, Save, Users } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { normalizePhone, isValidPhone } from './userFormUtils.js'

const LOGIN_ID_RE = /^[가-힣A-Za-z0-9_]+$/
const INVISIBLE_RE = new RegExp('\\u200B|\\u200C|\\u200D|\\uFEFF|\\u00A0', 'g')
const cleanText = (v) => (v ?? '').replace(INVISIBLE_RE, '').trim()

function humanizeError(err) {
  if (!err) return '저장 중 오류가 발생했습니다.'
  const msg = err.message || ''
  if (err.code === '23505' || /duplicate key/i.test(msg)) return '이미 사용 중인 login_id입니다.'
  return msg || '저장 중 오류가 발생했습니다.'
}

// 학부모 추가/수정 폼
function ParentForm({ mode, initial, initialChildIds = [], activeStudents, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [loginId, setLoginId] = useState(initial?.loginId ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [resetPassword, setResetPassword] = useState(false) // edit 모드: 저장 시 비밀번호를 연락처로 초기화
  const [childIds, setChildIds] = useState(initialChildIds)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const isEdit = mode === 'edit'

  const visibleStudents = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return activeStudents
    return activeStudents.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.school || '').toLowerCase().includes(q) ||
        (s.grade || '').toLowerCase().includes(q)
    )
  }, [activeStudents, query])

  const toggleChild = (id) => {
    setChildIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const canSubmit = cleanText(name) && cleanText(loginId) && phone

  const handleSubmit = async () => {
    setErrorMsg('')
    const nameClean = cleanText(name)
    const loginIdClean = cleanText(loginId)
    if (!nameClean) return setErrorMsg('이름을 입력하세요.')
    if (!loginIdClean) return setErrorMsg('로그인 ID를 입력하세요.')
    if (!LOGIN_ID_RE.test(loginIdClean)) {
      return setErrorMsg('로그인 ID는 한글·영문·숫자·밑줄(_)만 사용할 수 있습니다.')
    }
    const phoneClean = normalizePhone(phone)
    if (!phoneClean) return setErrorMsg('연락처를 입력하세요.')
    if (!isValidPhone(phoneClean)) {
      return setErrorMsg('연락처는 010으로 시작하는 11자리 숫자여야 합니다.')
    }

    setSaving(true)
    try {
      await onSubmit({
        name: nameClean,
        loginId: loginIdClean,
        phone: phoneClean,
        resetPassword: isEdit ? resetPassword : undefined,
        childIds,
      })
    } catch (err) {
      setErrorMsg(humanizeError(err))
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] font-bold text-gray-500 mb-1">이름 *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
            placeholder="예: 홍길동 학부모"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-gray-500 mb-1">로그인 ID *</label>
          <input
            type="text"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
            placeholder="예: parent_hong"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-gray-500 mb-1">연락처 *</label>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          value={phone}
          onChange={(e) => setPhone(normalizePhone(e.target.value))}
          maxLength={11}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
          placeholder="01012345678"
        />
        {!isEdit && (
          <p className="mt-1 text-[10px] text-gray-400">
            초기 비밀번호는 연락처와 같게 설정되며, 첫 로그인 때 본인이 직접 바꿉니다.
          </p>
        )}
      </div>

      {isEdit && (
        <label className="flex items-start gap-2 rounded-lg border border-gray-200 px-3 py-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={resetPassword}
            onChange={(e) => setResetPassword(e.target.checked)}
            className="w-4 h-4 mt-0.5"
          />
          <span className="text-xs text-gray-600">
            <span className="font-bold text-gray-700 block">비밀번호 초기화</span>
            저장 시 비밀번호가 연락처로 재설정되고, 다음 로그인 때 새 비밀번호를 정합니다.
          </span>
        </label>
      )}

      <div>
        <label className="block text-[11px] font-bold text-gray-500 mb-1">
          자녀 선택 ({childIds.length}명)
        </label>
        <div className="mb-2 relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름·학교·학년 검색"
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-rose-400"
          />
        </div>
        <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
          {visibleStudents.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-gray-400">학생이 없습니다.</p>
          ) : (
            visibleStudents.map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={childIds.includes(s.id)}
                  onChange={() => toggleChild(s.id)}
                  className="w-4 h-4"
                />
                <span className="text-sm font-semibold text-gray-800">{s.name}</span>
                <span className="text-xs text-gray-400">
                  {s.grade || ''}{s.school ? ` · ${s.school}` : ''}
                </span>
              </label>
            ))
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-semibold text-gray-700"
        >
          취소
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || saving}
          className="flex-1 py-2.5 rounded-xl bg-rose-600 text-sm font-semibold text-white flex items-center justify-center gap-1 disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  )
}

export default function ParentManagementModal({ onClose }) {
  const { data, addParent, updateParent, deleteParent, setParentChildren } = useData()
  const [view, setView] = useState('list') // 'list' | 'create' | { mode:'edit', parent }

  const parents = data.parents ?? []
  const parentChildren = data.parentChildren ?? []
  const activeStudents = data.students.filter((s) => (s.status ?? 'active') === 'active')

  const childrenOf = (parentId) =>
    parentChildren
      .filter((l) => l.parentId === parentId)
      .map((l) => data.students.find((s) => s.id === l.studentId))
      .filter(Boolean)

  const handleCreate = async ({ name, loginId, phone, childIds }) => {
    await addParent({ name, loginId, phone, childIds })
    setView('list')
  }

  const handleEdit = async (parentId, { name, loginId, phone, resetPassword, childIds }) => {
    await updateParent(parentId, { name, loginId, phone, resetPassword })
    await setParentChildren(parentId, childIds)
    setView('list')
  }

  const handleDelete = async (parent) => {
    if (!window.confirm(`${parent.name} 학부모 계정을 삭제할까요? 자녀 연결도 함께 삭제됩니다.`)) return
    try {
      await deleteParent(parent.id)
    } catch {
      alert('삭제 중 오류가 발생했습니다.')
    }
  }

  const title =
    view === 'create' ? '학부모 추가'
      : view?.mode === 'edit' ? '학부모 수정'
        : '학부모 계정'

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md max-h-[90vh] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-800">{title}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-4">
          {view === 'create' && (
            <ParentForm
              mode="create"
              activeStudents={activeStudents}
              onSubmit={handleCreate}
              onCancel={() => setView('list')}
            />
          )}

          {view?.mode === 'edit' && (
            <ParentForm
              mode="edit"
              initial={view.parent}
              initialChildIds={childrenOf(view.parent.id).map((c) => c.id)}
              activeStudents={activeStudents}
              onSubmit={(form) => handleEdit(view.parent.id, form)}
              onCancel={() => setView('list')}
            />
          )}

          {view === 'list' && (
            <div className="space-y-3">
              <button
                onClick={() => setView('create')}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700"
              >
                <Plus size={16} />
                학부모 추가
              </button>

              {parents.length === 0 ? (
                <div className="py-10 flex flex-col items-center text-center gap-2 text-gray-400">
                  <Users size={32} className="text-gray-300" />
                  <p className="text-sm">등록된 학부모 계정이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {parents.map((p) => {
                    const kids = childrenOf(p.id)
                    return (
                      <div key={p.id} className="bg-gray-50 rounded-xl p-3 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-800">{p.name}</p>
                          <p className="text-xs text-gray-400">ID: {p.loginId}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            자녀: {kids.length > 0 ? kids.map((k) => k.name).join(', ') : '없음'}
                          </p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => setView({ mode: 'edit', parent: p })}
                            className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500"
                            aria-label="수정"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
                            aria-label="삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
