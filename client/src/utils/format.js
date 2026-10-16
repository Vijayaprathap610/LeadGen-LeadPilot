export const PRIORITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };
export const STATUS_LABEL = { new: 'New', contacted: 'Contacted', qualified: 'Qualified', disqualified: 'Disqualified' };
export const STATUSES = Object.keys(STATUS_LABEL);

export const formatNumber = (n) => new Intl.NumberFormat('en-US').format(n ?? 0);
export const plural = (n, one, many = `${one}s`) => `${formatNumber(n)} ${n === 1 ? one : many}`;

export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}
