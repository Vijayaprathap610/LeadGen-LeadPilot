import { formatNumber, plural } from '../utils/format';

/** The five numbers that describe the lead list, each optionally a shortcut into the filtered table. */
export default function StatStrip({ stats, onOpenLeads }) {
  const high = stats.highPriority;
  const items = [
    { key: 'unique', label: 'Unique leads', value: stats.uniqueLeads, hint: 'saved after duplicate checks', onClick: () => onOpenLeads({}) },
    { key: 'high', label: 'High priority', value: high, hint: `score ${stats.scoring.highThreshold} or more`, tone: 'high', onClick: () => onOpenLeads({ priority: 'high' }) },
    { key: 'review', label: 'Need review', value: stats.needReview, hint: 'missing or unclear data', tone: 'warn', onClick: () => onOpenLeads({ dataQuality: 'incomplete' }) },
    { key: 'dupes', label: 'Duplicates caught', value: stats.imports.duplicatesDetected, hint: `across ${plural(stats.imports.count, 'import')}` },
    { key: 'rejected', label: 'Rows rejected', value: stats.imports.invalidRejected, hint: 'could not be used' },
  ];
  return (
    <dl className="strip">
      {items.map(({ key, label, value, hint, tone, onClick }) => (
        <div key={key} className={`strip-item${tone ? ` strip-${tone}` : ''}`}>
          <dt>{label}</dt>
          <dd className="strip-value">{formatNumber(value)}</dd>
          <dd className="strip-hint">
            {onClick ? <button type="button" className="btn-link-plain" onClick={onClick}>{hint}</button> : hint}
          </dd>
        </div>
      ))}
    </dl>
  );
}
