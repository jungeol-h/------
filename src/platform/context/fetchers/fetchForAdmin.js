// 관리자 역할 초기 데이터 fetch — 전체 사용자 + 활성 학생의 활동 + 월간 통계.
// 사용자 관리 탭은 비활성 학생도 보여줘야 하므로 students는 전체 유지하되,
// 활동 데이터(마인드/학습 등)는 active 학생만 fetch해 통계에 미반영한다.
//
// 그룹 스코프: instructor/consultant/viewer도 이 fetcher를 공유한다.
// scope({ userId, role })가 오면 admin 외 역할은 자기 소속 그룹(users.group_names)의
// 학생으로 studentIds를 좁힌다 — 활동 데이터가 .in('student_id')로 fetch되므로
// 통계·확인평가가 자동 정합된다. 화면단에서 students만 거르면 전량 합산 통계
// (누적출결·업무횟수)와 퀴즈 응시/대상 비율이 깨지므로 반드시 여기서 거른다.

import { supabase } from '../../lib/supabase.js'
import { daysAgoStr } from '../../utils/dateUtils.js'
import { canViewByGroups, canViewRecordGroup } from '../../utils/groupScope.js'
import {
  toUser, toMindRecord, toDiaryRecord, toLearningRecord, toTask,
  toCounselingRecord, toAlert, toCareerDesignResult,
  toLearningDiagnosisResult, toAssignment, toQuizSet, toQuizQuestion,
  toQuizAttempt, toParentChild, toAttendanceRecord, toAttendanceSchedule,
  toAttendanceNotification, toWorkPlan,
  toUrgentReport, toManagementReport, toFinanceRecord, toLessonReport,
  collectRows,
} from '../../lib/supabaseHelpers.js'
import { EMPTY } from '../dataModel.js'

