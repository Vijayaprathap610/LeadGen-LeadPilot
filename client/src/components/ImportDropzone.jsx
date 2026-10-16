import { useRef, useState } from 'react';
import Button from 'react-bootstrap/Button';
import { FiFileText, FiUploadCloud } from 'react-icons/fi';

export default function ImportDropzone({ file, onFile, onSubmit, busy, error }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const pick = (list) => { if (list && list[0]) onFile(list[0]); };

  return (
    <div>
      <div
        className={`dropzone${dragging ? ' dropzone-active' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files); }}
      >
        <FiUploadCloud aria-hidden="true" size={28} />
        <p className="mb-1 fw-semibold">Drop a CSV file here</p>
        <p className="text-muted mb-3">or choose one from your computer</p>
        <input ref={inputRef} id="csv-input" type="file" accept=".csv,text/csv" className="visually-hidden"
          aria-describedby="csv-hint" onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
        <Button variant="outline-primary" onClick={() => inputRef.current.click()} disabled={busy}>Choose CSV file</Button>
      </div>
      <p id="csv-hint" className="small text-muted mt-2 mb-3">
        Needs a company name column. Website, industry, location, employees, revenue and contact columns are used when present.
      </p>

      {file && (
        <div className="selected-file">
          <FiFileText aria-hidden="true" />
          <span className="text-break flex-grow-1">{file.name} <span className="text-muted">({Math.max(1, Math.round(file.size / 1024))} KB)</span></span>
          <Button onClick={onSubmit} disabled={busy || Boolean(error)}>{busy ? 'Importing…' : 'Import leads'}</Button>
        </div>
      )}
    </div>
  );
}
