import { NavLink, Outlet } from "react-router";
import { NAV_ITEMS } from "../../constants/navigation";
import { CONFIG } from "../../config";
import SyncStatus from "./SyncStatus";

export default function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="sidebar__brand">🔥 {CONFIG.APP_NAME}</div>
        <nav>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `nav-link${isActive ? " nav-link--active" : ""}`
              }
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="content">
        <SyncStatus />
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) =>
              `bottom-nav__item${isActive ? " bottom-nav__item--active" : ""}`
            }
          >
            <span className="bottom-nav__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
