import { Suspense, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { NAV_ITEMS } from '../../constants/navigation';
import { CONFIG } from '../../config';
import { useTheme } from '../../hooks/useTheme';
import SyncStatus from './SyncStatus';
import UpdatePrompt from './UpdatePrompt';
import ReminderManager from './ReminderManager';
import ConfigBanner from './ConfigBanner';
import ErrorBoundary from './ErrorBoundary';

const TITLES = [
  [/^\/habits\/new/, 'New habit'],
  [/^\/habits\/[^/]+\/edit/, 'Edit habit'],
  [/^\/habits\/[^/]+/, 'Habit'],
  [/^\/habits/, 'Habits'],
  [/^\/timer/, 'Timer'],
  [/^\/quantity/, 'Stats'],
  [/^\/progress/, 'Progress'],
  [/^\/calendar/, 'Calendar'],
  [/^\/checkin/, 'Day check-in'],
  [/^\/schedule/, 'Schedule'],
  [/^\/settings/, 'Settings'],
];

export default function Layout() {
  useTheme();
  const { pathname } = useLocation();
  const mainRef = useRef(null);
  const first = useRef(true);

  // On every screen change: update the title, scroll up, and move focus to the page (screen readers announce it).
  useEffect(() => {
    const hit = TITLES.find(([re]) => re.test(pathname));
    document.title = pathname === '/' || !hit ? CONFIG.APP_NAME : `${hit[1]} · ${CONFIG.APP_NAME}`;
    if (first.current) { first.current = false; return; }
    window.scrollTo(0, 0);
    if (mainRef.current) mainRef.current.focus({ preventScroll: true });
  }, [pathname]);

  const skip = () => { if (mainRef.current) mainRef.current.focus(); };

  return (
    <div className="app-shell">
      {/* A button, not a #link: a hash link would change the HashRouter route. */}
      <button type="button" className="btn skip-link" onClick={skip}>Skip to content</button>

      <aside className="sidebar" aria-label="Primary">
        <div className="sidebar__brand">🔥 {CONFIG.APP_NAME}</div>
        <nav>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <main id="main" ref={mainRef} tabIndex={-1} className="content">
        <UpdatePrompt />
        <ReminderManager />
        <ConfigBanner />
        <SyncStatus />
        <ErrorBoundary key={pathname}>
          <Suspense fallback={<p className="muted" role="status">Loading…</p>}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>

      <nav className="bottom-nav" aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`}
          >
            <span className="bottom-nav__icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
