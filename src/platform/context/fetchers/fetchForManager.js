// 매니저 역할 초기 데이터 fetch — 담당 학생들의 활동 + 본인 알림/상담.
// 비활성 학생은 매니저 화면 전체에서 제외한다.

import { supabase } from '../../lib/supabase.js'
import { daysAgoStr } from '../../utils/dateUtils.js'
import {
  toUser, toMindRecord, toDiaryRecord, toLearningRecord, toTask,
  toCounselingRecord, toAlert, toCareerDesignResult,
  toLearningDiagnosisResult, toAssignment, toQuizSet, toQuizQuestion,
  toQuizAttempt, toAttendanceRecord, toAttendanceSchedule,
  toAttendanceNotification, toUrgentReport, toLessonReport, toNotice,
  toCenterClosure, toStudentFeedback, collectRows,
} from '../../lib/supabaseHelpers.js'
import { EMPTY } from '../dataModel.js'
import { canViewByGroups } from '../../utils/groupScope.js'

export async function fetchForManager(userId) {
  const errors = []
  const meta = {}

  const assnRes = await supabase
    .from('assignments')
    .select('*')
    .eq('educator_id', userId)
  const assnRows = collectRows(assnRes, 'assignments', errors)

  const allStudentIds = assnRows.map((a) => a.student_id)

  // 공지·알림 작성 관리 목록 — 담당 학생 유무와 무관하게 항상 조회
  const fetchNotices = async () => {
    const res = await supabase.from('notices').select('*').order('created_at', { ascending: false }).limit(200)
    return collectRows(res, 'notices', errors).map(toNotice)
  }

  if (allStudentIds.length === 0) {
    const notices = await fetchNotices()
    return { ...EMPTY, assignments: [], notices, _fetchErrors: errors, _fetchMeta: meta }
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
    const notices = await fetchNotices()
    return { ...EMPTY, assignments, notices, _fetchErrors: errors, _fetchMeta: meta }
  }

  // 출결: 기록은 최근 60일, 알림은 미해결 전체 + 최근 7일
  const attendanceSince = daysAgoStr(60)
  const notificationsSince = new Date(Date.now() - 7 * 86400000).toISOString()

  const [mindRes, alertsRes, counselingRes, tasksRes, learningRes, diaryRes, careerRes, diagRes, attemptsRes, setsRes, attendanceRes, schedulesRes, attNotiRes, urgentRes, educatorsRes, lessonReportsRes, studentGroupsRes, closuresRes, feedbacksRes] = await Promise.all([
    supabase.from('mind_records').select('*', { count: 'exact' }).in('student_id', studentIds).order('date', { ascending: false }).limit(2000),
    supabase.from('alerts').select('*').eq('manager_id', userId).order('created_at', { ascending: false }),
    // 담당 학생의 상담 기록 전체 — 작성자 무관 열람 (2026-07 클라이언트: 학생별 기록은 모든 강사 열람)
    supabase.from('counseling_records').select('*').in('student_id', studentIds).order('date', { ascending: false }),
    supabase.from('tasks').select('*').in('student_id', studentIds),
    supabase.from('learning_records').select('*', { count: 'exact' }).in('student_id', studentIds).order('date', { ascending: false }).limit(3000),
    supabase.from('diary_records').select('*', { count: 'exact' }).in('student_id', studentIds).order('date', { ascending: false }).limit(2000),
    supabase.from('career_results').select('*').in('student_id', studentIds),
    supabase.from('diagnosis_results').select('*').in('student_id', studentIds),
    supabase.from('quiz_attempts').select('*').in('student_id', studentIds).order('submitted_at', { ascending: false }),
    supabase.from('quiz_sets').select('*').order('grade').order('round'),
    supabase.from('attendance_records').select('*').in('student_id', studentIds).gte('date', attendanceSince).order('date', { ascending: false }),
    supabase.from('attendance_schedules').select('*').in('student_id', studentIds),
    supabase.from('attendance_notifications').select('*').in('student_id', studentIds).or(`resolved.eq.false,created_at.gte.${notificationsSince}`).order('created_at', { ascending: false }),
    // 본인이 보낸 긴급 보고 (확인 여부 표시용)
    supabase.from('urgent_reports').select('*').eq('author_id', userId).order('created_at', { ascending: false }),
    // 상담 작성자 표시용 교직원 목록 (학생/학부모 제외)
    supabase.from('users').select('*').not('role', 'in', '("student","parent")'),
    // 수업보고 — 상담과 동일하게 작성자 무관 전체 열람 (student_ids가 jsonb라 서버 필터 불가, 소량)
    supabase.from('lesson_reports').select('*').order('date', { ascending: false }).limit(1000),
    // 수업보고 그룹 필터용 — 전체 학생의 소속만 가볍게 조회
    supabase.from('users').select('id, group_names').eq('role', 'student'),
    // 센터 휴무기간 — 출결판 휴무 표시 (미적용 시 _fetchErrors로 강등)
    supabase.from('center_closures').select('*').order('start_date', { ascending: false }),
    // 학생 피드백(수시 코멘트) — 담당 학생분
    supabase.from('student_feedbacks').select('*').in('student_id', studentIds).order('date', { ascending: false }).limit(2000),
  ])
  const notices = await fetchNotices()

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

  // 수업보고 그룹 스코프 — 태그된 학생 중 한 명이라도 매니저 소속 그룹이면 보인다.
  // (매니저 자신의 그룹은 educators fetch에 포함된 본인 row에서 읽는다)
  const educatorRows = collectRows(educatorsRes, 'users', errors)
  const viewerGroups = educatorRows.find((u) => u.id === userId)?.group_names ?? null
  const studentGroupById = new Map(
    collectRows(studentGroupsRes, 'users', errors).map((u) => [u.id, u.group_names])
  )
  const lessonInScope = (row) => {
    const ids = Array.isArray(row.student_ids) ? row.student_ids : []
    return ids.length === 0 || ids.some((id) => canViewByGroups(viewerGroups, studentGroupById.get(id)))
  }

  return {
    ...EMPTY,
    students: activeStudents.map(toUser),
    educators: educatorRows.map(toUser),
    urgentReports: collectRows(urgentRes, 'urgent_reports', errors).map(toUrgentReport),
    lessonReports: collectRows(lessonReportsRes, 'lesson_reports', errors).filter(lessonInScope).map(toLessonReport),
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
    attendanceRecords: collectRows(attendanceRes, 'attendance_records', errors).map(toAttendanceRecord),
    attendanceSchedules: collectRows(schedulesRes, 'attendance_schedules', errors).map(toAttendanceSchedule),
    attendanceNotifications: collectRows(attNotiRes, 'attendance_notifications', errors).map(toAttendanceNotification),
    notices,
    centerClosures: collectRows(closuresRes, 'center_closures', errors).map(toCenterClosure),
    studentFeedbacks: collectRows(feedbacksRes, 'student_feedbacks', errors).map(toStudentFeedback),
    _fetchErrors: errors,
    _fetchMeta: meta,
  }
}
