// 관리자 홈 탭 (/admin/home) — 학년별 인원 현황, 핵심지표(긴급 업무보고·출결/학습/마인드 주의 + 상세 모달),
// 마인드 위험 학생 미리보기, 시스템 정합성 점검(getReconciliationIssues), 오늘의 업무 일정,
// 탭 진입 카드, 하단 통계(StatisticsSection). 지표는 전부 selector로 조회 시점에 계산한다.

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, AlertTriangle, Bell, CalendarX, TrendingDown,
  UserCog, ClipboardCheck, ChevronRight, MonitorSmartphone,
  ShieldCheck, ShieldAlert, CalendarDays, Siren, Loader,
} from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { getRiskStudents, getMindCautionStudents } from '../../context/selectors/riskDetection.js'
import { getAttendanceCautionStudents } from '../../context/selectors/attendanceStats.js'
import { toDateStr } from '../../utils/dateUtils.js'
import { getLearningCautionStudents } from '../../context/selectors/weeklyLearning.js'
import { getReconciliationIssues } from '../../context/selectors/reconciliation.js'
import { getWorkPlansForDate } from '../../context/selectors/workPlans.js'
import { COUNSELING_TYPE_LABELS } from '../../data/counselingTypes.js'
import { WORK_PLAN_TYPE_LABELS, WORK_PLAN_AUDIENCE_LABELS } from '../../data/workRecordTypes.js'
import StatisticsSection from '../../components/admin/StatisticsSection.jsx'
import UrgentReportListModal from '../../components/admin/UrgentReportListModal.jsx'
import CautionStudentsModal from '../../components/admin/CautionStudentsModal.jsx'
import GroupAttendanceSummary from '../../components/admin/GroupAttendanceSummary.jsx'
import { useHomeGroupFilter } from '../../components/admin/useHomeGroupFilter.js'

const GRADE_ORDER = { 중1: 1, 중2: 2, 중3: 3, 고1: 4, 고2: 5, 고3: 6 }
const gradeWeight = (g) => GRADE_ORDER[g] ?? 99

// 신입학 판정용 이번 달 프리픽스 — 로컬 기준 YYYY-MM (UTC 변환 시 하루 밀림 방지)
const currentMonthStr = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

const RISK_COLOR = {
  danger: 'text-red-600 bg-red-100',
  warning: 'text-yellow-700 bg-yellow-100',
  normal: 'text-green-600 bg-green-100',
}
const RISK_LABEL = { danger: '위험', warning: '주의', normal: '정상' }

