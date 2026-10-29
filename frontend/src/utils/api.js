import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const tenderApi = {
  getTenders: (params) => api.get('/tenders/', { params }),
  getTender: (id) => api.get(`/tenders/${id}`),
  updateTender: (id, data) => api.patch(`/tenders/${id}`, data),
  deleteTender: (id) => api.delete(`/tenders/${id}`),
  parseTenderPdf: (id) => api.post(`/tenders/${id}/parse-pdf`),
  batchParseTenders: (limit = 20) => api.post('/tenders/batch-parse', null, { params: { limit } }),
};

export const syncApi = {
  triggerSync: (data) => api.post('/sync/run', data),
  getStatus: () => api.get('/sync/status'),
  getHistory: () => api.get('/sync/history'),
};

export const analyticsApi = {
  getOverview: () => api.get('/analytics/overview'),
};

export const settingsApi = {
  getProfile: () => api.get('/settings/profile'),
  updateProfile: (data) => api.put('/settings/profile', data),
  getKeywords: () => api.get('/settings/keywords'),
  updateKeywords: (data) => api.put('/settings/keywords', data),
  getPortals: () => api.get('/settings/portals'),
};

export const exportApi = {
  getExcelUrl: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return `/api/v1/export/excel${qs ? `?${qs}` : ''}`;
  },
  getCsvUrl: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return `/api/v1/export/csv${qs ? `?${qs}` : ''}`;
  },
};

export default api;

