import { api } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { useEntity } from '../entity/EntityProvider';
import { useLoad } from './useLoad';

interface Period {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'open' | 'soft_closed' | 'closed';
}

const NEXT: Record<Period['status'], { to: Period['status']; label: string }[]> = {
  open: [{ to: 'soft_closed', label: 'Soft-close' }],
  soft_closed: [
    { to: 'open', label: 'Re-open' },
    { to: 'closed', label: 'Close' },
  ],
  closed: [],
};

export function PeriodsPage() {
  const { current } = useEntity();
  const { can } = useAuth();
  const { data, error, reload } = useLoad(current?.id ?? null, () =>
    api.get<Period[]>(`/entities/${current!.id}/periods`),
  );
  if (!current) return <p>No entity selected.</p>;
  const move = async (id: string, to: string) => {
    await api
      .post(`/entities/${current.id}/periods/${id}/transition`, { to })
      .catch((e: unknown) => alert(String(e)));
    reload();
  };
  return (
    <section>
      <h1>Accounting periods · {current.code}</h1>
      {error && <p className="error">{error}</p>}
      <table className="table">
        <thead>
          <tr>
            <th>Period</th>
            <th>From</th>
            <th>To</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.startDate}</td>
              <td>{p.endDate}</td>
              <td>
                <span className={`status ${p.status}`}>{p.status.replace('_', ' ')}</span>
              </td>
              <td>
                {can('period.manage') &&
                  NEXT[p.status].map((n) => (
                    <button
                      key={n.to}
                      type="button"
                      className="small"
                      onClick={() => void move(p.id, n.to)}
                    >
                      {n.label}
                    </button>
                  ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
