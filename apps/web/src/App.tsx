import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import { AppShell } from './components/AppShell';
import { EntityProvider } from './entity/EntityProvider';
import { NAVIGATION } from './navigation';
import { AccountsPage } from './pages/AccountsPage';
import { JournalEditorPage } from './pages/JournalEditorPage';
import { JournalsPage } from './pages/JournalsPage';
import { LoginPage } from './pages/LoginPage';
import { PeriodsPage } from './pages/PeriodsPage';
import { PlannedPage } from './pages/PlannedPage';
import { TrialBalancePage } from './pages/TrialBalancePage';

const planned = NAVIGATION.flatMap((s) => s.items).filter((i) => i.planned);

function Protected() {
  const { profile, loading } = useAuth();
  if (loading) return <p className="content">Loading…</p>;
  if (!profile) return <Navigate to="/login" replace />;
  return (
    <EntityProvider>
      <AppShell />
    </EntityProvider>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Protected />}>
        <Route index element={<Navigate to="/journals" replace />} />
        <Route path="/journals" element={<JournalsPage />} />
        <Route path="/journals/new" element={<JournalEditorPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/periods" element={<PeriodsPage />} />
        <Route path="/reports/trial-balance" element={<TrialBalancePage />} />
        {planned.map((item) => (
          <Route key={item.path} path={item.path} element={<PlannedPage item={item} />} />
        ))}
        <Route path="*" element={<Navigate to="/journals" replace />} />
      </Route>
    </Routes>
  );
}
