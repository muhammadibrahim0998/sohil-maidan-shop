
import React, { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, logout as apiLogout, getMe } from '../services/api';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('nexflow_user') || sessionStorage.getItem('nexflow_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem('nexflow_token') || sessionStorage.getItem('nexflow_token');
      if (!token) {
        setUser(null);
        localStorage.removeItem('nexflow_user');
        return;
      }
      try {
        const data = await getMe();
        if (data?.user) {
          setUser(prev => {
            // Keep object reference if nothing meaningful changed to prevent extra rerenders
            const isChanged = !prev ||
              prev.approvalStatus !== data.user.approvalStatus ||
              prev.isEditApproved !== data.user.isEditApproved ||
              prev.isDeleteApproved !== data.user.isDeleteApproved ||
              JSON.stringify(prev.allowedPages) !== JSON.stringify(data.user.allowedPages);
            return isChanged ? data.user : prev;
          });
          localStorage.setItem('nexflow_user', JSON.stringify(data.user));
          if (data.user.shopId) {
            try {
              localStorage.setItem(`nexflow_cached_shop_${data.user.shopId}`, JSON.stringify({
                id: data.user.shopId,
                _id: data.user.shopId,
                isEditApproved: data.user.isEditApproved,
                isDeleteApproved: data.user.isDeleteApproved,
                approvalStatus: data.user.approvalStatus,
                allowedPages: data.user.allowedPages
              }));
            } catch (_) { }
          }
        }
      } catch (error) {
        if (error.response?.status === 401) {
          setUser(null);
          localStorage.removeItem('nexflow_token');
          localStorage.removeItem('nexflow_user');
        }
      } finally {
        setLoading(false);
      }
    };
    checkSession();

    // Real-time dynamic sync for online production across multiple devices and tabs
    const syncInterval = setInterval(checkSession, 4000);
    const handleFocus = () => { checkSession(); };
    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('shop_approval_updated', handleFocus);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('shop_approval_updated', handleFocus);
    };
  }, []);

  const login = async (username, password) => {
    try {
      const data = await apiLogin({ username, password });
      if (data.token) {
        localStorage.setItem('nexflow_token', data.token);
      }
      if (data.user) {
        localStorage.setItem('nexflow_user', JSON.stringify(data.user));
      }
      setUser(data.user);
      // Role-based redirect after login
      const role = data.user?.role;
      if (role === 'super_admin') {
        window.location.replace('/');
      } else if (role === 'shop_admin') {
        window.location.replace('/');
      } else if (role === 'customer') {
        window.location.replace('/shop');
      } else {
        window.location.replace('/');
      }
      return data.user;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setUser(null);
      localStorage.removeItem('nexflow_token');
      localStorage.removeItem('nexflow_user');
      localStorage.removeItem('nexflow_shift');
    }
  };


  const isSuperAdmin = () => {
    if (!user) return false;
    const role = (user.role || '').toLowerCase();
    return role === 'super_admin';
  };

  const isShopAdmin = () => {
    if (!user) return false;
    const role = (user.role || '').toLowerCase();
    return role === 'shop_admin' || role === 'admin' || role === 'owner';
  };

  const isCustomer = () => {
    if (!user) return true;
    const role = (user.role || '').toLowerCase();
    return role === 'customer';
  };

  // Live dynamic synchronization when permissions change in another tab or Role Permissions view
  useEffect(() => {
    const handleApprovalUpdate = (e) => {
      const updatedShop = e?.detail?.shop;
      const updatedId = e?.detail?.shopId;
      if (updatedShop && user?.shopId && String(user.shopId) === String(updatedId)) {
        setUser(prev => {
          if (!prev) return prev;
          const merged = { ...prev, ...updatedShop };
          try { localStorage.setItem('nexflow_user', JSON.stringify(merged)); } catch { }
          return merged;
        });
      }
    };
    const handleStorage = (e) => {
      if (e.key && user?.shopId && e.key.includes(String(user.shopId))) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed) {
            setUser(prev => {
              if (!prev) return prev;
              const merged = { ...prev, ...parsed };
              try { localStorage.setItem('nexflow_user', JSON.stringify(merged)); } catch { }
              return merged;
            });
          }
        } catch { }
      }
    };
    window.addEventListener('shop_approval_updated', handleApprovalUpdate);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('shop_approval_updated', handleApprovalUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, [user?.shopId]);

  const isPageAllowed = () => {
    // All pages and reports remain visible and accessible.
    // Approval restrictions apply exclusively to Edit and Delete action buttons via isPageOpAllowed.
    return true;
  };

  // Helper to check whether an individual Edit or Delete button is allowed for a page
  const isPageOpAllowed = (pageKey, opType = 'edit', explicitShopId = null) => {
    if (!user) return false;
    const role = (user.role || '').toLowerCase();
    const sId = explicitShopId || user.shopId;

    if (!sId) {
      if (role === 'super_admin') return true;
      return false;
    }

    let shopData = null;
    try {
      const cached = localStorage.getItem(`nexflow_cached_shop_${sId}`);
      if (cached) shopData = JSON.parse(cached);
    } catch { }

    const approvalStatus = shopData?.approvalStatus || user.approvalStatus;
    if (approvalStatus === 'LOCKED') return false;

    // Direct edit / delete toggle flags on shop
    if (opType === 'edit') {
      const editFlag = shopData?.isEditApproved !== undefined
        ? (shopData.isEditApproved ? 1 : 0)
        : (user.isEditApproved !== undefined ? (user.isEditApproved ? 1 : 0) : 1);
      if (editFlag === 0) return false;
    }
    if (opType === 'delete') {
      const deleteFlag = shopData?.isDeleteApproved !== undefined
        ? (shopData.isDeleteApproved ? 1 : 0)
        : (user.isDeleteApproved !== undefined ? (user.isDeleteApproved ? 1 : 0) : 1);
      if (deleteFlag === 0) return false;
    }

    let allowed = shopData?.allowedPages !== undefined ? shopData.allowedPages : user.allowedPages;
    if (typeof allowed === 'string') {
      try { allowed = JSON.parse(allowed); } catch { allowed = null; }
    }

    if (Array.isArray(allowed)) {
      const hasGranularOps = allowed.some(k => typeof k === 'string' && (k.endsWith('_edit') || k.endsWith('_delete')));
      if (hasGranularOps) {
        const aliasKeys = (pageKey === 'customers' || pageKey === 'customerPaymentLedger' || pageKey === 'customer')
          ? ['customerPaymentLedger', 'customers']
          : (pageKey === 'vendors' || pageKey === 'vendorPaymentLedger')
            ? ['vendors', 'vendorPaymentLedger']
            : [pageKey];
        return aliasKeys.some(k => allowed.includes(`${k}_${opType}`));
      }
      if (allowed.length === 0) {
        return false;
      }
    }

    return true;
  };

  return (
    <UserContext.Provider value={{ user, login, logout, isSuperAdmin, isShopAdmin, isCustomer, isPageAllowed, isPageOpAllowed, loading }}>
      {!loading && children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    return {
      user: null,
      login: async () => { },
      logout: async () => { },
      isSuperAdmin: () => false,
      isShopAdmin: () => false,
      isCustomer: () => true,
      isPageAllowed: () => false,
      isPageOpAllowed: () => false,
      loading: false
    };
  }
  return context;
};
