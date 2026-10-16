import { useEffect, useRef, useState } from 'react';
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import { ToastProvider } from './components/ToastHost';
import { useHashRoute } from './hooks/useHashRoute';
import { useStats } from './hooks/useStats';
import DashboardPage from './pages/DashboardPage';
import ImportPage from './pages/ImportPage';
import LeadsPage from './pages/LeadsPage';

const PAGES = {
  dashboard: { label: 'Dashboard', title: 'Dashboard', lead: 'Where your lead list stands today.' },
  leads: { label: 'Leads', title: 'Leads', lead: 'Ranked by score. Open a lead to see why it scored the way it did.' },
  import: { label: 'Import', title: 'Import leads', lead: 'Upload a CSV. Duplicates are skipped and every skipped row is explained.' },
};

function Brand() {
  return (
    <Navbar.Brand href="#/dashboard" className="brand">
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false">
        <rect width="24" height="24" rx="5" fill="#0B6E5F" />
        <path d="M6 16.5 12 6l6 10.5-6-2.6z" fill="#fff" />
      </svg>
      <span>LeadPilot</span>
    </Navbar.Brand>
  );
}

export default function App() {
  const [route, navigate] = useHashRoute();
  const { stats, loading, error, refresh, thresholds } = useStats();
  const [preset, setPreset] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const mainRef = useRef(null);
  const firstRender = useRef(true);

  // Move focus to the page content after navigating, so keyboard and screen-reader users land in the right place.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    mainRef.current?.focus();
  }, [route]);

  const openLeads = (filters) => { setPreset(filters); navigate('leads'); };
  const page = PAGES[route];

  return (
    <ToastProvider>
      <button type="button" className="skip-link" onClick={() => mainRef.current?.focus()}>Skip to content</button>
      <Navbar expand="md" expanded={expanded} onToggle={setExpanded} className="app-nav" aria-label="Main">
        <Container className="app-container">
          <Brand />
          <Navbar.Toggle aria-controls="main-nav" aria-label="Toggle navigation" />
          <Navbar.Collapse id="main-nav">
            <Nav className="ms-md-4" as="ul">
              {Object.entries(PAGES).map(([key, p]) => (
                <li key={key} className="nav-item">
                  <Nav.Link href={`#/${key}`} active={route === key} aria-current={route === key ? 'page' : undefined}
                    onClick={() => setExpanded(false)}>{p.label}</Nav.Link>
                </li>
              ))}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <main id="main" ref={mainRef} tabIndex={-1} className="page app-container">
        <header className="mb-4">
          <h1 className="page-title">{page.title}</h1>
          <p className="text-muted mb-0">{page.lead}</p>
        </header>

        {route === 'dashboard' && (
          <DashboardPage stats={stats} loading={loading} error={error} onRetry={refresh}
            onOpenLeads={openLeads} onGoImport={() => navigate('import')} />
        )}
        {route === 'leads' && (
          <LeadsPage thresholds={thresholds} preset={preset} onPresetUsed={() => setPreset(null)}
            onDataChanged={refresh} onGoImport={() => navigate('import')} />
        )}
        {route === 'import' && <ImportPage onImported={refresh} onViewLeads={() => navigate('leads')} />}
      </main>
    </ToastProvider>
  );
}
