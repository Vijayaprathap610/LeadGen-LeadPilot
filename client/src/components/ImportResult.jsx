import Button from 'react-bootstrap/Button';
import { FiDownload } from 'react-icons/fi';
import { downloadBlob, issuesToCsv } from '../utils/csv';
import { formatNumber, plural } from '../utils/format';

export default function ImportResult({ result, onViewLeads }) {
  const { totalRows, imported, duplicates, invalid, incomplete, importedByPriority, ignoredColumns, issues, issuesTruncated } = result;
  const items = [
    ['Rows processed', totalRows, 'in the file'],
    ['Imported', imported, `${formatNumber(importedByPriority.high)} high priority`],
    ['Duplicates', duplicates.total, `${formatNumber(duplicates.inFile)} in file, ${formatNumber(duplicates.existing)} already saved`],
    ['Rejected', invalid, 'unusable rows'],
    ['Need review', incomplete, 'imported with warnings'],
  ];
  return (
    <section aria-labelledby="result-title" className="mt-4">
      <h2 id="result-title" className="h5 mb-3">
        {imported > 0 ? `Imported ${plural(imported, 'lead')}` : 'No new leads were imported'}
      </h2>
      <dl className="strip">
        {items.map(([label, value, hint]) => (
          <div key={label} className="strip-item"><dt>{label}</dt><dd className="strip-value">{formatNumber(value)}</dd><dd className="strip-hint">{hint}</dd></div>
        ))}
      </dl>

      {ignoredColumns.length > 0 && (
        <p className="small text-muted mt-3 mb-0">Ignored columns: {ignoredColumns.join(', ')}.</p>
      )}

      {issues.length > 0 && (
        <div className="mt-4">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
            <h3 className="h6 mb-0">Rows that were not imported</h3>
            <Button variant="outline-secondary" size="sm" className="d-inline-flex align-items-center gap-2"
              onClick={() => downloadBlob(new Blob([issuesToCsv(issues)], { type: 'text/csv;charset=utf-8' }), 'leadpilot-import-issues.csv')}>
              <FiDownload aria-hidden="true" /> Download report
            </Button>
          </div>
          <div className="table-wrap">
            <table className="lead-table issues-table">
              <caption className="visually-hidden">Rows that were rejected or skipped as duplicates</caption>
              <thead><tr><th scope="col">Row</th><th scope="col">Company</th><th scope="col">Result</th><th scope="col">Reason</th></tr></thead>
              <tbody>
                {issues.map((i) => (
                  <tr key={`${i.row}-${i.type}`}>
                    <td data-label="Row">{i.row}</td>
                    <td data-label="Company">{i.companyName || <span className="text-muted">No name</span>}</td>
                    <td data-label="Result"><span className={`pri ${i.type === 'duplicate' ? 'pri-medium' : 'pri-reject'}`}>{i.type === 'duplicate' ? 'Duplicate' : 'Rejected'}</span></td>
                    <td data-label="Reason">{i.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small text-muted mt-2 mb-0">
            Row numbers count data rows, not the header.{issuesTruncated && ' Only the first 1,000 are shown.'}
          </p>
        </div>
      )}

      {imported > 0 && <Button className="mt-4" onClick={onViewLeads}>View leads</Button>}
    </section>
  );
}
