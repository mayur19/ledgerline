import { useState } from 'react';
import { api } from '../api/client';
import type { TrialBalance } from '../api/types';
import { useEntity } from '../entity/EntityProvider';
import { TrialBalanceTable } from './TrialBalanceTable';
import { useLoad } from './useLoad';

export function TrialBalancePage() {
  const { current } = useEntity();
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [from, setFrom] = useState('');
  const [includeZero, setIncludeZero] = useState(false);
  const query = new URLSearchParams({
    to,
    includeZero: String(includeZero),
    ...(from ? { from } : {}),
  }).toString();
  const { data, error } = useLoad(current ? `${current.id}?${query}` : null, () =>
    api.get<TrialBalance>(`/entities/${current!.id}/reports/trial-balance?${query}`),
  );
  if (!current) return <p>No entity selected.</p>;
  return (
    <section>
      <h1>Trial balance · {current.code}</h1>
      <div className="inline-form">
        <label>
          From (default: fiscal year start)
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={includeZero}
            onChange={(e) => setIncludeZero(e.target.checked)}
          />{' '}
          Show zero balances
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      {data && (
        <>
          <p className={data.isBalanced ? 'info' : 'error'}>
            FY{data.fiscalYear} · {data.from} to {data.to} ·{' '}
            {data.isBalanced ? 'Balanced' : 'OUT OF BALANCE'} · prior-year earnings{' '}
            {data.priorYearEarnings}
          </p>
          <TrialBalanceTable report={data} />
        </>
      )}
    </section>
  );
}
