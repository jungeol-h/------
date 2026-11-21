import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { ORG_NAME } from '../config/meta'
import { SUMMARY_TEXT_LIMITS } from '../../context/selectors/growthReport.js'

// 종합성장 요약 리포트 (1쪽, A4 가로) — 2026-11 클라이언트 서식.
// 회색 배경 + 둥근 흰 카드(검은 하단 그림자) + 색 알약 라벨. 차트는 캡처 없이 View로 직접 그린다.
// 상세 리포트(GrowthReport)와 별개 — 클라이언트가 둘 다 유지하기로 함.
// 반드시 1페이지: 카드는 고정 높이 + overflow hidden, 긴 글은 글자 수에 따라 폰트를 줄인다
// (권장 글자수 SUMMARY_TEXT_LIMITS는 모달이 같은 값을 안내). 페이지번호 render 콜백 금지(pdf/README).
// DataContext 의존 금지 — 순수 props만.
// props: {
//   title, student: { name, school, grade }, generatedAt, author,
//   usage: { title, totalMinutes, bars: [{label, minutes}] },
//   study: { totalMinutes, selfIndex, subjectDist, methodDist },
//   coachingText, examTrend: { bars: [{label, score}] }, actionPlanText,
//   careerText, diagnosisText,
//   subjects: [{ name, count, text }]  // 수학·영어·과학·국어 순
// }

const SUBJECT_PILL = { 수학: '#9FA8DA', 영어: '#2FA597', 과학: '#9C2FB0', 국어: '#7CB342' }
const SUBJECT_TITLE = { 수학: '수학 교과 코칭', 영어: '영어교과 코칭', 과학: '과학 교과 코칭', 국어: '국어 교과 코칭' }
const BG = '#DCDDE1'
const INK = '#111111'

const s = StyleSheet.create({
  page: { backgroundColor: BG, padding: 18, fontFamily: 'Pretendard' },
  root: { height: 559, overflow: 'hidden' },
  header: { height: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: 700, color: '#D35400' },
  infoRow: { flexDirection: 'row' },
  infoBox: { backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, height: 26, justifyContent: 'center', marginLeft: 8, minWidth: 90 },
  infoText: { fontSize: 11, fontWeight: 700, color: INK },
  topRow: { height: 292, flexDirection: 'row', marginBottom: 8 },
  bottomRow: { height: 189, flexDirection: 'row' },
  col: { flex: 1, marginRight: 8 },
  // 검은 그림자 = 뒤에 깔린 검정 박스를 아래로 3pt 비워 드러냄
  shadow: { backgroundColor: INK, borderRadius: 10, paddingBottom: 3 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 7, overflow: 'hidden' },
  pillRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  pill: { borderRadius: 9, paddingHorizontal: 9, paddingVertical: 2 },
  pillText: { fontSize: 9, fontWeight: 700, color: '#fff' },
  count: { fontSize: 9, fontWeight: 700, color: INK },
  small: { fontSize: 7, color: '#6b7280' },
  chartArea: { flexDirection: 'row', alignItems: 'flex-end', flex: 1, borderBottomWidth: 0.7, borderBottomColor: '#9ca3af', borderBottomStyle: 'solid' },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  barVal: { fontSize: 6.5, color: INK, marginBottom: 1 },
  barLabelRow: { flexDirection: 'row', marginTop: 2 },
  barLabel: { flex: 1, fontSize: 6.5, textAlign: 'center', color: INK },
})

const fmtH = (min) => {
  const m = Math.round(Number(min) || 0)
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h > 0) return r > 0 ? `${h}시간 ${r}분` : `${h}시간`
  return `${r}분`
}
// 막대 위 값 라벨은 좁아서 시간 단위(소수 1자리)로 줄여 쓴다
const fmtHShort = (min) => (min > 0 ? `${Math.round(min / 6) / 10}h` : '')

// 글자 수 대비 폰트 축소 — 카드 고정 크기에 맞춰 최소 5pt까지.
const BASE = 8.5
function fitSize(text, cap) {
  const len = String(text ?? '').length
  if (len <= cap) return BASE
  return Math.max(5, Math.round(BASE * Math.sqrt(cap / len) * 10) / 10)
}

