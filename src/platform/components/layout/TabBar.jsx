import { NavLink } from 'react-router-dom'

export default function TabBar({ tabs }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] print:hidden">
      <div className="max-w-lg mx-auto flex">
        {tabs.map(({ path, label, icon: Icon, badge = 0 }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors ${
                isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="relative">
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-4 text-center">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </span>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
