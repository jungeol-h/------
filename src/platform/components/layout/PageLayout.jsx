import Header from './Header.jsx'
import TabBar from './TabBar.jsx'

export default function PageLayout({ title, badge, tabs, children }) {
  return (
    <div className="min-h-screen bg-gray-50 print:min-h-0 print:bg-white">
      <Header title={title} badge={badge} />
      <main className="max-w-lg mx-auto pt-14 pb-20 px-4 min-h-screen print:max-w-none print:mx-0 print:pt-0 print:pb-0 print:px-0 print:min-h-0">
        {children}
      </main>
      <TabBar tabs={tabs} />
    </div>
  )
}
