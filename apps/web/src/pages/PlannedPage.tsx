import type { NavItem } from '../navigation';

export function PlannedPage({ item }: { item: NavItem }) {
  return (
    <section>
      <h1>
        {item.label} <span className="badge">Planned</span>
      </h1>
      <p>{item.planned?.summary}</p>
      <p className="muted">
        Tracked as {item.planned?.ticket} in milestone {item.planned?.milestone}. See
        docs/planning/backlog.md.
      </p>
    </section>
  );
}
