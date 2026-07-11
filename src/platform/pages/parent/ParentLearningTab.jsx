// 학부모 학습 탭 (/parent/learning) — 선택 자녀(child prop)의 자기주도지수(getSelfDirectedIndex),
// 최근 7일 학습시간 막대 차트, 과목별 학습시간 도넛 차트.

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { useData } from '../../context/DataContext.jsx'
import { subjectBreakdown } from '../../context/selectors/learningRecords.js'
import { getSelfDirectedIndex } from '../../context/selectors/indices.js'
import { formatMinutes } from '../student/learningTabLogic.js'

const SUBJECTS = [
  '국어', '영어', '수학', '과학', '사회', '도덕',
  '역사(한국사)', '기술가정', '한문', '정보',
  '교양 독서', '진로 독서', '진로 탐구',
]

const SUBJECT_COLORS = [
  '#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed',
  '#0891b2', '#65a30d', '#ea580c', '#db2777', '#0d9488',
  '#4f46e5', '#9333ea', '#57534e',
]

export default function ParentLearningTab({ child }) {
  const { data, getWeeklyLearning } = useData()
  const studentId = child.id

  const weekly = getWeeklyLearning(studentId)
  const weeklyTotal = weekly.reduce((sum, d) => sum + d.minutes, 0)

  const records = data.learningRecords.filter((r) => r.studentId === studentId)
  const pieData = subjectBreakdown(records, SUBJECTS.length).map(({ name, minutes }) => ({
    name,
    value: minutes,
  }))

  const selfIndex = getSelfDirectedIndex(data, studentId)

  return (
    <div className="py-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{child.name} 학습</h2>
        <p className="text-xs text-gray-500 mt-0.5">최근 학습 현황</p>
      </div>

      {/* 자기주도지수 */}
      <section className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">자기주도지수</p>
            <p className="text-3xl font-bold text-rose-600 mt-1">
              {selfIndex ?? '-'}
              {selfIndex != null && <span className="text-base font-normal text-gray-400">점</span>}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">최근 7일 학습</p>
            <p className="text-xl font-bold text-blue-600 mt-1">{formatMinutes(weeklyTotal)}</p>
          </div>
        </div>
      </section>

      {/* 주간 학습시간 막대 */}
      <section className="bg-white rounded-2xl p-4 shadow-sm">
        <h3 className="text-sm font-bold text-gray-700 mb-3">최근 7일 학습시간</h3>
        {weeklyTotal > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weekly} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [formatMinutes(v), '학습시간']} />
              <Bar dataKey="minutes" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-gray-400 py-10 text-sm">
            최근 7일 학습 기록이 없어요
          </p>
        )}
      </section>

      {/* 과목별 도넛 */}
      <section className="bg-white rounded-2xl p-4 shadow-sm">
        <h3 className="text-sm font-bold text-gray-700 mb-3">과목별 학습 시간</h3>
        {pieData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="45%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={SUBJECT_COLORS[SUBJECTS.indexOf(entry.name) >= 0 ? SUBJECTS.indexOf(entry.name) : index % SUBJECT_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [formatMinutes(v), '학습시간']} />
              <Legend
                formatter={(value) => <span style={{ fontSize: 11 }}>{value}</span>}
                iconSize={10}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-gray-400 py-10 text-sm">
            아직 실제 학습시간 기록이 없어요
          </p>
        )}
      </section>
    </div>
  )
}
