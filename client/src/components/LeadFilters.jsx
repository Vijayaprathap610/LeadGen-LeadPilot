import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import { FiDownload, FiSearch, FiX } from 'react-icons/fi';
import { PRIORITY_LABEL, STATUS_LABEL } from '../utils/format';

export default function LeadFilters({ search, onSearch, filters, onChange, onClear, onExport, exporting, hasActive }) {
  const select = (name, label, options) => (
    <Form.Group controlId={`filter-${name}`} className="filter-field">
      <Form.Label>{label}</Form.Label>
      <Form.Select size="sm" value={filters[name]} onChange={(e) => onChange({ [name]: e.target.value })}>
        {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </Form.Select>
    </Form.Group>
  );
  return (
    <div className="toolbar" role="search" aria-label="Filter leads">
      <Form.Group controlId="filter-search" className="filter-field filter-search">
        <Form.Label>Search</Form.Label>
        <div className="search-box">
          <FiSearch aria-hidden="true" />
          <Form.Control size="sm" type="search" value={search} placeholder="Company name or website"
            onChange={(e) => onSearch(e.target.value)} autoComplete="off" />
        </div>
      </Form.Group>
      {select('priority', 'Priority', [['', 'All priorities'], ...Object.entries(PRIORITY_LABEL)])}
      {select('status', 'Status', [['', 'All statuses'], ...Object.entries(STATUS_LABEL)])}
      {select('dataQuality', 'Data quality', [['', 'All records'], ['incomplete', 'Need review'], ['complete', 'Complete']])}
      {select('sort', 'Sort by', [['score_desc', 'Highest score'], ['score_asc', 'Lowest score'], ['newest', 'Newest first'], ['name_asc', 'Company A to Z']])}
      <div className="toolbar-actions">
        {hasActive && (
          <Button variant="link" size="sm" onClick={onClear} className="d-inline-flex align-items-center gap-1">
            <FiX aria-hidden="true" /> Clear filters
          </Button>
        )}
        <Button variant="outline-primary" size="sm" onClick={onExport} disabled={exporting}
          className="d-inline-flex align-items-center gap-2">
          <FiDownload aria-hidden="true" /> {exporting ? 'Preparing…' : 'Export CSV'}
        </Button>
      </div>
    </div>
  );
}
