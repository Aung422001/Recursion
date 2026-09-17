import { NavLink, Outlet, Link } from 'react-router-dom';
import { LANGUAGES } from 'shared/constants.js';
import { useAuth } from '../hooks/useAuth';
import { Button } from './Button';
import { LanguageBadge } from './LanguageBadge';

const navItems = [
  { to: '/', label: 'Learn', icon: '🏠', end: true },
  { to: '/review', label: 'Review', icon: '🔁' },
  { to: '/alphabet', label: 'Script', icon: '🔤' },
  { to: '/words', label: 'Words', icon: '📖' },
  { to: '/profile', label: 'Profile', icon: '👤' },
];

export function Layout() {
  const { user, dueCount, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
          <Link to="/" className="flex items-center gap-2 font-extrabold tracking-tight">
            <span aria-hidden="true">🗣️</span>
            <span className="hidden sm:inline">Recursion</span>
          </Link>

          <CourseSwitcher user={user} />

          <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Main">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `relative rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {item.label}
                {item.to === '/review' && dueCount > 0 && <Badge count={dueCount} />}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 md:ml-0">
            <div className="hidden items-center gap-3 text-sm font-semibold sm:flex">
              <span className="text-amber-600" title="Day streak">
                🔥 {user?.currentStreak ?? 0}
              </span>
              <span className="text-emerald-600" title="Total XP">
                ⭐ {user?.xp ?? 0}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={logout}>
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 md:pb-6">
        <Outlet />
      </main>

      {/* Mobile tab bar — this is a phone-first product category. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white md:hidden"
        aria-label="Main"
      >
        <div className="mx-auto flex max-w-lg">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
                  isActive ? 'text-emerald-700' : 'text-slate-500'
                }`
              }
            >
              <span aria-hidden="true" className="text-lg">
                {item.icon}
              </span>
              {item.label}
              {item.to === '/review' && dueCount > 0 && <Badge count={dueCount} />}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

/** Shows the active pair and doubles as the way into the course picker. */
function CourseSwitcher({ user }) {
  if (!user) return null;
  const source = LANGUAGES[user.sourceLang];
  const target = LANGUAGES[user.targetLang];
  if (!source || !target) return null;

  return (
    <Link
      to="/courses"
      title={`Studying ${target.name} from ${source.name} — tap to change`}
      className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1.5
        text-sm font-medium transition-colors hover:border-slate-300 hover:bg-slate-50"
    >
      <LanguageBadge code={user.targetLang} />
      <span className="hidden sm:inline">{target.name}</span>
      <span className="text-xs text-slate-400">▾</span>
      <span className="sr-only">
        Studying {target.name} from {source.name}. Change course.
      </span>
    </Link>
  );
}

function Badge({ count }) {
  return (
    <span className="absolute right-0 top-0 min-w-[18px] rounded-full bg-rose-500 px-1 text-[11px] font-bold leading-[18px] text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}
