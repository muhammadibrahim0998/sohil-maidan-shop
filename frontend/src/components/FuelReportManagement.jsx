import React, { useState, useEffect, useMemo } from 'react';
import {
  Fuel,
  Truck,
  Car,
  Plus,
  Search,
  Calendar,
  DollarSign,
  CreditCard,
  Printer,
  Download,
  Share2,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Filter,
  RotateCcw,
  FileSpreadsheet,
  Gauge,
  User,
  Phone,
  MapPin,
  X,
  Building2,
  Clock,
  Layers,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getFuelExpenses,
  createFuelExpense,
  updateFuelExpense,
  deleteFuelExpense
} from '../services/api.js';

export const FuelReportManagement = ({ shopId = '1', shop = null, user = null, onRecordsChange = null }) => {
  const shopName = shop?.name || 'POS Management System';
  const shopAddress = shop?.address || 'Main Branch, Mardan / Peshawar';
  const shopPhone = shop?.phone || '';

  // Data states
  const [fuelRecords, setFuelRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // Date range filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');

  // Secondary search & filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFuelType, setSelectedFuelType] = useState('ALL');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('ALL');
  const [selectedVehicle, setSelectedVehicle] = useState('ALL');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [settleRecord, setSettleRecord] = useState(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState('CASH');

  // Form state
  const initialFormState = {
    vehicleNo: '',
    vehicleName: '',
    driverName: '',
    driverPhone: '',
    purpose: 'Stock Purchase Transport',
    goodsDetails: '',
    fuelType: 'Diesel',
    liters: '',
    ratePerLiter: '',
    totalAmount: '',
    paymentMethod: 'CASH',
    paidAmount: '',
    dueAmount: '',
    petrolPump: '',
    odometerReading: '',
    expenseDate: new Date().toISOString().slice(0, 16),
    notes: ''
  };
  const [formData, setFormData] = useState(initialFormState);

  // Local storage cache key
  const cacheKey = `fuel_records_${shopId || '1'}`;

  // Fetch data
  const fetchRecords = async () => {
    try {
      setLoading(true);
      const res = await getFuelExpenses(shopId);
      if (res?.success && Array.isArray(res.data)) {
        const normalized = res.data.map(item => ({
          ...item,
          id: item.id !== undefined && item.id !== null ? item.id : item._id
        }));
        setFuelRecords(normalized);
        localStorage.setItem(cacheKey, JSON.stringify(normalized));
        if (typeof onRecordsChange === 'function') onRecordsChange(normalized);
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('fuel_records_updated'));
      } else {
        // Fallback to cache if any
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              setFuelRecords(parsed.map(item => ({
                ...item,
                id: item.id !== undefined && item.id !== null ? item.id : item._id
              })));
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      console.warn('Backend fuel fetch error, checking local cache:', err.message);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            setFuelRecords(parsed.map(item => ({
              ...item,
              id: item.id !== undefined && item.id !== null ? item.id : item._id
            })));
          }
        } catch (e) {}
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [shopId]);

  // Handle Form changes with auto calculations
  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };

      // Auto-compute total amount if liters or rate changes
      if (field === 'liters' || field === 'ratePerLiter') {
        const l = field === 'liters' ? parseFloat(value) || 0 : parseFloat(prev.liters) || 0;
        const r = field === 'ratePerLiter' ? parseFloat(value) || 0 : parseFloat(prev.ratePerLiter) || 0;
        if (l > 0 && r > 0) {
          const computedTotal = Math.round(l * r);
          next.totalAmount = computedTotal;
          if (next.paymentMethod === 'CASH' || next.paymentMethod === 'BANK') {
            next.paidAmount = computedTotal;
            next.dueAmount = 0;
          } else if (next.paymentMethod === 'CREDIT') {
            next.paidAmount = 0;
            next.dueAmount = computedTotal;
          }
        }
      }

      // Auto-adjust paid vs due on payment method change
      if (field === 'paymentMethod') {
        const total = parseFloat(next.totalAmount) || 0;
        if (value === 'CASH' || value === 'BANK') {
          next.paidAmount = total;
          next.dueAmount = 0;
        } else if (value === 'CREDIT') {
          next.paidAmount = 0;
          next.dueAmount = total;
        }
      }

      // Auto-adjust due when paidAmount changes manually
      if (field === 'paidAmount') {
        const total = parseFloat(next.totalAmount) || 0;
        const paid = parseFloat(value) || 0;
        next.dueAmount = Math.max(0, total - paid);
      }

      // Auto-adjust paid when totalAmount changes
      if (field === 'totalAmount') {
        const total = parseFloat(value) || 0;
        if (next.paymentMethod === 'CREDIT') {
          next.paidAmount = 0;
          next.dueAmount = total;
        } else {
          next.paidAmount = total;
          next.dueAmount = 0;
        }
      }

      return next;
    });
  };

  // Helper to reliably extract a valid ID from a fuel record
  const getRecordId = (rec) => {
    if (!rec) return null;
    if (rec.id !== undefined && rec.id !== null) return rec.id;
    if (rec._id !== undefined && rec._id !== null) return rec._id;
    return null;
  };

  // Helper to reliably check if two records are the same specific record
  // (Prevents undefined === undefined matching every record in the array)
  const isSameRecord = (recA, recB) => {
    if (!recA || !recB) return false;
    const idA = getRecordId(recA);
    const idB = getRecordId(recB);
    if (idA !== null && idB !== null && String(idA) === String(idB)) {
      return true;
    }
    return false;
  };

  // Submit Add or Edit
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.vehicleNo.trim()) {
      toast.error('Vehicle Number is required');
      return;
    }
    const total = parseFloat(formData.totalAmount) || 0;
    if (total <= 0) {
      toast.error('Please enter a valid Total Cost or Liters & Rate');
      return;
    }

    const payload = {
      ...formData,
      shopId,
      liters: parseFloat(formData.liters) || 0,
      ratePerLiter: parseFloat(formData.ratePerLiter) || 0,
      totalAmount: total,
      paidAmount: parseFloat(formData.paidAmount) || 0,
      dueAmount: parseFloat(formData.dueAmount) || 0,
      createdBy: user?.name || user?.username || 'Shop Admin'
    };

    try {
      if (editingRecord) {
        // Update
        const targetId = getRecordId(editingRecord);
        let updatedItem = { ...editingRecord, ...payload, updatedAt: new Date().toISOString() };
        try {
          const res = await updateFuelExpense(targetId, payload);
          if (res?.data) updatedItem = res.data;
        } catch (e) {
          console.warn('Backend update error, updating local state:', e);
        }
        setFuelRecords(prev => {
          const next = prev.map(r => isSameRecord(r, editingRecord) ? updatedItem : r);
          localStorage.setItem(cacheKey, JSON.stringify(next));
          if (typeof onRecordsChange === 'function') onRecordsChange(next);
          if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('fuel_records_updated'));
          return next;
        });
        toast.success('Fuel expense record updated successfully');
        fetchRecords();
      } else {
        // Create
        let newItem;
        try {
          const res = await createFuelExpense(payload, shopId);
          newItem = res?.data;
        } catch (e) {
          console.warn('API error, falling back to local entry:', e);
        }
        if (!newItem) {
          newItem = {
            id: Date.now(),
            ...payload,
            createdAt: new Date().toISOString()
          };
        }
        setFuelRecords(prev => {
          const next = [newItem, ...prev];
          localStorage.setItem(cacheKey, JSON.stringify(next));
          if (typeof onRecordsChange === 'function') onRecordsChange(next);
          if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('fuel_records_updated'));
          return next;
        });
        toast.success('New vehicle fuel expense logged successfully');
      }

      setIsAddModalOpen(false);
      setEditingRecord(null);
      setFormData(initialFormState);
    } catch (err) {
      toast.error('Failed to save fuel expense: ' + (err.message || 'Unknown error'));
    }
  };

  // Delete Record
  const handleDelete = async (id) => {
    if (!id) return;
    try {
      await deleteFuelExpense(id);
    } catch (e) {
      console.warn('Delete API call failed:', e);
    }
    setFuelRecords(prev => {
      const next = prev.filter(r => String(getRecordId(r)) !== String(id));
      localStorage.setItem(cacheKey, JSON.stringify(next));
      if (typeof onRecordsChange === 'function') onRecordsChange(next);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('fuel_records_updated'));
      return next;
    });
    setDeleteConfirmId(null);
    toast.success('Fuel expense record deleted');
    fetchRecords();
  };

  // Settle Outstanding Due (Credit) - STRICTLY for this specific record only
  const handleSettleDue = async () => {
    if (!settleRecord) return;
    const targetId = getRecordId(settleRecord);
    if (!targetId) {
      toast.error('Record ID not found');
      return;
    }
    const pay = parseFloat(settleAmount) || 0;
    if (pay <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }
    const currentDue = parseFloat(settleRecord.dueAmount) || 0;
    const currentPaid = parseFloat(settleRecord.paidAmount) || 0;
    const newPaid = currentPaid + pay;
    const newDue = Math.max(0, currentDue - pay);
    const newMethod = newDue === 0 ? settleMethod : settleRecord.paymentMethod;

    const payload = {
      paidAmount: newPaid,
      dueAmount: newDue,
      paymentMethod: newMethod,
      notes: (settleRecord.notes || '') + `\n[Settled RS ${pay} via ${settleMethod} on ${new Date().toLocaleDateString('en-PK')}]`
    };

    try {
      await updateFuelExpense(targetId, payload);
    } catch (e) {
      console.warn('Backend credit settlement update error:', e);
    }

    setFuelRecords(prev => {
      // ONLY update the specific record that matches this unique ID
      const next = prev.map(r => isSameRecord(r, settleRecord) ? { ...r, ...payload } : r);
      localStorage.setItem(cacheKey, JSON.stringify(next));
      if (typeof onRecordsChange === 'function') onRecordsChange(next);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('fuel_records_updated'));
      return next;
    });

    toast.success(`RS ${pay.toLocaleString('en-PK')} credit paid successfully`);
    setSettleRecord(null);
    setSettleAmount('');
    fetchRecords();
  };

  // Open Edit Modal
  const openEditModal = (rec) => {
    setEditingRecord(rec);
    setFormData({
      vehicleNo: rec.vehicleNo || '',
      vehicleName: rec.vehicleName || '',
      driverName: rec.driverName || '',
      driverPhone: rec.driverPhone || '',
      purpose: rec.purpose || 'Stock Purchase Transport',
      goodsDetails: rec.goodsDetails || '',
      fuelType: rec.fuelType || 'Diesel',
      liters: rec.liters ? String(rec.liters) : '',
      ratePerLiter: rec.ratePerLiter ? String(rec.ratePerLiter) : '',
      totalAmount: rec.totalAmount ? String(rec.totalAmount) : '',
      paymentMethod: rec.paymentMethod || 'CASH',
      paidAmount: rec.paidAmount !== undefined ? String(rec.paidAmount) : '',
      dueAmount: rec.dueAmount !== undefined ? String(rec.dueAmount) : '',
      petrolPump: rec.petrolPump || '',
      odometerReading: rec.odometerReading || '',
      expenseDate: rec.expenseDate ? new Date(rec.expenseDate).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
      notes: rec.notes || ''
    });
    setIsAddModalOpen(true);
  };

  // Distinct vehicles list for filtering
  const distinctVehicles = useMemo(() => {
    const set = new Set();
    fuelRecords.forEach(r => {
      if (r.vehicleNo && r.vehicleNo.trim()) set.add(r.vehicleNo.trim());
    });
    return Array.from(set);
  }, [fuelRecords]);

  const parseSafeDate = (val) => {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    if (typeof val === 'number') {
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }
    const str = String(val).trim();
    if (!str) return null;
    const isoStr = str.includes(' ') && !str.includes('T') ? str.replace(' ', 'T') : str;
    let d = new Date(isoStr);
    if (!isNaN(d.getTime())) return d;
    const m = str.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) {
      d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  };

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return fuelRecords.filter(r => {
      // Date filter (supports both applied and dynamic input)
      const activeStart = appliedStartDate || startDate;
      const activeEnd = appliedEndDate || endDate;
      if (activeStart || activeEnd) {
        const itemDate = parseSafeDate(r.expenseDate || r.createdAt);
        if (!itemDate) return false;

        const pad = (n) => String(n).padStart(2, '0');
        const localYMD = `${itemDate.getFullYear()}-${pad(itemDate.getMonth() + 1)}-${pad(itemDate.getDate())}`;
        const utcYMD = `${itemDate.getUTCFullYear()}-${pad(itemDate.getUTCMonth() + 1)}-${pad(itemDate.getUTCDate())}`;

        let startTs = null;
        if (activeStart) {
          const parts = activeStart.split('-').map(Number);
          if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
            startTs = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0).getTime();
          }
        }
        let endTs = null;
        if (activeEnd) {
          const parts = activeEnd.split('-').map(Number);
          if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
            endTs = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999).getTime();
          }
        }

        const itemTs = itemDate.getTime();

        if (activeStart && activeEnd) {
          const inStr = (localYMD >= activeStart && localYMD <= activeEnd) ||
                        (utcYMD >= activeStart && utcYMD <= activeEnd);
          const inTs = (startTs !== null && itemTs >= startTs) && (endTs !== null && itemTs <= endTs);
          if (!inStr && !inTs) return false;
        } else if (activeStart) {
          const inStr = localYMD >= activeStart || utcYMD >= activeStart;
          const inTs = startTs !== null && itemTs >= startTs;
          if (!inStr && !inTs) return false;
        } else if (activeEnd) {
          const inStr = localYMD <= activeEnd || utcYMD <= activeEnd;
          const inTs = endTs !== null && itemTs <= endTs;
          if (!inStr && !inTs) return false;
        }
      }

      // Fuel type filter
      if (selectedFuelType !== 'ALL' && String(r.fuelType).toUpperCase() !== selectedFuelType.toUpperCase()) {
        return false;
      }

      // Payment method filter
      if (selectedPaymentMethod !== 'ALL') {
        const m = String(r.paymentMethod || 'CASH').toUpperCase();
        if (selectedPaymentMethod === 'CREDIT' && (Number(r.dueAmount) > 0 || m === 'CREDIT')) {
          // match
        } else if (m !== selectedPaymentMethod.toUpperCase()) {
          return false;
        }
      }

      // Vehicle filter
      if (selectedVehicle !== 'ALL' && String(r.vehicleNo).trim().toLowerCase() !== selectedVehicle.trim().toLowerCase()) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const vNo = (r.vehicleNo || '').toLowerCase();
        const vName = (r.vehicleName || '').toLowerCase();
        const dName = (r.driverName || '').toLowerCase();
        const pump = (r.petrolPump || '').toLowerCase();
        const purp = (r.purpose || '').toLowerCase();
        const notes = (r.notes || '').toLowerCase();
        if (!vNo.includes(q) && !vName.includes(q) && !dName.includes(q) && !pump.includes(q) && !purp.includes(q) && !notes.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [fuelRecords, appliedStartDate, appliedEndDate, selectedFuelType, selectedPaymentMethod, selectedVehicle, searchTerm]);

  // Computed summary metrics
  const stats = useMemo(() => {
    let totalExpense = 0;
    let totalPaidCash = 0;
    let totalPaidBank = 0;
    let totalCreditDue = 0;
    let totalLiters = 0;
    let dieselLiters = 0;
    let petrolLiters = 0;
    let dieselExpense = 0;
    let petrolExpense = 0;

    filteredRecords.forEach(r => {
      const tot = Number(r.totalAmount) || 0;
      const paid = Number(r.paidAmount) || 0;
      const due = Number(r.dueAmount) || 0;
      const lit = Number(r.liters) || 0;
      const fType = String(r.fuelType || 'Diesel').toLowerCase();
      const pMethod = String(r.paymentMethod || 'CASH').toUpperCase();

      totalExpense += tot;
      totalCreditDue += due;

      if (pMethod === 'BANK') {
        totalPaidBank += paid;
      } else {
        totalPaidCash += paid;
      }

      totalLiters += lit;
      if (fType.includes('diesel')) {
        dieselLiters += lit;
        dieselExpense += tot;
      } else if (fType.includes('petrol')) {
        petrolLiters += lit;
        petrolExpense += tot;
      }
    });

    return {
      totalExpense,
      totalPaidCash,
      totalPaidBank,
      totalCreditDue,
      totalLiters,
      dieselLiters,
      petrolLiters,
      dieselExpense,
      petrolExpense,
      tripsCount: filteredRecords.length
    };
  }, [filteredRecords]);

  // Dynamic Today's Fuel Stats
  const todayFuelStats = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const isMatchToday = (raw) => {
      if (!raw) return false;
      const d = new Date(raw);
      if (isNaN(d.getTime())) return false;
      if (d.toDateString() === now.toDateString()) return true;
      const dLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (dLocal === localToday) return true;
      return d.toISOString().split('T')[0] === todayStr;
    };

    let totalExpense = 0;
    let totalLiters = 0;
    let totalPaidCash = 0;
    let totalPaidBank = 0;
    let totalCreditDue = 0;
    let tripsCount = 0;

    (fuelRecords || []).forEach(r => {
      if (isMatchToday(r.expenseDate || r.createdAt || r.date)) {
        tripsCount += 1;
        totalExpense += Number(r.totalAmount || 0);
        totalLiters += Number(r.liters || 0);
        const paid = Number(r.paidAmount || 0);
        const due = Number(r.dueAmount || 0);
        totalCreditDue += due;
        const pMethod = String(r.paymentMethod || 'CASH').toUpperCase();
        if (pMethod === 'BANK') {
          totalPaidBank += paid;
        } else {
          totalPaidCash += paid;
        }
      }
    });

    return {
      totalExpense,
      totalLiters,
      totalPaidCash,
      totalPaidBank,
      totalCreditDue,
      tripsCount
    };
  }, [fuelRecords]);

  // Date filter controls
  const handleApplyDateFilter = () => {
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    toast.success('Date filter applied to Fuel & Vehicle report');
  };

  const handleClearDateFilter = () => {
    setStartDate('');
    setEndDate('');
    setAppliedStartDate('');
    setAppliedEndDate('');
    toast.info('Date filter reset');
  };

  // Print Complete Fuel Report
  const handlePrintFuelReport = () => {
    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Please allow popups to print report');
      return;
    }

    const dateRangeLabel = appliedStartDate && appliedEndDate
      ? `${new Date(appliedStartDate).toLocaleDateString('en-PK')} to ${new Date(appliedEndDate).toLocaleDateString('en-PK')}`
      : appliedStartDate
      ? `From ${new Date(appliedStartDate).toLocaleDateString('en-PK')}`
      : appliedEndDate
      ? `Up to ${new Date(appliedEndDate).toLocaleDateString('en-PK')}`
      : 'All-Time Cumulative';

    const tableRows = filteredRecords.map((r, idx) => {
      const d = new Date(r.expenseDate || r.createdAt || Date.now()).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const due = Number(r.dueAmount) || 0;
      const isCredit = due > 0 || String(r.paymentMethod).toUpperCase() === 'CREDIT';

      return `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding:7px 8px; border:1px solid #cbd5e1; text-align:center; font-weight:bold;">${idx + 1}</td>
          <td style="padding:7px 8px; border:1px solid #cbd5e1; font-size:10.5px; color:#475569;">${d}</td>
          <td style="padding:7px 8px; border:1px solid #cbd5e1; font-weight:bold; color:#0f172a;">
            <div>${r.vehicleNo}</div>
            ${r.vehicleName ? `<div style="font-size:9.5px; color:#64748b; font-weight:normal;">${r.vehicleName}</div>` : ''}
            ${r.driverName ? `<div style="font-size:9px; color:#065f46; font-weight:bold;">Driver: ${r.driverName}</div>` : ''}
          </td>
          <td style="padding:7px 8px; border:1px solid #cbd5e1; font-size:10px;">
            <div style="font-weight:700; color:#1e293b;">${r.purpose || 'Transport'}</div>
            ${r.petrolPump ? `<div style="font-size:9px; color:#64748b;">⛽ ${r.petrolPump}</div>` : ''}
            ${r.odometerReading ? `<div style="font-size:9px; color:#94a3b8;">📟 ${r.odometerReading}</div>` : ''}
          </td>
          <td style="padding:7px 8px; border:1px solid #cbd5e1; text-align:center;">
            <span style="font-size:9.5px; font-weight:800; padding:2px 6px; border-radius:4px; ${String(r.fuelType).toLowerCase().includes('diesel') ? 'background:#fef3c7; color:#92400e;' : 'background:#e0f2fe; color:#0369a1;'}">
              ${r.fuelType || 'Diesel'}
            </span>
            <div style="font-size:10px; font-weight:800; color:#0f172a; margin-top:2px;">
              ${r.liters ? `${r.liters} L` : '—'}
              ${r.ratePerLiter ? `<span style="font-size:8.5px; color:#64748b;">(@${r.ratePerLiter})</span>` : ''}
            </div>
          </td>
          <td style="padding:7px 8px; border:1px solid #cbd5e1; text-align:center;">
            <span style="font-size:9.5px; font-weight:800; padding:2px 7px; border-radius:4px; ${isCredit ? 'background:#ffe4e6; color:#be123c;' : r.paymentMethod === 'BANK' ? 'background:#eff6ff; color:#2563eb;' : 'background:#ecfdf5; color:#047857;'}">
              ${r.paymentMethod || 'CASH'}
            </span>
          </td>
          <td style="padding:7px 8px; border:1px solid #cbd5e1; text-align:right; font-weight:900; color:#047857;">
            RS ${(Number(r.totalAmount) || 0).toLocaleString('en-PK')}
          </td>
          <td style="padding:7px 8px; border:1px solid #cbd5e1; text-align:right; font-weight:bold; color:${due > 0 ? '#e11d48' : '#64748b'};">
            ${due > 0 ? `RS ${due.toLocaleString('en-PK')}` : 'PAID'}
          </td>
        </tr>
      `;
    }).join('');

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Vehicle Fuel &amp; Transport Expenses Statement - ${shopName}</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            * { box-sizing: border-box; }
            body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; padding: 15px; color: #0f172a; background: #ffffff; font-size: 11px; margin: 0; }
            .header { background: linear-gradient(135deg, #064e3b 0%, #047857 50%, #0f172a 100%); color: #ffffff; padding: 18px 24px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; }
            .header h1 { margin: 0; font-size: 19px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; }
            .header p { margin: 3px 0 0; font-size: 10px; font-weight: 700; color: #a7f3d0; text-transform: uppercase; letter-spacing: 1px; }
            .meta-bar { display: flex; justify-content: space-between; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 8px 14px; margin-top: 12px; font-size: 10px; font-weight: 800; color: #475569; }
            .stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-top: 12px; }
            .stat-card { border-radius: 10px; padding: 10px 14px; border: 1.5px solid #cbd5e1; }
            .stat-card .lbl { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; }
            .stat-card .val { font-size: 16px; font-weight: 900; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; border: 1.5px solid #cbd5e1; border-radius: 8px; overflow: hidden; margin-top: 14px; }
            th { background: #0f172a; color: #ffffff; text-transform: uppercase; font-weight: 900; font-size: 9px; padding: 8px; text-align: left; border: 1px solid #0f172a; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px; margin-top: 30px; padding-top: 14px; border-top: 1px dashed #cbd5e1; text-align: center; }
            .sign-line { border-top: 1.5px solid #94a3b8; padding-top: 4px; font-size: 9.5px; font-weight: 800; color: #475569; text-transform: uppercase; }
            .footer { margin-top: 16px; text-align: center; font-size: 8.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
            @media print {
              body { padding: 0; }
              * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>${shopName.toUpperCase()}</h1>
              <p>VEHICLE FUEL &amp; TRANSPORT STATEMENT</p>
            </div>
            <div style="text-align: right; background: #f59e0b; color: #0f172a; padding: 6px 14px; border-radius: 8px; font-weight: 900; font-size: 12px;">
              ${filteredRecords.length} TRIPS / LOGS
            </div>
          </div>

          <div class="meta-bar">
            <span>📅 Period: <strong>${dateRangeLabel}</strong></span>
            <span>🏢 Store: <strong>${shopName}</strong> (Shop ID: ${shopId})</span>
            <span>🖨️ Printed: <strong>${new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong></span>
          </div>

          <div class="stats-grid">
            <div class="stat-card" style="background: #ecfdf5; border-color: #10b981;">
              <div class="lbl" style="color: #065f46;">Total Fuel Expenses</div>
              <div class="val" style="color: #047857;">RS ${stats.totalExpense.toLocaleString('en-PK')}</div>
            </div>
            <div class="stat-card" style="background: #eff6ff; border-color: #3b82f6;">
              <div class="lbl" style="color: #1e40af;">Total Liters Consumed</div>
              <div class="val" style="color: #1d4ed8;">${stats.totalLiters.toFixed(1)} L</div>
            </div>
            <div class="stat-card" style="background: #f0fdf4; border-color: #86efac;">
              <div class="lbl" style="color: #166534;">Paid in Cash</div>
              <div class="val" style="color: #15803d;">RS ${stats.totalPaidCash.toLocaleString('en-PK')}</div>
            </div>
            <div class="stat-card" style="background: #f5f3ff; border-color: #a855f7;">
              <div class="lbl" style="color: #6b21a8;">Paid via Bank</div>
              <div class="val" style="color: #7e22ce;">RS ${stats.totalPaidBank.toLocaleString('en-PK')}</div>
            </div>
            <div class="stat-card" style="background: #fff1f2; border-color: #f43f5e;">
              <div class="lbl" style="color: #9f1239;">Remaining Credit Due</div>
              <div class="val" style="color: #e11d48;">RS ${stats.totalCreditDue.toLocaleString('en-PK')}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width:30px; text-align:center;">#</th>
                <th style="width:110px;">Date &amp; Time</th>
                <th>Vehicle &amp; Driver</th>
                <th>Trip Purpose &amp; Station</th>
                <th style="text-align:center; width:90px;">Fuel &amp; Liters</th>
                <th style="text-align:center; width:80px;">Payment</th>
                <th style="text-align:right; width:90px;">Total Cost</th>
                <th style="text-align:right; width:80px;">Due / Debt</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows || '<tr><td colspan="8" style="padding:15px; text-align:center; color:#94a3b8;">No fuel expense records found.</td></tr>'}
            </tbody>
            <tfoot>
              <tr style="background:#f1f5f9; font-weight:900;">
                <td colspan="4" style="padding:8px; border:1px solid #cbd5e1; text-align:right; text-transform:uppercase;">TOTALS:</td>
                <td style="padding:8px; border:1px solid #cbd5e1; text-align:center; color:#1d4ed8;">${stats.totalLiters.toFixed(1)} Liters</td>
                <td style="padding:8px; border:1px solid #cbd5e1; text-align:center;">${filteredRecords.length} Logs</td>
                <td style="padding:8px; border:1px solid #cbd5e1; text-align:right; color:#047857; font-size:12px;">RS ${stats.totalExpense.toLocaleString('en-PK')}</td>
                <td style="padding:8px; border:1px solid #cbd5e1; text-align:right; color:#e11d48; font-size:12px;">RS ${stats.totalCreditDue.toLocaleString('en-PK')}</td>
              </tr>
            </tfoot>
          </table>

          <div class="signatures">
            <div class="sign-line">Driver / Transport Incharge</div>
            <div class="sign-line">Accountant / Cashier</div>
            <div class="sign-line">${shopName} Authorized Stamp</div>
          </div>

          <div class="footer">
            ${shopName} • Financial Management &amp; Transport Vehicle Accounting Ledger
          </div>
        </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => printWin.print(), 300);
  };

  // Print Single Fuel Slip
  const handlePrintSingleFuelSlip = (rec, idx = 0) => {
    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Please allow popups');
      return;
    }

    const d = new Date(rec.expenseDate || rec.createdAt || Date.now()).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const voucherNo = `#FUEL-${String(rec.id || idx + 1).slice(-4).padStart(4, '0')}`;
    const due = Number(rec.dueAmount) || 0;
    const isCredit = due > 0 || String(rec.paymentMethod).toUpperCase() === 'CREDIT';

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Vehicle Fuel Voucher - ${voucherNo}</title>
          <style>
            @page { size: A5 portrait; margin: 10mm; }
            * { box-sizing: border-box; }
            body { font-family: 'Segoe UI', -apple-system, sans-serif; padding: 15px; color: #0f172a; font-size: 12px; margin: 0; }
            .voucher { border: 2px solid #047857; border-radius: 14px; overflow: hidden; }
            .head { background: #064e3b; color: #ffffff; padding: 16px; display: flex; justify-content: space-between; align-items: center; }
            .head h2 { margin: 0; font-size: 16px; font-weight: 900; text-transform: uppercase; }
            .body { padding: 16px 20px; }
            .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #e2e8f0; }
            .lbl { font-weight: 800; color: #64748b; text-transform: uppercase; font-size: 10px; }
            .val { font-weight: 900; color: #0f172a; font-size: 13px; }
            .total-banner { background: #ecfdf5; border: 1.5px solid #10b981; border-radius: 10px; padding: 12px 16px; margin: 16px 0; display: flex; justify-content: space-between; align-items: center; }
            .signs { display: flex; justify-content: space-between; margin-top: 30px; text-align: center; }
            .sign { border-top: 1.5px solid #94a3b8; width: 140px; padding-top: 4px; font-size: 9.5px; font-weight: 800; color: #475569; text-transform: uppercase; }
            @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="voucher">
            <div class="head">
              <div>
                <h2>${shopName}</h2>
                <div style="font-size: 9.5px; color: #a7f3d0; margin-top: 2px; text-transform: uppercase; font-weight: 800;">OFFICIAL VEHICLE FUEL RECEIPT</div>
              </div>
              <div style="background: #f59e0b; color: #0f172a; padding: 4px 10px; border-radius: 6px; font-weight: 900;">${voucherNo}</div>
            </div>
            <div class="body">
              <div class="row">
                <span class="lbl">Date &amp; Time</span>
                <span class="val">${d}</span>
              </div>
              <div class="row">
                <span class="lbl">Vehicle Number</span>
                <span class="val" style="color: #047857;">${rec.vehicleNo} ${rec.vehicleName ? `(${rec.vehicleName})` : ''}</span>
              </div>
              <div class="row">
                <span class="lbl">Driver</span>
                <span class="val">${rec.driverName || 'Not Specified'} ${rec.driverPhone ? `• ${rec.driverPhone}` : ''}</span>
              </div>
              <div class="row">
                <span class="lbl">Trip / Purpose</span>
                <span class="val">${rec.purpose || 'Transport'}</span>
              </div>
              <div class="row">
                <span class="lbl">Fuel Type &amp; Liters</span>
                <span class="val">${rec.fuelType || 'Diesel'}: ${rec.liters ? `${rec.liters} Liters` : '—'} ${rec.ratePerLiter ? `(@RS ${rec.ratePerLiter}/L)` : ''}</span>
              </div>
              <div class="row">
                <span class="lbl">Petrol Pump / Station</span>
                <span class="val">${rec.petrolPump || 'N/A'}</span>
              </div>
              <div class="row">
                <span class="lbl">Payment Method</span>
                <span class="val" style="color: ${isCredit ? '#be123c' : '#047857'};">${rec.paymentMethod || 'CASH'}</span>
              </div>

              <div class="total-banner">
                <div>
                  <div style="font-size: 10px; font-weight: 900; color: #065f46; text-transform: uppercase;">Total Fuel Expense:</div>
                  ${due > 0 ? `<div style="font-size: 11px; font-weight: 800; color: #be123c;">Paid: RS ${(Number(rec.paidAmount) || 0).toLocaleString('en-PK')} • Due: RS ${due.toLocaleString('en-PK')}</div>` : ''}
                </div>
                <div style="font-size: 20px; font-weight: 900; color: #047857;">RS ${(Number(rec.totalAmount) || 0).toLocaleString('en-PK')}</div>
              </div>

              <div class="signs">
                <div class="sign">Driver Signature</div>
                <div class="sign">Authorized Signature</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => printWin.print(), 300);
  };

  // WhatsApp Share
  const handleWhatsAppShare = () => {
    const dateRangeLabel = appliedStartDate && appliedEndDate
      ? `${appliedStartDate} to ${appliedEndDate}`
      : 'All Time';

    let msg = `⛽ *VEHICLE FUEL & TRANSPORT REPORT - ${shopName.toUpperCase()}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📅 *Period:* ${dateRangeLabel}\n`;
    msg += `🚗 *Total Vehicle Trips:* ${stats.tripsCount}\n`;
    msg += `🛢️ *Total Liters Consumed:* ${stats.totalLiters.toFixed(1)} Liters\n`;
    if (stats.dieselLiters > 0) msg += `  • Diesel: ${stats.dieselLiters.toFixed(1)} L (RS ${stats.dieselExpense.toLocaleString('en-PK')})\n`;
    if (stats.petrolLiters > 0) msg += `  • Petrol: ${stats.petrolLiters.toFixed(1)} L (RS ${stats.petrolExpense.toLocaleString('en-PK')})\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💰 *TOTAL FUEL EXPENSE:* RS ${stats.totalExpense.toLocaleString('en-PK')}\n`;
    msg += `💵 *Paid in Cash:* RS ${stats.totalPaidCash.toLocaleString('en-PK')}\n`;
    if (stats.totalPaidBank > 0) msg += `🏦 *Paid via Bank:* RS ${stats.totalPaidBank.toLocaleString('en-PK')}\n`;
    if (stats.totalCreditDue > 0) {
      msg += `⚠️ *OUTSTANDING CREDIT DUE:* RS ${stats.totalCreditDue.toLocaleString('en-PK')}\n`;
    } else {
      msg += `✅ *Credit Due:* RS 0 (All Paid)\n`;
    }
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `Generated via ${shopName} Financial Ledger`;

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      toast.warning('No records to export');
      return;
    }
    let csv = 'ID,Date,Vehicle No,Vehicle Name,Driver Name,Driver Phone,Purpose,Fuel Type,Liters,Rate Per Liter,Total Amount,Payment Method,Paid Amount,Due Amount,Petrol Pump,Notes\n';
    filteredRecords.forEach((r, idx) => {
      const d = new Date(r.expenseDate || r.createdAt || Date.now()).toISOString();
      csv += `"${idx + 1}","${d}","${r.vehicleNo || ''}","${r.vehicleName || ''}","${r.driverName || ''}","${r.driverPhone || ''}","${r.purpose || ''}","${r.fuelType || ''}","${r.liters || 0}","${r.ratePerLiter || 0}","${r.totalAmount || 0}","${r.paymentMethod || 'CASH'}","${r.paidAmount || 0}","${r.dueAmount || 0}","${r.petrolPump || ''}","${(r.notes || '').replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Fuel_Report_${shopName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Fuel report exported to CSV successfully');
  };

  return (
    <div className="space-y-6">
      {/* ─── TOP HEADER & ACTIONS ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-600 shadow-sm">
              <Fuel className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-wide">
                Fuel Expenses
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Vehicle fuel and transport logs
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => { setEditingRecord(null); setFormData(initialFormState); setIsAddModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-sm transition-all shadow-md hover:shadow-emerald-600/25 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Add Fuel</span>
          </button>

          <button
            onClick={handlePrintFuelReport}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-all border border-slate-300 hover:border-slate-400 cursor-pointer shadow-sm"
          >
            <Printer className="w-4 h-4 text-emerald-600" />
            <span>Print</span>
          </button>

          <button
            onClick={handleWhatsAppShare}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold rounded-xl text-xs transition-all cursor-pointer shadow-sm"
          >
            <Share2 className="w-4 h-4 text-emerald-600" />
            <span>WhatsApp</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-teal-600" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* ─── DATE RANGE FILTER BAR (EXACT PATTERN ACROSS APP) ─── */}
      <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>Start:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                const val = e.target.value;
                setStartDate(val);
                setAppliedStartDate(val);
              }}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-emerald-500 transition-colors shadow-sm"
            />
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <span>End:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                const val = e.target.value;
                setEndDate(val);
                setAppliedEndDate(val);
              }}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-emerald-500 transition-colors shadow-sm"
            />
          </div>

          <button
            onClick={handleApplyDateFilter}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-lg text-xs transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filter</span>
          </button>

          {(appliedStartDate || appliedEndDate) && (
            <button
              onClick={handleClearDateFilter}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}

          <div className="ml-auto text-xs text-slate-500 font-semibold">
            Showing <span className="text-emerald-700 font-black">{filteredRecords.length}</span> of {fuelRecords.length} records
          </div>
        </div>
      </div>

      {/* ─── SUMMARY STATS CARDS ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Expense */}
        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wider">Total Cost</span>
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 border border-emerald-100">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-slate-900 mt-2">
              RS {stats.totalExpense.toLocaleString('en-PK')}
            </div>
            <div className="text-[10.5px] text-slate-500 mt-1 flex justify-between font-medium">
              <span>{stats.tripsCount} Trips</span>
              <span className="text-emerald-700 font-bold">{stats.totalLiters.toFixed(1)} L</span>
            </div>
          </div>
        </div>

        {/* Liters Consumed */}
        <div className="bg-white p-4 rounded-xl border border-sky-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-sky-800 uppercase tracking-wider">Total Liters</span>
              <div className="p-2 bg-sky-50 rounded-lg text-sky-600 border border-sky-100">
                <Gauge className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-slate-900 mt-2">
              {stats.totalLiters.toFixed(1)} <span className="text-xs text-sky-700 font-bold">L</span>
            </div>
            <div className="text-[10.5px] text-slate-500 mt-1 flex justify-between font-medium">
              <span>Diesel: <strong className="text-amber-700">{stats.dieselLiters.toFixed(1)}L</strong></span>
              <span>Petrol: <strong className="text-sky-700">{stats.petrolLiters.toFixed(1)}L</strong></span>
            </div>
          </div>
        </div>

        {/* Paid Cash */}
        <div className="bg-white p-4 rounded-xl border border-teal-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-teal-800 uppercase tracking-wider">Cash Paid</span>
              <div className="p-2 bg-teal-50 rounded-lg text-teal-600 border border-teal-100">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-teal-700 mt-2">
              RS {stats.totalPaidCash.toLocaleString('en-PK')}
            </div>
            <div className="text-[10.5px] text-slate-500 mt-1 font-medium">
              Cash Settled
            </div>
          </div>
        </div>

        {/* Paid Bank */}
        <div className="bg-white p-4 rounded-xl border border-purple-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-purple-800 uppercase tracking-wider">Bank Paid</span>
              <div className="p-2 bg-purple-50 rounded-lg text-purple-600 border border-purple-100">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-purple-700 mt-2">
              RS {stats.totalPaidBank.toLocaleString('en-PK')}
            </div>
            <div className="text-[10.5px] text-slate-500 mt-1 font-medium">
              Bank Transfer
            </div>
          </div>
        </div>

        {/* Remaining Credit Due */}
        <div className={`p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between ${stats.totalCreditDue > 0 ? 'bg-rose-50/70 border-rose-300' : 'bg-white border-slate-200'}`}>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-rose-800 uppercase tracking-wider">Credit Due</span>
              <div className="p-2 bg-rose-100 rounded-lg text-rose-600 border border-rose-200">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <div className={`text-xl font-black mt-2 ${stats.totalCreditDue > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
              RS {stats.totalCreditDue.toLocaleString('en-PK')}
            </div>
            <div className="text-[10.5px] text-slate-500 mt-1 font-medium">
              {stats.totalCreditDue > 0 ? 'Due Debt' : 'Paid'}
            </div>
          </div>
        </div>
      </div>

      {/* ─── DEDICATED TODAY'S FUEL & VEHICLE SUMMARY (GRAY & BIGGER SIZE) ─── */}
      <div className="bg-slate-100 border-2 border-slate-300 rounded-3xl p-5 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-slate-700 animate-pulse" />
            Today's Vehicle Fuel &amp; Transport Activity (Daily Breakdown)
          </span>
          <span className="text-xs bg-white text-slate-800 border-2 border-slate-300 px-3 py-1 rounded-xl font-bold shadow-xs">
            {todayFuelStats.tripsCount} Trips &bull; {todayFuelStats.totalLiters.toFixed(1)} Liters Today
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Card 1: Today Fuel Expense */}
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">1. Today Fuel Expense</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-2">RS {todayFuelStats.totalExpense.toLocaleString('en-PK')}</div>
            <span className="text-[10px] font-bold text-slate-600 truncate mt-1">{todayFuelStats.tripsCount} Trips Recorded</span>
          </div>

          {/* Card 2: Today Fuel Liters */}
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-sky-800">2. Today Fuel Liters</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-2">{todayFuelStats.totalLiters.toFixed(1)} L</div>
            <span className="text-[10px] font-bold text-slate-600 truncate mt-1">Total Fuel Consumed</span>
          </div>

          {/* Card 3: Today Cash */}
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-teal-800">3. Today Cash Paid</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-2">RS {todayFuelStats.totalPaidCash.toLocaleString('en-PK')}</div>
            <span className="text-[10px] font-bold text-slate-600 truncate mt-1">Cash Settled</span>
          </div>

          {/* Card 4: Today Bank */}
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-800">4. Today Bank Paid</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-2">RS {todayFuelStats.totalPaidBank.toLocaleString('en-PK')}</div>
            <span className="text-[10px] font-bold text-slate-600 truncate mt-1">Bank Transfer</span>
          </div>

          {/* Card 5: Today Credit Due */}
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 flex flex-col justify-between shadow-xs col-span-2 sm:col-span-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-800">5. Today Credit Due</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-2">RS {todayFuelStats.totalCreditDue.toLocaleString('en-PK')}</div>
            <span className="text-[10px] font-bold text-slate-600 truncate mt-1">{todayFuelStats.totalCreditDue > 0 ? 'Unsettled Fuel Due' : 'All Settled'}</span>
          </div>
        </div>
      </div>

      {/* ─── SECONDARY FILTER & SEARCH BAR ─── */}
      <div className="flex flex-col sm:flex-row gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search vehicle, driver, pump..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors shadow-sm font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Fuel Type Filter */}
          <select
            value={selectedFuelType}
            onChange={(e) => setSelectedFuelType(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-700 font-bold focus:outline-none focus:border-emerald-500 shadow-sm"
          >
            <option value="ALL">All Fuels</option>
            <option value="DIESEL">Diesel</option>
            <option value="PETROL">Petrol</option>
            <option value="CNG">CNG</option>
            <option value="MOBIL OIL">Mobil Oil</option>
          </select>

          {/* Payment Method Filter */}
          <select
            value={selectedPaymentMethod}
            onChange={(e) => setSelectedPaymentMethod(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-700 font-bold focus:outline-none focus:border-emerald-500 shadow-sm"
          >
            <option value="ALL">All Payments</option>
            <option value="CASH">Cash</option>
            <option value="BANK">Bank</option>
            <option value="CREDIT">Credit</option>
          </select>

          {/* Distinct Vehicle Filter */}
          {distinctVehicles.length > 0 && (
            <select
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-700 font-bold focus:outline-none focus:border-emerald-500 shadow-sm"
            >
              <option value="ALL">All Vehicles ({distinctVehicles.length})</option>
              {distinctVehicles.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ─── RECORDS TABLE ─── */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-[10.5px] font-black uppercase text-slate-600 tracking-wider">
                <th className="py-3 px-3.5 text-center w-12">#</th>
                <th className="py-3 px-3.5">Date</th>
                <th className="py-3 px-3.5">Vehicle / Driver</th>
                <th className="py-3 px-3.5">Purpose</th>
                <th className="py-3 px-3.5 text-center">Fuel</th>
                <th className="py-3 px-3.5 text-center">Payment</th>
                <th className="py-3 px-3.5 text-right">Total</th>
                <th className="py-3 px-3.5 text-right">Due</th>
                <th className="py-3 px-3.5 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Fuel className="w-6 h-6 animate-spin text-emerald-600" />
                      <span>Loading vehicle fuel records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Truck className="w-8 h-8 text-slate-300" />
                      <span className="font-bold text-sm text-slate-600">No vehicle fuel records found</span>
                      <span className="text-[11px] text-slate-400">Click &quot;+ Add Fuel Expense&quot; above to log your first car/truck diesel or petrol expense.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec, idx) => {
                  const due = Number(rec.dueAmount) || 0;
                  const isCredit = due > 0 || String(rec.paymentMethod).toUpperCase() === 'CREDIT';
                  const dateStr = new Date(rec.expenseDate || rec.createdAt || Date.now()).toLocaleDateString('en-PK', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <tr key={rec.id || rec._id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3.5 text-center font-bold text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap text-slate-600 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{dateStr}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 font-black rounded-md text-[11px] tracking-wide">
                            {rec.vehicleNo}
                          </span>
                          {rec.vehicleName && (
                            <span className="text-slate-600 text-[11px] font-semibold">
                              ({rec.vehicleName})
                            </span>
                          )}
                        </div>
                        {rec.driverName && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 mt-1">
                            <User className="w-3 h-3 text-slate-400" />
                            <span className="font-semibold">{rec.driverName}</span>
                            {rec.driverPhone && (
                              <span className="text-slate-400">({rec.driverPhone})</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-800">
                          {rec.purpose || 'Stock Purchase Transport'}
                        </div>
                        {rec.petrolPump && (
                          <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <span>⛽ {rec.petrolPump}</span>
                          </div>
                        )}
                        {rec.odometerReading && (
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Gauge className="w-3 h-3 text-slate-400" />
                            <span>{rec.odometerReading}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${String(rec.fuelType).toLowerCase().includes('diesel') ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-sky-50 text-sky-800 border border-sky-200'}`}>
                          {rec.fuelType || 'Diesel'}
                        </span>
                        <div className="font-black text-slate-900 mt-0.5">
                          {rec.liters ? `${rec.liters} L` : '—'}
                        </div>
                        {rec.ratePerLiter > 0 && (
                          <div className="text-[9.5px] text-slate-400 font-semibold">
                            @RS {rec.ratePerLiter}/L
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase ${isCredit ? 'bg-rose-50 text-rose-700 border border-rose-200' : rec.paymentMethod === 'BANK' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                          {isCredit ? 'CREDIT' : rec.paymentMethod === 'BANK' ? 'BANK' : 'CASH'}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-right font-black text-emerald-700 text-sm whitespace-nowrap">
                        RS {(Number(rec.totalAmount) || 0).toLocaleString('en-PK')}
                      </td>
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        {due > 0 ? (
                          <div>
                            <div className="text-rose-700 font-black text-[11.5px]">
                              Due: RS {due.toLocaleString('en-PK')}
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium">
                              Paid: RS {(Number(rec.paidAmount) || 0).toLocaleString('en-PK')}
                            </div>
                            <button
                              onClick={() => { setSettleRecord(rec); setSettleAmount(String(due)); setSettleMethod('CASH'); }}
                              className="mt-1 px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-[9.5px] font-bold transition-all cursor-pointer shadow-sm"
                            >
                              Settle
                            </button>
                          </div>
                        ) : (
                          <span className="text-emerald-600 font-bold text-[11px] flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Paid</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handlePrintSingleFuelSlip(rec, idx)}
                            title="Print Voucher Slip"
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg transition-colors cursor-pointer shadow-sm"
                          >
                            <Printer className="w-3.5 h-3.5 text-emerald-600" />
                          </button>
                          <button
                            onClick={() => openEditModal(rec)}
                            title="Edit"
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg transition-colors cursor-pointer shadow-sm"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-sky-600" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(rec.id || rec._id)}
                            title="Delete"
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg transition-colors cursor-pointer shadow-sm"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── ADD / EDIT FUEL MODAL ─── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto shadow-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg shadow-sm">
                  <Fuel className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 leading-tight">
                    {editingRecord ? 'Edit Fuel' : 'Add Fuel'}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Vehicle fuel details
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setIsAddModalOpen(false); setEditingRecord(null); }}
                className="p-1.5 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-2.5 text-xs">
              {/* Vehicle & Driver details - 4 columns */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-[11px]">
                    Vehicle No <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LES-1234"
                    value={formData.vehicleNo}
                    onChange={(e) => handleInputChange('vehicleNo', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-[11px]">
                    Vehicle Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Pickup, Mazda"
                    value={formData.vehicleName}
                    onChange={(e) => handleInputChange('vehicleName', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-[11px]">
                    Driver Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ahmad, Bilal"
                    value={formData.driverName}
                    onChange={(e) => handleInputChange('driverName', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-[11px]">
                    Driver Phone
                  </label>
                  <input
                    type="text"
                    placeholder="0300-1234567"
                    value={formData.driverPhone}
                    onChange={(e) => handleInputChange('driverPhone', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {/* Purpose / Station */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-[11px]">
                    Purpose
                  </label>
                  <select
                    value={formData.purpose}
                    onChange={(e) => handleInputChange('purpose', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 transition-colors font-medium"
                  >
                    <option value="Stock Purchase Transport">Stock Purchase</option>
                    <option value="Customer Order Delivery">Delivery</option>
                    <option value="Farm & Mandi Routine Trip">Farm Trip</option>
                    <option value="Shop Routine & General Run">Shop Routine</option>
                    <option value="Vehicle Maintenance & Repair">Maintenance</option>
                    <option value="Other Transport">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-[11px]">
                    Pump Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PSO Bypass, Shell Station"
                    value={formData.petrolPump}
                    onChange={(e) => handleInputChange('petrolPump', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {/* Fuel Type, Liters, Rate, Total */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-emerald-800 uppercase text-[10.5px] tracking-wider">
                    Fuel
                  </span>
                  <div className="flex items-center gap-1.5">
                    {['Diesel', 'Petrol', 'CNG', 'Mobil Oil'].map(f => (
                      <button
                        type="button"
                        key={f}
                        onClick={() => handleInputChange('fuelType', f)}
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition-all cursor-pointer ${formData.fuelType === f ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white border border-slate-300 text-slate-600 hover:text-slate-900'}`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-slate-600 font-bold mb-0.5 text-[10.5px]">
                      Liters
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 25"
                      value={formData.liters}
                      onChange={(e) => handleInputChange('liters', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-500 shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-0.5 text-[10.5px]">
                      Rate / Liter (RS)
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 280"
                      value={formData.ratePerLiter}
                      onChange={(e) => handleInputChange('ratePerLiter', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-500 shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-emerald-800 font-black mb-0.5 text-[10.5px]">
                      Total (RS) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="Total"
                      value={formData.totalAmount}
                      onChange={(e) => handleInputChange('totalAmount', e.target.value)}
                      className="w-full bg-white border border-emerald-400 rounded-lg px-2 py-1.5 text-emerald-700 font-black text-xs focus:outline-none focus:border-emerald-500 shadow-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Method, Paid, Due */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-800 uppercase text-[10.5px] tracking-wider">
                    Payment
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[
                      { id: 'CASH', label: 'Cash' },
                      { id: 'BANK', label: 'Bank' },
                      { id: 'CREDIT', label: 'Credit' }
                    ].map(p => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => handleInputChange('paymentMethod', p.id)}
                        className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase transition-all cursor-pointer ${formData.paymentMethod === p.id ? (p.id === 'CREDIT' ? 'bg-rose-600 text-white shadow-sm' : 'bg-slate-900 text-white shadow-sm') : 'bg-white border border-slate-300 text-slate-600 hover:text-slate-900'}`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 font-bold mb-0.5 text-[10.5px]">
                      Paid (RS)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.paidAmount}
                      onChange={(e) => handleInputChange('paidAmount', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-500 shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-rose-700 font-bold mb-0.5 text-[10.5px]">
                      Due (RS)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.dueAmount}
                      onChange={(e) => handleInputChange('dueAmount', e.target.value)}
                      className="w-full bg-white border border-rose-300 rounded-lg px-2.5 py-1.5 text-xs text-rose-700 font-black focus:outline-none focus:border-rose-400 shadow-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Date, Odometer & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-[11px]">
                    Date
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.expenseDate}
                    onChange={(e) => handleInputChange('expenseDate', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-[11px]">
                    Odometer (KM)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 142,500 KM"
                    value={formData.odometerReading}
                    onChange={(e) => handleInputChange('odometerReading', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-[11px]">
                    Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Trip details..."
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => { setIsAddModalOpen(false); setEditingRecord(null); }}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs transition-colors cursor-pointer border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-lg text-xs transition-all shadow-md hover:shadow-emerald-600/25 cursor-pointer"
                >
                  {editingRecord ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── SETTLE DUE MODAL ─── */}
      {settleRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Settle Due</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Vehicle: <strong className="text-emerald-700">{settleRecord.vehicleNo}</strong>
            </p>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 my-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-600">Total Bill:</span>
                <span className="font-bold text-slate-900">RS {(Number(settleRecord.totalAmount) || 0).toLocaleString('en-PK')}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-600">Paid:</span>
                <span className="font-bold text-teal-700">RS {(Number(settleRecord.paidAmount) || 0).toLocaleString('en-PK')}</span>
              </div>
              <div className="flex justify-between text-xs pt-2 border-t border-slate-200">
                <span className="font-black text-rose-700">Due:</span>
                <span className="font-black text-rose-700 text-sm">RS {(Number(settleRecord.dueAmount) || 0).toLocaleString('en-PK')}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Amount to Pay (RS)
                </label>
                <input
                  type="number"
                  step="any"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className="w-full bg-white border border-emerald-400 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold text-sm focus:outline-none focus:border-emerald-500 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Payment Method
                </label>
                <div className="flex gap-2">
                  {['CASH', 'BANK'].map(m => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setSettleMethod(m)}
                      className={`flex-1 py-2 rounded-xl font-black text-xs transition-all cursor-pointer ${settleMethod === m ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200'}`}
                    >
                      {m === 'CASH' ? 'Cash' : 'Bank'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-6">
              <button
                onClick={() => setSettleRecord(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer border border-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSettleDue}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition-all shadow-sm cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE CONFIRMATION MODAL ─── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900">Delete Record?</h3>
            <p className="text-xs text-slate-500 mt-1">
              This fuel expense record will be permanently deleted.
            </p>
            <div className="flex justify-center gap-3 mt-5">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer border border-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs transition-all shadow-sm cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FuelReportManagement;
