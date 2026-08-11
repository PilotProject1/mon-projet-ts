import { NavLink, Outlet } from 'react-router-dom'
import NotificationBell from './NotificationBell'
import BrandLogo from './BrandLogo'
import AmbientBackground from './AmbientBackground'
import type { Notification } from '../types'

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/documents', label: 'Documents' },
  { to: '/echeances', label: 'Échéances' },
  { to: '/contrats', label: 'Contrats' },
]

interface LayoutProps {
  onLogout: () => void
  notifications: Notification[]
  onMarkRead: (id: string) => void
}

export default function Layout({ onLogout, notifications, onMarkRead }: LayoutProps) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-brand-mint">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <AmbientBackground variant="app" />
      </div>

      <header className="relative z-10 border-b border-brand-border bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <BrandLogo />
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-medium ${
                    isActive
                      ? 'brand-gradient text-white'
                      : 'text-brand-muted hover:bg-brand-mint hover:text-brand-deep'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <NotificationBell notifications={notifications} onMarkRead={onMarkRead} />
            <button
              onClick={onLogout}
              className="ml-2 rounded-md px-3 py-2 text-sm font-medium text-brand-danger hover:bg-brand-mint"
            >
              Déconnexion
            </button>
          </nav>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
