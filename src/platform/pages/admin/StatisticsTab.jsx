import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'
import { useData } from '../../context/DataContext.jsx'

export default function StatisticsTab() {
  const { data } = useData()

  return (
    <div className="py-6 space-y-5">
      <h2 className="text-lg font-bold text-gray-900">통계 & 분석</h2>

      {/* 월간 출석률 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-3">월간 출석률 (%)</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data.monthlyStats}>
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis domain={[70, 100]} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="attendance" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 자기주도지수 추이 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-3">자기주도지수 추이</h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data.monthlyStats}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis domain={[60, 100]} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey="selfIndex" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 참여도 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-3">학습 참여도 추이 (%)</h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data.monthlyStats}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis domain={[60, 100]} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey="engagement" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
