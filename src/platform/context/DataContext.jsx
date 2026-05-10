import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  toUser, toMindRecord, toDiaryRecord, toLearningRecord,
  toTask, toCounselingRecord, toAlert, toTodoItem,
  toCareerResult, toDiagnosisResult, toAssignment,
} from '../lib/supabaseHelpers'
import { useAuth } from './AuthContext'

const DataContext = createContext(null)

const EMPTY = {
  students: [],
  educators: [],
  assignments: [],
  mindRecords: [],
  diaryRecords: [],
  learningRecords: [],
  attendanceRecords: [],
  tasks: [],
  counselingRecords: [],
  alerts: [],
  monthlyStats: [],
  schoolStats: [],
  todoItems: [],
  careerResults: [],
  diagnosisResults: [],
}

// 역할별 초기 데이터 fetch
async function fetchForStudent(userId) {
  const [mindRes, learningRes, tasksRes, todoRes, diaryRes, careerRes, diagRes] = await Promise.all([
    supabase.from('mind_records').select('*').eq('student_id', userId).order('date', { ascending: false }).limit(50),
    supabase.from('learning_records').select('*').eq('student_id', userId).order('date', { ascending: false }).limit(100),
    supabase.from('tasks').select('*').eq('student_id', userId),
    supabase.from('todo_items').select('*').eq('student_id', userId).order('date', { ascending: false }).limit(30),
    supabase.from('diary_records').select('*').eq('student_id', userId).order('date', { ascending: false }).limit(10),
    supabase.from('career_results').select('*').eq('student_id', userId).order('created_at', { ascending: false }).limit(1),
    supabase.from('diagnosis_results').select('*').eq('student_id', userId).order('created_at', { ascending: false }).limit(1),
  ])
  return {
    ...EMPTY,
    mindRecords: (mindRes.data ?? []).map(toMindRecord),
    learningRecords: (learningRes.data ?? []).map(toLearningRecord),
    tasks: (tasksRes.data ?? []).map(toTask),
    todoItems: (todoRes.data ?? []).map(toTodoItem),
    diaryRecords: (diaryRes.data ?? []).map(toDiaryRecord),
    careerResults: (careerRes.data ?? []).map(toCareerResult),
    diagnosisResults: (diagRes.data ?? []).map(toDiagnosisResult),
  }
}

async function fetchForManager(userId) {
  const { data: assnData } = await supabase
    .from('assignments')
    .select('*')
    .eq('educator_id', userId)

  const studentIds = (assnData ?? []).map((a) => a.student_id)
  const assignments = (assnData ?? []).map(toAssignment)

  if (studentIds.length === 0) {
    return { ...EMPTY, assignments }
  }

  const [studentsRes, mindRes, alertsRes, counselingRes, tasksRes, learningRes] = await Promise.all([
    supabase.from('users').select('*').in('id', studentIds),
    supabase.from('mind_records').select('*').in('student_id', studentIds).order('date', { ascending: false }).limit(200),
    supabase.from('alerts').select('*').eq('manager_id', userId).order('created_at', { ascending: false }),
    supabase.from('counseling_records').select('*').eq('manager_id', userId).order('date', { ascending: false }),
    supabase.from('tasks').select('*').in('student_id', studentIds),
    supabase.from('learning_records').select('*').in('student_id', studentIds).order('date', { ascending: false }).limit(500),
  ])

  return {
    ...EMPTY,
    students: (studentsRes.data ?? []).map(toUser),
    assignments,
    mindRecords: (mindRes.data ?? []).map(toMindRecord),
    alerts: (alertsRes.data ?? []).map(toAlert),
    counselingRecords: (counselingRes.data ?? []).map(toCounselingRecord),
    tasks: (tasksRes.data ?? []).map(toTask),
    learningRecords: (learningRes.data ?? []).map(toLearningRecord),
  }
}

async function fetchForAdmin() {
  const [usersRes, assnRes, alertsRes, counselingRes, statsRes] = await Promise.all([
    supabase.from('users').select('*').order('grade').order('login_id'),
    supabase.from('assignments').select('*'),
    supabase.from('alerts').select('*').order('created_at', { ascending: false }),
    supabase.from('counseling_records').select('*').order('date', { ascending: false }),
    supabase.from('monthly_stats').select('*').order('id'),
  ])

  const allUsers = usersRes.data ?? []
  return {
    ...EMPTY,
    students: allUsers.filter((u) => u.role === 'student').map(toUser),
    educators: allUsers.filter((u) => u.role !== 'student').map(toUser),
    assignments: (assnRes.data ?? []).map(toAssignment),
    alerts: (alertsRes.data ?? []).map(toAlert),
    counselingRecords: (counselingRes.data ?? []).map(toCounselingRecord),
    monthlyStats: (statsRes.data ?? []).map((r) => ({
      month: r.month,
      selfIndex: r.self_index,
      taskRate: r.task_rate,
      mindTotal: r.mind_total,
      centerHours: r.center_hours,
    })),
  }
}

