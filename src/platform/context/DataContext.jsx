import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  toUser, toMindRecord, toDiaryRecord, toLearningRecord,
  toTask, toCounselingRecord, toAlert, toTodoItem,
  toCareerDesignResult, toLearningDiagnosisResult, toAssignment,
  toQuizSet, toQuizQuestion, toQuizAttempt,
} from '../lib/supabaseHelpers'
import { gradeAttempt } from '../utils/quizGrading'
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
  careerDesignResults: [],
  learningDiagnosisResults: [],
  quizSets: [],
  quizQuestions: [],
  quizAttempts: [],
}

// 역할별 초기 데이터 fetch
async function fetchForStudent(userId) {
  const [userRes, assnRes, mindRes, learningRes, tasksRes, todoRes, diaryRes, careerRes, diagRes, attemptsRes] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).limit(1),
    supabase.from('assignments').select('*').eq('student_id', userId),
    supabase.from('mind_records').select('*').eq('student_id', userId).order('date', { ascending: false }).limit(50),
    supabase.from('learning_records').select('*').eq('student_id', userId).order('date', { ascending: false }).limit(100),
    supabase.from('tasks').select('*').eq('student_id', userId),
    supabase.from('todo_items').select('*').eq('student_id', userId).order('date', { ascending: false }).limit(30),
    supabase.from('diary_records').select('*').eq('student_id', userId).order('date', { ascending: false }).limit(10),
    supabase.from('career_results').select('*').eq('student_id', userId).order('created_at', { ascending: false }).limit(1),
    supabase.from('diagnosis_results').select('*').eq('student_id', userId).order('created_at', { ascending: false }).limit(1),
    supabase.from('quiz_attempts').select('*').eq('student_id', userId),
  ])

  const me = (userRes.data ?? [])[0]
  const myGrade = me?.grade ?? ''
  // 학생 본인 학년의 회차만 노출
  const setsRes = myGrade
    ? await supabase.from('quiz_sets').select('*').eq('grade', myGrade).eq('is_published', true).order('round')
    : { data: [] }
  const setIds = (setsRes.data ?? []).map((s) => s.id)
  const questionsRes = setIds.length > 0
    ? await supabase.from('quiz_questions').select('*').in('quiz_set_id', setIds).order('order_no')
    : { data: [] }

  return {
    ...EMPTY,
    students: (userRes.data ?? []).map(toUser),
    assignments: (assnRes.data ?? []).map(toAssignment),
    mindRecords: (mindRes.data ?? []).map(toMindRecord),
    learningRecords: (learningRes.data ?? []).map(toLearningRecord),
    tasks: (tasksRes.data ?? []).map(toTask),
    todoItems: (todoRes.data ?? []).map(toTodoItem),
    diaryRecords: (diaryRes.data ?? []).map(toDiaryRecord),
    careerDesignResults: (careerRes.data ?? []).map(toCareerDesignResult),
    learningDiagnosisResults: (diagRes.data ?? []).map(toLearningDiagnosisResult),
    quizSets: (setsRes.data ?? []).map(toQuizSet),
    quizQuestions: (questionsRes.data ?? []).map(toQuizQuestion),
    quizAttempts: (attemptsRes.data ?? []).map(toQuizAttempt),
  }
}

