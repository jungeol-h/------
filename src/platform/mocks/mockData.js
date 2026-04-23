// ─── 학생 목록 ─────────────────────────────────────────────
export const students = [
  { id: 's1', name: '김안동', school: '안동중학교', grade: '중2', selfIndex: 85, avatar: '🎒', riskLevel: 'normal' },
  { id: 's2', name: '이수진', school: '안동중학교', grade: '중3', selfIndex: 92, avatar: '📚', riskLevel: 'normal' },
  { id: 's3', name: '박민준', school: '경안고등학교', grade: '고1', selfIndex: 61, avatar: '🎯', riskLevel: 'warning' },
  { id: 's4', name: '최서연', school: '경안고등학교', grade: '고2', selfIndex: 78, avatar: '🌟', riskLevel: 'normal' },
  { id: 's5', name: '정하늘', school: '안동고등학교', grade: '고1', selfIndex: 55, avatar: '🎵', riskLevel: 'danger' },
]

// ─── 교육자 목록 ───────────────────────────────────────────
export const educators = [
  { id: 'e1', name: '최민수', role: 'teacher', assignedStudents: ['s1', 's2'] },
  { id: 'e2', name: '박지현', role: 'manager', assignedStudents: ['s1', 's3', 's5'] },
  { id: 'e3', name: '김상훈', role: 'manager', assignedStudents: ['s2', 's4'] },
]

// ─── M:N 매핑 ──────────────────────────────────────────────
export const assignments = [
  { studentId: 's1', educatorId: 'e1' },
  { studentId: 's1', educatorId: 'e2' },
  { studentId: 's2', educatorId: 'e1' },
  { studentId: 's2', educatorId: 'e3' },
  { studentId: 's3', educatorId: 'e2' },
  { studentId: 's4', educatorId: 'e3' },
  { studentId: 's5', educatorId: 'e2' },
]

// ─── 마인드 기록 ───────────────────────────────────────────
export const mindRecords = [
  { id: 'm1', studentId: 's1', date: '2026-04-24', emotion: '보통', motivation: 3, confidence: 3, memo: '' },
  { id: 'm2', studentId: 's2', date: '2026-04-24', emotion: '좋음', motivation: 4, confidence: 5, memo: '오늘 발표 잘 됐어요' },
  { id: 'm3', studentId: 's3', date: '2026-04-23', emotion: '힘듦', motivation: 2, confidence: 2, memo: '시험 걱정돼요' },
  { id: 'm4', studentId: 's5', date: '2026-04-24', emotion: '힘듦', motivation: 1, confidence: 1, memo: '너무 지쳐요' },
]

// ─── 학습 기록 ─────────────────────────────────────────────
export const learningRecords = [
  { id: 'l1', studentId: 's1', date: '2026-04-24', subject: '수학', duration: 60, focus: 80 },
  { id: 'l2', studentId: 's1', date: '2026-04-23', subject: '영어', duration: 45, focus: 75 },
  { id: 'l3', studentId: 's2', date: '2026-04-24', subject: '과학', duration: 90, focus: 90 },
  { id: 'l4', studentId: 's3', date: '2026-04-24', subject: '수학', duration: 30, focus: 50 },
  { id: 'l5', studentId: 's4', date: '2026-04-24', subject: '국어', duration: 70, focus: 85 },
]

// ─── 출석 기록 ─────────────────────────────────────────────
export const attendanceRecords = [
  { id: 'att1', studentId: 's1', date: '2026-04-24', status: 'present' },
  { id: 'att2', studentId: 's2', date: '2026-04-24', status: 'present' },
  { id: 'att3', studentId: 's3', date: '2026-04-24', status: 'late' },
  { id: 'att4', studentId: 's4', date: '2026-04-24', status: 'present' },
  { id: 'att5', studentId: 's5', date: '2026-04-24', status: 'absent' },
]

// ─── 과제 목록 ─────────────────────────────────────────────
export const tasks = [
  { id: 't1', studentId: 's1', title: '수학 2단원 연습문제', dueDate: '2026-04-26', status: 'pending', subject: '수학' },
  { id: 't2', studentId: 's1', title: '영어 단어 50개 암기', dueDate: '2026-04-25', status: 'done', subject: '영어' },
  { id: 't3', studentId: 's1', title: '독서 감상문 작성', dueDate: '2026-04-28', status: 'pending', subject: '국어' },
  { id: 't4', studentId: 's2', title: '과학 실험 보고서', dueDate: '2026-04-27', status: 'pending', subject: '과학' },
]

// ─── 상담 기록 ─────────────────────────────────────────────
export const counselingRecords = [
  { id: 'c1', studentId: 's3', managerId: 'e2', date: '2026-04-22', content: '진로 방향에 대해 상담. 이공계 진학 희망.', type: 'career' },
  { id: 'c2', studentId: 's5', managerId: 'e2', date: '2026-04-20', content: '학습 의욕 저하 상담. 정서적 지지 필요.', type: 'mind' },
]

// ─── 알림 ─────────────────────────────────────────────────
export const alerts = [
  {
    id: 'a1',
    studentId: 's3',
    managerId: 'e2',
    type: 'mind',
    severity: 'warning',
    message: '박민준 학생이 "힘듦"을 보고했습니다',
    detail: '동기 2점, 자신감 2점 — 시험 걱정을 언급했습니다.',
    date: '2026-04-23',
    resolved: false,
    coachingComment: '',
  },
  {
    id: 'a2',
    studentId: 's5',
    managerId: 'e2',
    type: 'mind',
    severity: 'danger',
    message: '정하늘 학생이 "힘듦"을 보고했습니다',
    detail: '동기 1점, 자신감 1점 — 매우 지쳐있다고 합니다. 즉각 대응 필요.',
    date: '2026-04-24',
    resolved: false,
    coachingComment: '',
  },
]

// ─── 월간 통계 (관리자용) ──────────────────────────────────
export const monthlyStats = [
  { month: '1월', attendance: 88, engagement: 72, selfIndex: 76 },
  { month: '2월', attendance: 91, engagement: 78, selfIndex: 79 },
  { month: '3월', attendance: 85, engagement: 75, selfIndex: 77 },
  { month: '4월', attendance: 90, engagement: 82, selfIndex: 83 },
]

// ─── 학교별 통계 ───────────────────────────────────────────
export const schoolStats = [
  { school: '안동중', studentCount: 2, avgSelfIndex: 88, riskCount: 0 },
  { school: '경안고', studentCount: 2, avgSelfIndex: 70, riskCount: 1 },
  { school: '안동고', studentCount: 1, avgSelfIndex: 55, riskCount: 1 },
]