function Card({ title, color, right, style, children }) {
  return (
    <View style={[s.shadow, style]}>
      <View style={[s.card, { flex: 1 }]}>
        <View style={s.pillRow}>
          <View style={[s.pill, { backgroundColor: color }]}><Text style={s.pillText}>{title}</Text></View>
          {right ? <Text style={s.count}>{right}</Text> : null}
        </View>
        {children}
      </View>
    </View>
  )
}

function BodyText({ text, cap, empty = '내용 없음' }) {
  const t = String(text ?? '').trim()
  if (!t) return <Text style={[s.small, { fontSize: 8.5 }]}>{empty}</Text>
  const size = fitSize(t, cap)
  return <Text style={{ fontSize: size, lineHeight: 1.35, color: INK }}>{t}</Text>
}

// 교과 코칭 칸 — '날짜 · 주제' 줄 목록이라 글자 수가 아니라 '줄 수(줄바꿈 포함)'가 넘침을 좌우한다.
// 카드 안쪽 폭·높이(pt)에 맞을 때까지 폰트를 줄인다. 폭은 글자 종류별 대략치로 추정
// (Pretendard: 한글 ≈0.92em, 영숫자 ≈0.56em, 공백 ≈0.26em) — 실측 렌더로 보정함.
const SUBJECT_BOX = { width: 178, height: 148 }
const LINE_HEIGHT = 1.3
function textWidthEm(str) {
  let w = 0
  for (const ch of str) {
    if (ch === ' ') w += 0.26
    else if (/[\u3131-\uD79D]/.test(ch)) w += 0.92
    else if (/[.,·:;'"()[\]/-]/.test(ch)) w += 0.32
    else w += 0.56
  }
  return w
}
function fitLinesSize(lines, { width, height }, max = 8.5, min = 4.6) {
  for (let size = max; size > min; size = Math.round((size - 0.1) * 10) / 10) {
    const perLine = width / size // 한 줄에 들어가는 em 수
    const rows = lines.reduce((n, l) => n + Math.max(1, Math.ceil(textWidthEm(l) / perLine)), 0)
    if (rows * size * LINE_HEIGHT <= height) return size
  }
  return min
}

function LinesText({ text, empty }) {
  const t = String(text ?? '').trim()
  if (!t) return <Text style={[s.small, { fontSize: 8.5 }]}>{empty}</Text>
  const size = fitLinesSize(t.split('\n'), SUBJECT_BOX)
  return <Text style={{ fontSize: size, lineHeight: LINE_HEIGHT, color: INK }}>{t}</Text>
}

// 세로 막대 차트 — value 최대값 기준 비율 (scaleMax 지정 시 그 값 기준)
function Bars({ bars, color, fmt, scaleMax }) {
  const max = scaleMax ?? Math.max(1, ...bars.map((b) => b.value ?? 0))
  return (
    <View style={{ flex: 1 }}>
      <View style={s.chartArea}>
        {bars.map((b, i) => (
          <View key={i} style={s.barCol}>
            {b.value != null && b.value > 0 ? <Text style={s.barVal}>{fmt(b.value)}</Text> : null}
            <View
              style={{
                width: Math.min(26, 150 / bars.length),
                height: `${b.value != null && b.value > 0 ? Math.max(2, (b.value / max) * 82) : 0}%`,
                backgroundColor: color,
              }}
            />
          </View>
        ))}
      </View>
      <View style={s.barLabelRow}>
        {bars.map((b, i) => <Text key={i} style={s.barLabel}>{b.label}</Text>)}
      </View>
    </View>
  )
}

export default function GrowthSummaryReport({
  title = 'NAVI',
  student = {},
  generatedAt,
  author,
  usage = { title: '센터 이용시간', totalMinutes: 0, bars: [] },
  study = { totalMinutes: 0, selfIndex: null, subjectDist: [], methodDist: [] },
  coachingText = '',
  examTrend = { bars: [] },
  actionPlanText = '',
  careerText = '',
  diagnosisText = '',
  subjects = [],
}) {
  const top = (dist) => dist.slice(0, 3).map((d) => `${d.name} ${fmtH(d.minutes)}`).join(', ')
  const studyLines = [
    `총 학습시간  ${fmtH(study.totalMinutes)}`,
    `자기주도지수  ${study.selfIndex == null ? '-' : `${study.selfIndex}점`}`,
    study.subjectDist.length > 0 ? `주요 과목  ${top(study.subjectDist)}` : null,
    study.methodDist.length > 0 ? `주요 학습법  ${top(study.methodDist)}` : null,
  ].filter(Boolean)

  return (
    <Document
      title={`${title} 요약 리포트 (${generatedAt})`}
      author={author}
      creator={ORG_NAME}
      producer={ORG_NAME}
    >
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.root}>
          <View style={s.header}>
            <Text style={s.title}>{title}</Text>
            <View style={s.infoRow}>
              <View style={s.infoBox}><Text style={s.infoText}>이름: {student.name ?? ''}</Text></View>
              <View style={s.infoBox}><Text style={s.infoText}>학교: {student.school ?? ''}</Text></View>
              <View style={[s.infoBox, { minWidth: 70 }]}><Text style={s.infoText}>학년: {student.grade ?? ''}</Text></View>
            </View>
          </View>

          <View style={s.topRow}>
            {/* 1열: 센터 이용시간 */}
            <Card title="센터 이용시간" color="#3B4BA8" style={s.col} right={`총 ${fmtH(usage.totalMinutes)}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#E4572E', marginRight: 3 }} />
                <Text style={s.small}>총 이용시간 ({usage.title})</Text>
              </View>
              <Bars
                bars={usage.bars.map((b) => ({ label: b.label, value: b.minutes }))}
                color="#E4572E"
                fmt={fmtHShort}
              />
            </Card>

            {/* 2열: 학습통계 / 학습코칭 */}
            <View style={s.col}>
              <Card title="학습통계" color="#0E6E5E" style={{ flex: 1, marginBottom: 8 }}>
                {studyLines.map((l, i) => (
                  <Text key={i} style={{ fontSize: 8.5, lineHeight: 1.45, color: INK }}>{l}</Text>
                ))}
              </Card>
              <Card title="학습코칭" color="#138A78" style={{ flex: 1.25 }}>
                <BodyText text={coachingText} cap={SUMMARY_TEXT_LIMITS.coaching} />
              </Card>
            </View>

            {/* 3열: 내신 피드백 */}
            <Card title="내신 피드백" color="#5B1E7A" style={s.col}>
              <Text style={[s.small, { color: INK, fontWeight: 700, marginBottom: 2 }]}>
                성적추이 <Text style={{ fontWeight: 400, color: '#6b7280' }}>(과목 평균)</Text>
              </Text>
              <View style={{ height: 110 }}>
                <Bars
                  bars={examTrend.bars.map((b) => ({ label: b.label, value: b.score }))}
                  color="#7B3FA0"
                  fmt={(v) => String(v)}
                  scaleMax={100}
                />
              </View>
              <Text style={[s.small, { color: INK, fontWeight: 700, marginTop: 6, marginBottom: 2 }]}>보완과 실천과제</Text>
              <BodyText text={actionPlanText} cap={SUMMARY_TEXT_LIMITS.actionPlan} />
            </Card>

            {/* 4열: 진로진단 / 학습진단 */}
            <View style={[s.col, { marginRight: 0 }]}>
              <Card title="진로진단" color="#476B2B" style={{ flex: 1, marginBottom: 8 }}>
                <BodyText text={careerText} cap={SUMMARY_TEXT_LIMITS.career} />
              </Card>
              <Card title="학습진단" color="#5A8A30" style={{ flex: 1 }}>
                <BodyText text={diagnosisText} cap={SUMMARY_TEXT_LIMITS.diagnosis} />
              </Card>
            </View>
          </View>

          <View style={s.bottomRow}>
            {subjects.map((sub, i) => (
              <Card
                key={sub.name}
                title={SUBJECT_TITLE[sub.name] ?? sub.name}
                color={SUBJECT_PILL[sub.name] ?? '#6b7280'}
                right={`총 ${sub.count}회`}
                style={[s.col, i === subjects.length - 1 ? { marginRight: 0 } : null]}
              >
                <LinesText text={sub.text} empty="기간 내 코칭 기록 없음" />
              </Card>
            ))}
          </View>
        </View>
      </Page>
    </Document>
  )
}
