import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useEntity } from '../entity/EntityProvider';
import { NAVIGATION } from '../navigation';

export function AppShell() {
  const { profile, logout } = useAuth();
  const { entities, current, select } = useEntity();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Ledgerline</div>
        <label className="entity-picker">
          <span>Entity</span>
          <select
            value={current?.id ?? ''}
            onChange={(e) => select(e.target.value)}
            aria-label="Entity"
          >
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.code} · {e.functionalCurrency}
              </option>
            ))}
          </select>
        </label>
        <nav aria-label="Main">
          {NAVIGATION.map((section) => (
            <div key={section.title} className="nav-section">
              <h2>{section.title}</h2>
              {section.items.map((item) => (
                <NavLink key={item.path} to={item.path} end className="nav-link">
                  {item.label}
                  {item.planned && <span className="badge">Planned</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <span>{current ? `${current.name} (${current.code})` : 'No entity yet'}</span>
          <span className="spacer" />
          <span className="muted">
            {profile?.user.displayName} · {profile?.role}
          </span>
          <button type="button" className="link" onClick={() => void logout()}>
            Sign out
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
