import { PRIORITY_LABEL, formatNumber } from '../utils/format';

export default function PriorityMix({ stats }) {
  const total = stats.uniqueLeads;
  if (!total) return null;
  const parts = ['high', 'medium', 'low'].map((p) => ({ key: p, count: stats[`${p}Priority`] }));
  const pct = (n) => Math.round((n / total) * 100);
  return (
    <section aria-labelledby="mix-title">
      <h2 id="mix-title" className="h6 mb-3">Priority mix</h2>
      <div className="mix-bar" role="img" aria-label={parts.map((p) => `${PRIORITY_LABEL[p.key]} ${p.count}`).join(', ')}>
        {parts.filter((p) => p.count > 0).map((p) => (
          <span key={p.key} className={`mix-seg meter-${p.key}`} style={{ flexGrow: p.count }} />
        ))}
      </div>
      <ul className="mix-legend list-unstyled mb-0">
        {parts.map((p) => (
          <li key={p.key}>
            <span className={`mix-dot meter-${p.key}`} aria-hidden="true" />
            <span>{PRIORITY_LABEL[p.key]}</span>
            <span className="ms-auto fw-semibold">{formatNumber(p.count)}</span>
            <span className="text-muted ps-1">({pct(p.count)}%)</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
