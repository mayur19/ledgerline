import { ACCOUNT_TYPES, accountDepths, type AccountType } from '@ledgerline/shared';
import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '../api/client';
import type { Account } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { useEntity } from '../entity/EntityProvider';
import { useLoad } from './useLoad';

export function AccountsPage() {
  const { current } = useEntity();
  const { can } = useAuth();
  const { data, error, reload } = useLoad(current?.id ?? null, () =>
    api.get<Account[]>(`/entities/${current!.id}/accounts`),
  );
  const [form, setForm] = useState({
    code: '',
    name: '',
    type: 'expense' as AccountType,
    parentId: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  if (!current) return <p>Create an entity to manage its chart of accounts.</p>;
  const accounts = data ?? [];
  const depths = accountDepths(accounts);
  const headers = accounts.filter((a) => !a.isPostable && a.type === form.type);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    try {
      await api.post(`/entities/${current.id}/accounts`, {
        ...form,
        parentId: form.parentId || null,
      });
      setForm({ ...form, code: '', name: '' });
      reload();
    } catch (e) {
      setFormError(errorMessage(e));
    }
  };

  return (
    <section>
      <h1>Chart of accounts</h1>
      {error && <p className="error">{error}</p>}
      {can('account.manage') && (
        <form className="inline-form" onSubmit={(e) => void submit(e)}>
          <input
            placeholder="Code"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            required
          />
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <select
            value={form.type}
            onChange={(e) =>
              setForm({ ...form, type: e.target.value as AccountType, parentId: '' })
            }
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select
            value={form.parentId}
            onChange={(e) => setForm({ ...form, parentId: e.target.value })}
            aria-label="Parent"
          >
            <option value="">No parent</option>
            {headers.map((h) => (
              <option key={h.id} value={h.id}>
                {h.code} {h.name}
              </option>
            ))}
          </select>
          <button type="submit">Add account</button>
          {formError && <span className="error">{formError}</span>}
        </form>
      )}
      <table className="table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Type</th>
            <th>Currency</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id} className={a.isPostable ? '' : 'header-row'}>
              <td>{a.code}</td>
              <td style={{ paddingLeft: `${0.75 + (depths.get(a.id) ?? 0) * 1.25}rem` }}>
                {a.name}
              </td>
              <td>{a.type}</td>
              <td>{a.currency ?? 'any'}</td>
              <td>{a.isActive ? (a.isPostable ? 'Postable' : 'Header') : 'Inactive'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
