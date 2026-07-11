import { useMemo, useState } from 'react'
import { Save, Star } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useData } from '../../context/DataContext.jsx'
import { toDateStr } from '../../utils/dateUtils.js'

// 돌아보기 "오늘의 자기주도 학습 점수" — 100점 만점 자기평가 + 기억할 점 메모.
// 하루 1건 upsert(재저장 = 덮어쓰기). 왼쪽 최근 14일 막대그래프, 오른쪽 선택일 메모.
export default function DailySelfScoreSection({ studentId }) {
  const { data, upsertDailySelfScore } = useData()
  const today = toDateStr(new Date())

  const myScores = useMemo(
    () => data.dailySelfScores
      .filter((s) => s.studentId === studentId)
      .sort((a, b) => String(a.date).localeCompare(String(b.date))),
    [data.dailySelfScores, studentId]
  )
  const todayRecord = myScores.find((s) => s.date === today)

  const [score, setScore] = useState(() => todayRecord?.score ?? 70)
  const [memo, setMemo] = useState(() => todayRecord?.memo ?? '')
  const [saving, setSaving] = useState(false)
  const [selectedDate, setSelectedDate] = useState(today)

  const chartData = useMemo(() => myScores.slice(-14).map((s) => ({
    date: s.date,
    day: String(s.date).slice(5).replace('-', '.'),
    score: s.score,
  })), [myScores])

  const selectedRecord = myScores.find((s) => s.date === selectedDate)

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      await upsertDailySelfScore(studentId, { date: today, score: Number(score), memo: memo.trim() })
      setSelectedDate(today)
    } catch {
      // 저장 실패는 전역 Toast가 표면화한다.
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="bg-white rounded-xl p-4 shadow-sm space-y-4">
      <div className="flex items-center gap-1.5">
        <Star size={15} className="text-amber-500" />
        <h3 className="text-sm font-bold text-gray-700">오늘의 자기주도 학습 점수</h3>
      </div>

      {/* 입력 — 슬라이더 + 숫자 + 메모 */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="flex-1 accent-amber-500"
            aria-label="자기주도 학습 점수"
          />
          <div className="w-16 text-center">
            <span className="text-2xl font-bold text-amber-600">{score}</span>
            <span className="text-xs text-gray-400">점</span>
          </div>
        </div>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="오늘 학습에서 꼭 기억해야 할 점을 메모해보세요"
          rows={2}
          className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-200"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full h-10 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 active:scale-[0.99] disabled:opacity-40 flex items-center justify-center gap-1.5"
        >
          <Save size={14} />
          {todayRecord ? '오늘 점수 다시 저장' : '오늘 점수 저장'}
        </button>
      </div>

      {/* 좌: 최근 14일 추이 막대 / 우: 선택일 메모 */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <p className="text-[11px] font-bold text-gray-500 mb-1">최근 점수 추이</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v) => [`${v}점`, '자기평가']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                />
                <Bar
                  dataKey="score"
                  radius={[3, 3, 0, 0]}
                  onClick={(entry) => entry?.date && setSelectedDate(entry.date)}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.date}
                      fill={entry.date === selectedDate ? '#f59e0b' : '#fcd34d'}
                      cursor="pointer"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-500 mb-1">
              기억할 점 <span className="text-gray-400 font-normal">({selectedDate.slice(5).replace('-', '.')})</span>
            </p>
            <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-3 min-h-[100px]">
              {selectedRecord ? (
                <>
                  <p className="text-lg font-bold text-amber-600">{selectedRecord.score}점</p>
                  <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words">
                    {selectedRecord.memo || '메모가 없어요'}
                  </p>
                </>
              ) : (
                <p className="text-xs text-gray-400">이 날짜의 기록이 없어요. 막대를 눌러 다른 날을 볼 수 있어요.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
