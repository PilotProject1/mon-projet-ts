import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Search,
  FileText,
  Clock,
  FileSignature,
  Share2,
  Building2,
  Users,
  Receipt,
  ChevronDown,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import NotificationBell from './NotificationBell'
import BrandLogo from './BrandLogo'
import PlanUsageCard from './PlanUsageCard'
import AmbientBackground from './AmbientBackground'
import type { Notification, PlanUsage, User } from '../types'

const navGroups = [
  {
    label: 'Aperçu',
    items: [
      { to: '/', label: 'Dashboard', end: true, icon: LayoutDashboard },
      { to: '/recherche', label: 'Recherche', icon: Search },
    ],
  },
  {
    label: 'Gestion',
    items: [
      { to: '/documents', label: 'Documents', icon: FileText },
      { to: '/echeances', label: 'Échéances', icon: Clock },
      { to: '/contrats', label: 'Contrats', icon: FileSignature },
      { to: '/partages', label: 'Partages', icon: Share2 },
    ],
  },
  {
    label: 'Entreprise',
    items: [
      { to: '/entreprise', label: 'Entreprise', icon: Building2 },
      { to: '/clients', label: 'Clients', icon: Users },
      { to: '/factures', label: 'Factures', icon: Receipt },
    ],
  },
]

interface LayoutProps {
  user: User
  planUsage: PlanUsage | null
  onLogout: () => void
  notifications: Notification[]
  onMarkRead: (id: string) => void
}

export default function Layout({
  user,
  planUsage,
  onLogout,
  notifications,
  onMarkRead,
}: LayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-brand-mint">
      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setNavOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[232px] shrink-0 flex-col bg-brand-deep px-4 py-5.5 transition-transform duration-200 md:relative md:translate-x-0 ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-7.5 flex items-center justify-between gap-2.5 px-1.5">
          <BrandLogo iconSize={32} wordmarkClassName="text-[17px]" dark />
          <button
            onClick={() => setNavOpen(false)}
            className="text-white/60 hover:text-white md:hidden"
            aria-label="Fermer le menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-5.5 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="mb-2 px-2.5 text-[10.5px] font-semibold tracking-[0.08em] text-white/40 uppercase">
                {group.label}
              </div>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setNavOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13.5px] font-medium ${
                        isActive
                          ? 'bg-brand-green font-semibold text-white'
                          : 'text-white/75 hover:bg-white/10 hover:text-white'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          size={16.5}
                          strokeWidth={2}
                          className={isActive ? 'text-white' : 'text-white/65'}
                        />
                        {item.label}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {planUsage && (
          <div className="mt-3.5 border-t border-white/10 pt-3.5">
            <PlanUsageCard usage={planUsage} compact />
          </div>
        )}

        <div className="mt-3.5 border-t border-white/10 pt-3.5">
          <p className="px-2.5 text-[11.5px] leading-relaxed text-white/45">
            Vos documents, synchronisés.
            <br />
            Zéro papier.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 px-2.5">
            <Link to="/mentions-legales" className="text-[11px] text-white/40 hover:text-white/70">
              Mentions légales
            </Link>
            <Link to="/confidentialite" className="text-[11px] text-white/40 hover:text-white/70">
              Confidentialité
            </Link>
          </div>
        </div>
      </aside>

      <div className="relative flex-1 overflow-x-hidden">
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <AmbientBackground variant="app" />
        </div>

        <div className="relative z-20 flex items-center justify-between gap-3.5 px-4 pt-6 md:justify-end md:px-8">
          <button
            onClick={() => setNavOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-brand-border bg-white text-brand-deep md:hidden"
            aria-label="Ouvrir le menu"
          >
            <Menu size={18} />
          </button>

          <div className="flex items-center gap-3.5">
            <NotificationBell notifications={notifications} onMarkRead={onMarkRead} />
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-[10px] border border-brand-border bg-white py-1.5 pr-2.5 pl-1.5"
              >
                <span className="flex h-6.5 w-6.5 items-center justify-center rounded-full bg-brand-green font-heading text-xs font-semibold text-white">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <ChevronDown size={14} className="text-brand-muted" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-1.5 w-44 rounded-[10px] border border-brand-border bg-white p-1.5 shadow-[0_8px_24px_rgba(11,46,47,0.12)]">
                    <button
                      onClick={onLogout}
                      className="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-2 text-left text-sm text-brand-danger hover:bg-brand-mint"
                    >
                      <LogOut size={15} />
                      Déconnexion
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <main className="relative z-10 mx-auto max-w-6xl px-4 pt-4 pb-8 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
