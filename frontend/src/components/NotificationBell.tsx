import { useState } from 'react'
import { Bell } from 'lucide-react'
import type { Notification } from '../types'

interface NotificationBellProps {
  notifications: Notification[]
  onMarkRead: (id: string) => void
}

export default function NotificationBell({ notifications, onMarkRead }: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const unreadCount = notifications.filter((n) => !n.readAt).length

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-[10px] border border-brand-border bg-white"
      >
        <Bell size={16.5} className="text-brand-muted" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-brand-amber" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="fixed top-16 right-4 z-20 w-80 max-w-[calc(100vw-2rem)] rounded-[10px] border border-brand-border bg-white shadow-[0_8px_24px_rgba(11,46,47,0.12)] md:absolute md:top-auto md:right-0 md:mt-1.5 md:max-w-none">
            <div className="border-b border-brand-border px-4 py-2 font-heading text-sm font-semibold text-brand-deep">
              Notifications
            </div>
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-brand-muted">Aucune notification.</p>
            ) : (
              <ul className="max-h-80 divide-y divide-brand-border overflow-y-auto">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={`px-4 py-3 text-sm ${n.readAt ? 'text-brand-muted' : 'text-brand-ink'}`}
                  >
                    <p>{n.message}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-brand-muted">
                        {new Date(n.sentAt).toLocaleString('fr-FR')}
                      </span>
                      {!n.readAt && (
                        <button
                          onClick={() => onMarkRead(n.id)}
                          className="text-xs font-medium text-brand-green hover:underline"
                        >
                          Marquer lu
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
