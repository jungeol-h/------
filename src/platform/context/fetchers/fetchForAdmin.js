// 관리자 역할 초기 데이터 fetch — 전체 사용자 + 활성 학생의 활동 + 월간 통계.
// 사용자 관리 탭은 비활성 학생도 보여줘야 하므로 students는 전체 유지하되,
// 활동 데이터(마인드/학습 등)는 active 학생만 fetch해 통계에 미반영한다.

import { supabase } from '../../lib/supabase.js'
import {
  toUser, toMindRecord, toDiaryRecord, toLearningRecord, toTask,
  toCounselingRecord, toAlert, toCareerDesignResult,
  toLearningDiagnosisResult, toAssignment, toQuizSet, toQuizQuestion,
  toQuizAttempt, collectRows,
} from '../../lib/supabaseHelpers.js'
import { EMPTY } from '../dataModel.js'

export async function fetchForAdmin() {
  const errors = []
  const meta = {}

  const [usersRes, assnRes, alertsRes, counselingRes, statsRes, setsRes] = await Promise.all([
    supabase.from('users').select('*').order('grade').order('login_id'),
    supabase.from('assignments').select('*'),
    supabase.from('alerts').select('*').order('created_at', { ascending: false }),
    supabase.from('counseling_records').select('*').order('date', { ascending: false }),
    supabase.from('monthly_stats').select('*').order('id'),
    supabase.from('quiz_sets').select('*').order('grade').order('round'),
  ])

  const allUsers = collectRows(usersRes, 'users', errors)
  const studentIds = allUsers
    .filter((u) => u.role === 'student' && (u.status ?? 'active') === 'active')
    .map((u) => u.id)
  const setRows = collectRows(setsRes, 'quiz_sets', errors)
  const setIds = setRows.map((s) => s.id)

  const [mindRes, learningRes, tasksRes, diaryRes, careerRes, diagRes, attemptsRes] = studentIds.length > 0
    ? await Promise.all([
        supabase.from('mind_records').select('*', { count: 'exact' }).in('student_id', studentIds).order('date', { ascending: false }).limit(3000),
        supabase.from('learning_records').select('*', { count: 'exact' }).in('student_id', studentIds).order('date', { ascending: false }).limit(5000),
        supabase.from('tasks').select('*').in('student_id', studentIds),
        supabase.from('diary_records').select('*', { count: 'exact' }).in('student_id', studentIds).order('date', { ascending: false }).limit(3000),
        supabase.from('career_results').select('*').in('student_id', studentIds),
        supabase.from('diagnosis_results').select('*').in('student_id', studentIds),
        supabase.from('quiz_attempts').select('*').in('student_id', studentIds).order('submitted_at', { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }]

  const recordMeta = (res, table) => {
    if (res?.error || res?.count == null) return
    meta[table] = { fetched: (res.data ?? []).length, total: res.count }
  }
  recordMeta(mindRes, 'mind_records')
  recordMeta(learningRes, 'learning_records')
  recordMeta(diaryRes, 'diary_records')

  const questionsRes = setIds.length > 0
    ? await supabase.from('quiz_questions').select('*').in('quiz_set_id', setIds).order('order_no')
    : { data: [] }

  return {
    ...EMPTY,
    students: allUsers.filter((u) => u.role === 'student').map(toUser),
    educators: allUsers.filter((u) => u.role !== 'student').map(toUser),
    assignments: collectRows(assnRes, 'assignments', errors).map(toAssignment),
    alerts: collectRows(alertsRes, 'alerts', errors).map(toAlert),
    counselingRecords: collectRows(counselingRes, 'counseling_records', errors).map(toCounselingRecord),
    mindRecords: collectRows(mindRes, 'mind_records', errors).map(toMindRecord),
    learningRecords: collectRows(learningRes, 'learning_records', errors).map(toLearningRecord),
    tasks: collectRows(tasksRes, 'tasks', errors).map(toTask),
    diaryRecords: collectRows(diaryRes, 'diary_records', errors).map(toDiaryRecord),
    careerDesignResults: collectRows(careerRes, 'career_results', errors).map(toCareerDesignResult),
    learningDiagnosisResults: collectRows(diagRes, 'diagnosis_results', errors).map(toLearningDiagnosisResult),
    monthlyStats: collectRows(statsRes, 'monthly_stats', errors).map((r) => ({
      month: r.month,
      selfIndex: r.self_index,
      taskRate: r.task_rate,
      mindTotal: r.mind_total,
      centerHours: r.center_hours,
    })),
    quizSets: setRows.map(toQuizSet),
    quizQuestions: collectRows(questionsRes, 'quiz_questions', errors).map(toQuizQuestion),
    quizAttempts: collectRows(attemptsRes, 'quiz_attempts', errors).map(toQuizAttempt),
    _fetchErrors: errors,
    _fetchMeta: meta,
  }
}
