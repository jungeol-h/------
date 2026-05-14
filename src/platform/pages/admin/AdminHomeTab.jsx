import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, TrendingUp, AlertTriangle, Bell,
  BarChart2, UserCog, ClipboardCheck, ChevronRight,
} from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'

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
    const unresolvedAlerts = data.alerts.filter((a) => !a.resolved)
    const avgSelfIndex = active.length > 0
      ? Math.round(active.reduce((s, st) => s + st.selfIndex, 0) / active.length)
      : 0
    return {
      active,
      withdrawn,
      risk,
      unresolvedAlerts,
      enrolled: active.length + withdrawn.length,
      avgSelfIndex,
    }
  }, [data.students, data.alerts])

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
              <p className="text-[11px] text-gray-500">미해결 알림</p>
            </div>
            <p className="text-xl font-bold text-amber-600">{stats.unresolvedAlerts.length}<span className="text-xs font-normal text-gray-400 ml-0.5">건</span></p>
          </div>
        </div>
      </section>

      {/* ── 미해결 알림 미리보기 ──────────────────────────── */}
      {stats.unresolvedAlerts.length > 0 && (
        <section className="bg-red-50 border border-red-100 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-red-600" />
              <h3 className="text-sm font-bold text-red-700">처리 대기 알림 {stats.unresolvedAlerts.length}건</h3>
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
            {stats.unresolvedAlerts.slice(0, 3).map((a) => {
              const student = data.students.find((s) => s.id === a.studentId)
              const risk = student?.riskLevel || 'normal'
              return (
                <li key={a.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{student?.name ?? a.studentId}</p>
                    <p className="text-xs text-gray-500 truncate">{a.message}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ml-2 ${RISK_COLOR[risk]}`}>
                    {RISK_LABEL[risk]}
                  </span>
                </li>
              )
            })}
            {stats.unresolvedAlerts.length > 3 && (
              <li className="text-[11px] text-red-600 text-center pt-1">외 {stats.unresolvedAlerts.length - 3}건</li>
            )}
          </ul>
        </section>
      )}

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
