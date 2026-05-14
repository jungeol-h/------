import { useState } from 'react'
import { X, Save } from 'lucide-react'

const GRADE_OPTIONS = ['중1', '중2', '중3']

export default function StudentFormModal({
  mode = 'create',
  initial,
  managers = [],
  initialManagerId = '',
  onSubmit,
  onClose,
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [gender, setGender] = useState(initial?.gender ?? '')
  const [grade, setGrade] = useState(initial?.grade ?? '중1')
  const [className, setClassName] = useState(initial?.className ?? '')
  const [school, setSchool] = useState(initial?.school ?? '')
  const [loginId, setLoginId] = useState(initial?.loginId ?? '')
  const [password, setPassword] = useState(initial?.password ?? '')
  const [parentPassword, setParentPassword] = useState(initial?.parentPassword ?? '')
  const [managerId, setManagerId] = useState(initialManagerId ?? '')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const isEdit = mode === 'edit'
  const canSubmit =
    name.trim() && grade && loginId.trim() && password.trim()

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSaving(true)
    setErrorMsg('')
    try {
      await onSubmit({
        name: name.trim(),
        gender: gender || null,
        grade,
        className: className.trim(),
        school: school.trim(),
        loginId: loginId.trim(),
        password: password.trim(),
        parentPassword: parentPassword.trim(),
        managerId: managerId || null,
      })
      onClose()
    } catch (err) {
      setErrorMsg(err?.message ?? '저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md max-h-[90vh] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-800">
            {isEdit ? '학생 정보 수정' : '새 학생 추가'}
          </p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">이름 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              placeholder="예: 홍길동"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">성별</label>
            <div className="flex gap-2">
              {[
                { value: 'M', label: '남' },
                { value: 'F', label: '여' },
                { value: '', label: '미지정' },
              ].map((opt) => (
                <label
                  key={opt.value || 'none'}
                  className={`flex-1 py-2 rounded-lg border text-sm font-semibold text-center cursor-pointer select-none ${
                    gender === opt.value
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="gender"
                    value={opt.value}
                    checked={gender === opt.value}
                    onChange={() => setGender(opt.value)}
                    className="hidden"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1">학년 *</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
              >
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1">반</label>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                placeholder="예: 중2A"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">학교</label>
            <input
              type="text"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              placeholder="예: 안동중학교"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">login_id (로그인 ID) *</label>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              placeholder="동명이인은 다르게 (예: 홍길동남)"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1">비밀번호 *</label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                placeholder="010+8자리"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1">학부모 비밀번호</label>
              <input
                type="text"
                value={parentPassword}
                onChange={(e) => setParentPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                placeholder="010+8자리"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">담당 매니저</label>
            <select
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
            >
              <option value="">미배정</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {errorMsg && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-700">
              {errorMsg}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-semibold text-gray-700"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-sm font-semibold text-white flex items-center justify-center gap-1 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
