import { CURRENCY_CODES } from '@ledgerline/shared';
import type { Account } from '../api/types';
import type { DraftLine } from './summary';

interface Props {
  lines: readonly DraftLine[];
  accounts: readonly Account[];
  onChange: (lines: DraftLine[]) => void;
}

export function JournalLinesEditor({ lines, accounts, onChange }: Props) {
  const postable = accounts.filter((a) => a.isPostable && a.isActive);
  const update = (key: string, patch: Partial<DraftLine>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: string) => onChange(lines.filter((l) => l.key !== key));

  return (
    <table className="table lines">
      <thead>
        <tr>
          <th>#</th>
          <th>Account</th>
          <th>Side</th>
          <th>Amount</th>
          <th>Currency</th>
          <th>Rate (optional)</th>
          <th>Memo</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {lines.map((line, index) => (
          <tr key={line.key}>
            <td>{index + 1}</td>
            <td>
              <select
                aria-label={`Account line ${index + 1}`}
                value={line.accountId}
                onChange={(e) => update(line.key, { accountId: e.target.value })}
              >
                <option value="">Select…</option>
                {postable.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} {a.name}
                  </option>
                ))}
              </select>
            </td>
            <td>
              <select
                aria-label={`Side line ${index + 1}`}
                value={line.side}
                onChange={(e) => update(line.key, { side: e.target.value as DraftLine['side'] })}
              >
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
              </select>
            </td>
            <td>
              <input
                aria-label={`Amount line ${index + 1}`}
                inputMode="decimal"
                value={line.amount}
                onChange={(e) => update(line.key, { amount: e.target.value })}
              />
            </td>
            <td>
              <select
                aria-label={`Currency line ${index + 1}`}
                value={line.currency}
                onChange={(e) => update(line.key, { currency: e.target.value })}
              >
                {CURRENCY_CODES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </td>
            <td>
              <input
                aria-label={`Rate line ${index + 1}`}
                value={line.rate}
                onChange={(e) => update(line.key, { rate: e.target.value })}
              />
            </td>
            <td>
              <input
                aria-label={`Memo line ${index + 1}`}
                value={line.memo}
                onChange={(e) => update(line.key, { memo: e.target.value })}
              />
            </td>
            <td>
              <button
                type="button"
                className="link"
                onClick={() => remove(line.key)}
                disabled={lines.length <= 2}
              >
                Remove
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
