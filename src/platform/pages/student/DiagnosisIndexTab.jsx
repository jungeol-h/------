import { Link } from 'react-router-dom'
import { Activity, Compass, ClipboardCheck, ChevronRight } from 'lucide-react'

const CARDS = [
  {
    to: '/student/diagnosis/learning',
    label: '학습진단',
    desc: '30문항으로 학습 역량 4단계 진단',
    icon: Activity,
    color: 'from-indigo-500 to-violet-500',
    iconBg: 'bg-indigo-100 text-indigo-600',
  },
  {
    to: '/student/diagnosis/career',
    label: '진로설계',
    desc: '동사·활동 기반 진로 흥미 탐색',
    icon: Compass,
    color: 'from-violet-500 to-purple-600',
    iconBg: 'bg-violet-100 text-violet-600',
  },
  {
    to: '/student/diagnosis/quiz',
    label: '확인평가',
    desc: '학년별 단답형 쪽지시험',
    icon: ClipboardCheck,
    color: 'from-emerald-500 to-teal-600',
    iconBg: 'bg-emerald-100 text-emerald-600',
  },
]

export default function DiagnosisIndexTab() {
  return (
    <div className="py-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">진단</h2>
        <p className="text-sm text-gray-500 mt-0.5">학습·진로·확인평가를 한 곳에서 진행하세요.</p>
      </div>

      <div className="space-y-3">
        {CARDS.map(({ to, label, desc, icon: Icon, iconBg }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm active:scale-[0.98] transition-all"
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBg}`}>
              <Icon size={22} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-800">{label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
            </div>
            <ChevronRight size={18} className="text-gray-300" />
          </Link>
        ))}
      </div>
    </div>
  )
}
