import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Authorization header if JWT token is stored
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tender_tracker_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor to clear stale credentials on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const url = error.config?.url || '';
      if (!url.includes('/auth/login')) {
        localStorage.removeItem('tender_tracker_token');
        localStorage.removeItem('bitvivid_user');
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

export const tenderApi = {
  getTenders: (params) => api.get('/tenders/', { params }),
  getUpcomingDeadlines: (params) => api.get('/tenders/upcoming-deadlines', { params }),
  getNotifications: (params) => api.get('/tenders/notifications', { params }),
  getTender: (id) => api.get(`/tenders/${encodeURIComponent(id)}`),
  updateTender: (id, data) => api.patch(`/tenders/${id}`, data),
  deleteTender: (id) => api.delete(`/tenders/${id}`),
  purgePastTenders: () => api.post('/tenders/purge-past'),
  parseTenderPdf: (id) => api.post(`/tenders/${id}/parse-pdf`),
  batchParseTenders: (limit = 20) => api.post('/tenders/batch-parse', null, { params: { limit } }),
  getDeepAnalysis: (id) => api.get(`/tenders/${encodeURIComponent(id)}/deep-analysis`),
  forceDeepAnalyze: (id) => api.post(`/tenders/${encodeURIComponent(id)}/deep-analyze`),
  uploadDocumentAndAnalyze: (id, formData) =>
    api.post(`/tenders/${encodeURIComponent(id)}/upload-document`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  analyzeAdHoc: (formData) =>
    api.post('/tenders/analyze-ad-hoc', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

export const crmApi = {
  getRecords: (params) => api.get('/crm-records', { params }),
  pickTender: (tenderId) => api.post(`/crm-records/pick/${tenderId}`),
  unpickTender: (tenderId) => api.post(`/crm-records/unpick/${tenderId}`),
  createManual: (data) => api.post('/crm-records/manual', data),
  updateRecord: (id, data) => api.patch(`/crm-records/${id}`, data),
  deleteRecord: (id) => api.delete(`/crm-records/${id}`),
  importRecords: (formData) =>
    api.post('/crm-records/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getTemplateUrl: () => '/api/v1/crm-records/template',
};

export const usersApi = {
  getUsers: () => api.get('/users'),
  createUser: (data) => api.post('/users', data),
  updatePermissions: (id, permissions) => api.patch(`/users/${id}/permissions`, { permissions }),
  updateStatus: (id, is_active) => api.patch(`/users/${id}/status`, { is_active }),
  deleteUser: (id) => api.delete(`/users/${id}`),
};

export const auditApi = {
  getLogs: (params) => api.get('/audit-logs', { params }),
};

export const chatbotApi = {
  query: (data) => api.post('/chatbot/query', data),
  getSuggested: (tenderId) => api.get(`/chatbot/suggested/${tenderId}`),
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

export const contactsApi = {
  getContacts: async (params) => {
    try {
      return await api.get('/contacts', { params });
    } catch (err) {
      if (err.response && err.response.status === 404) {
        try {
          return await api.get('/contacts/', { params });
        } catch (err2) {
          if (err2.response && err2.response.status === 404) {
            return await api.get('/tenders/contacts', { params });
          }
          throw err2;
        }
      }
      throw err;
    }
  },
  updateEmail: async (companyName, email) => {
    try {
      return await api.post('/contacts/update-email', {
        company_name: companyName,
        email: email,
      });
    } catch (err) {
      if (err.response && err.response.status === 404) {
        return await api.put('/contacts/email', {
          company_name: companyName,
          email: email,
        });
      }
      throw err;
    }
  },
  batchExtract: async (limit = 25, companyName = null) => {
    return await api.post('/contacts/batch-extract', null, {
      params: {
        limit,
        company_name: companyName || undefined,
      },
    });
  },
  getExtractStatus: async () => {
    return await api.get('/contacts/extract-status');
  },
  extractNotices: async (companyName = null, limit = 15) => {
    return await api.post('/contacts/batch-extract', null, {
      params: { company_name: companyName || undefined, limit },
    });
  },
  getCsvUrl: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return `/api/v1/contacts/export/csv${qs ? `?${qs}` : ''}`;
  },
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
