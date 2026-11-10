import axios from 'axios';

// Dynamic API Base URL resolution for local, custom domains, and production hosting:
export const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) {
    return String(import.meta.env.VITE_API_URL).trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname;
    // Local development: use empty string so Vite proxy forwards /api to localhost:5000
    if (host === 'localhost' || host === '127.0.0.1') {
      return '';
    }
    // Dynamic default for custom hosting domains / VPS / cPanel (relative routing)
    return '';
  }
  return '';
})();

// Helper to get full backend host URL for downloads, invoices, and direct assets
export const getBackendBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return String(import.meta.env.VITE_API_URL).trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:5001';
    }
    return window.location.origin;
  }
  return 'http://localhost:5001';
};

export const getApiUrl = (endpoint = '') => {
  const clean = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (clean.startsWith('/api')) {
    return `${API_BASE}${clean}`;
  }
  return `${API_BASE}/api${clean}`;
};

// Global transparent fetch router:
// Redirects any relative fetch('/api/...') or fetch('/uploads/...') to backend directly,
// preventing any SPA hosting provider from accidentally returning index.html (HTML/DOCTYPE).
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = function (resource, config = {}) {
    const token = localStorage.getItem('nexflow_token') || sessionStorage.getItem('nexflow_token');
    
    // Auto-inject Authorization header if token exists
    if (token) {
      const headers = new Headers(config.headers || {});
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      config = { ...config, headers };
    }

    if (API_BASE && typeof resource === 'string') {
      if (resource.startsWith('/api/') || resource === '/api') {
        resource = `${API_BASE}${resource}`;
        if (!config.credentials) {
          config = { ...config, credentials: 'include' };
        }
      } else if (resource.startsWith('/uploads/') || resource === '/uploads') {
        resource = `${API_BASE}${resource}`;
      } else if (resource.startsWith('/invoices/') || resource === '/invoices') {
        resource = `${API_BASE}${resource}`;
      }
    }
    return originalFetch.call(this, resource, config);
  };
}

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  withCredentials: true, // Required for cookies
});

