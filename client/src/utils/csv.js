// Spreadsheet apps run cells that start with these characters as formulas.
const neutralise = (v) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
const cell = (value) => `"${neutralise(String(value ?? '')).replace(/"/g, '""')}"`;

/** Builds the downloadable report of rows that were rejected or skipped as duplicates. */
export function issuesToCsv(issues) {
  const header = ['Row', 'Company', 'Result', 'Reason'].map(cell).join(',');
  const rows = issues.map((i) => [i.row, i.companyName, i.type === 'duplicate' ? 'Duplicate' : 'Rejected', i.reason].map(cell).join(','));
  return `${[header, ...rows].join('\r\n')}\r\n`;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
