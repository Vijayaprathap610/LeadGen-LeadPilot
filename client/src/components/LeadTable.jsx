import Form from 'react-bootstrap/Form';
import { FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import PriorityBadge from './PriorityBadge';
import ScoreMeter from './ScoreMeter';
import { STATUS_LABEL, STATUSES, plural } from '../utils/format';

export default function LeadTable({ leads, thresholds, onSelect, onStatusChange, busy }) {
  return (
    <div className="table-wrap" aria-busy={busy}>
      <table className="lead-table">
        <caption className="visually-hidden">Leads ranked by score</caption>
        <thead>
          <tr>
            <th scope="col">Company</th>
            <th scope="col">Industry and location</th>
            <th scope="col">Size and revenue</th>
            <th scope="col">Score</th>
            <th scope="col">Status</th>
            <th scope="col">Data quality</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const warnings = lead.dataQualityWarnings.length;
            return (
              <tr key={lead._id}>
                <td className="cell-company">
                  <button type="button" className="company-link" onClick={() => onSelect(lead._id)}>{lead.companyName}</button>
                  <span className="cell-sub">{lead.normalizedDomain || 'No website'}</span>
                </td>
                <td data-label="Industry and location">
                  <span>{lead.industry || <span className="text-muted">Not provided</span>}</span>
                  <span className="cell-sub">{lead.location || 'Location not provided'}</span>
                </td>
                <td data-label="Size and revenue">
                  <span>{lead.companySize || <span className="text-muted">Size not provided</span>}</span>
                  <span className="cell-sub">{lead.revenueRange || 'Revenue not provided'}</span>
                </td>
                <td data-label="Score" className="cell-score">
                  <ScoreMeter score={lead.score} priority={lead.priority} thresholds={thresholds} provisional={lead.provisional} />
                  <PriorityBadge priority={lead.priority} provisional={lead.provisional} />
                </td>
                <td data-label="Status">
                  <Form.Select size="sm" className="status-select" value={lead.status}
                    aria-label={`Status for ${lead.companyName}`} onChange={(e) => onStatusChange(lead, e.target.value)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </Form.Select>
                </td>
                <td data-label="Data quality">
                  {warnings ? (
                    <button type="button" className="quality-flag" onClick={() => onSelect(lead._id)}
                      aria-label={`${plural(warnings, 'issue')} to review for ${lead.companyName}`}>
                      <FiAlertTriangle aria-hidden="true" /> {plural(warnings, 'issue')} to review
                    </button>
                  ) : (
                    <span className="quality-ok"><FiCheckCircle aria-hidden="true" /> Complete</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
