import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, ChevronDown, X } from 'lucide-react'

const labelOf = (s) => `${s.name} (${s.school ?? ''} ${s.grade ?? ''})`.replace(/\s+\)/, ')')

// 검색형 학생 선택 콤보박스. 학생 수가 많아 일반 select 드롭다운이 비효율이라 도입.
// 라이브러리 없이 input + 필터링 목록 + 키보드 내비(↑↓/Enter/Esc) + 외부 클릭 닫기.
// value는 선택된 studentId, onChange(id)로 상위에 전달.
export default function StudentCombobox({ students, value, onChange, placeholder = '피상담자 검색...' }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const wrapRef = useRef(null)
  const listRef = useRef(null)

  const selected = students.find((s) => s.id === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return students
    return students.filter((s) => labelOf(s).toLowerCase().includes(q))
  }, [students, query])

  // 외부 클릭 시 닫기.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // 활성 항목이 보이도록 스크롤.
  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.children[activeIdx]
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx, open])

  const choose = (s) => {
    onChange(s.id)
    setQuery('')
    setOpen(false)
  }

  const clear = () => {
    onChange('')
    setQuery('')
    setActiveIdx(0)
    setOpen(true)
  }

  const openDropdown = () => {
    setActiveIdx(0)
    setOpen(true)
  }

  const handleKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      openDropdown()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const s = filtered[activeIdx]
      if (s) choose(s)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const fieldClass =
    'w-full border border-gray-200 rounded-xl pl-9 pr-9 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300'

  return (
    <div ref={wrapRef} className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        type="text"
        // 선택된 상태에서 검색 중이 아니면 선택 학생명을 보여준다.
        value={open ? query : selected ? labelOf(selected) : ''}
        onChange={(e) => {
          setQuery(e.target.value)
          setActiveIdx(0)
          if (!open) setOpen(true)
        }}
        onFocus={openDropdown}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={fieldClass}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {selected ? (
        <button
          type="button"
          onClick={clear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
          aria-label="선택 해제"
        >
          <X size={16} />
        </button>
      ) : (
        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      )}

      {open && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-60 overflow-auto bg-white border border-gray-200 rounded-xl shadow-lg py-1"
          role="listbox"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-gray-400">검색 결과가 없어요</li>
          ) : (
            filtered.map((s, idx) => (
              <li
                key={s.id}
                role="option"
                aria-selected={s.id === value}
                // mousedown으로 처리해 input blur보다 먼저 선택을 확정한다.
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(s)
                }}
                onMouseEnter={() => setActiveIdx(idx)}
                className={`px-3 py-2.5 text-sm cursor-pointer ${
                  idx === activeIdx ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                } ${s.id === value ? 'font-semibold' : ''}`}
              >
                {labelOf(s)}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
