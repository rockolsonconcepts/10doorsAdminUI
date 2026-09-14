import { NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { Activity, AlertTriangle, Building2, Megaphone, Moon, Sun, LogOut, ClipboardCheck, Send, BookOpen, ListChecks, PenLine } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme/themeProvider';

const nav = [
  {
    section: 'Platform',
    items: [
      { to: '/', label: 'Overview', icon: Activity, end: true },
      { to: '/errors', label: 'Traced Errors', icon: AlertTriangle },
      { to: '/platform', label: 'Clients & Admins', icon: Building2 },
    ],
  },
  {
    section: 'Marketing Agent',
    items: [
      { to: '/marketing', label: 'Approval Queue', icon: ClipboardCheck, end: true },
      { to: '/marketing/publications', label: 'Publications', icon: Send },
      { to: '/marketing/activity', label: 'Agent Activity', icon: ListChecks },
      { to: '/marketing/reference', label: 'Reference Data', icon: BookOpen },
      { to: '/marketing/charter', label: 'Content Charter', icon: PenLine },
    ],
  },
];

export function Layout() {
  const { state, logout } = useAuth();
  const { mode, toggle } = useTheme();
  const email = state.status === 'signed-in' ? state.identity.email ?? state.identity.subjectId : '';

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-white/10 dark:bg-[#16161D]">
        <div className="flex items-center gap-2 px-5 py-4">
          <Megaphone className="h-5 w-5 text-blue-600" />
          <span className="font-semibold">10Doors Admin</span>
        </div>
        <nav className="flex-1 space-y-5 px-3 py-2">
          {nav.map((group) => (
            <div key={group.section}>
              <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.section}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm',
                      isActive
                        ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5',
                    )
                  }
                >
                  <item.icon className="h-4 w-4" /> {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
          <div className="truncate" title={email}>{email}</div>
          <div className="mt-2 flex items-center gap-3">
            <button onClick={toggle} className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100">
              {mode === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />} Theme
            </button>
            <button onClick={() => logout()} className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
