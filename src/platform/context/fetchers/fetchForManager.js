// 매니저 역할 초기 데이터 fetch — 담당 학생들의 활동 + 본인 알림/상담.
// 비활성 학생은 매니저 화면 전체에서 제외한다.

import { supabase } from '../../lib/supabase.js'
import {
  toUser, toMindRecord, toDiaryRecord, toLearningRecord, toTask,
  toCounselingRecord, toAlert, toCareerDesignResult,
  toLearningDiagnosisResult, toAssignment, toQuizSet, toQuizQuestion,
  toQuizAttempt,
} from '../../lib/supabaseHelpers.js'
import { EMPTY } from '../dataModel.js'

export async function fetchForManager(userId) {
  const { data: assnData } = await supabase
    .from('assignments')
    .select('*')
    .eq('educator_id', userId)

  const allStudentIds = (assnData ?? []).map((a) => a.student_id)

  if (allStudentIds.length === 0) {
    return { ...EMPTY, assignments: [] }
  }

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
