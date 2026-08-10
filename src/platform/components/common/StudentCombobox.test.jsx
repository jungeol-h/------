import React from 'react'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StudentCombobox from './StudentCombobox.jsx'

// jsdom 미구현 — 활성 항목 스크롤 효과에서만 쓰인다
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

// 2026-08 클라이언트: 학생 이용시간 수정에서 이름 검색 + 신청취소·퇴원 학생도 대상.
const STUDENTS = [
  { id: 's1', name: '김하늘', school: '나매크고', grade: '고1', status: 'active' },
  { id: 's2', name: '이바다', school: '나매크고', grade: '고2', status: 'withdrawn' },
  { id: 's3', name: '박구름', school: '나매크고', grade: '고3', status: 'cancelled' },
  { id: 's4', name: '최바람', school: '나매크고', grade: '고1' }, // status 누락 = 재원
]

const openList = () => fireEvent.focus(screen.getByRole('combobox'))
const type = (v) => fireEvent.change(screen.getByRole('combobox'), { target: { value: v } })

describe('StudentCombobox', () => {
  it('이름 일부를 입력하면 해당 학생만 남는다', () => {
    render(<StudentCombobox students={STUDENTS} value="" onChange={() => {}} />)
    openList()
    type('하늘')
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(1)
    expect(options[0].textContent).toContain('김하늘')
  })

  it('퇴원·신청취소 학생도 이름으로 검색되고 상태 배지가 붙는다', () => {
    render(<StudentCombobox students={STUDENTS} value="" onChange={() => {}} />)
    openList()
    type('이바다')
    const option = screen.getByRole('option')
    expect(option.textContent).toContain('이바다')
    expect(option.textContent).toContain('퇴원')
  })

  it('상태 라벨로도 검색된다', () => {
    render(<StudentCombobox students={STUDENTS} value="" onChange={() => {}} />)
    openList()
    type('신청취소')
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(1)
    expect(options[0].textContent).toContain('박구름')
  })

  it('재원 학생에는 상태 배지를 달지 않는다', () => {
    render(<StudentCombobox students={STUDENTS} value="" onChange={() => {}} />)
    openList()
    type('최바람') // status 누락 → 재원 취급
    expect(screen.getByRole('option').textContent).not.toContain('비활성')
  })

  it('퇴원 학생을 선택하면 id를 상위로 전달한다', () => {
    const onChange = vi.fn()
    render(<StudentCombobox students={STUDENTS} value="" onChange={onChange} />)
    openList()
    type('이바다')
    fireEvent.mouseDown(screen.getByRole('option'))
    expect(onChange).toHaveBeenCalledWith('s2')
  })

  it('선택된 퇴원 학생은 입력칸에 상태와 함께 표시된다', () => {
    render(<StudentCombobox students={STUDENTS} value="s2" onChange={() => {}} />)
    expect(screen.getByRole('combobox').value).toBe('이바다 (나매크고 고2) · 퇴원')
  })
})
