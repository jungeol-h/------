import { createContext, useContext, useState, useEffect } from 'react'
import * as mock from '../mocks/mockData.js'

const DataContext = createContext(null)

const STORAGE_KEY = 'platform_data'

function loadFromStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

const initialData = {
  students: mock.students,
  educators: mock.educators,
  assignments: mock.assignments,
  mindRecords: mock.mindRecords,
  diaryRecords: mock.diaryRecords,
  learningRecords: mock.learningRecords,
  attendanceRecords: mock.attendanceRecords,
  tasks: mock.tasks,
  counselingRecords: mock.counselingRecords,
  alerts: mock.alerts,
  monthlyStats: mock.monthlyStats,
  schoolStats: mock.schoolStats,
}

function getInitialData() {
  const loaded = loadFromStorage()
  // 구버전 캐시(emotion 기반 mindRecords) 감지 시 자동 초기화
  if (loaded?.mindRecords?.[0] && loaded.mindRecords[0].mood === undefined) {
    return initialData
  }
  // diaryRecords 없는 구버전 캐시 초기화
  if (loaded && !loaded.diaryRecords) {
    return initialData
  }
  return loaded || initialData
}

export function DataProvider({ children }) {
  const [data, setData] = useState(getInitialData)

  useEffect(() => {
    saveToStorage(data)
  }, [data])

  // 마인드 기록 추가 + 알림 자동 생성
  const addMindRecord = (studentId, { mood, motivation, confidence, memo }) => {
    const id = `m${Date.now()}`
    const newRecord = { id, studentId, date: new Date().toISOString().slice(0, 10), mood, motivation, confidence, memo }

    const total = mood + motivation + confidence
    const isCritical = total <= -6 || mood <= -4 || motivation <= -4 || confidence <= -4

    const newAlerts = []
    if (isCritical) {
      const isDanger = total <= -9 || mood <= -4 || motivation <= -4 || confidence <= -4
      const student = data.students.find(s => s.id === studentId)
      const managerId = data.assignments.find(a => a.studentId === studentId)?.educatorId || 'e2'
      newAlerts.push({
        id: `a${Date.now()}`,
        studentId,
        managerId,
        type: 'mind',
        severity: isDanger ? 'danger' : 'warning',
        message: `${student?.name || ''} 학생의 마인드 점수가 낮습니다`,
        detail: `기분 ${mood} / 동기 ${motivation} / 자신감 ${confidence} (합계 ${total}점)${memo ? ` — ${memo}` : ''}`,
        date: new Date().toISOString().slice(0, 10),
        resolved: false,
        coachingComment: '',
      })
    }

    setData(prev => ({
      ...prev,
      mindRecords: [...prev.mindRecords, newRecord],
      alerts: [...prev.alerts, ...newAlerts],
    }))
  }

  // 3줄 일기 추가 (오늘 날짜 이미 있으면 덮어쓰기)
  const addDiaryRecord = (studentId, { praise, reflection, resolution }) => {
    const today = new Date().toISOString().slice(0, 10)
    const existing = data.diaryRecords.find(d => d.studentId === studentId && d.date === today)
    const newRecord = {
      id: existing?.id || `d${Date.now()}`,
      studentId, date: today, praise, reflection, resolution,
    }
    setData(prev => ({
      ...prev,
      diaryRecords: existing
        ? prev.diaryRecords.map(d => d.id === existing.id ? newRecord : d)
        : [...prev.diaryRecords, newRecord],
    }))
  }

  // 알림 해제 + 코칭 코멘트 저장
  const resolveAlert = (alertId, coachingComment = '') => {
    setData(prev => ({
      ...prev,
      alerts: prev.alerts.map(a =>
        a.id === alertId ? { ...a, resolved: true, coachingComment } : a
      ),
    }))

    if (coachingComment) {
      const alert = data.alerts.find(a => a.id === alertId)
      if (alert) {
        const newRecord = {
          id: `c${Date.now()}`,
          studentId: alert.studentId,
          managerId: alert.managerId,
          date: new Date().toISOString().slice(0, 10),
          content: coachingComment,
          type: 'mind',
        }
        setData(prev => ({
          ...prev,
          counselingRecords: [...prev.counselingRecords, newRecord],
        }))
      }
    }
  }

  // 과제 완료 토글
  const toggleTask = (taskId) => {
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.map(t =>
        t.id === taskId ? { ...t, status: t.status === 'done' ? 'pending' : 'done' } : t
      ),
    }))
  }

  // 학습 기록 추가
  const addLearningRecord = (studentId, { subject, duration, focus }) => {
    const newRecord = {
      id: `l${Date.now()}`,
      studentId,
      date: new Date().toISOString().slice(0, 10),
      subject,
      duration,
      focus,
    }
    setData(prev => ({ ...prev, learningRecords: [...prev.learningRecords, newRecord] }))
  }

  // 데이터 초기화
  const resetData = () => {
    setData(initialData)
    saveToStorage(initialData)
  }

  return (
    <DataContext.Provider value={{ data, addMindRecord, addDiaryRecord, resolveAlert, toggleTask, addLearningRecord, resetData }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
