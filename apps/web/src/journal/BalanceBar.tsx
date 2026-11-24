import type { DraftSummary } from './summary';

export function BalanceBar({ summary }: { summary: DraftSummary }) {
  if (summary.totals.length === 0)
    return <p className="muted">Enter amounts to see the running balance.</p>;
  return (
    <div className="balance-bar" aria-live="polite">
      {summary.totals.map((t) => (
        <div
          key={t.currency}
          className={t.balanced ? 'balance ok' : 'balance off'}
          data-testid={`balance-${t.currency}`}
        >
          <strong>{t.currency}</strong>
          <span>Debit {t.debit}</span>
          <span>Credit {t.credit}</span>
          <span>{t.balanced ? 'Balanced' : `Out by ${t.difference}`}</span>
        </div>
      ))}
      {summary.invalidLines.length > 0 && (
        <div className="balance off">Check amounts on line {summary.invalidLines.join(', ')}</div>
      )}
    </div>
  );
}
