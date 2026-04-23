import { useData } from '../../context/DataContext.jsx'

export default function AdminHomeTab() {
  const { data } = useData()

  const totalStudents = data.students.length
  const riskStudents = data.students.filter(s => s.riskLevel === 'danger' || s.riskLevel === 'warning').length
  const unresolved = data.alerts.filter(a => !a.resolved).length
  const avgSelfIndex = Math.round(data.students.reduce((s, st) => s + st.selfIndex, 0) / data.students.length)

  const stats = [
    { label: '전체 학생', value: totalStudents, unit: '명', color: 'text-blue-600', bg: 'bg-blue-50', icon: '👥' },
    { label: '평균 자기주도지수', value: avgSelfIndex, unit: '점', color: 'text-indigo-600', bg: 'bg-indigo-50', icon: '📈' },
    { label: '위험/주의 학생', value: riskStudents, unit: '명', color: 'text-orange-600', bg: 'bg-orange-50', icon: '⚠️' },
    { label: '미해결 알림', value: unresolved, unit: '건', color: 'text-red-600', bg: 'bg-red-50', icon: '🚨' },
  ]

  return (
    <div className="py-6 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900">전체 현황</h2>
        <p className="text-sm text-gray-500 mt-0.5">안동형 자기주도학습 관리 시스템</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {stats.map(({ label, value, unit, color, bg, icon }) => (
          <div key={label} className={`${bg} rounded-2xl p-4`}>
            <div className="text-2xl mb-1">{icon}</div>
            <p className={`text-2xl font-bold ${color}`}>{value}<span className="text-sm font-normal">{unit}</span></p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* 학교별 현황 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-3">학교별 현황</h3>
        <div className="space-y-3">
          {data.schoolStats.map(({ school, studentCount, avgSelfIndex, riskCount }) => (
            <div key={school} className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 w-20">{school}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${avgSelfIndex}%` }} />
              </div>
              <span className="text-sm font-bold text-gray-800 w-8">{avgSelfIndex}</span>
              {riskCount > 0 && (
                <span className="text-xs bg-red-100 text-red-600 px-1.5 rounded-full">{riskCount}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 인쇄 */}
      <button
        onClick={() => window.print()}
        className="w-full py-4 bg-violet-500 text-white rounded-2xl font-bold hover:bg-violet-600 active:scale-95 transition-all shadow-md"
      >
        🖨️ 리포트 인쇄
      </button>
    </div>
  )
}
