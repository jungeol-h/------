import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, TrendingUp, AlertTriangle, Bell,
  BarChart2, UserCog, ClipboardCheck, ChevronRight,
  ShieldCheck, ShieldAlert,
} from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { getRiskStudents } from '../../context/selectors/riskDetection.js'
import { getReconciliationIssues } from '../../context/selectors/reconciliation.js'

const RISK_COLOR = {
  danger: 'text-red-600 bg-red-100',
  warning: 'text-yellow-700 bg-yellow-100',
  normal: 'text-green-600 bg-green-100',
}
const RISK_LABEL = { danger: '위험', warning: '주의', normal: '정상' }

export default function AdminHomeTab() {
  const { data } = useData()
  const navigate = useNavigate()

  const stats = useMemo(() => {
    const active = data.students.filter((s) => (s.status ?? 'active') === 'active')
    const withdrawn = data.students.filter((s) => s.status === 'inactive')
    const risk = active.filter((s) => s.riskLevel === 'danger' || s.riskLevel === 'warning')
    // 마인드 위험군 — 전체 active 학생 중 마인드 점수 위험 (미배정 학생도 포함)
    const mindRiskStudents = getRiskStudents(data)
    const avgSelfIndex = active.length > 0
      ? Math.round(active.reduce((s, st) => s + st.selfIndex, 0) / active.length)
      : 0
    return {
      active,
      withdrawn,
      risk,
      mindRiskStudents,
      enrolled: active.length + withdrawn.length,
      avgSelfIndex,
    }
  }, [data])

  const reconciliation = useMemo(() => getReconciliationIssues(data), [data])

  const managerCount = data.educators.filter((e) => e.role === 'manager').length
  const quizSetCount = data.quizSets.length
  const attemptCount = data.quizAttempts.length

  return (
    <div className="py-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">관리자 대시보드</h2>
        <p className="text-xs text-gray-500 mt-0.5">학습 센터의 현재 상황을 한눈에 확인합니다.</p>
      </div>

      {/* ── 인원 요약 ────────────────────────────────────── */}
      <section className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users size={16} className="text-blue-600" />
          <h3 className="text-sm font-bold text-gray-800">인원 현황</h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-[11px] text-gray-500">재적</p>
            <p className="text-xl font-bold text-gray-800 mt-0.5">{stats.enrolled}<span className="text-xs font-normal text-gray-400 ml-0.5">명</span></p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-[11px] text-blue-700">현 인원</p>
            <p className="text-xl font-bold text-blue-700 mt-0.5">{stats.active.length}<span className="text-xs font-normal text-blue-400 ml-0.5">명</span></p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-[11px] text-gray-500">탈퇴</p>
            <p className="text-xl font-bold text-gray-500 mt-0.5">{stats.withdrawn.length}<span className="text-xs font-normal text-gray-400 ml-0.5">명</span></p>
          </div>
        </div>
      </section>

      {/* ── 핵심 KPI ─────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-bold text-gray-500 mb-2">핵심 지표</h3>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-2xl shadow-sm p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp size={13} className="text-blue-500" />
              <p className="text-[11px] text-gray-500">평균 자기주도지수</p>
            </div>
            <p className="text-xl font-bold text-blue-600">{stats.avgSelfIndex}<span className="text-xs font-normal text-gray-400 ml-0.5">점</span></p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle size={13} className="text-red-500" />
              <p className="text-[11px] text-gray-500">위험·주의</p>
            </div>
            <p className="text-xl font-bold text-red-600">{stats.risk.length}<span className="text-xs font-normal text-gray-400 ml-0.5">명</span></p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Bell size={13} className="text-amber-500" />
              <p className="text-[11px] text-gray-500">마인드 위험</p>
            </div>
            <p className="text-xl font-bold text-amber-600">{stats.mindRiskStudents.length}<span className="text-xs font-normal text-gray-400 ml-0.5">명</span></p>
          </div>
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
              onClick={() => navigate('/admin/users')}
              className="text-[11px] font-semibold text-red-700 hover:text-red-800"
            >
              학생 관리 →
            </button>
          </div>
          <ul className="space-y-1.5">
            {stats.mindRiskStudents.slice(0, 3).map(({ student, level }) => (
              <li key={student.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{student.name}</p>
                  <p className="text-xs text-gray-500 truncate">{student.school} · {student.grade}</p>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ml-2 ${RISK_COLOR[level]}`}>
                  {RISK_LABEL[level]}
                </span>
              </li>
            ))}
            {stats.mindRiskStudents.length > 3 && (
              <li className="text-[11px] text-red-600 text-center pt-1">외 {stats.mindRiskStudents.length - 3}명</li>
            )}
          </ul>
        </section>
      )}

      {/* ── 시스템 정합성 점검 ───────────────────────────── */}
      <ReconciliationSection issues={reconciliation} onGoUsers={() => navigate('/admin/users')} />

      {/* ── 탭 진입 카드 ─────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-bold text-gray-500 mb-2">상세 메뉴</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <NavCard
            icon={BarChart2}
            iconColor="text-blue-600"
            bgColor="bg-blue-50"
            title="통계 & 분석"
            description="월간 추이 · 보고서 출력"
            meta={`${data.monthlyStats.length}개월 누적`}
            onClick={() => navigate('/admin/statistics')}
          />
          <NavCard
            icon={UserCog}
            iconColor="text-emerald-600"
            bgColor="bg-emerald-50"
            title="사용자 관리"
            description="학생·매니저 관리 · 보고서 출력"
            meta={`학생 ${stats.active.length}명 / 매니저 ${managerCount}명`}
            onClick={() => navigate('/admin/users')}
          />
          <NavCard
            icon={ClipboardCheck}
            iconColor="text-violet-600"
            bgColor="bg-violet-50"
            title="확인평가"
            description="회차 관리 · 응시 모니터링"
            meta={`${quizSetCount}회 · 응시 ${attemptCount}건`}
            onClick={() => navigate('/admin/quiz')}
          />
        </div>
      </section>
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
