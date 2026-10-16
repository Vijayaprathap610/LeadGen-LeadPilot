import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';

export default function ErrorAlert({ title = 'Something went wrong', message, onRetry }) {
  return (
    <Alert variant="danger" role="alert" className="d-flex gap-3 align-items-start">
      <FiAlertTriangle aria-hidden="true" className="flex-shrink-0 mt-1" size={18} />
      <div className="flex-grow-1">
        <p className="fw-semibold mb-1">{title}</p>
        <p className="mb-0">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline-danger" size="sm" onClick={onRetry} className="d-inline-flex align-items-center gap-2 flex-shrink-0">
          <FiRefreshCw aria-hidden="true" /> Try again
        </Button>
      )}
    </Alert>
  );
}
