// Supabase DB row(snake_case) → DataContext 형식(camelCase) 변환 헬퍼

import { reportError } from './sentry.js'

export const toUser = (row) => ({
  id: row.id,
  loginId: row.login_id,
  name: row.name,
  role: row.role,
  school: row.school ?? '',
  grade: row.grade ?? '',
  className: row.class_name ?? '',
  gender: row.gender ?? null,
  password: row.password ?? '',
  parentPassword: row.parent_password ?? '',
  selfIndex: row.self_index ?? 70,
  riskLevel: row.risk_level ?? 'normal',
  status: row.status ?? 'active',
  enrolledAt: row.enrolled_at ?? null,
  subject: row.subject ?? '',
  groups: row.group_names ?? [], // 소속 그룹 (빈 배열 = 무소속: 직원이면 전체 열람, 학생이면 공용)
})

export const toMindRecord = (row) => ({
  id: row.id,
  studentId: row.student_id,
  date: row.date,
  mood: row.mood,
  motivation: row.motivation,
  confidence: row.confidence,
  memo: row.memo ?? '',
})

export const toDiaryRecord = (row) => ({
  id: row.id,
  studentId: row.student_id,
  date: row.date,
  praise: row.praise ?? '',
  reflection: row.reflection ?? '',
  resolution: row.resolution ?? '',
})

export const toLearningRecord = (row) => ({
  id: row.id,
  studentId: row.student_id,
  date: row.date,
  subject: row.subject,
  duration: row.duration,
  actualDuration: row.actual_duration ?? row.duration ?? null,
  recordType: row.record_type ?? 'timer',
  status: row.status ?? 'done',
  studyMethod: row.study_method ?? '',
  studyLocation: row.study_location ?? '',
  content: row.content ?? '',
  plannedMin: row.planned_min ?? null,
  sortOrder: row.sort_order ?? null,
  focus: row.focus,
  startTime: toHHMM(row.start_time),
})

// TIME 컬럼은 'HH:MM:SS'로 오므로 'HH:MM'으로 자른다
function toHHMM(t) { return t ? String(t).slice(0, 5) : null }

export const toAttendanceRecord = (row) => ({
  id: row.id,
  studentId: row.student_id,
  date: row.date,
  status: row.status ?? 'present',
  checkInAt: row.check_in_at ?? null,
  checkOutAt: row.check_out_at ?? null,
  scheduledArrival: toHHMM(row.scheduled_arrival),
  scheduledDeparture: toHHMM(row.scheduled_departure),
  checkoutStatus: row.checkout_status ?? null,
  source: row.source ?? 'kiosk',
  note: row.note ?? '',
})

export const toAttendanceSchedule = (row) => ({
  id: row.id,
  studentId: row.student_id,
  dayOfWeek: row.day_of_week,
  arrivalTime: toHHMM(row.arrival_time),
  departureTime: toHHMM(row.departure_time),
})

export const toAttendanceNotification = (row) => ({
  id: row.id,
  studentId: row.student_id,
  date: row.date,
  type: row.type,
  message: row.message,
  resolved: row.resolved ?? false,
  createdAt: row.created_at,
})

export const toTask = (row) => ({
  id: row.id,
  studentId: row.student_id,
  title: row.title,
  subject: row.subject,
  dueDate: row.due_date,
  dueTime: row.due_time ?? '23:59',
  status: row.status ?? 'pending',
  assignerId: row.assigner_id ?? null,
  assignerName: row.assigner_name ?? '',
  method: row.method ?? '',
  content: row.content ?? '',
  attachments: row.attachments ?? [], // 강사 첨부 (문제/자료)
  submissions: row.submissions ?? [], // 학생 제출 파일
})

export const toCounselingRecord = (row) => ({
  id: row.id,
  studentId: row.student_id,
  educatorId: row.manager_id,
  date: row.date,
  comment: row.content,
  type: row.type ?? 'study',
  targetType: row.target_type ?? 'student',
  // 보고서 양식 6단계 — 구 기록은 null(단일 comment만 존재)
  topic: row.topic ?? '',
  diagnosis: row.diagnosis ?? '',
  advice: row.advice ?? '',
  followUp: row.follow_up ?? '',
  note: row.note ?? '',
  nextAppointment: row.next_appointment ?? '',
  startTime: row.start_time ?? '',
  endTime: row.end_time ?? '',
  attachments: toArray(row.attachments), // [{ path, name, size }] — PDF 첨부 메타
})

export const toAlert = (row) => ({
  id: row.id,
  studentId: row.student_id,
  managerId: row.manager_id,
  type: row.type ?? 'mind',
  level: row.severity ?? 'warning',
  message: row.message,
  detail: row.detail ?? '',
  date: row.date,
  resolved: row.resolved ?? false,
  coachingComment: row.coaching_comment ?? '',
})

export const toTodoItem = (row) => ({
  id: row.id,
  studentId: row.student_id,
  date: row.date,
  subject: row.subject,
  plannedMin: row.planned_min,
  content: row.content ?? '',
  done: row.done ?? false,
})

export const toCareerDesignResult = (row) => ({
  id: row.id,
  studentId: row.student_id,
  date: row.date,
  selectedVerbs: row.selected_verbs ?? [],
  selectedActivities: row.selected_activities ?? [],
  selectedCategories: row.selected_categories ?? [],
  primaryCat: row.primary_cat ?? '',
  typeName: row.type_name ?? '',
  finalScores: row.final_scores ?? {},
  fields: row.fields ?? [],
})

