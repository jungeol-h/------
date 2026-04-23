import Header from './Header.jsx'
import TabBar from './TabBar.jsx'

export default function PageLayout({ title, badge, tabs, children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header title={title} badge={badge} />
      <main className="max-w-lg mx-auto pt-14 pb-20 px-4 min-h-screen">
        {children}
      </main>
      <TabBar tabs={tabs} />
    </div>
  )
}
