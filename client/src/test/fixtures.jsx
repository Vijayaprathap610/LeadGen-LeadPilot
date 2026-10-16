export const THRESHOLDS = { highThreshold: 70, mediumThreshold: 40 };

export const makeLead = (overrides = {}) => ({
  _id: '507f1f77bcf86cd799439011',
  companyName: 'Northwind Analytics',
  normalizedDomain: 'northwind.example',
  website: 'https://northwind.example',
  industry: 'Software',
  location: 'Austin, TX',
  companySize: '51-200',
  revenueRange: '$5M-$10M',
  contactName: 'Dana Reyes',
  contactEmail: 'dana@northwind.example',
  score: 88,
  priority: 'high',
  provisional: false,
  status: 'new',
  scoreBreakdown: [
    { criterion: 'completeness', label: 'Data completeness', points: 30, max: 30, detail: '7 of 7 fields present' },
    { criterion: 'industry', label: 'Industry relevance', points: null, max: null, detail: 'Not scored: no target industries configured' },
  ],
  dataQualityWarnings: [],
  createdAt: '2026-10-13T10:00:00.000Z',
  ...overrides,
});

export const page = (leads, extra = {}) => ({
  success: true,
  data: leads,
  pagination: { page: 1, limit: 25, total: leads.length, totalPages: 1, ...extra },
});

export const makeStats = (overrides = {}) => ({
  uniqueLeads: 12, highPriority: 9, mediumPriority: 2, lowPriority: 1, needReview: 6, provisionalScores: 2,
  averageScore: 78, byStatus: { new: 11, contacted: 1, qualified: 0, disqualified: 0 },
  scoring: { highThreshold: 70, mediumThreshold: 40, targetIndustries: [] },
  imports: { count: 2, rowsProcessed: 30, duplicatesDetected: 16, invalidRejected: 2 },
  lastImport: { fileName: 'sample-leads.csv', totalRows: 15, imported: 12, duplicates: 2, invalid: 1, createdAt: '2026-10-13T10:00:00.000Z' },
  ...overrides,
});

export const renderWithToasts = async (ui) => {
  const { render } = await import('@testing-library/react');
  const { ToastProvider } = await import('../components/ToastHost');
  return render(<ToastProvider>{ui}</ToastProvider>);
};