async function fetchForManager(userId) {
  const { data: assnData } = await supabase
    .from('assignments')
    .select('*')
    .eq('educator_id', userId)

  const allStudentIds = (assnData ?? []).map((a) => a.student_id)

  if (allStudentIds.length === 0) {
    return { ...EMPTY, assignments: [] }
  }

  // 비활성 학생은 매니저 화면 전체에서 제외
  const { data: activeStudents } = await supabase
    .from('users')
    .select('*')
    .in('id', allStudentIds)
    .eq('status', 'active')

  const studentIds = (activeStudents ?? []).map((u) => u.id)
  const activeIdSet = new Set(studentIds)
  const assignments = (assnData ?? [])
    .filter((a) => activeIdSet.has(a.student_id))
    .map(toAssignment)

  if (studentIds.length === 0) {
    return { ...EMPTY, assignments }
  }

  const [mindRes, alertsRes, counselingRes, tasksRes, learningRes, diaryRes, careerRes, diagRes, attemptsRes, setsRes] = await Promise.all([
    supabase.from('mind_records').select('*').in('student_id', studentIds).order('date', { ascending: false }).limit(200),
    supabase.from('alerts').select('*').eq('manager_id', userId).order('created_at', { ascending: false }),
    supabase.from('counseling_records').select('*').eq('manager_id', userId).order('date', { ascending: false }),
    supabase.from('tasks').select('*').in('student_id', studentIds),
    supabase.from('learning_records').select('*').in('student_id', studentIds).order('date', { ascending: false }).limit(500),
    supabase.from('diary_records').select('*').in('student_id', studentIds).order('date', { ascending: false }).limit(200),
    supabase.from('career_results').select('*').in('student_id', studentIds),
    supabase.from('diagnosis_results').select('*').in('student_id', studentIds),
    supabase.from('quiz_attempts').select('*').in('student_id', studentIds).order('submitted_at', { ascending: false }),
    supabase.from('quiz_sets').select('*').order('grade').order('round'),
  ])
  const setIds = (setsRes.data ?? []).map((s) => s.id)
  const questionsRes = setIds.length > 0
    ? await supabase.from('quiz_questions').select('*').in('quiz_set_id', setIds).order('order_no')
    : { data: [] }

  return {
    ...EMPTY,
    students: (activeStudents ?? []).map(toUser),
    assignments,
    mindRecords: (mindRes.data ?? []).map(toMindRecord),
    alerts: (alertsRes.data ?? []).map(toAlert),
    counselingRecords: (counselingRes.data ?? []).map(toCounselingRecord),
    tasks: (tasksRes.data ?? []).map(toTask),
    learningRecords: (learningRes.data ?? []).map(toLearningRecord),
    diaryRecords: (diaryRes.data ?? []).map(toDiaryRecord),
    careerDesignResults: (careerRes.data ?? []).map(toCareerDesignResult),
    learningDiagnosisResults: (diagRes.data ?? []).map(toLearningDiagnosisResult),
    quizSets: (setsRes.data ?? []).map(toQuizSet),
    quizQuestions: (questionsRes.data ?? []).map(toQuizQuestion),
    quizAttempts: (attemptsRes.data ?? []).map(toQuizAttempt),
  }
}

