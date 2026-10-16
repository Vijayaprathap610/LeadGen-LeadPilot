import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { formatNumber } from '../utils/format';

export default function Pager({ pagination, onPage, onLimit }) {
  const { page, limit, total, totalPages } = pagination;
  const first = total === 0 ? 0 : (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);
  return (
    <nav className="pager" aria-label="Pagination">
      <p className="mb-0" aria-live="polite">Showing {formatNumber(first)}–{formatNumber(last)} of {formatNumber(total)}</p>
      <div className="pager-controls">
        <Form.Group controlId="page-size" className="d-flex align-items-center gap-2">
          <Form.Label className="mb-0">Rows per page</Form.Label>
          <Form.Select size="sm" value={limit} onChange={(e) => onLimit(Number(e.target.value))} className="w-auto">
            {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </Form.Select>
        </Form.Group>
        <Button variant="outline-secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}
          className="d-inline-flex align-items-center gap-1"><FiChevronLeft aria-hidden="true" /> Previous</Button>
        <span className="px-1">Page {page} of {totalPages}</span>
        <Button variant="outline-secondary" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}
          className="d-inline-flex align-items-center gap-1">Next <FiChevronRight aria-hidden="true" /></Button>
      </div>
    </nav>
  );
}
