import { PRIORITY_LABEL } from '../utils/format';

export default function PriorityBadge({ priority, provisional = false }) {
  return (
    <span className="d-inline-flex align-items-center gap-2 flex-wrap">
      <span className={`pri pri-${priority}`}>{PRIORITY_LABEL[priority]}</span>
      {provisional && (
        <span className="provisional" title="Too little data for a final score. Add size, revenue or industry to firm it up.">
          Provisional
        </span>
      )}
    </span>
  );
}
