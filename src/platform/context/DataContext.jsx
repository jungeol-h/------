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
  learningRecords: mock.learningRecords,
  attendanceRecords: mock.attendanceRecords,
  tasks: mock.tasks,
  counselingRecords: mock.counselingRecords,
  alerts: mock.alerts,
  monthlyStats: mock.monthlyStats,
  schoolStats: mock.schoolStats,
}

export function DataProvider({ children }) {
  const [data, setData] = useState(() => loadFromStorage() || initialData)

  useEffect(() => {
    saveToStorage(data)
  }, [data])

  // 마인드 기록 추가 + 알림 자동 생성
  const addMindRecord = (studentId, { emotion, motivation, confidence, memo }) => {
    const id = `m${Date.now()}`
    const newRecord = { id, studentId, date: new Date().toISOString().slice(0, 10), emotion, motivation, confidence, memo }

    const newAlerts = []
    if (emotion === '힘듦' || motivation <= 2 || confidence <= 2) {
      const student = data.students.find(s => s.id === studentId)
      const managerId = data.assignments.find(a => a.studentId === studentId)?.educatorId || 'e2'
      newAlerts.push({
        id: `a${Date.now()}`,
        studentId,
        managerId,
        type: 'mind',
        severity: motivation <= 1 && confidence <= 1 ? 'danger' : 'warning',
        message: `${student?.name || ''} 학생이 "${emotion}"을 보고했습니다`,
        detail: `동기 ${motivation}점, 자신감 ${confidence}점${memo ? ` — ${memo}` : ''}`,
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

  // 알림 해제 + 코칭 코멘트 저장
  const resolveAlert = (alertId, coachingComment = '') => {
    setData(prev => ({
      ...prev,
      alerts: prev.alerts.map(a =>
        a.id === alertId ? { ...a, resolved: true, coachingComment } : a
      ),
    }))

    // 상담 기록에도 추가
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
    <DataContext.Provider value={{ data, addMindRecord, resolveAlert, toggleTask, addLearningRecord, resetData }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