// basePath/readOnly: 감독관(viewer)이 재사용 — 이동 경로를 /viewer로, 쓰기 액션(긴급보고 확인·키오스크)은 숨김
export default function AdminHomeTab({ basePath = '/admin', readOnly = false }) {
  const { data } = useData()
  const navigate = useNavigate()
  const [showUrgentList, setShowUrgentList] = useState(false)
  const [cautionModal, setCautionModal] = useState(null) // 'attendance' | 'learning' | 'mind'
  const [memberView, setMemberView] = useState('grade') // 인원 현황 보기: 'grade' | 'group'
  const unconfirmedUrgent = data.urgentReports.filter((r) => !r.confirmed).length

  // 그룹 필터 — 인원 현황(그룹별 보기)·그룹별 출결 집계가 공유. admin_config에 사용자별 저장.
  const { groups: homeGroups, toggleGroup, saveGroups, saving: savingGroups } = useHomeGroupFilter()

  const stats = useMemo(() => {
    const active = data.students.filter((s) => (s.status ?? 'active') === 'active')
    // 마인드 위험군 — 전체 active 학생 중 마인드 점수 위험 (미배정 학생도 포함)
    const mindRiskStudents = getRiskStudents(data)
    return { active, mindRiskStudents }
  }, [data])

  // 1단: 학년별 인원 현황 — 재적(전체) / 현인원(active) / 신입학(입학일이 이번 달) / 탈퇴
  const gradeRows = useMemo(() => {
    const thisMonth = currentMonthStr()
    const byGrade = {}
    data.students.forEach((s) => {
      const g = s.grade || '미지정'
      if (!byGrade[g]) byGrade[g] = { label: g, enrolled: 0, active: 0, newcomer: 0, withdrawn: 0 }
      byGrade[g].enrolled += 1
      if ((s.status ?? 'active') === 'active') byGrade[g].active += 1
      else byGrade[g].withdrawn += 1
      if (s.enrolledAt && String(s.enrolledAt).startsWith(thisMonth)) byGrade[g].newcomer += 1
    })
    return Object.values(byGrade).sort((a, b) => gradeWeight(a.label) - gradeWeight(b.label))
  }, [data.students])

  // 1단-그룹별: 같은 지표를 그룹 기준으로 버킷팅 — 출결 집계와 같은 관례를 따른다.
  // (첫 소속 기준, 필터 지정 시 해당 그룹만, 필터에 있지만 0명인 그룹도 행 노출,
  //  정렬은 필터 순서 → 인원 많은 순 → 무소속 마지막)
  const groupRows = useMemo(() => {
    const thisMonth = currentMonthStr()
    const filter = homeGroups ?? []
    const NO_GROUP = '무소속'
    const buckets = new Map() // group → counts
    const ensure = (g) => {
      if (!buckets.has(g)) buckets.set(g, { label: g, enrolled: 0, active: 0, newcomer: 0, withdrawn: 0 })
      return buckets.get(g)
    }
    data.students.forEach((s) => {
      const g = s.groups?.[0] || NO_GROUP
      if (filter.length > 0 && !filter.includes(g)) return
      const b = ensure(g)
      b.enrolled += 1
      if ((s.status ?? 'active') === 'active') b.active += 1
      else b.withdrawn += 1
      if (s.enrolledAt && String(s.enrolledAt).startsWith(thisMonth)) b.newcomer += 1
    })
    filter.forEach((g) => ensure(g))
    const orderIndex = (g) => {
      if (g === NO_GROUP) return Infinity
      const i = filter.indexOf(g)
      return i === -1 ? filter.length : i
    }
    return [...buckets.values()].sort((a, b) => {
      const oi = orderIndex(a.label) - orderIndex(b.label)
      if (oi !== 0) return oi
      return b.enrolled - a.enrolled
    })
  }, [data.students, homeGroups])

  // 인원 현황 표에 실제로 뿌릴 행/합계 — 그룹별 보기는 필터로 일부 학생이 빠질 수 있어 행 합산으로 계산.
  const memberRows = memberView === 'group' ? groupRows : gradeRows
  const memberTotals = memberRows.reduce(
    (acc, r) => {
      acc.enrolled += r.enrolled; acc.active += r.active
      acc.newcomer += r.newcomer; acc.withdrawn += r.withdrawn
      return acc
    },
    { enrolled: 0, active: 0, newcomer: 0, withdrawn: 0 }
  )

  // 2단: 핵심지표 — 출결 주의(최근 30일 결석 3회+) / 학습 주의(7일 이행률 60% 미만) / 마인드 주의(단일 -3 이하)
  const cautions = useMemo(() => ({
    attendance: getAttendanceCautionStudents(data),
    learning: getLearningCautionStudents(data),
    mind: getMindCautionStudents(data),
  }), [data])

  const reconciliation = useMemo(() => getReconciliationIssues(data), [data])

  // 4단: 오늘의 업무 일정 (업무계획 탭에서 등록한 오늘 일정)
  const todayPlans = useMemo(() => getWorkPlansForDate(data, toDateStr(new Date())), [data])

  const managerCount = data.educators.filter((e) => e.role === 'manager').length
  const quizSetCount = data.quizSets.length
  const attemptCount = data.quizAttempts.length

  // 핵심지표 상세 모달 구성 — selector가 이미 학생 배열을 반환하므로 표시 텍스트만 조립.
  const CAUTION_MODALS = {
    attendance: {
      title: '출결 주의 학생',
      icon: CalendarX,
      iconClass: 'text-red-500',
      description: '최근 30일 결석 3회 이상인 학생입니다. 누르면 학생 상세로 이동합니다.',
      emptyText: '출결 주의 학생이 없습니다.',
      rows: cautions.attendance.map(({ student, absentCount }) => ({
        student,
        valueText: `결석 ${absentCount}회`,
      })),
    },
    learning: {
      title: '학습 주의 학생',
      icon: TrendingDown,
      iconClass: 'text-orange-500',
      description: '최근 7일 계획 이행률이 60% 미만인 학생입니다. 누르면 학생 상세로 이동합니다.',
      emptyText: '학습 주의 학생이 없습니다.',
      rows: cautions.learning.map(({ student, rate }) => ({
        student,
        valueText: `이행 ${Math.round(rate * 100)}%`,
      })),
    },
    mind: {
      title: '마인드 주의 학생',
      icon: Bell,
      iconClass: 'text-amber-500',
      description: '최근 기록의 기분·동기·자신감 중 -3점 이하가 있는 학생입니다. 누르면 학생 상세로 이동합니다.',
      emptyText: '마인드 주의 학생이 없습니다.',
      rows: cautions.mind.map(({ student, latest }) => ({
        student,
        valueText: `기분 ${latest.mood} · 동기 ${latest.motivation} · 자신감 ${latest.confidence}`,
      })),
    },
  }

  return (
    <div className="py-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{readOnly ? '대시보드' : '관리자 대시보드'}</h2>
        <p className="text-xs text-gray-500 mt-0.5">현재 상황을 한눈에 확인합니다.</p>
      </div>

      {/* ── 1단: 인원 현황 (학년별/그룹별 보기 전환) ─────────── */}
      <section className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-blue-600" />
            <h3 className="text-sm font-bold text-gray-800">인원 현황</h3>
          </div>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {[['grade', '학년별'], ['group', '그룹별']].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMemberView(key)}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition ${
                  memberView === key ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {memberView === 'group' && homeGroups === null ? (
          // 그룹 필터 로드 전 — 출결 집계와 같은 스피너
          <div className="flex justify-center py-6 text-gray-300">
            <Loader size={20} className="animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-5 gap-1 text-center text-[11px] font-bold text-gray-400 pb-1.5 border-b border-gray-100">
              <span className="text-left pl-1">{memberView === 'group' ? '그룹' : '학년'}</span>
              <span>재적</span>
              <span className="text-blue-600">현 인원</span>
              <span className="text-emerald-600">신입학</span>
              <span>탈퇴</span>
            </div>
            {memberRows.map((row) => (
              <div key={row.label} className="grid grid-cols-5 gap-1 text-center text-sm py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-left pl-1 text-xs font-bold text-gray-600 self-center truncate">{row.label}</span>
                <span className="font-semibold text-gray-800">{row.enrolled}</span>
                <span className="font-semibold text-blue-700">{row.active}</span>
                <span className={`font-semibold ${row.newcomer > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>{row.newcomer}</span>
                <span className={`font-semibold ${row.withdrawn > 0 ? 'text-gray-500' : 'text-gray-300'}`}>{row.withdrawn}</span>
              </div>
            ))}
            <div className="grid grid-cols-5 gap-1 text-center text-sm pt-2 mt-0.5 border-t border-gray-100">
              <span className="text-left pl-1 text-xs font-bold text-gray-800 self-center">전체</span>
              <span className="font-bold text-gray-800">{memberTotals.enrolled}</span>
              <span className="font-bold text-blue-700">{memberTotals.active}</span>
              <span className="font-bold text-emerald-600">{memberTotals.newcomer}</span>
              <span className="font-bold text-gray-500">{memberTotals.withdrawn}</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-2">
              {memberView === 'group'
                ? '그룹은 첫 소속 기준 · 표시 그룹은 출결 집계의 그룹 설정과 공유 · 신입학 = 입학일이 이번 달'
                : '신입학 = 입학일이 이번 달인 학생 (사용자 관리에서 입학일 입력)'}
            </p>
          </>
        )}
      </section>

      {/* ── 그룹별 출결 집계 (오늘) ─────────────────────────── */}
      <GroupAttendanceSummary groups={homeGroups} toggleGroup={toggleGroup} saveGroups={saveGroups} saving={savingGroups} />

      {/* ── 2단: 핵심 지표 (주의 학생) ─────────────────────── */}
      <section>
        <h3 className="text-sm font-bold text-gray-500 mb-2">핵심 지표</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => setShowUrgentList(true)}
            className={`rounded-2xl shadow-sm p-3 text-left transition active:scale-[0.98] ${
              unconfirmedUrgent > 0 ? 'bg-red-50 border border-red-200 hover:bg-red-100/60' : 'bg-white hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Siren size={13} className="text-red-600" />
              <p className="text-[11px] text-gray-500">긴급 업무보고</p>
            </div>
            <p className="text-xl font-bold text-red-700">{unconfirmedUrgent}<span className="text-xs font-normal text-gray-400 ml-0.5">건</span></p>
            <p className="text-[10px] text-gray-400 mt-0.5">미확인 보고·건의</p>
          </button>
          <button
            type="button"
            onClick={() => setCautionModal('attendance')}
            className="bg-white rounded-2xl shadow-sm p-3 text-left hover:bg-gray-50 transition active:scale-[0.98]"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <CalendarX size={13} className="text-red-500" />
              <p className="text-[11px] text-gray-500">출결 주의</p>
            </div>
            <p className="text-xl font-bold text-red-600">{cautions.attendance.length}<span className="text-xs font-normal text-gray-400 ml-0.5">명</span></p>
            <p className="text-[10px] text-gray-400 mt-0.5">30일 결석 3회↑</p>
          </button>
          <button
            type="button"
            onClick={() => setCautionModal('learning')}
            className="bg-white rounded-2xl shadow-sm p-3 text-left hover:bg-gray-50 transition active:scale-[0.98]"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown size={13} className="text-orange-500" />
              <p className="text-[11px] text-gray-500">학습 주의</p>
            </div>
            <p className="text-xl font-bold text-orange-600">{cautions.learning.length}<span className="text-xs font-normal text-gray-400 ml-0.5">명</span></p>
            <p className="text-[10px] text-gray-400 mt-0.5">계획 이행 60% 미만</p>
          </button>
          <button
            type="button"
            onClick={() => setCautionModal('mind')}
            className="bg-white rounded-2xl shadow-sm p-3 text-left hover:bg-gray-50 transition active:scale-[0.98]"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Bell size={13} className="text-amber-500" />
              <p className="text-[11px] text-gray-500">마인드 주의</p>
            </div>
            <p className="text-xl font-bold text-amber-600">{cautions.mind.length}<span className="text-xs font-normal text-gray-400 ml-0.5">명</span></p>
            <p className="text-[10px] text-gray-400 mt-0.5">지표 -3점 이하</p>
          </button>
        </div>
      </section>

      {/* ── 마인드 위험 학생 미리보기 ──────────────────────── */}
      {stats.mindRiskStudents.length > 0 && (
        <section className="bg-red-50 border border-red-100 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-red-600" />
              <h3 className="text-sm font-bold text-red-700">마인드 위험 학생 {stats.mindRiskStudents.length}명</h3>
            </div>
            <button
              type="button"
              onClick={() => navigate(`${basePath}/users`)}
              className="text-[11px] font-semibold text-red-700 hover:text-red-800"
            >
              학생 관리 →
            </button>
          </div>
          <ul className="space-y-1.5">
            {stats.mindRiskStudents.slice(0, 3).map(({ student, level }) => (
              <li key={student.id}>
                <button
                  type="button"
                  onClick={() => navigate(`${basePath}/student/${student.id}`)}
                  className="w-full flex items-center justify-between bg-white rounded-lg px-3 py-2 text-left hover:bg-red-100/40 transition"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{student.name}</p>
                    <p className="text-xs text-gray-500 truncate">{student.school} · {student.grade}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ml-2 ${RISK_COLOR[level]}`}>
                    {RISK_LABEL[level]}
                  </span>
                </button>
              </li>
            ))}
            {stats.mindRiskStudents.length > 3 && (
              <li className="text-[11px] text-red-600 text-center pt-1">외 {stats.mindRiskStudents.length - 3}명</li>
            )}
          </ul>
        </section>
      )}

      {/* ── 시스템 정합성 점검 ───────────────────────────── */}
      <ReconciliationSection issues={reconciliation} onGoUsers={() => navigate(`${basePath}/users`)} />

      {/* ── 4단: 오늘의 업무 일정 ─────────────────────────── */}
      <section className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-blue-600" />
            <h3 className="text-sm font-bold text-gray-800">오늘의 업무 일정</h3>
          </div>
          <button
            type="button"
            onClick={() => navigate(`${basePath}/counseling?menu=plans`)}
            className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
          >
            업무계획 →
          </button>
        </div>
        {todayPlans.length === 0 ? (
          <p className="text-xs text-gray-400 py-2 text-center">오늘 예정된 업무가 없습니다.</p>
        ) : (
          <ul className="space-y-1.5">
            {todayPlans.map((plan) => (
              <li key={plan.id}>
                <button
                  type="button"
                  onClick={() => navigate(`${basePath}/counseling?menu=plans`)}
                  className="w-full flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-left hover:bg-blue-50 transition"
                >
                  <span className="text-xs font-bold text-gray-700 flex-shrink-0 w-11">
                    {plan.planTime || '—'}
                  </span>
                  <span className="flex gap-1 flex-shrink-0">
                    {plan.types.map((t) => (
                      <span key={t} className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700">
                        {WORK_PLAN_TYPE_LABELS[t] ?? COUNSELING_TYPE_LABELS[t] ?? t}
                      </span>
                    ))}
                  </span>
                  <span className="text-xs text-gray-600 truncate flex-1">
                    {(plan.audiences?.length > 0
                      ? plan.audiences.map((a) => WORK_PLAN_AUDIENCE_LABELS[a] ?? a)
                      : plan.studentIds.map((sid) => data.students.find((s) => s.id === sid)?.name ?? '?')
                    ).join(', ')}
                    {plan.memo && <span className="text-gray-400"> · {plan.memo}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 탭 진입 카드 ─────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-bold text-gray-500 mb-2">상세 메뉴</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <NavCard
            icon={UserCog}
            iconColor="text-emerald-600"
            bgColor="bg-emerald-50"
            title="사용자 관리"
            description="학생·매니저 관리 · 보고서 출력"
            meta={`학생 ${stats.active.length}명 / 매니저 ${managerCount}명`}
            onClick={() => navigate(`${basePath}/users`)}
          />
          <NavCard
            icon={ClipboardCheck}
            iconColor="text-violet-600"
            bgColor="bg-violet-50"
            title="확인평가"
            description="회차 관리 · 응시 모니터링"
            meta={`${quizSetCount}회 · 응시 ${attemptCount}건`}
            onClick={() => navigate(`${basePath}/quiz`)}
          />
          {!readOnly && (
            <NavCard
              icon={MonitorSmartphone}
              iconColor="text-indigo-600"
              bgColor="bg-indigo-50"
              title="등·하원 키오스크"
              description="센터 공용 태블릿 전체화면"
              meta="전화번호 뒷 4자리로 등·하원 체크"
              onClick={() => navigate('/admin/kiosk')}
            />
          )}
        </div>
      </section>

      {/* ── 5단: 통계 (구 통계 탭 → 홈 하단) ────────────────── */}
      <StatisticsSection />

      {showUrgentList && <UrgentReportListModal readOnly={readOnly} onClose={() => setShowUrgentList(false)} />}
      {cautionModal && (
        <CautionStudentsModal
          {...CAUTION_MODALS[cautionModal]}
          onClose={() => setCautionModal(null)}
          onSelect={(id) => {
            setCautionModal(null)
            navigate(`${basePath}/student/${id}`)
          }}
        />
      )}
    </div>
  )
}

// 데이터 정합성 점검 결과. 이상이 없으면 안심 신호(초록), 있으면 항목별 경고.
function ReconciliationSection({ issues, onGoUsers }) {
  const { unassignedActive, orphanAssignments, truncatedTables, fetchErrors, hasIssue } = issues

  if (!hasIssue) {
    return (
      <section className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-emerald-600" />
          <h3 className="text-sm font-bold text-emerald-700">시스템 정합성 이상 없음</h3>
        </div>
        <p className="text-[11px] text-emerald-600 mt-1">
          미배정 학생·데이터 로드 실패·누락이 발견되지 않았습니다.
        </p>
      </section>
    )
  }

  return (
    <section className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <ShieldAlert size={14} className="text-orange-600" />
        <h3 className="text-sm font-bold text-orange-700">시스템 정합성 점검 필요</h3>
      </div>
      <div className="space-y-2">
        {unassignedActive.length > 0 && (
          <div className="bg-white rounded-xl p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-800">
                담당 매니저 미배정 학생 {unassignedActive.length}명
              </p>
              <button
                type="button"
                onClick={onGoUsers}
                className="text-[11px] font-semibold text-orange-700 hover:text-orange-800 flex-shrink-0 ml-2"
              >
                배정하기 →
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              이 학생들의 활동은 어느 매니저 화면에도 나타나지 않습니다.
            </p>
            <p className="text-[11px] text-gray-600 mt-1 truncate">
              {unassignedActive.map((s) => s.name).join(', ')}
            </p>
          </div>
        )}

        {orphanAssignments.length > 0 && (
          <div className="bg-white rounded-xl p-3">
            <p className="text-xs font-bold text-gray-800">
              잘못된 배정 {orphanAssignments.length}건
            </p>
            <p className="text-[11px] text-gray-500 mt-1">
              존재하지 않는 학생 또는 매니저를 가리키는 배정입니다.
            </p>
          </div>
        )}

        {truncatedTables.length > 0 && (
          <div className="bg-white rounded-xl p-3">
            <p className="text-xs font-bold text-gray-800">
              일부만 불러온 데이터 {truncatedTables.length}건
            </p>
            <p className="text-[11px] text-gray-500 mt-1">
              화면에 보이는 데이터가 전체가 아닐 수 있습니다.
            </p>
            <ul className="text-[11px] text-gray-600 mt-1 space-y-0.5">
              {truncatedTables.map((t) => (
                <li key={t.table}>{t.table}: {t.fetched} / {t.total}건</li>
              ))}
            </ul>
          </div>
        )}

        {fetchErrors.length > 0 && (
          <div className="bg-white rounded-xl p-3">
            <p className="text-xs font-bold text-red-600">
              데이터 로드 실패 {fetchErrors.length}건
            </p>
            <ul className="text-[11px] text-gray-600 mt-1 space-y-0.5">
              {fetchErrors.map((e, i) => (
                <li key={i}>{e.table}: {e.message}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

function NavCard({ icon, iconColor, bgColor, title, description, meta, onClick }) {
  const IconCmp = icon
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white rounded-2xl shadow-sm p-4 text-left hover:shadow-md active:scale-[0.98] transition flex items-center gap-3"
    >
      <div className={`w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center flex-shrink-0`}>
        <IconCmp size={18} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-800">{title}</p>
        <p className="text-[11px] text-gray-500 truncate">{description}</p>
        <p className="text-[11px] text-gray-400 mt-0.5 truncate">{meta}</p>
      </div>
      <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
    </button>
  )
}
