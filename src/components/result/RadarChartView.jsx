import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { DOMAIN_LABELS, DOMAIN_ORDER } from '../../data/questions'
import './RadarChartView.css'

export default function RadarChartView({ domainScores }) {
  const data = DOMAIN_ORDER.map(domain => ({
    subject: DOMAIN_LABELS[domain],
    score: domainScores[domain] || 0,
    fullMark: 100,
  }))

  return (
    <div className="radar-chart-wrap">
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="#E5E7EB" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 12, fill: '#4B5563', fontWeight: 500 }}
          />
          <Radar
            name="점수"
            dataKey="score"
            stroke="#4F6EF7"
            fill="#4F6EF7"
            fillOpacity={0.25}
            strokeWidth={2}
          />
          <Tooltip
            formatter={(value) => [`${value}점`, '점수']}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #E5E7EB',
              fontSize: 13,
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
