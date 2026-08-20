// 출결 화면 렌더 스모크 — AttendanceTab(알림/오늘 현황) · KioskPage(입력→조회→등원)
// 등·하원 시간표 편집기는 제거됨 — 시간표는 센터 이용시간 저장 시
// center_save_hours RPC가 자동 파생한다 (편집 UI 단일화, 2026-07-18).
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AttendanceTab from './AttendanceTab.jsx'
import KioskPage from './KioskPage.jsx'

const updateAttendance = vi.fn()
const createManualAttendance = vi.fn()
const resolveAttendanceNotification = vi.fn()
const resolveAllAttendanceNotifications = vi.fn()
const ingestAttendanceNotification = vi.fn()
const kioskFindStudents = vi.fn()
const kioskCheckIn = vi.fn()
const kioskCheckOut = vi.fn()
const kioskFindStaff = vi.fn()
const kioskStaffCheckIn = vi.fn()
const kioskStaffCheckOut = vi.fn()

// 오늘 날짜 기준 데이터 — 셀렉터가 로컬 날짜를 쓰므로 UTC(toISOString)가 아닌 로컬로 생성
const now = new Date()
const todayStr = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, '0'),
  String(now.getDate()).padStart(2, '0'),
].join('-')
const todayDow = now.getDay()

const data = {
  students: [
    { id: 's1', name: '김등원', grade: '중1' },
    { id: 's2', name: '박미등원', grade: '중2' },
  ],
  assignments: [
    { educatorId: 'm01', studentId: 's1' },
    { educatorId: 'm01', studentId: 's2' },
  ],
  attendanceRecords: [
    {
      id: 'at1', studentId: 's1', date: todayStr, status: 'late',
      checkInAt: `${todayStr}T06:10:00Z`, checkOutAt: null,
      checkoutStatus: null, note: '', source: 'kiosk',
    },
  ],
  attendanceSchedules: [
    { id: 'sch1', studentId: 's1', dayOfWeek: todayDow, arrivalTime: '09:00', departureTime: '19:00' },
    { id: 'sch2', studentId: 's2', dayOfWeek: todayDow, arrivalTime: '00:01', departureTime: '19:00' },
  ],
  attendanceNotifications: [
    {
      id: 'an1', studentId: 's2', date: todayStr, type: 'no_show',
      message: '박미등원 학생 미등원 — 긴급 확인이 필요합니다.',
      resolved: false, createdAt: `${todayStr}T06:11:00Z`,
    },
  ],
}

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ currentUser: { id: 'm01', name: '김학습', role: 'manager' } }),
}))

vi.mock('../../context/DataContext.jsx', () => ({
  useData: () => ({
    data,
    updateAttendance,
    createManualAttendance,
    resolveAttendanceNotification,
    resolveAllAttendanceNotifications,
    ingestAttendanceNotification,
    kioskFindStudents,
    kioskCheckIn,
    kioskCheckOut,
    kioskFindStaff,
    kioskStaffCheckIn,
    kioskStaffCheckOut,
  }),
}))

// Realtime 구독은 스모크 범위 밖 — no-op 채널로 대체
vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    channel: () => ({ on: function () { return this }, subscribe: () => ({}) }),
    removeChannel: vi.fn(),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  kioskFindStaff.mockResolvedValue([])
})

