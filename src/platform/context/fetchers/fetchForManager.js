// 매니저 역할 초기 데이터 fetch — 담당 학생들의 활동 + 본인 알림/상담.
// 비활성 학생은 매니저 화면 전체에서 제외한다.

import { supabase } from '../../lib/supabase.js'
import {
  toUser, toMindRecord, toDiaryRecord, toLearningRecord, toTask,
  toCounselingRecord, toAlert, toCareerDesignResult,
  toLearningDiagnosisResult, toAssignment, toQuizSet, toQuizQuestion,
  toQuizAttempt, collectRows,
} from '../../lib/supabaseHelpers.js'
import { EMPTY } from '../dataModel.js'

export async function fetchForManager(userId) {
  const errors = []
  const meta = {}

  const assnRes = await supabase
    .from('assignments')
    .select('*')
    .eq('educator_id', userId)
  const assnRows = collectRows(assnRes, 'assignments', errors)

  const allStudentIds = assnRows.map((a) => a.student_id)

  if (allStudentIds.length === 0) {
    return { ...EMPTY, assignments: [], _fetchErrors: errors, _fetchMeta: meta }
  }

  const studentsRes = await supabase
    .from('users')
    .select('*')
    .in('id', allStudentIds)
    .eq('status', 'active')
  const activeStudents = collectRows(studentsRes, 'users', errors)

  const studentIds = activeStudents.map((u) => u.id)
  const activeIdSet = new Set(studentIds)
  const assignments = assnRows
    .filter((a) => activeIdSet.has(a.student_id))
    .map(toAssignment)

  if (studentIds.length === 0) {
    return { ...EMPTY, assignments, _fetchErrors: errors, _fetchMeta: meta }
  }

  const [mindRes, alertsRes, counselingRes, tasksRes, learningRes, diaryRes, careerRes, diagRes, attemptsRes, setsRes] = await Promise.all([
    supabase.from('mind_records').select('*', { count: 'exact' }).in('student_id', studentIds).order('date', { ascending: false }).limit(2000),
    supabase.from('alerts').select('*').eq('manager_id', userId).order('created_at', { ascending: false }),
    supabase.from('counseling_records').select('*').eq('manager_id', userId).order('date', { ascending: false }),
    supabase.from('tasks').select('*').in('student_id', studentIds),
    supabase.from('learning_records').select('*', { count: 'exact' }).in('student_id', studentIds).order('date', { ascending: false }).limit(3000),
    supabase.from('diary_records').select('*', { count: 'exact' }).in('student_id', studentIds).order('date', { ascending: false }).limit(2000),
    supabase.from('career_results').select('*').in('student_id', studentIds),
    supabase.from('diagnosis_results').select('*').in('student_id', studentIds),
    supabase.from('quiz_attempts').select('*').in('student_id', studentIds).order('submitted_at', { ascending: false }),
    supabase.from('quiz_sets').select('*').order('grade').order('round'),
  ])

  const recordMeta = (res, table) => {
    if (res?.error || res?.count == null) return
    meta[table] = { fetched: (res.data ?? []).length, total: res.count }
  }
  recordMeta(mindRes, 'mind_records')
  recordMeta(learningRes, 'learning_records')
  recordMeta(diaryRes, 'diary_records')

  const setRows = collectRows(setsRes, 'quiz_sets', errors)
  const setIds = setRows.map((s) => s.id)
  const questionsRes = setIds.length > 0
    ? await supabase.from('quiz_questions').select('*').in('quiz_set_id', setIds).order('order_no')
    : { data: [] }

  return {
    ...EMPTY,
    students: activeStudents.map(toUser),
    assignments,
    mindRecords: collectRows(mindRes, 'mind_records', errors).map(toMindRecord),
    alerts: collectRows(alertsRes, 'alerts', errors).map(toAlert),
    counselingRecords: collectRows(counselingRes, 'counseling_records', errors).map(toCounselingRecord),
    tasks: collectRows(tasksRes, 'tasks', errors).map(toTask),
    learningRecords: collectRows(learningRes, 'learning_records', errors).map(toLearningRecord),
    diaryRecords: collectRows(diaryRes, 'diary_records', errors).map(toDiaryRecord),
    careerDesignResults: collectRows(careerRes, 'career_results', errors).map(toCareerDesignResult),
    learningDiagnosisResults: collectRows(diagRes, 'diagnosis_results', errors).map(toLearningDiagnosisResult),
    quizSets: setRows.map(toQuizSet),
    quizQuestions: collectRows(questionsRes, 'quiz_questions', errors).map(toQuizQuestion),
    quizAttempts: collectRows(attemptsRes, 'quiz_attempts', errors).map(toQuizAttempt),
    _fetchErrors: errors,
    _fetchMeta: meta,
  }
}
