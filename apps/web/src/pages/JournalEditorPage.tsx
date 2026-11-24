import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import type { Account } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { useEntity } from '../entity/EntityProvider';
import { BalanceBar } from '../journal/BalanceBar';
import { JournalLinesEditor } from '../journal/JournalLinesEditor';
import { emptyLine, summarizeDraft, type DraftLine } from '../journal/summary';
import { useLoad } from './useLoad';

interface Preview {
  totalDebit: string;
  roundingAdjustment: string;
  period: { name: string; status: string };
}

const today = () => new Date().toISOString().slice(0, 10);

export function JournalEditorPage() {
  const { current } = useEntity();
  const { can } = useAuth();
  const navigate = useNavigate();
  const { data: accounts } = useLoad(current?.id ?? null, () =>
    api.get<Account[]>(`/entities/${current!.id}/accounts`),
  );
  const currency = current?.functionalCurrency ?? 'USD';
  const [entryDate, setEntryDate] = useState(today);
  const [memo, setMemo] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<DraftLine[]>(() => [
    emptyLine(currency, 'debit'),
    emptyLine(currency, 'credit'),
  ]);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const summary = useMemo(() => summarizeDraft(lines), [lines]);

  if (!current) return <p>No entity selected.</p>;

  const payload = () => ({
    entryDate,
    memo,
    ...(reference ? { reference } : {}),
    lines: lines.map((l) => ({
      accountId: l.accountId,
      side: l.side,
      amount: l.amount,
      currency: l.currency,
      ...(l.rate ? { rate: l.rate } : {}),
      ...(l.memo ? { memo: l.memo } : {}),
    })),
  });

  const preview = async () => {
    try {
      const result = await api.post<Preview>(`/entities/${current.id}/journals/preview`, payload());
      const rounding =
        result.roundingAdjustment !== '0.00' ? `, rounding ${result.roundingAdjustment}` : '';
      setMessage({
        kind: 'info',
        text: `Valid for ${result.period.name} (${result.period.status}): ${result.totalDebit} ${currency}${rounding}`,
      });
    } catch (e) {
      setMessage({ kind: 'error', text: errorMessage(e) });
    }
  };

  const save = async (event: FormEvent, post: boolean) => {
    event.preventDefault();
    try {
      await api.post(`/entities/${current.id}/journals`, { ...payload(), post });
      navigate('/journals');
    } catch (e) {
      setMessage({ kind: 'error', text: errorMessage(e) });
    }
  };

  return (
    <section>
      <h1>New journal · {current.code}</h1>
      <form onSubmit={(e) => void save(e, false)}>
        <div className="inline-form">
          <label>
            Date
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              required
            />
          </label>
          <label className="grow">
            Memo
            <input value={memo} onChange={(e) => setMemo(e.target.value)} required />
          </label>
          <label>
            Reference
            <input value={reference} onChange={(e) => setReference(e.target.value)} />
          </label>
        </div>
        <JournalLinesEditor lines={lines} accounts={accounts ?? []} onChange={setLines} />
        <button
          type="button"
          className="link"
          onClick={() => setLines([...lines, emptyLine(currency)])}
        >
          + Add line
        </button>
        <BalanceBar summary={summary} />
        {message && (
          <p className={message.kind === 'error' ? 'error' : 'info'} role="status">
            {message.text}
          </p>
        )}
        <div className="actions">
          <button type="button" className="secondary" onClick={() => void preview()}>
            Check
          </button>
          <button type="submit" className="secondary">
            Save draft
          </button>
          {can('journal.post') && (
            <button
              type="button"
              onClick={(e) => void save(e, true)}
              disabled={!summary.balancedPerCurrency && summary.totals.length < 2}
            >
              Post
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
