import { Users, TrendingUp, AlertTriangle, Bell, Printer } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'

function PrintReport({ data }) {
  const avgSelfIndex = Math.round(data.students.reduce((s, st) => s + st.selfIndex, 0) / data.students.length)
  const riskStudents = data.students.filter(s => s.riskLevel !== 'normal')
  const todayStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div id="print-report" className="hidden print:block bg-white p-10 text-gray-900" style={{ fontFamily: 'serif' }}>
      <div className="border-b-2 border-gray-900 pb-4 mb-6">
        <h1 className="text-2xl font-bold">안동형 자기주도학습·진로성장 관리 시스템</h1>
        <p className="text-base mt-1 text-gray-600">운영 현황 리포트 — {todayStr}</p>
      </div>

      <section className="mb-6">
        <h2 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3">1. 핵심 현황</h2>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-gray-200">
              <td className="py-2 font-medium w-40">전체 학생 수</td>
              <td className="py-2">{data.students.length}명</td>
              <td className="py-2 font-medium w-40">평균 자기주도지수</td>
              <td className="py-2">{avgSelfIndex}점</td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="py-2 font-medium">위험/주의 학생</td>
              <td className="py-2">{riskStudents.length}명</td>
              <td className="py-2 font-medium">미해결 알림</td>
              <td className="py-2">{data.alerts.filter(a => !a.resolved).length}건</td>
            </tr>
            <tr>
              <td className="py-2 font-medium">전체 교육자</td>
              <td className="py-2">{data.educators.length}명</td>
              <td className="py-2 font-medium">총 상담 기록</td>
              <td className="py-2">{data.counselingRecords.length}건</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3">2. 학생 현황</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-3 py-2 text-left">이름</th>
              <th className="border border-gray-300 px-3 py-2 text-left">학교/학년</th>
              <th className="border border-gray-300 px-3 py-2 text-center">자기주도지수</th>
              <th className="border border-gray-300 px-3 py-2 text-center">위험도</th>
              <th className="border border-gray-300 px-3 py-2 text-left">담당 매니저</th>
            </tr>
          </thead>
          <tbody>
            {data.students.map(s => {
              const managerIds = data.assignments.filter(a => a.studentId === s.id).map(a => a.educatorId)
              const managers = data.educators.filter(e => managerIds.includes(e.id) && e.role === 'manager')
              const riskLabel = s.riskLevel === 'danger' ? '위험' : s.riskLevel === 'warning' ? '주의' : '정상'
              return (
                <tr key={s.id} className="border-b border-gray-200">
                  <td className="border border-gray-300 px-3 py-2">{s.name}</td>
                  <td className="border border-gray-300 px-3 py-2">{s.school} {s.grade}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center font-bold">{s.selfIndex}점</td>
                  <td className="border border-gray-300 px-3 py-2 text-center">{riskLabel}</td>
                  <td className="border border-gray-300 px-3 py-2">{managers.map(m => m.name).join(', ') || '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3">3. 학교별 현황</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-3 py-2 text-left">학교</th>
              <th className="border border-gray-300 px-3 py-2 text-center">학생 수</th>
              <th className="border border-gray-300 px-3 py-2 text-center">평균 자기주도지수</th>
              <th className="border border-gray-300 px-3 py-2 text-center">위험/주의</th>
            </tr>
          </thead>
          <tbody>
            {data.schoolStats.map(row => (
              <tr key={row.school} className="border-b border-gray-200">
                <td className="border border-gray-300 px-3 py-2">{row.school}</td>
                <td className="border border-gray-300 px-3 py-2 text-center">{row.studentCount}명</td>
                <td className="border border-gray-300 px-3 py-2 text-center font-bold">{row.avgSelfIndex}점</td>
                <td className="border border-gray-300 px-3 py-2 text-center">{row.riskCount}명</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="mt-8 pt-4 border-t border-gray-300 text-xs text-gray-500 text-center">
        본 리포트는 안동형 자기주도학습·진로성장 관리 시스템에서 자동 생성되었습니다.
      </div>
    </div>
  )
}

export default function AdminHomeTab() {
  const { data } = useData()

  const totalStudents = data.students.length
  const riskStudents = data.students.filter(s => s.riskLevel === 'danger' || s.riskLevel === 'warning').length
  const unresolved = data.alerts.filter(a => !a.resolved).length
  const avgSelfIndex = Math.round(data.students.reduce((s, st) => s + st.selfIndex, 0) / data.students.length)

  const statCards = [
    { label: '전체 학생', value: totalStudents, unit: '명', color: 'text-blue-600', bg: 'bg-blue-50', icon: Users },
    { label: '평균 자기주도지수', value: avgSelfIndex, unit: '점', color: 'text-indigo-600', bg: 'bg-indigo-50', icon: TrendingUp },
    { label: '위험/주의 학생', value: riskStudents, unit: '명', color: 'text-orange-600', bg: 'bg-orange-50', icon: AlertTriangle },
    { label: '미해결 알림', value: unresolved, unit: '건', color: 'text-red-600', bg: 'bg-red-50', icon: Bell },
  ]

  return (
    <>
      <PrintReport data={data} />

      <div className="py-6 space-y-5 print:hidden">
        <div>
          <h2 className="text-lg font-bold text-gray-900">전체 현황</h2>
          <p className="text-sm text-gray-500 mt-0.5">안동형 자기주도학습 관리 시스템</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {statCards.map(({ label, value, unit, color, bg, icon: Icon }) => (
            <div key={label} className={`${bg} rounded-2xl p-4`}>
              <Icon size={22} className={`${color} mb-2`} strokeWidth={1.8} />
              <p className={`text-2xl font-bold ${color}`}>{value}<span className="text-sm font-normal">{unit}</span></p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* 학교별 현황 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-3">학교별 현황</h3>
          <div className="space-y-3">
            {data.schoolStats.map(({ school, avgSelfIndex: avg, riskCount }) => (
              <div key={school} className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 w-20">{school}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${avg}%` }} />
                </div>
                <span className="text-sm font-bold text-gray-800 w-8">{avg}</span>
                {riskCount > 0 && (
                  <span className="text-xs bg-red-100 text-red-600 px-1.5 rounded-full">{riskCount}명</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 미해결 알림 */}
        {unresolved > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-red-500" />
              <h3 className="font-bold text-red-800">미해결 알림 {unresolved}건</h3>
            </div>
            <div className="space-y-1">
              {data.alerts.filter(a => !a.resolved).map(a => {
                const student = data.students.find(s => s.id === a.studentId)
                return (
                  <div key={a.id} className="text-sm text-red-700">
                    · {student?.name} — {a.message}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 인쇄 */}
        <button
          onClick={() => window.print()}
          className="w-full py-4 bg-violet-500 text-white rounded-2xl font-bold hover:bg-violet-600 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
        >
          <Printer size={18} />
          리포트 인쇄
        </button>
      </div>
    </>
  )
}
