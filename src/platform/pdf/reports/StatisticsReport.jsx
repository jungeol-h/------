import { View } from '@react-pdf/renderer'
import PageWrapper from '../components/PageWrapper'
import Section from '../components/Section'
import Table from '../components/Table'
import KpiGrid from '../components/KpiGrid'
import ChartImage from '../components/ChartImage'

export default function StatisticsReport({
  monthlyStats,
  chartImages,
  period,
  generatedAt,
  author,
}) {
  const latest = monthlyStats[monthlyStats.length - 1] || {}

  const kpiItems = [
    { label: `${latest.month || '-'} 센터 이용시간`, value: latest.centerHours ?? '-', unit: '시간' },
    { label: `${latest.month || '-'} 자기주도지수`, value: latest.selfIndex ?? '-', unit: '점' },
    { label: `${latest.month || '-'} 마인드 기록`, value: latest.mindTotal ?? '-', unit: '건' },
    { label: `${latest.month || '-'} 과제 이행률`, value: `${latest.taskRate ?? '-'}%` },
  ]

  const centerHoursColumns = [
    { key: 'month', header: '월', width: '60%' },
    { key: 'centerHours', header: '이용시간 (시간)', width: '40%', align: 'right' },
  ]

  const selfIndexColumns = [
    { key: 'month', header: '월', width: '60%' },
    { key: 'selfIndex', header: '자기주도지수 (점)', width: '40%', align: 'right' },
  ]

  const periodLabel = monthlyStats.length > 0
    ? `${monthlyStats[0].month} ~ ${monthlyStats[monthlyStats.length - 1].month}`
    : period

  return (
    <PageWrapper
      reportTitle="월간 통계 보고서"
      period={period || periodLabel}
      generatedAt={generatedAt}
      author={author}
    >
      <Section title={`이번 달 핵심 지표 (${latest.month || '-'})`}>
        <KpiGrid items={kpiItems} columns={4} />
      </Section>

      <Section title="월간 센터 이용시간">
        <ChartImage
          src={chartImages?.centerHours}
          height={180}
          caption="단위: 시간"
          fallback="차트를 캡처하지 못해 아래 표로 대체합니다."
        />
        <View style={{ marginTop: 8 }} />
        <Table
          columns={centerHoursColumns}
          rows={monthlyStats.map((m) => ({ key: m.month, month: m.month, centerHours: m.centerHours }))}
        />
      </Section>

      <Section title="자기주도지수 추이">
        <ChartImage
          src={chartImages?.selfIndex}
          height={180}
          caption="단위: 점 (100점 만점)"
          fallback="차트를 캡처하지 못해 아래 표로 대체합니다."
        />
        <View style={{ marginTop: 8 }} />
        <Table
          columns={selfIndexColumns}
          rows={monthlyStats.map((m) => ({ key: m.month, month: m.month, selfIndex: m.selfIndex }))}
        />
      </Section>
    </PageWrapper>
  )
}