export function DataProvider({ children }) {
  const { currentUser } = useAuth()
  const [data, setData] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [dataReady, setDataReady] = useState(false)

  // currentUser 변경 시 역할별 fetch
  useEffect(() => {
    if (!currentUser) {
      setData(EMPTY)
      setDataReady(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setDataReady(false)

    const load = async () => {
      try {
        let fetched
        if (currentUser.role === 'student') {
          fetched = await fetchForStudent(currentUser.id)
        } else if (currentUser.role === 'manager') {
          fetched = await fetchForManager(currentUser.id)
        } else if (currentUser.role === 'admin') {
          fetched = await fetchForAdmin()
        } else {
          fetched = EMPTY
        }
        if (!cancelled) {
          setData(fetched)
          setDataReady(true)
        }
      } catch (err) {
        console.error('DataContext fetch error:', err)
        if (!cancelled) setDataReady(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [currentUser?.id, currentUser?.role])

  // 마인드 기록 추가 + 알림 자동 생성
  const addMindRecord = useCallback(async (studentId, { mood, motivation, confidence, memo }) => {
    const today = new Date().toISOString().slice(0, 10)
    const id = `m${Date.now()}`
    const newRecord = { id, student_id: studentId, date: today, mood, motivation, confidence, memo }

    await supabase.from('mind_records').insert(newRecord)

    const total = mood + motivation + confidence
    const isCritical = total <= -6 || mood <= -4 || motivation <= -4 || confidence <= -4

    let newAlertLocal = null
    if (isCritical) {
      const isDanger = total <= -9 || mood <= -4 || motivation <= -4 || confidence <= -4
      const student = data.students.find((s) => s.id === studentId) ?? { name: '' }
      const assignment = data.assignments.find((a) => a.studentId === studentId)
      const managerId = assignment?.educatorId ?? currentUser?.id

      if (managerId) {
        const alertId = `al${Date.now()}`
        const alertRow = {
          id: alertId,
          student_id: studentId,
          manager_id: managerId,
          type: 'mind',
          severity: isDanger ? 'danger' : 'warning',
          message: `${student.name} 학생의 마인드 점수가 낮습니다`,
          detail: `기분 ${mood} / 동기 ${motivation} / 자신감 ${confidence} (합계 ${total}점)${memo ? ` — ${memo}` : ''}`,
          date: today,
          resolved: false,
          coaching_comment: '',
        }
        await supabase.from('alerts').insert(alertRow)
        newAlertLocal = toAlert(alertRow)
      }
    }

    setData((prev) => ({
      ...prev,
      mindRecords: [toMindRecord(newRecord), ...prev.mindRecords],
      alerts: newAlertLocal ? [newAlertLocal, ...prev.alerts] : prev.alerts,
    }))
  }, [data.students, data.assignments, currentUser?.id])

  // 3줄 일기 추가 (오늘 날짜 있으면 덮어쓰기)
  const addDiaryRecord = useCallback(async (studentId, { praise, reflection, resolution }) => {
    const today = new Date().toISOString().slice(0, 10)
    const existing = data.diaryRecords.find((d) => d.studentId === studentId && d.date === today)
    const id = existing?.id ?? `d${Date.now()}`
    const row = { id, student_id: studentId, date: today, praise, reflection, resolution }

    await supabase.from('diary_records').upsert(row, { onConflict: 'student_id,date' })

    const local = toDiaryRecord(row)
    setData((prev) => ({
      ...prev,
      diaryRecords: existing
        ? prev.diaryRecords.map((d) => (d.id === existing.id ? local : d))
        : [local, ...prev.diaryRecords],
    }))
  }, [data.diaryRecords])

  // 알림 해제 + 코칭 코멘트 → 상담 기록 생성
  const resolveAlert = useCallback(async (alertId, coachingComment = '') => {
    await supabase
      .from('alerts')
      .update({ resolved: true, coaching_comment: coachingComment })
      .eq('id', alertId)

    let newCounselingLocal = null
    if (coachingComment) {
      const alert = data.alerts.find((a) => a.id === alertId)
      if (alert) {
        const today = new Date().toISOString().slice(0, 10)
        const counselRow = {
          id: `c${Date.now()}`,
          student_id: alert.studentId,
          manager_id: alert.managerId,
          date: today,
          content: coachingComment,
          type: 'mind',
        }
        await supabase.from('counseling_records').insert(counselRow)
        newCounselingLocal = toCounselingRecord(counselRow)
      }
    }

    setData((prev) => ({
      ...prev,
      alerts: prev.alerts.map((a) =>
        a.id === alertId ? { ...a, resolved: true, coachingComment } : a
      ),
      counselingRecords: newCounselingLocal
        ? [newCounselingLocal, ...prev.counselingRecords]
        : prev.counselingRecords,
    }))
  }, [data.alerts])

  // 과제 완료 토글
  const toggleTask = useCallback(async (taskId) => {
    const task = data.tasks.find((t) => t.id === taskId)
    if (!task) return
    const newStatus = task.status === 'done' ? 'pending' : 'done'
    await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)
    setData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
    }))
  }, [data.tasks])

  // 학습 기록 추가
  const addLearningRecord = useCallback(async (studentId, { subject, duration, focus }) => {
    const row = {
      id: `l${Date.now()}`,
      student_id: studentId,
      date: new Date().toISOString().slice(0, 10),
      subject,
      duration,
      focus,
    }
    await supabase.from('learning_records').insert(row)
    setData((prev) => ({
      ...prev,
      learningRecords: [toLearningRecord(row), ...prev.learningRecords],
    }))
  }, [])

  // TODO 아이템 추가
  const addTodoItem = useCallback(async (studentId, { subject, plannedMin }) => {
    const row = {
      id: `td${Date.now()}`,
      student_id: studentId,
      date: new Date().toISOString().slice(0, 10),
      subject,
      planned_min: plannedMin,
      done: false,
    }
    await supabase.from('todo_items').insert(row)
    setData((prev) => ({
      ...prev,
      todoItems: [toTodoItem(row), ...prev.todoItems],
    }))
  }, [])

  // TODO 완료 토글
  const toggleTodo = useCallback(async (itemId) => {
    const item = data.todoItems.find((t) => t.id === itemId)
    if (!item) return
    const newDone = !item.done
    await supabase.from('todo_items').update({ done: newDone }).eq('id', itemId)
    setData((prev) => ({
      ...prev,
      todoItems: prev.todoItems.map((t) => (t.id === itemId ? { ...t, done: newDone } : t)),
    }))
  }, [data.todoItems])

  // 진로 검사 결과 저장 (학생당 1개)
  const saveCareerResult = useCallback(async (studentId, { selectedVerbs, selectedActivities, selectedCategories, primaryCat, typeName, finalScores, fields }) => {
    const row = {
      id: `cr${Date.now()}`,
      student_id: studentId,
      date: new Date().toISOString().slice(0, 10),
      selected_verbs: selectedVerbs,
      selected_activities: selectedActivities,
      selected_categories: selectedCategories,
      primary_cat: primaryCat,
      type_name: typeName,
      final_scores: finalScores,
      fields,
    }
    // 기존 레코드 삭제 후 삽입 (학생당 1개 유지)
    await supabase.from('career_results').delete().eq('student_id', studentId)
    await supabase.from('career_results').insert(row)
    setData((prev) => ({
      ...prev,
      careerResults: [
        ...prev.careerResults.filter((r) => r.studentId !== studentId),
        toCareerResult(row),
      ],
    }))
  }, [])

  // 학습 진단 결과 저장 (학생당 1개)
  const saveDiagnosisResult = useCallback(async (studentId, resultData) => {
    const row = {
      id: `dr${Date.now()}`,
      student_id: studentId,
      date: new Date().toISOString().slice(0, 10),
      answers: resultData.answers ?? [],
      domain_scores: resultData.domainScores ?? {},
      stage_scores: resultData.stageScores ?? {},
      stage_grades: resultData.stageGrades ?? {},
      state_types: resultData.stateTypes ?? {},
      type_name: resultData.typeName ?? '',
    }
    await supabase.from('diagnosis_results').delete().eq('student_id', studentId)
    await supabase.from('diagnosis_results').insert(row)
    setData((prev) => ({
      ...prev,
      diagnosisResults: [
        ...prev.diagnosisResults.filter((r) => r.studentId !== studentId),
        toDiagnosisResult(row),
      ],
    }))
  }, [])

  // 최근 7일 학습시간 집계 (StudentListTab 주간 차트용)
  const getWeeklyLearning = useCallback((studentId) => {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      days.push(d.toISOString().slice(0, 10))
    }
    return days.map((date) => {
      const total = data.learningRecords
        .filter((r) => r.studentId === studentId && r.date === date)
        .reduce((sum, r) => sum + (r.duration ?? 0), 0)
      return { day: date.slice(5), minutes: total }
    })
  }, [data.learningRecords])

  // 데이터 초기화 (로그아웃 시 자동 호출 필요 없음 — currentUser 변경으로 자동 처리)
  const resetData = useCallback(() => {
    setData(EMPTY)
  }, [])

  return (
    <DataContext.Provider value={{
      data,
      loading,
      dataReady,
      addMindRecord,
      addDiaryRecord,
      resolveAlert,
      toggleTask,
      addLearningRecord,
      addTodoItem,
      toggleTodo,
      saveCareerResult,
      saveDiagnosisResult,
      getWeeklyLearning,
      resetData,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
