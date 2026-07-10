import StatisticsSection from '../../components/admin/StatisticsSection.jsx'

// 구 관리자 '통계' 탭 — 콘텐츠는 StatisticsSection으로 이동해 관리자 홈 하단에 임베드됨.
// 이 래퍼는 뷰어(ViewerDashboard) 통계 라우트에서 계속 사용한다.
export default function StatisticsTab() {
  return (
    <div className="py-6">
      <StatisticsSection />
    </div>
  )
}
