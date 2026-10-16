import { useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import ImportDropzone from '../components/ImportDropzone';
import ImportResult from '../components/ImportResult';
import { useToast } from '../components/ToastHost';
import { api } from '../services/api';
import { plural } from '../utils/format';

export default function ImportPage({ onImported, onViewLeads }) {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [fileProblem, setFileProblem] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  function chooseFile(chosen) {
    setResult(null);
    setError(null);
    if (!/\.csv$/i.test(chosen.name)) {
      setFile(null);
      setFileProblem(`"${chosen.name}" is not a CSV file. Export your list as .csv and try again.`);
      return;
    }
    setFileProblem(null);
    setFile(chosen);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const data = await api.importCsv(file);
      setResult(data);
      setFile(null);
      onImported();
      toast.success(data.imported > 0 ? `Imported ${plural(data.imported, 'lead')}.` : 'Import finished. No new leads were added.');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const details = error?.details;
  return (
    <>
      <ImportDropzone file={file} onFile={chooseFile} onSubmit={submit} busy={busy} />

      {fileProblem && <Alert variant="danger" role="alert" className="mt-3 mb-0">{fileProblem}</Alert>}
      {error && (
        <Alert variant="danger" role="alert" className="mt-3 mb-0">
          <p className="fw-semibold mb-1">The file was not imported</p>
          <p className="mb-0">{error.message}</p>
          {details?.missingColumns && (
            <p className="mt-2 mb-0">
              Add a column headed {details.acceptedHeaders.map((h) => `"${h}"`).join(', ')}.
              {details.foundHeaders && <> Columns found: {details.foundHeaders.join(', ')}.</>}
            </p>
          )}
        </Alert>
      )}
      {result && <ImportResult result={result} onViewLeads={onViewLeads} />}
    </>
  );
}
