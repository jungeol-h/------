import './ResultTabNav.css'

const TABS = [
  { id: 1, label: '요약' },
  { id: 2, label: '상세 분석' },
  { id: 3, label: '코칭' },
]

export default function ResultTabNav({ activeTab, onChange }) {
  return (
    <div className="result-tab-nav">
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={`result-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
