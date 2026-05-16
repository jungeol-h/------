// 관리자 역할 초기 데이터 fetch — 전체 사용자 + 활성 학생의 활동 + 월간 통계.
// 사용자 관리 탭은 비활성 학생도 보여줘야 하므로 students는 전체 유지하되,
// 활동 데이터(마인드/학습 등)는 active 학생만 fetch해 통계에 미반영한다.

import { supabase } from '../../lib/supabase.js'
import {
  toUser, toMindRecord, toDiaryRecord, toLearningRecord, toTask,
  toCounselingRecord, toAlert, toCareerDesignResult,
  toLearningDiagnosisResult, toAssignment, toQuizSet, toQuizQuestion,
  toQuizAttempt,
} from '../../lib/supabaseHelpers.js'
import { EMPTY } from '../dataModel.js'

export async function fetchForAdmin() {
  const [usersRes, assnRes, alertsRes, counselingRes, statsRes, setsRes] = await Promise.all([
    supabase.from('users').select('*').order('grade').order('login_id'),
    supabase.from('assignments').select('*'),
    supabase.from('alerts').select('*').order('created_at', { ascending: false }),
    supabase.from('counseling_records').select('*').order('date', { ascending: false }),
    supabase.from('monthly_stats').select('*').order('id'),
    supabase.from('quiz_sets').select('*').order('grade').order('round'),
  ])

  const allUsers = usersRes.data ?? []
  const studentIds = allUsers
    .filter((u) => u.role === 'student' && (u.status ?? 'active') === 'active')
    .map((u) => u.id)
  const setIds = (setsRes.data ?? []).map((s) => s.id)

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
