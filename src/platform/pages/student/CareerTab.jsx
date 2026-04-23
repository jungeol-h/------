export default function CareerTab() {
  return (
    <div className="py-6 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">진로 탐색</h2>
      <div className="bg-white rounded-2xl p-5 shadow-sm text-center space-y-3">
        <div className="text-5xl">🎯</div>
        <h3 className="font-bold text-gray-800">자기주도학습 진단</h3>
        <p className="text-sm text-gray-500">학습 습관과 강점을 파악하고 진로 방향을 탐색해 보세요</p>
        <button className="w-full py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 active:scale-95 transition-all">
          진단 시작하기
        </button>
      </div>
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h4 className="font-semibold text-gray-800 mb-3">진로 활동 기록</h4>
        <div className="space-y-2 text-sm text-gray-500">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span>이공계 진로 탐색 세미나</span>
            <span className="text-gray-400">2026.04.15</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span>자기소개서 기초 특강</span>
            <span className="text-gray-400">2026.04.10</span>
          </div>
        </div>
      </div>
    </div>
  )
}