// Request interceptor for debugging
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('nexflow_token') || sessionStorage.getItem('nexflow_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const savedUser = localStorage.getItem('nexflow_user') || sessionStorage.getItem('nexflow_user');
  if (savedUser) {
    try {
      const parsedUser = JSON.parse(savedUser);
      if (parsedUser?.role) {
        config.headers['x-user-role'] = parsedUser.role;
      }
    } catch (e) {}
  }
  console.log(`[Request] ${config.method.toUpperCase()} ${config.url}`);
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor for centralized error logging
api.interceptors.response.use((response) => {
  return response;
}, (error) => {
  const url = error.config?.url || '';
  const status = error.response?.status;
  // Suppress expected 401 on session check — not a real error
  const isSilent = status === 401 && url.includes('/auth/me');
  if (!isSilent) {
    const message = error.response?.data?.message || error.message;
    console.error(`[API Error ${status}]:`, message);
  }
  return Promise.reject(error);
});

// --- AUTH API ---
export const login = async (credentials) => {
  const response = await api.post('/auth/login', credentials);
  return response.data;
};

export const logout = async () => {
  const response = await api.post('/auth/logout');
  return response.data;
};

export const getMe = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

// --- ITEMS API ---
export const getPurchaseCredits = async (shopId) => {
  const url = shopId ? `/items/purchase-credits?shopId=${shopId}` : '/items/purchase-credits';
  const response = await api.get(url);
  return response.data;
};

export const getCustomerCredits = async (shopId) => {
  const url = shopId ? `/sales/customer-credits?shopId=${shopId}` : '/sales/customer-credits';
  const response = await api.get(url);
  return response.data;
};

export const deleteCustomerCredit = async (id) => {
  const response = await api.delete(`/sales/customer-credit/${id}`);
  return response.data;
};

export const getItems = async (shopId) => {
  const response = await api.get('/items', { params: shopId ? { shopId } : {} });
  return response.data;
};

export const getItem = async (id) => {
  const response = await api.get(`/items/${id}`);
  return response.data;
};

export const createItem = async (itemData) => {
  const response = await api.post('/items', itemData);
  return response.data;
};

export const updateItem = async (id, itemData, password, role) => {
  if (!id || id === 'undefined' || id === 'null') {
    throw new Error('Valid Product ID is required to update product');
  }
  const response = await api.put(`/items/${id}`, itemData, {
    headers: { 
      'x-owner-password': password,
      'x-user-role': role
    }
  });
  return response.data;
};

export const deleteItem = async (id, password, role) => {
  if (!id || id === 'undefined' || id === 'null') {
    throw new Error('Valid Product ID is required to delete product');
  }
  const response = await api.delete(`/items/${id}`, {
    headers: { 
      'x-owner-password': password,
      'x-user-role': role
    }
  });
  return response.data;
};

export const getVendors = async (shopId) => {
  const params = shopId ? { shopId } : {};
  const response = await api.get('/items/vendors', { params });
  return response.data;
};

export const createVendor = async (vendorData) => {
  const response = await api.post('/items/vendor/create', vendorData);
  return response.data;
};

export const updateVendor = async (vendorData) => {
  const response = await api.put('/items/vendor/update', vendorData);
  return response.data;
};

export const deleteVendor = async (vendorData) => {
  const response = await api.post('/items/vendor/delete', vendorData);
  return response.data;
};

export const deletePurchaseCredit = async (id) => {
  const response = await api.delete(`/items/purchase-credit/${id}`);
  return response.data;
};

export const settleSupplierCredit = async (id, paymentData) => {
  const method = String(paymentData.paymentMethod || 'Cash').toUpperCase();
  const endpoint = (method === 'BANK' || method === 'BANK_TRANSFER' || method === 'ONLINE')
    ? `/items/${id}/settle-bank`
    : `/items/${id}/settle-cash`;
  const response = await api.patch(endpoint, paymentData);
  return response.data;
};

export const settleSupplierCash = async (id, paymentData) => {
  const response = await api.patch(`/items/${id}/settle-cash`, paymentData);
  return response.data;
};

export const settleSupplierBank = async (id, paymentData) => {
  const response = await api.patch(`/items/${id}/settle-bank`, paymentData);
  return response.data;
};

// --- UPLOAD API ---
export const uploadImages = async (files) => {
  const formData = new FormData();
  for (const file of files) {
    formData.append('images', file);
  }
  
  const response = await api.post('/upload', formData);
  return response.data.images; 
};

// --- SALES API ---
export const getPaymentLedger = async (shopId) => {
  const response = await api.get('/sales/payment-ledger', { params: shopId ? { shopId } : {} });
  return response.data;
};

export const getSales = async (shopId) => {
  const response = await api.get('/sales', { params: shopId ? { shopId } : {} });
  return response.data;
};

export const createSale = async (saleData) => {
  const method = String(saleData.paymentMethod || 'CASH').toUpperCase();
  let endpoint = '/sales';
  if (method === 'CASH') endpoint = '/sales/cash';
  else if (method === 'BANK_TRANSFER' || method === 'BANK' || method === 'ONLINE' || method === 'EASYPAISA') endpoint = '/sales/bank';
  else if (method === 'CREDIT' || method === 'DUE') endpoint = '/sales/credit';

  const response = await api.post(endpoint, saleData);
  return response.data;
};

export const createCashSale = async (saleData) => {
  const response = await api.post('/sales/cash', saleData);
  return response.data;
};

export const createBankSale = async (saleData) => {
  const response = await api.post('/sales/bank', saleData);
  return response.data;
};

export const createCreditSale = async (saleData) => {
  const response = await api.post('/sales/credit', saleData);
  return response.data;
};

export const getSalesBreakdown = async (shopId) => {
  const response = await api.get(`/sales/breakdown${shopId ? `/${shopId}` : ''}`);
  return response.data;
};

export const getSalesByType = async (type, shopId) => {
  const response = await api.get(`/sales/by-type/${type}`, { params: shopId ? { shopId } : {} });
  return response.data;
};

export const updateSale = async (id, saleData, password, role) => {
  const response = await api.put(`/sales/${id}`, saleData, {
    headers: { 
      'x-owner-password': password,
      'x-user-role': role
    }
  });
  return response.data;
};

export const deleteSale = async (id, password, role) => {
  const response = await api.delete(`/sales/${id}`, {
    headers: { 
      'x-owner-password': password,
      'x-user-role': role
    }
  });
  return response.data;
};

export const returnSale = async (id, returnData, password, role) => {
  const response = await api.put(`/sales/${id}/return`, returnData, {
    headers: { 
      'x-owner-password': password,
      'x-user-role': role
    }
  });
  return response.data;
};

export const settleCreditViaCash = async (id, data) => {
  const response = await api.patch(`/sales/${id}/settle-cash`, data);
  return response.data;
};

export const settleCreditViaBank = async (id, data) => {
  const response = await api.patch(`/sales/${id}/settle-bank`, data);
  return response.data;
};

export const settleCreditSale = async (id, paymentData) => {
  const method = String(paymentData.paymentMethod || 'CASH').toUpperCase();
  const endpoint = (method === 'BANK' || method === 'BANK_TRANSFER' || method === 'ONLINE')
    ? `/sales/${id}/settle-bank`
    : `/sales/${id}/settle-cash`;
  const response = await api.patch(endpoint, paymentData);
  return response.data;
};

// --- USER MANAGEMENT API ---
export const getUsers = async (role) => {
  const response = await api.get('/users', {
    headers: { 'x-user-role': role }
  });
  return response.data;
};

export const createUser = async (userData, role) => {
  const response = await api.post('/users', userData, {
    headers: { 'x-user-role': role }
  });
  return response.data;
};

export const updateUser = async (id, userData, role) => {
  const response = await api.put(`/users/${id}`, userData, {
    headers: { 'x-user-role': role }
  });
  return response.data;
};

export const deleteUser = async (id, role) => {
  const response = await api.delete(`/users/${id}`, {
    headers: { 'x-user-role': role }
  });
  return response.data;
};

export const getShops = async () => {
  const response = await api.get('/shops');
  return response.data;
};

export const updateShopApproval = async (shopId, approvalData) => {
  const cleanId = shopId || '1';
  const customHeaders = { 'x-user-role': 'super_admin' };
  try {
    const response = await api.patch(`/shops/${cleanId}/approval`, approvalData, { headers: customHeaders });
    return response.data;
  } catch (err) {
    // If PATCH failed due to proxy / firewall / 405 Method Not Allowed / network error, fallback to PUT or POST
    try {
      const putRes = await api.put(`/shops/${cleanId}/approval`, approvalData, { headers: customHeaders });
      return putRes.data;
    } catch (fErr) {
      try {
        const postRes = await api.post(`/shops/${cleanId}/approval`, approvalData, { headers: customHeaders });
        return postRes.data;
      } catch (pErr) {
        // Direct transparent fetch fallback with explicit super_admin role header
        const token = localStorage.getItem('nexflow_token') || sessionStorage.getItem('nexflow_token');
        const targetUrl = getApiUrl(`/shops/${cleanId}/approval`);
        const res = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            'x-user-role': 'super_admin'
          },
          body: JSON.stringify(approvalData)
        });
        if (res.ok) {
          return await res.json();
        }
        throw pErr;
      }
    }
  }
};