async function fetchForAdmin() {
  const [usersRes, assnRes, alertsRes, counselingRes, statsRes, setsRes] = await Promise.all([
    supabase.from('users').select('*').order('grade').order('login_id'),
    supabase.from('assignments').select('*'),
    supabase.from('alerts').select('*').order('created_at', { ascending: false }),
    supabase.from('counseling_records').select('*').order('date', { ascending: false }),
    supabase.from('monthly_stats').select('*').order('id'),
    supabase.from('quiz_sets').select('*').order('grade').order('round'),
  ])

  const allUsers = usersRes.data ?? []
  // 사용자 관리 탭은 비활성 학생도 보여줘야 하므로 students 자체는 전체 유지
  // 활동 데이터(마인드/학습/통계 등) fetch는 active 학생만 대상으로 — 비활성은 통계에 미반영
  const studentIds = allUsers
    .filter((u) => u.role === 'student' && (u.status ?? 'active') === 'active')
    .map((u) => u.id)
  const setIds = (setsRes.data ?? []).map((s) => s.id)

  // 매니저 화면과 동일하게 학생 활동 데이터도 fetch
  const [mindRes, learningRes, tasksRes, diaryRes, careerRes, diagRes, attemptsRes] = studentIds.length > 0
    ? await Promise.all([
        supabase.from('mind_records').select('*').in('student_id', studentIds).order('date', { ascending: false }).limit(500),
        supabase.from('learning_records').select('*').in('student_id', studentIds).order('date', { ascending: false }).limit(1000),
        supabase.from('tasks').select('*').in('student_id', studentIds),
        supabase.from('diary_records').select('*').in('student_id', studentIds).order('date', { ascending: false }).limit(500),
        supabase.from('career_results').select('*').in('student_id', studentIds),
        supabase.from('diagnosis_results').select('*').in('student_id', studentIds),
        supabase.from('quiz_attempts').select('*').in('student_id', studentIds).order('submitted_at', { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }]

  const questionsRes = setIds.length > 0
    ? await supabase.from('quiz_questions').select('*').in('quiz_set_id', setIds).order('order_no')
    : { data: [] }

  return {
    ...EMPTY,
    students: allUsers.filter((u) => u.role === 'student').map(toUser),
    educators: allUsers.filter((u) => u.role !== 'student').map(toUser),
    assignments: (assnRes.data ?? []).map(toAssignment),
    alerts: (alertsRes.data ?? []).map(toAlert),
    counselingRecords: (counselingRes.data ?? []).map(toCounselingRecord),
    mindRecords: (mindRes.data ?? []).map(toMindRecord),
    learningRecords: (learningRes.data ?? []).map(toLearningRecord),
    tasks: (tasksRes.data ?? []).map(toTask),
    diaryRecords: (diaryRes.data ?? []).map(toDiaryRecord),
    careerDesignResults: (careerRes.data ?? []).map(toCareerDesignResult),
    learningDiagnosisResults: (diagRes.data ?? []).map(toLearningDiagnosisResult),
    monthlyStats: (statsRes.data ?? []).map((r) => ({
      month: r.month,
      selfIndex: r.self_index,
      taskRate: r.task_rate,
      mindTotal: r.mind_total,
      centerHours: r.center_hours,
    })),
    quizSets: (setsRes.data ?? []).map(toQuizSet),
    quizQuestions: (questionsRes.data ?? []).map(toQuizQuestion),
    quizAttempts: (attemptsRes.data ?? []).map(toQuizAttempt),
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

    const { error: mindError } = await supabase.from('mind_records').insert(newRecord)
    if (mindError) {
      console.error('addMindRecord insert error:', mindError)
      throw mindError
    }

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
        const { error: alertError } = await supabase.from('alerts').insert(alertRow)
        if (alertError) console.error('addMindRecord alert insert error:', alertError)
        else newAlertLocal = toAlert(alertRow)
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

    const { error: upsertError } = await supabase.from('diary_records').upsert(row, { onConflict: 'student_id,date' })
    if (upsertError) {
      console.error('addDiaryRecord upsert error:', upsertError)
      throw upsertError
    }

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
    const { error: updateError } = await supabase
      .from('alerts')
      .update({ resolved: true, coaching_comment: coachingComment })
      .eq('id', alertId)
    if (updateError) {
      console.error('resolveAlert update error:', updateError)
      throw updateError
    }

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
        const { error: counselError } = await supabase.from('counseling_records').insert(counselRow)
        if (counselError) console.error('resolveAlert counseling insert error:', counselError)
        else newCounselingLocal = toCounselingRecord(counselRow)
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
    const { error: taskError } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)
    if (taskError) {
      console.error('toggleTask update error:', taskError)
      throw taskError
    }
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
    const { error: learnError } = await supabase.from('learning_records').insert(row)
    if (learnError) {
      console.error('addLearningRecord insert error:', learnError)
      throw learnError
    }
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
    const { error: todoError } = await supabase.from('todo_items').insert(row)
    if (todoError) {
      console.error('addTodoItem insert error:', todoError)
      throw todoError
    }
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
    const { error: toggleError } = await supabase.from('todo_items').update({ done: newDone }).eq('id', itemId)
    if (toggleError) {
      console.error('toggleTodo update error:', toggleError)
      throw toggleError
    }
    setData((prev) => ({
      ...prev,
      todoItems: prev.todoItems.map((t) => (t.id === itemId ? { ...t, done: newDone } : t)),
    }))
  }, [data.todoItems])

  // 진로설계 결과 저장 (학생당 1개)
  const saveCareerDesignResult = useCallback(async (studentId, { selectedVerbs, selectedActivities, selectedCategories, primaryCat, typeName, finalScores, fields }) => {
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
    const { error: insertError } = await supabase.from('career_results').insert(row)
    if (insertError) {
      console.error('saveCareerDesignResult insert error:', insertError)
      throw insertError
    }
    setData((prev) => ({
      ...prev,
      careerDesignResults: [
        ...prev.careerDesignResults.filter((r) => r.studentId !== studentId),
        toCareerDesignResult(row),
      ],
    }))
  }, [])

  // 학습진단 결과 저장 (학생당 1개)
  const saveLearningDiagnosisResult = useCallback(async (studentId, resultData) => {
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
    const { error: insertError } = await supabase.from('diagnosis_results').insert(row)
    if (insertError) {
      console.error('saveLearningDiagnosisResult insert error:', insertError)
      throw insertError
    }
    setData((prev) => ({
      ...prev,
      learningDiagnosisResults: [
        ...prev.learningDiagnosisResults.filter((r) => r.studentId !== studentId),
        toLearningDiagnosisResult(row),
      ],
    }))
  }, [])

  // 확인평가 제출 — 채점 + insert + local state 반영
  const submitQuizAttempt = useCallback(async (studentId, quizSetId, rawByQid) => {
    const questions = data.quizQuestions
      .filter((q) => q.quizSetId === quizSetId)
      .sort((a, b) => a.orderNo - b.orderNo)
    if (questions.length === 0) {
      throw new Error('해당 회차의 문제를 불러오지 못했습니다.')
    }
    const { answers, score, total } = gradeAttempt(questions, rawByQid)
    const row = {
      id: `qa-${Date.now()}`,
      student_id: studentId,
      quiz_set_id: quizSetId,
      answers,
      score,
      total,
      submitted_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('quiz_attempts').insert(row)
    if (error) {
      console.error('submitQuizAttempt insert error:', error)
      if (error.code === '23505') {
        throw new Error('이미 응시한 회차입니다. 결과 화면에서 확인하세요.')
      }
      throw error
    }
    const local = toQuizAttempt(row)
    setData((prev) => ({
      ...prev,
      quizAttempts: [local, ...prev.quizAttempts.filter((a) => !(a.studentId === studentId && a.quizSetId === quizSetId))],
    }))
    return local
  }, [data.quizQuestions])

  // 회차 신규 생성
  const createQuizSet = useCallback(async ({ title, grade, round, source = '', description = '', isPublished = true }) => {
    const row = {
      id: `qs-${Date.now()}`,
      title,
      grade,
      round,
      source,
      description,
      is_published: isPublished,
      created_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('quiz_sets').insert(row)
    if (error) {
      console.error('createQuizSet insert error:', error)
      throw error
    }
    const local = toQuizSet(row)
    setData((prev) => ({
      ...prev,
      quizSets: [...prev.quizSets, local].sort((a, b) =>
        (a.grade ?? '').localeCompare(b.grade ?? '') || (a.round ?? 0) - (b.round ?? 0)
      ),
    }))
    return local
  }, [])

  // 회차 정보 수정 (배포 토글 포함)
  const updateQuizSet = useCallback(async (setId, patch) => {
    const snake = {}
    if (patch.title !== undefined) snake.title = patch.title
    if (patch.grade !== undefined) snake.grade = patch.grade
    if (patch.round !== undefined) snake.round = patch.round
    if (patch.source !== undefined) snake.source = patch.source
    if (patch.description !== undefined) snake.description = patch.description
    if (patch.isPublished !== undefined) snake.is_published = patch.isPublished

    const { error } = await supabase.from('quiz_sets').update(snake).eq('id', setId)
    if (error) {
      console.error('updateQuizSet update error:', error)
      throw error
    }
    setData((prev) => ({
      ...prev,
      quizSets: prev.quizSets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
    }))
  }, [])

  // 회차 삭제 (CASCADE로 문제/응시 함께 정리)
  const deleteQuizSet = useCallback(async (setId) => {
    const { error } = await supabase.from('quiz_sets').delete().eq('id', setId)
    if (error) {
      console.error('deleteQuizSet delete error:', error)
      throw error
    }
    setData((prev) => ({
      ...prev,
      quizSets: prev.quizSets.filter((s) => s.id !== setId),
      quizQuestions: prev.quizQuestions.filter((q) => q.quizSetId !== setId),
      quizAttempts: prev.quizAttempts.filter((a) => a.quizSetId !== setId),
    }))
  }, [])

  // 문제 신규 생성
  const createQuizQuestion = useCallback(async ({ quizSetId, orderNo, question, acceptedAnswers, explanation = '', hint = '' }) => {
    const row = {
      id: `qq-${Date.now()}`,
      quiz_set_id: quizSetId,
      order_no: orderNo,
      question,
      accepted_answers: acceptedAnswers,
      explanation,
      hint,
    }
    const { error } = await supabase.from('quiz_questions').insert(row)
    if (error) {
      console.error('createQuizQuestion insert error:', error)
      throw error
    }
    const local = toQuizQuestion(row)
    setData((prev) => ({
      ...prev,
      quizQuestions: [...prev.quizQuestions, local].sort((a, b) => {
        if (a.quizSetId !== b.quizSetId) return (a.quizSetId ?? '').localeCompare(b.quizSetId ?? '')
        return (a.orderNo ?? 0) - (b.orderNo ?? 0)
      }),
    }))
    return local
  }, [])

  // 문제 수정
  const updateQuizQuestion = useCallback(async (questionId, patch) => {
    const snake = {}
    if (patch.orderNo !== undefined) snake.order_no = patch.orderNo
    if (patch.question !== undefined) snake.question = patch.question
    if (patch.acceptedAnswers !== undefined) snake.accepted_answers = patch.acceptedAnswers
    if (patch.explanation !== undefined) snake.explanation = patch.explanation
    if (patch.hint !== undefined) snake.hint = patch.hint

    const { error } = await supabase.from('quiz_questions').update(snake).eq('id', questionId)
    if (error) {
      console.error('updateQuizQuestion update error:', error)
      throw error
    }
    setData((prev) => ({
      ...prev,
      quizQuestions: prev.quizQuestions.map((q) => (q.id === questionId ? { ...q, ...patch } : q)),
    }))
  }, [])

  // 문제 삭제 (응시 기록의 answers는 그대로 유지 — 재채점 안 함)
  const deleteQuizQuestion = useCallback(async (questionId) => {
    const { error } = await supabase.from('quiz_questions').delete().eq('id', questionId)
    if (error) {
      console.error('deleteQuizQuestion delete error:', error)
      throw error
    }
    setData((prev) => ({
      ...prev,
      quizQuestions: prev.quizQuestions.filter((q) => q.id !== questionId),
    }))
  }, [])

  // 학생 신규 추가 (관리자 사용자 관리 탭)
  const createStudent = useCallback(async ({
    name, gender, grade, className, school,
    loginId, password, parentPassword, managerId,
  }) => {
    const id = `s${Date.now()}`
    const row = {
      id,
      login_id: loginId,
      password,
      name,
      role: 'student',
      school: school ?? '',
      grade: grade ?? '',
      class_name: className ?? '',
      parent_password: parentPassword ?? '',
      gender: gender ?? null,
      self_index: 70,
      risk_level: 'normal',
      status: 'active',
    }
    const { error } = await supabase.from('users').insert(row)
    if (error) {
      console.error('createStudent insert error:', error)
      if (error.code === '23505') {
        throw new Error('이미 사용 중인 login_id입니다.')
      }
      throw error
    }

    let newAssignment = null
    if (managerId) {
      const assn = { student_id: id, educator_id: managerId }
      const { error: aErr } = await supabase.from('assignments').insert(assn)
      if (aErr) console.error('createStudent assignment insert error:', aErr)
      else newAssignment = toAssignment(assn)
    }

    const local = toUser(row)
    setData((prev) => ({
      ...prev,
      students: [...prev.students, local],
      assignments: newAssignment ? [...prev.assignments, newAssignment] : prev.assignments,
    }))
    return local
  }, [])

  // 학생 정보 수정. patch에 managerId 키가 있으면 assignments 갈아치움.
  const updateStudent = useCallback(async (studentId, patch) => {
    const snake = {}
    if (patch.name !== undefined) snake.name = patch.name
    if (patch.loginId !== undefined) snake.login_id = patch.loginId
    if (patch.password !== undefined) snake.password = patch.password
    if (patch.gender !== undefined) snake.gender = patch.gender
    if (patch.grade !== undefined) snake.grade = patch.grade
    if (patch.className !== undefined) snake.class_name = patch.className
    if (patch.school !== undefined) snake.school = patch.school
    if (patch.parentPassword !== undefined) snake.parent_password = patch.parentPassword

    if (Object.keys(snake).length > 0) {
      const { error } = await supabase.from('users').update(snake).eq('id', studentId)
      if (error) {
        console.error('updateStudent update error:', error)
        if (error.code === '23505') {
          throw new Error('이미 사용 중인 login_id입니다.')
        }
        throw error
      }
    }

    // managerId 변경 처리: 기존 assignments 모두 삭제 후 신규 1개 insert
    let assignmentsPatch = null
    if (patch.managerId !== undefined) {
      const { error: delErr } = await supabase
        .from('assignments')
        .delete()
        .eq('student_id', studentId)
      if (delErr) console.error('updateStudent assignment delete error:', delErr)

      if (patch.managerId) {
        const assn = { student_id: studentId, educator_id: patch.managerId }
        const { error: insErr } = await supabase.from('assignments').insert(assn)
        if (insErr) console.error('updateStudent assignment insert error:', insErr)
        else assignmentsPatch = toAssignment(assn)
      } else {
        assignmentsPatch = 'cleared'
      }
    }

    // local state: patch를 camelCase 그대로 머지
    const localPatch = { ...patch }
    delete localPatch.managerId

    setData((prev) => {
      let nextAssignments = prev.assignments
      if (patch.managerId !== undefined) {
        nextAssignments = prev.assignments.filter((a) => a.studentId !== studentId)
        if (assignmentsPatch && assignmentsPatch !== 'cleared') {
          nextAssignments = [...nextAssignments, assignmentsPatch]
        }
      }
      return {
        ...prev,
        students: prev.students.map((s) => (s.id === studentId ? { ...s, ...localPatch } : s)),
        assignments: nextAssignments,
      }
    })
  }, [])

  // 학생 활성/비활성 토글 (soft delete)
  const setStudentStatus = useCallback(async (studentId, status) => {
    const { error } = await supabase
      .from('users')
      .update({ status })
      .eq('id', studentId)
    if (error) {
      console.error('setStudentStatus update error:', error)
      throw error
    }
    setData((prev) => ({
      ...prev,
      students: prev.students.map((s) => (s.id === studentId ? { ...s, status } : s)),
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
      saveCareerDesignResult,
      saveLearningDiagnosisResult,
      submitQuizAttempt,
      createQuizSet,
      updateQuizSet,
      deleteQuizSet,
      createQuizQuestion,
      updateQuizQuestion,
      deleteQuizQuestion,
      createStudent,
      updateStudent,
      setStudentStatus,
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
