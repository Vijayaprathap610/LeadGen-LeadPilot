import Offcanvas from 'react-bootstrap/Offcanvas';
import PriorityBadge from './PriorityBadge';
import ScoreMeter from './ScoreMeter';
import { formatDate } from '../utils/format';

const FIELDS = [
  ['Website', (l) => l.website], ['Industry', (l) => l.industry], ['Location', (l) => l.location],
  ['Company size', (l) => l.companySize], ['Revenue', (l) => l.revenueRange],
  ['Contact', (l) => l.contactName], ['Contact email', (l) => l.contactEmail],
  ['Source file', (l) => l.source], ['Added', (l) => formatDate(l.createdAt)],
];

export default function LeadDetail({ lead, thresholds, onHide }) {
  return (
    <Offcanvas show={Boolean(lead)} onHide={onHide} placement="end" className="detail-panel" aria-labelledby="detail-title">
      {lead && (
        <>
          <Offcanvas.Header closeButton closeLabel="Close details">
            <Offcanvas.Title as="h2" id="detail-title" className="h5">{lead.companyName}</Offcanvas.Title>
          </Offcanvas.Header>
          <Offcanvas.Body>
            <section className="mb-4" aria-label="Score">
              <ScoreMeter score={lead.score} priority={lead.priority} thresholds={thresholds} provisional={lead.provisional} />
              <PriorityBadge priority={lead.priority} provisional={lead.provisional} />
            </section>

            <section className="mb-4" aria-labelledby="why-title">
              <h3 id="why-title" className="h6">How this score was calculated</h3>
              <ul className="why-list list-unstyled mb-0">
                {lead.scoreBreakdown.map((b) => (
                  <li key={b.criterion}>
                    <span className="why-label">{b.label}</span>
                    <span className="why-points">{b.max === null ? '–' : `${b.points} of ${b.max}`}</span>
                    <span className="why-detail">{b.detail}</span>
                  </li>
                ))}
              </ul>
              <p className="small text-muted mt-3 mb-0">
                Scores come from fixed rules, not a machine-learning model. They are out of 100: high is {thresholds.highThreshold} or more, medium is {thresholds.mediumThreshold} or more.
              </p>
            </section>

            <section className="mb-4" aria-labelledby="quality-title">
              <h3 id="quality-title" className="h6">Data quality</h3>
              {lead.dataQualityWarnings.length === 0 ? (
                <p className="mb-0">No issues found.</p>
              ) : (
                <ul className="mb-0 ps-3">
                  {lead.dataQualityWarnings.map((w) => <li key={w.code}>{w.message}</li>)}
                </ul>
              )}
            </section>

            <section aria-labelledby="facts-title">
              <h3 id="facts-title" className="h6">Details</h3>
              <dl className="facts mb-0">
                {FIELDS.map(([label, get]) => (
                  <div key={label}><dt>{label}</dt><dd>{get(lead) || <span className="text-muted">Not provided</span>}</dd></div>
                ))}
              </dl>
            </section>
          </Offcanvas.Body>
        </>
      )}
    </Offcanvas>
  );
}
