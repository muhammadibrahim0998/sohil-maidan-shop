import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useUser } from './UserContext';

const SettingsContext = createContext();

const API_URL = '/settings';

export function SettingsProvider({ children }) {
  const { user } = useUser();
  const [settings, setSettings] = useState({
    shopName: 'Egg Station POS',
    currency: '$',
    address: '',
    phone: '',
    email: '',
    taxRate: 0,
    logoUrl: '',
    ownerFullName: '',
    ownerEmail: '',
    ownerPhone: '',
    easypaisaNumber: '',
    easypaisaEnabled: false
  });
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    if (user?.role === 'super_admin') {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get(API_URL);
      setSettings(res.data);
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates, currentPassword, role) => {
    try {
      const res = await api.put(API_URL,
        { ...updates, currentPassword },
        { headers: { 'x-user-role': role } }
      );
      setSettings(res.data);
      return res.data;
    } catch (err) {
      throw err.response?.data || { message: "Failed to update settings" };
    }
  };

  const getSecureSettings = async (ownerPassword, role) => {
    try {
      const res = await api.get(`${API_URL}/secure`, {
        headers: {
          'x-owner-password': ownerPassword,
          'x-user-role': role
        }
      });
      return res.data;
    } catch (err) {
      console.error("AXIOS ERROR DETAILS:", err);
      throw err.response?.data || { message: err.message || "Network error or CORS block" };
    }
  };

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings, fetchSettings, getSecureSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