export const toLearningDiagnosisResult = (row) => ({
  id: row.id,
  studentId: row.student_id,
  date: row.date,
  answers: row.answers ?? [],
  domainScores: row.domain_scores ?? {},
  stageScores: row.stage_scores ?? {},
  stageGrades: row.stage_grades ?? {},
  stateTypes: row.state_types ?? {},
  typeName: row.type_name ?? '',
})

export const toParentChild = (row) => ({
  id: row.id,
  parentId: row.parent_id,
  studentId: row.student_id,
})

export const toDailySelfScore = (row) => ({
  id: row.id,
  studentId: row.student_id,
  date: row.date,
  score: row.score,
  memo: row.memo ?? '',
})

// jsonb 컬럼은 이미 배열로 오지만, 문자열로 저장된 경우도 방어한다
const toArray = (v) => {
  if (Array.isArray(v)) return v
  if (typeof v === 'string') {
    try { return JSON.parse(v) } catch { return [] }
  }
  return []
}

export const toWorkPlan = (row) => ({
  id: row.id,
  authorId: row.author_id,
  planDate: row.plan_date,
  planTime: row.plan_time ?? '',
  types: toArray(row.types),
  studentIds: toArray(row.student_ids),
  memo: row.memo ?? '',
  status: row.status ?? 'planned',
  createdAt: row.created_at,
})

export const toManagementReport = (row) => ({
  id: row.id,
  authorId: row.author_id,
  date: row.date,
  workType: row.work_type ?? 'etc',
  startTime: row.start_time ?? '',
  endTime: row.end_time ?? '',
  content: row.content ?? '',
  note: row.note ?? '',
  groupName: row.group_name ?? null, // null = 공용 (그룹 도입 전 기록)
  createdAt: row.created_at,
})

export const toFinanceRecord = (row) => ({
  id: row.id,
  authorId: row.author_id,
  date: row.date,
  category: row.category ?? 'etc',
  itemName: row.item_name ?? '',
  unitPrice: row.unit_price ?? 0,
  quantity: row.quantity ?? 1,
  amount: row.amount ?? 0,
  vendor: row.vendor ?? '',
  paymentMethod: row.payment_method ?? 'personal_card',
  attachments: toArray(row.attachments), // [{ path, name, size }] — 영수증·사진 메타
  groupName: row.group_name ?? null,
  createdAt: row.created_at,
})

export const toLessonReport = (row) => ({
  id: row.id,
  authorId: row.author_id,
  date: row.date,
  studentIds: toArray(row.student_ids),
  startTime: row.start_time ?? '',
  endTime: row.end_time ?? '',
  topic: row.topic ?? '',
  textbook: row.textbook ?? '',
  content: row.content ?? '',
  homework: row.homework ?? '',
  note: row.note ?? '',
  createdAt: row.created_at,
})

export const toUrgentReport = (row) => ({
  id: row.id,
  authorId: row.author_id,
  content: row.content,
  groupName: row.group_name ?? null,
  confirmed: row.confirmed ?? false,
  confirmedBy: row.confirmed_by ?? null,
  confirmedAt: row.confirmed_at ?? null,
  createdAt: row.created_at,
})

// flat 형식 [{ educatorId, studentId }] — 기존 컴포넌트 코드와 호환
export const toAssignment = (row) => ({
  educatorId: row.educator_id,
  studentId: row.student_id,
})

export const toQuizSet = (row) => ({
  id: row.id,
  title: row.title,
  grade: row.grade,
  subject: row.subject ?? '국어',
  round: row.round ?? 1,
  source: row.source ?? '',
  description: row.description ?? '',
  isPublished: row.is_published ?? true,
  isScoreOnly: row.is_score_only ?? false,
  maxScore: row.max_score ?? null,
  createdAt: row.created_at,
})

export const toQuizQuestion = (row) => ({
  id: row.id,
  quizSetId: row.quiz_set_id,
  orderNo: row.order_no,
  type: row.type ?? 'short',
  question: row.question,
  acceptedAnswers: row.accepted_answers ?? [],
  explanation: row.explanation ?? '',
  hint: row.hint ?? '',
  attachments: row.attachments ?? [],
})

export const toQuizAttempt = (row) => ({
  id: row.id,
  studentId: row.student_id,
  quizSetId: row.quiz_set_id,
  answers: row.answers ?? [],
  score: row.score ?? 0,
  total: row.total ?? 0,
  submittedAt: row.submitted_at,
})

// ── 침묵 실패 방지: fetch 결과 검사 ──────────────────────────────
// Supabase 쿼리 결과에서 에러를 errors 배열에 수집하고 data 행을 꺼낸다.
// 에러가 나도 throw하지 않고 [] 를 돌려줘 부분 렌더는 유지하되,
// "실패했다는 사실"은 errors 에 남겨 화면에서 경고할 수 있게 한다.
// 동시에 Sentry로도 보내 개발자가 운영 중 즉시 인지하게 한다.
export function collectRows(res, table, errors) {
  if (res?.error) {
    errors.push({ table, message: res.error.message ?? String(res.error) })
    reportError(res.error, { where: 'fetch', table })
    return []
  }
  return res?.data ?? []
}
