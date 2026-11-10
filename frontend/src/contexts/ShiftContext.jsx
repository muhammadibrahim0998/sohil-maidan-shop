import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useUser } from './UserContext';

const ShiftContext = createContext();

export const ShiftProvider = ({ children }) => {
  const { user } = useUser();
  const [currentSession, setCurrentSession] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCurrentSession = async () => {
    if (user?.role === 'super_admin') {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/cash-sessions/current');
      setCurrentSession(res.data);
    } catch (err) {
      console.error("Error fetching shift:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (user?.role === 'super_admin') return;
    try {
      const res = await api.get('/cash-sessions/history');
      setHistory(res.data);
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  };

  const startShift = async (openingCash, shiftType, customCashierId) => {
    try {
      const res = await api.post('/cash-sessions/start', {
        openingCash,
        cashierId: customCashierId || user.id,
        shiftType
      });
      setCurrentSession(res.data);
      fetchHistory(); // Refresh history
      return res.data;
    } catch (err) {
      throw err.response?.data || err;
    }
  };

  const endShift = async (actualCash, notes) => {
    try {
      const res = await api.post('/cash-sessions/end', {
        actualCash,
        notes,
        userId: user.id
      });
      setCurrentSession(null);
      fetchHistory(); // Refresh history
      return res.data;
    } catch (err) {
      throw err.response?.data || err;
    }
  };

  useEffect(() => {
    if (user) {
      fetchCurrentSession();
      fetchHistory();
    }
  }, [user]);

  return (
    <ShiftContext.Provider value={{
      currentSession,
      history,
      loading,
      startShift,
      endShift,
      fetchHistory,
      refreshSession: fetchCurrentSession
    }}>
      {children}
    </ShiftContext.Provider>
  );
};

export const useShift = () => useContext(ShiftContext);
