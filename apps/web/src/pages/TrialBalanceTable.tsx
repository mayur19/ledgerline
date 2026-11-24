import type { TrialBalance } from '../api/types';

const blank = (value: string) => (/^-?0(\.0+)?$/.test(value) ? '' : value);

export function TrialBalanceTable({ report }: { report: TrialBalance }) {
  return (
    <table className="table report">
      <thead>
        <tr>
          <th>Code</th>
          <th>Account</th>
          <th className="num">Opening</th>
          <th className="num">Debit</th>
          <th className="num">Credit</th>
          <th className="num">Closing Dr</th>
          <th className="num">Closing Cr</th>
        </tr>
      </thead>
      <tbody>
        {report.rows.map((r) => (
          <tr key={r.accountId} className={r.isHeader ? 'header-row' : ''}>
            <td>{r.code}</td>
            <td style={{ paddingLeft: `${0.75 + r.depth * 1.25}rem` }}>{r.name}</td>
            <td className="num">{blank(r.opening)}</td>
            <td className="num">{blank(r.periodDebit)}</td>
            <td className="num">{blank(r.periodCredit)}</td>
            <td className="num">{blank(r.closingDebit)}</td>
            <td className="num">{blank(r.closingCredit)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={2}>Totals ({report.currency})</td>
          <td className="num">
            {report.totals.openingDebit} / {report.totals.openingCredit}
          </td>
          <td className="num">{report.totals.periodDebit}</td>
          <td className="num">{report.totals.periodCredit}</td>
          <td className="num">{report.totals.closingDebit}</td>
          <td className="num">{report.totals.closingCredit}</td>
        </tr>
      </tfoot>
    </table>
  );
}