describe('AttendanceTab', () => {
  const renderTab = () => render(<MemoryRouter><AttendanceTab /></MemoryRouter>)

  it('긴급 알림·오늘 현황판(지각/미등원)을 렌더한다', () => {
    renderTab()
    expect(screen.getByText('긴급 확인 필요')).toBeTruthy()
    expect(screen.getByText('박미등원 학생 미등원 — 긴급 확인이 필요합니다.')).toBeTruthy()
    expect(screen.getByText('지각')).toBeTruthy()
    expect(screen.getByText('김등원')).toBeTruthy()
    expect(screen.getByText('미등원')).toBeTruthy()
  })

  // 확인 클릭 → 사유 입력 모달 (2026-08 클라이언트: 확인 시 출결 기록으로 연결)
  it('알림 확인 버튼이 사유 입력 모달을 연다 — 기록 없으면 수동 결석 생성 후 확인 처리', async () => {
    createManualAttendance.mockResolvedValue()
    resolveAttendanceNotification.mockResolvedValue()
    renderTab()
    fireEvent.click(screen.getByText('확인'))
    // s2는 기록이 없어 신규 생성 모드
    expect(screen.getByText(`박미등원 출결 확인 (${todayStr})`)).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText(/사유 메모/), { target: { value: '병결 확인' } })
    fireEvent.click(screen.getByText('저장'))
    await waitFor(() => {
      expect(createManualAttendance).toHaveBeenCalledWith('s2', todayStr, { status: 'absent', note: '병결 확인' })
      expect(resolveAttendanceNotification).toHaveBeenCalledWith('an1')
    })
  })

  it("'기록 없이 확인만'은 기록 생성 없이 알림만 확인 처리한다", async () => {
    resolveAttendanceNotification.mockResolvedValue()
    renderTab()
    fireEvent.click(screen.getByText('확인'))
    fireEvent.click(screen.getByText('기록 없이 확인만'))
    await waitFor(() => {
      expect(resolveAttendanceNotification).toHaveBeenCalledWith('an1')
    })
    expect(createManualAttendance).not.toHaveBeenCalled()
  })

  it('전체 확인 버튼이 미해결 알림 id 전부로 일괄 확인을 호출한다', () => {
    resolveAllAttendanceNotifications.mockResolvedValue()
    renderTab()
    fireEvent.click(screen.getByText('전체 확인 (1건)'))
    expect(resolveAllAttendanceNotifications).toHaveBeenCalledWith(['an1'])
  })

  it('◀로 지난 날짜를 조회하고 오늘 버튼으로 복귀한다', () => {
    renderTab()
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    const yLabel = `${yesterday.getMonth() + 1}월 ${yesterday.getDate()}일`
    const tLabel = `${now.getMonth() + 1}월 ${now.getDate()}일`

    fireEvent.click(screen.getByLabelText('이전 날짜'))
    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain(yLabel)
    expect(screen.getByText(/지난 날짜 조회/)).toBeTruthy()

    fireEvent.click(screen.getByText('오늘'))
    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain(tLabel)
  })
})

describe('KioskPage', () => {
  const renderKiosk = () => render(<MemoryRouter><KioskPage /></MemoryRouter>)

  it('4자리 입력 시 조회하고, 학생 카드에서 등원 처리까지 이어진다', async () => {
    kioskFindStudents.mockResolvedValue([
      { id: 's1', name: '김등원', grade: '중1', className: '', checkedIn: false, checkedOut: false },
    ])
    kioskCheckIn.mockResolvedValue({ result: 'late', corrected: false, noSchedule: false })
    renderKiosk()

    fireEvent.click(screen.getByText('6'))
    fireEvent.click(screen.getByText('9'))
    fireEvent.click(screen.getByText('2'))
    fireEvent.click(screen.getByText('0'))
    await waitFor(() => expect(kioskFindStudents).toHaveBeenCalledWith('6920'))

    expect(await screen.findByText('김등원')).toBeTruthy()
    fireEvent.click(screen.getByText('등원'))
    await waitFor(() => expect(kioskCheckIn).toHaveBeenCalledWith('s1'))
    expect(await screen.findByText('김등원님 등원 완료 · 지각')).toBeTruthy()
  })

  it('일치 학생이 없으면 안내 후 초기화 경로를 보여준다', async () => {
    kioskFindStudents.mockResolvedValue([])
    renderKiosk()
    fireEvent.click(screen.getByText('1'))
    fireEvent.click(screen.getByText('2'))
    fireEvent.click(screen.getByText('3'))
    fireEvent.click(screen.getByText('4'))
    expect(
      await screen.findByText('해당 번호의 학생이 없어요. 다시 확인해 주세요.')
    ).toBeTruthy()
  })

  it('등원 완료 학생은 등원 버튼이 비활성, 하원 버튼이 활성이다', async () => {
    kioskFindStudents.mockResolvedValue([
      { id: 's1', name: '김등원', grade: '중1', className: '', checkedIn: true, checkedOut: false },
    ])
    kioskCheckOut.mockResolvedValue({ result: 'early_leave' })
    renderKiosk()
    fireEvent.click(screen.getByText('6'))
    fireEvent.click(screen.getByText('9'))
    fireEvent.click(screen.getByText('2'))
    fireEvent.click(screen.getByText('0'))

    const checkInBtn = (await screen.findByText('등원')).closest('button')
    const checkOutBtn = screen.getByText('하원').closest('button')
    expect(checkInBtn.disabled).toBe(true)
    expect(checkOutBtn.disabled).toBe(false)

    fireEvent.click(checkOutBtn)
    await waitFor(() => expect(kioskCheckOut).toHaveBeenCalledWith('s1'))
    expect(await screen.findByText('김등원님 하원 완료 · 조퇴 처리')).toBeTruthy()
  })
})
