import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import EmptyState from '../components/EmptyState';
import ErrorAlert from '../components/ErrorAlert';
import PriorityMix from '../components/PriorityMix';
import StatStrip from '../components/StatStrip';
import { STATUS_LABEL, STATUSES, formatDate, formatNumber, plural } from '../utils/format';

export default function DashboardPage({ stats, loading, error, onRetry, onOpenLeads, onGoImport }) {
  if (!stats && loading) {
    return <div className="py-5 text-center" role="status"><Spinner animation="border" size="sm" className="me-2" />Loading dashboard…</div>;
  }
  if (!stats) {
    return <ErrorAlert title="The dashboard could not load" message={error} onRetry={onRetry} />;
  }
  if (stats.uniqueLeads === 0 && stats.imports.count === 0) {
    return (
      <EmptyState title="No leads yet"
        action={(
          <div className="d-flex flex-wrap gap-2 justify-content-center">
            <Button onClick={onGoImport}>Import a CSV</Button>
            <a className="btn btn-outline-secondary" href="/sample-leads.csv" download>Download a sample file</a>
          </div>
        )}>
        Import a CSV of companies and LeadPilot will remove duplicates, flag missing data and rank each lead by priority.
      </EmptyState>
    );
  }

  const { lastImport, scoring } = stats;
  return (
    <>
      {error && <ErrorAlert title="Showing the last loaded numbers" message={error} onRetry={onRetry} />}
      <StatStrip stats={stats} onOpenLeads={onOpenLeads} />
      <div className="dash-grid">
        <div className="panel"><PriorityMix stats={stats} /></div>
        <div className="panel">
          <h2 className="h6 mb-3">Pipeline by status</h2>
          <ul className="list-unstyled mb-0 pipeline">
            {STATUSES.map((s) => (
              <li key={s}><span>{STATUS_LABEL[s]}</span><span className="fw-semibold">{formatNumber(stats.byStatus[s])}</span></li>
            ))}
          </ul>
        </div>
        <div className="panel">
          <h2 className="h6 mb-3">Latest import</h2>
          {lastImport ? (
            <>
              <p className="mb-1 text-break fw-semibold">{lastImport.fileName}</p>
              <p className="text-muted small mb-2">{formatDate(lastImport.createdAt)}</p>
              <p className="mb-3">
                {plural(lastImport.totalRows, 'row')} processed: {formatNumber(lastImport.imported)} imported,{' '}
                {formatNumber(lastImport.duplicates)} duplicates, {formatNumber(lastImport.invalid)} rejected.
              </p>
            </>
          ) : <p className="text-muted">No imports yet.</p>}
          <Button variant="outline-primary" size="sm" onClick={onGoImport}>Import another file</Button>
        </div>
        <div className="panel">
          <h2 className="h6 mb-3">How scoring works</h2>
          <p className="mb-2">
            Each lead gets a score from 0 to 100 using fixed rules: how complete the record is, company size, revenue
            {scoring.targetIndustries.length ? ' and industry fit' : ''}. High priority is {scoring.highThreshold} or more; medium is {scoring.mediumThreshold} or more.
          </p>
          <p className="small text-muted mb-0">
            {scoring.targetIndustries.length
              ? `Target industries: ${scoring.targetIndustries.join(', ')}.`
              : 'No target industries are set, so industry is not scored.'}{' '}
            Scores are not produced by a machine-learning model. {formatNumber(stats.provisionalScores)} {stats.provisionalScores === 1 ? 'lead has' : 'leads have'} a provisional score because data is missing.
          </p>
        </div>
      </div>
    </>
  );
}