export async function fetchForAdmin(scope = null) {
  const errors = []
  const meta = {}

  const [usersRes, assnRes, alertsRes, counselingRes, statsRes, setsRes, parentChildrenRes, workPlansRes, urgentReportsRes, managementReportsRes, financeRecordsRes, lessonReportsRes] = await Promise.all([
    supabase.from('users').select('*').order('grade').order('login_id'),
    supabase.from('assignments').select('*'),
    supabase.from('alerts').select('*').order('created_at', { ascending: false }),
    supabase.from('counseling_records').select('*').order('date', { ascending: false }),
    supabase.from('monthly_stats').select('*').order('id'),
    supabase.from('quiz_sets').select('*').order('grade').order('round'),
    supabase.from('parent_children').select('*'),
    supabase.from('work_plans').select('*').order('plan_date', { ascending: false }).limit(1000),
    supabase.from('urgent_reports').select('*').order('created_at', { ascending: false }),
    supabase.from('management_reports').select('*').order('date', { ascending: false }).limit(1000),
    supabase.from('finance_records').select('*').order('date', { ascending: false }).limit(2000),
    supabase.from('lesson_reports').select('*').order('date', { ascending: false }).limit(1000),
  ])

  const allUsers = collectRows(usersRes, 'users', errors)

  // 그룹 스코프 — 열람자 그룹은 localStorage 세션이 아니라 방금 fetch한 row에서 읽는다(스테일 방지).
  // admin이거나 그룹이 비어 있으면 viewerGroups=null → canViewByGroups가 전부 통과.
  const requester = scope && scope.role !== 'admin'
    ? allUsers.find((u) => u.id === scope.userId)
    : null
  const viewerGroups = requester?.group_names?.length ? requester.group_names : null // 빈 배열도 전체 열람

  const scopedStudents = allUsers.filter(
    (u) => u.role === 'student' && canViewByGroups(viewerGroups, u.group_names)
  )
  const scopedStudentIdSet = new Set(scopedStudents.map((u) => u.id)) // 비활성 포함 — 기록 표시용
  const studentIds = scopedStudents
    .filter((u) => (u.status ?? 'active') === 'active')
    .map((u) => u.id)

  // 학생 참조가 있는 기록은 스코프 학생 기준, 없는 기록(관리보고·재정·긴급보고)은 group_name 기준.
  const byStudentId = (row) => !row.student_id || scopedStudentIdSet.has(row.student_id)
  const byStudentIdList = (row) => {
    const ids = Array.isArray(row.student_ids) ? row.student_ids : []
    return ids.length === 0 || ids.some((id) => scopedStudentIdSet.has(id))
  }
  const byRecordGroup = (row) => canViewRecordGroup(viewerGroups, row.group_name)
  const setRows = collectRows(setsRes, 'quiz_sets', errors)
  const setIds = setRows.map((s) => s.id)

  // 출결은 최근 60일 윈도 — 대시보드 출결 주의 지표·학생 목록 출결 컬럼용 (fetchForManager와 동일)
  const attendanceSince = daysAgoStr(60)
  const notificationsSince = new Date(Date.now() - 7 * 86400000).toISOString()

  const [mindRes, learningRes, tasksRes, diaryRes, careerRes, diagRes, attemptsRes, attendanceRes, schedulesRes, attNotiRes] = studentIds.length > 0
    ? await Promise.all([
        supabase.from('mind_records').select('*', { count: 'exact' }).in('student_id', studentIds).order('date', { ascending: false }).limit(3000),
        supabase.from('learning_records').select('*', { count: 'exact' }).in('student_id', studentIds).order('date', { ascending: false }).limit(5000),
        supabase.from('tasks').select('*').in('student_id', studentIds),
        supabase.from('diary_records').select('*', { count: 'exact' }).in('student_id', studentIds).order('date', { ascending: false }).limit(3000),
        supabase.from('career_results').select('*').in('student_id', studentIds),
        supabase.from('diagnosis_results').select('*').in('student_id', studentIds),
        supabase.from('quiz_attempts').select('*').in('student_id', studentIds).order('submitted_at', { ascending: false }),
        supabase.from('attendance_records').select('*').in('student_id', studentIds).gte('date', attendanceSince).order('date', { ascending: false }),
        // 출결 탭(관리자도 매니저 화면 재사용) — 시간표·긴급 알림 (fetchForManager와 동일 윈도)
        supabase.from('attendance_schedules').select('*').in('student_id', studentIds),
        supabase.from('attendance_notifications').select('*').in('student_id', studentIds).or(`resolved.eq.false,created_at.gte.${notificationsSince}`).order('created_at', { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }]

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

  // 학부모는 스코프 학생의 부모만 남긴다 (parent_children 링크 기준)
  const parentChildRows = collectRows(parentChildrenRes, 'parent_children', errors).filter(byStudentId)
  const scopedParentIds = new Set(parentChildRows.map((r) => r.parent_id))

  return {
    ...EMPTY,
    students: scopedStudents.map(toUser),
    educators: allUsers.filter((u) => u.role !== 'student' && u.role !== 'parent').map(toUser),
    parents: allUsers.filter((u) => u.role === 'parent' && (viewerGroups == null || scopedParentIds.has(u.id))).map(toUser),
    parentChildren: parentChildRows.map(toParentChild),
    assignments: collectRows(assnRes, 'assignments', errors).filter(byStudentId).map(toAssignment),
    alerts: collectRows(alertsRes, 'alerts', errors).filter(byStudentId).map(toAlert),
    counselingRecords: collectRows(counselingRes, 'counseling_records', errors).filter(byStudentId).map(toCounselingRecord),
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
    attendanceRecords: collectRows(attendanceRes, 'attendance_records', errors).map(toAttendanceRecord),
    attendanceSchedules: collectRows(schedulesRes, 'attendance_schedules', errors).map(toAttendanceSchedule),
    attendanceNotifications: collectRows(attNotiRes, 'attendance_notifications', errors).map(toAttendanceNotification),
    workPlans: collectRows(workPlansRes, 'work_plans', errors).filter(byStudentIdList).map(toWorkPlan),
    urgentReports: collectRows(urgentReportsRes, 'urgent_reports', errors).filter(byRecordGroup).map(toUrgentReport),
    managementReports: collectRows(managementReportsRes, 'management_reports', errors).filter(byRecordGroup).map(toManagementReport),
    financeRecords: collectRows(financeRecordsRes, 'finance_records', errors).filter(byRecordGroup).map(toFinanceRecord),
    lessonReports: collectRows(lessonReportsRes, 'lesson_reports', errors).filter(byStudentIdList).map(toLessonReport),
    _fetchErrors: errors,
    _fetchMeta: meta,
  }
}
