import { useEffect, useMemo, useState } from 'react';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import EmptyState from '../components/EmptyState';
import ErrorAlert from '../components/ErrorAlert';
import LeadDetail from '../components/LeadDetail';
import LeadFilters from '../components/LeadFilters';
import LeadTable from '../components/LeadTable';
import Pager from '../components/Pager';
import { useToast } from '../components/ToastHost';
import { useDebounce } from '../hooks/useDebounce';
import { useLeads } from '../hooks/useLeads';
import { api } from '../services/api';
import { downloadBlob } from '../utils/csv';
import { STATUS_LABEL } from '../utils/format';

const DEFAULTS = { search: '', priority: '', status: '', dataQuality: '', sort: 'score_desc', page: 1, limit: 25 };

export default function LeadsPage({ thresholds, preset, onPresetUsed, onDataChanged, onGoImport }) {
  const toast = useToast();
  const [filters, setFilters] = useState(() => ({ ...DEFAULTS, ...(preset || {}) }));
  const [searchInput, setSearchInput] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const debouncedSearch = useDebounce(searchInput, 350);

  useEffect(() => { if (preset) onPresetUsed(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setFilters((f) => (f.search === debouncedSearch ? f : { ...f, search: debouncedSearch, page: 1 }));
  }, [debouncedSearch]);

  const params = useMemo(() => ({ ...filters }), [filters]);
  const { leads, pagination, loading, error, reload, patchLead } = useLeads(params);
  const selected = leads.find((l) => l._id === selectedId) || null;

  const hasActive = Boolean(searchInput || filters.priority || filters.status || filters.dataQuality || filters.sort !== DEFAULTS.sort);
  const change = (patch) => setFilters((f) => ({ ...f, ...patch, page: 1 }));
  const clear = () => { setSearchInput(''); setFilters({ ...DEFAULTS, limit: filters.limit }); };

  async function changeStatus(lead, status) {
    const previous = lead.status;
    patchLead({ ...lead, status });
    try {
      patchLead(await api.updateStatus(lead._id, status));
      toast.success(`${lead.companyName} marked ${STATUS_LABEL[status].toLowerCase()}.`);
      onDataChanged();
    } catch (err) {
      patchLead({ ...lead, status: previous });
      toast.error(`Could not update ${lead.companyName}: ${err.message}`);
    }
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const { search, priority, status, dataQuality, sort } = filters;
      const blob = await api.exportCsv({ search, priority, status, dataQuality, sort });
      downloadBlob(blob, `leadpilot-leads-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success('Export downloaded. It includes every lead that matches the current filters.');
    } catch (err) {
      toast.error(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  }

  const firstLoad = loading && !pagination;
  const noResults = pagination && pagination.total === 0;

  return (
    <>
      <LeadFilters search={searchInput} onSearch={setSearchInput} filters={filters} onChange={change}
        onClear={clear} onExport={exportCsv} exporting={exporting} hasActive={hasActive} />
      <p className="small text-muted my-2">
        The bar shows each score out of 100. The two ticks mark the medium ({thresholds.mediumThreshold}) and high ({thresholds.highThreshold}) cut-offs.
      </p>

      {error && <ErrorAlert title="Leads could not be loaded" message={error} onRetry={reload} />}
      {firstLoad && !error && <div className="py-5 text-center" role="status"><Spinner animation="border" size="sm" className="me-2" />Loading leads…</div>}

      {noResults && !error && (hasActive ? (
        <EmptyState title="No leads match these filters"
          action={<Button variant="outline-primary" onClick={clear}>Clear filters</Button>}>
          Try a different search or remove a filter.
        </EmptyState>
      ) : (
        <EmptyState title="No leads yet" action={<Button onClick={onGoImport}>Import a CSV</Button>}>
          Import a list of companies to see them ranked here.
        </EmptyState>
      ))}

      {pagination && pagination.total > 0 && (
        <div className={loading ? 'is-refreshing' : ''}>
          <LeadTable leads={leads} thresholds={thresholds} busy={loading} onSelect={setSelectedId} onStatusChange={changeStatus} />
          <Pager pagination={pagination} onPage={(page) => setFilters((f) => ({ ...f, page }))}
            onLimit={(limit) => setFilters((f) => ({ ...f, limit, page: 1 }))} />
        </div>
      )}

      <LeadDetail lead={selected} thresholds={thresholds} onHide={() => setSelectedId(null)} />
    </>
  );
}