export const getBranchCashSessions = async (shopId) => {
  const params = shopId && shopId !== 'ALL' ? { shopId } : {};
  const response = await api.get('/cash-sessions/all', { params });
  return response.data;
};

export const createBranchCashSession = async (sessionData) => {
  const response = await api.post('/cash-sessions/all', sessionData);
  return response.data;
};

export const updateBranchCashSession = async (shopId, id, data) => {
  const response = await api.put(`/cash-sessions/all/${shopId}/${id}`, data);
  return response.data;
};

export const deleteBranchCashSession = async (shopId, id) => {
  const response = await api.delete(`/cash-sessions/all/${shopId}/${id}`);
  return response.data;
};

export const getSystemUpdates = async () => {
  const response = await api.get('/updates');
  return response.data;
};

// --- ORDERS API (Shop Admin / Super Admin) ---
export const getShopOrders = async (params = {}) => {
  const response = await api.get('/checkout/orders', { params });
  return response.data;
};

export const getOrderById = async (orderId) => {
  const response = await api.get(`/checkout/order/${orderId}`);
  return response.data;
};

export const updateOrderStatus = async (orderId, { paymentStatus, orderStatus }) => {
  const response = await api.patch(`/checkout/order/${orderId}/status`, { paymentStatus, orderStatus });
  return response.data;
};

export const deleteOrder = async (orderId) => {
  const response = await api.delete(`/checkout/order/${orderId}`);
  return response.data;
};

export const deleteOrderProof = async (orderId) => {
  const response = await api.delete(`/checkout/order/${orderId}/proof`);
  return response.data;
};

// --- FUEL & VEHICLE EXPENSES API ---
export const getFuelExpenses = async (shopId) => {
  const url = shopId ? `/fuel-expenses/shop/${shopId}` : '/fuel-expenses';
  const response = await api.get(url);
  return response.data;
};

export const createFuelExpense = async (data, shopId) => {
  const url = shopId ? `/fuel-expenses/shop/${shopId}` : '/fuel-expenses';
  const response = await api.post(url, data);
  return response.data;
};

export const updateFuelExpense = async (id, data) => {
  const response = await api.put(`/fuel-expenses/${id}`, data);
  return response.data;
};

export const deleteFuelExpense = async (id) => {
  const response = await api.delete(`/fuel-expenses/${id}`);
  return response.data;
};

export default api;