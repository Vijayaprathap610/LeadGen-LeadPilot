import axios from 'axios';

const baseURL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
export const http = axios.create({ baseURL, timeout: 60000 });

export const isCancel = axios.isCancel;

export class ApiRequestError extends Error {
  constructor(message, { status, details } = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.details = details;
  }
}

/** Turns any axios failure into an ApiRequestError with a message a user can act on. */
export async function toApiError(err) {
  if (axios.isCancel(err) || !axios.isAxiosError(err)) return err;
  if (!err.response) {
    return new ApiRequestError(
      err.code === 'ECONNABORTED'
        ? 'The request took too long and was stopped. Try again, or use a smaller file.'
        : "Can't reach the LeadPilot server. Check that the API is running and try again.",
    );
  }
  let body = err.response.data;
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    try { body = JSON.parse(await body.text()); } catch { body = null; }
  }
  return new ApiRequestError(body?.error?.message || `The server returned an error (${err.response.status}).`, {
    status: err.response.status,
    details: body?.error?.details,
  });
}

async function request(config) {
  try {
    return (await http.request(config)).data;
  } catch (err) {
    throw await toApiError(err);
  }
}

const clean = (params = {}) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));

export const api = {
  getStats: (signal) => request({ url: '/dashboard/stats', signal }).then((r) => r.data),
  getLeads: (params, signal) => request({ url: '/leads', params: clean(params), signal }),
  updateStatus: (id, status) => request({ method: 'patch', url: `/leads/${id}/status`, data: { status } }).then((r) => r.data),
  importCsv: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request({ method: 'post', url: '/leads/import', data: form }).then((r) => r.data);
  },
  exportCsv: (params) => request({ url: '/leads/export', params: clean(params), responseType: 'blob' }),
};
