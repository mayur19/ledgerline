import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { JournalSummary } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { useEntity } from '../entity/EntityProvider';
import { useLoad } from './useLoad';

export function JournalsPage() {
  const { current } = useEntity();
  const { can } = useAuth();
  const { data, error, reload } = useLoad(current?.id ?? null, () =>
    api.get<JournalSummary[]>(`/entities/${current!.id}/journals?limit=100`),
  );
  if (!current) return <p>No entity selected.</p>;

  const post = async (id: string) => {
    await api
      .post(`/entities/${current.id}/journals/${id}/post`)
      .catch((e: unknown) => alert(String(e)));
    reload();
  };

  return (
    <section>
      <div className="page-head">
        <h1>Journals</h1>
        {can('journal.create') && (
          <Link className="button" to="/journals/new">
            New journal
          </Link>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      <table className="table">
        <thead>
          <tr>
            <th>Number</th>
            <th>Date</th>
            <th>Memo</th>
            <th>Status</th>
            <th className="num">Amount ({current.functionalCurrency})</th>
            <th>Prepared by</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((j) => (
            <tr key={j.id}>
              <td>{j.entryNumber ?? '—'}</td>
              <td>{j.entryDate}</td>
              <td>{j.memo}</td>
              <td>
                <span className={`status ${j.status}`}>{j.status}</span>
              </td>
              <td className="num">{j.totalDebit}</td>
              <td>{j.createdBy?.displayName}</td>
              <td>
                {j.status === 'draft' && can('journal.post') && (
                  <button type="button" className="small" onClick={() => void post(j.id)}>
                    Post
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
