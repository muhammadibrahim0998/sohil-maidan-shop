import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  Plus,
  Search,
  Phone,
  MapPin,
  Mail,
  FileText,
  AlertCircle,
  CheckCircle2,
  X,
  RefreshCw,
  Loader2,
  Send,
  Edit2,
  Trash2,
  Users,
  List,
  LayoutGrid,
  Calendar,
  Filter,
  Sparkles
} from 'lucide-react';
import { useProducts } from '../contexts/ProductContext';
import { useUser } from '../contexts/UserContext';
import { getVendors, createVendor, updateVendor, deleteVendor } from '../services/api';
import { CountUpNumber } from '../components/CountUpNumber';
import { toast } from 'sonner';

export function VendorsManagement({ shopId: propShopId }) {
  const { user } = useUser?.() || {};
  const currentShopId = propShopId || (user?.shopId ? (typeof user.shopId === 'object' ? (user.shopId._id || user.shopId.id) : user.shopId) : null);
  const { fetchData } = useProducts() || {};
  const [vendors, setVendors] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // ALL, WITH_PHONE, WITH_LOCATION
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
  const [loading, setLoading] = useState(false);
  const [vendorStartDate, setVendorStartDate] = useState('');
  const [vendorEndDate, setVendorEndDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');

  const handleApplyDateFilter = (startVal = vendorStartDate, endVal = vendorEndDate) => {
    setAppliedStartDate(startVal);
    setAppliedEndDate(endVal);
  };

  const handleClearDateFilter = () => {
    setVendorStartDate('');
    setVendorEndDate('');
    setAppliedStartDate('');
    setAppliedEndDate('');
  };

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

  const isDateInSelectedRange = (rawDate) => {
    if (!rawDate) return false;
    const d = parseSafeDate(rawDate);
    if (!d) return false;

    const activeStart = appliedStartDate || vendorStartDate;
    const activeEnd = appliedEndDate || vendorEndDate;

    if (activeStart || activeEnd) {
      const pad = (n) => String(n).padStart(2, '0');
      const localYMD = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const utcYMD = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

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

      const itemTs = d.getTime();

      if (activeStart && activeEnd) {
        const inStr = (localYMD >= activeStart && localYMD <= activeEnd) ||
          (utcYMD >= activeStart && utcYMD <= activeEnd);
        const inTs = (startTs !== null && itemTs >= startTs) && (endTs !== null && itemTs <= endTs);
        return inStr || inTs;
      }
      if (activeStart) {
        const inStr = localYMD >= activeStart || utcYMD >= activeStart;
        const inTs = startTs !== null && itemTs >= startTs;
        return inStr || inTs;
      }
      if (activeEnd) {
        const inStr = localYMD <= activeEnd || utcYMD <= activeEnd;
        const inTs = endTs !== null && itemTs <= endTs;
        return inStr || inTs;
      }
      return true;
    }

    return true;
  };

  // Add Vendor Modal State
  const [addVendorModal, setAddVendorModal] = useState({
    isOpen: false,
    name: '',
    phone: '',
    location: '',
    email: '',
    notes: '',
    isSubmitting: false,
    error: null,
  });

  // Edit Vendor Modal State
  const [editVendorModal, setEditVendorModal] = useState({
    isOpen: false,
    oldName: '',
    name: '',
    phone: '',
    location: '',
    email: '',
    notes: '',
    isSubmitting: false,
    error: null,
  });

  // Delete Vendor Modal State
  const [deleteVendorModal, setDeleteVendorModal] = useState({
    isOpen: false,
    name: '',
    isSubmitting: false,
    error: null,
  });

  const loadVendors = async () => {
    try {
      setLoading(true);
      const res = await getVendors(currentShopId);
      const list = Array.isArray(res) ? res : (res?.vendors || []);
      setVendors(list);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendors();
  }, [currentShopId]);

  // Handler: Add New Vendor
  const handleCreateVendor = async (e) => {
    if (e) e.preventDefault();
    if (!addVendorModal.name.trim()) {
      setAddVendorModal(prev => ({ ...prev, error: 'Vendor / Farm Name is required' }));
      return;
    }

    setAddVendorModal(prev => ({ ...prev, isSubmitting: true, error: null }));
    try {
      const activeShopId = currentShopId || (user?.shopId ? (typeof user.shopId === 'object' ? (user.shopId._id || user.shopId.id) : user.shopId) : 1);
      const res = await createVendor({
        name: addVendorModal.name.trim(),
        phone: addVendorModal.phone.trim(),
        location: addVendorModal.location.trim(),
        farmLocation: addVendorModal.location.trim(),
        email: addVendorModal.email.trim(),
        notes: addVendorModal.notes.trim(),
        shopId: activeShopId
      });

      toast.success(res?.message || `Vendor "${addVendorModal.name.trim()}" registered successfully!`);
      setAddVendorModal({
        isOpen: false,
        name: '',
        phone: '',
        location: '',
        email: '',
        notes: '',
        isSubmitting: false,
        error: null,
      });

      await loadVendors();
      if (fetchData) fetchData();
    } catch (err) {
      console.error(err);
      setAddVendorModal(prev => ({
        ...prev,
        isSubmitting: false,
        error: err?.response?.data?.message || err.message || 'Failed to create vendor'
      }));
    }
  };

  // Handler: Update Vendor
  const handleUpdateVendor = async (e) => {
    if (e) e.preventDefault();
    if (!editVendorModal.name.trim()) {
      setEditVendorModal(prev => ({ ...prev, error: 'Vendor name is required' }));
      return;
    }

    setEditVendorModal(prev => ({ ...prev, isSubmitting: true, error: null }));
    try {
      const activeShopId = currentShopId || (user?.shopId ? (typeof user.shopId === 'object' ? (user.shopId._id || user.shopId.id) : user.shopId) : 1);
      const res = await updateVendor({
        oldName: editVendorModal.oldName,
        name: editVendorModal.name.trim(),
        phone: editVendorModal.phone.trim(),
        location: editVendorModal.location.trim(),
        email: editVendorModal.email.trim(),
        notes: editVendorModal.notes.trim(),
        shopId: activeShopId
      });

      toast.success(res?.message || 'Vendor updated successfully!');
      setEditVendorModal({
        isOpen: false,
        oldName: '',
        name: '',
        phone: '',
        location: '',
        email: '',
        notes: '',
        isSubmitting: false,
        error: null,
      });

      await loadVendors();
      if (fetchData) fetchData();
    } catch (err) {
      console.error(err);
      setEditVendorModal(prev => ({
        ...prev,
        isSubmitting: false,
        error: err?.response?.data?.message || err.message || 'Failed to update vendor'
      }));
    }
  };

  // Handler: Delete Vendor
  const handleDeleteVendor = async () => {
    if (!deleteVendorModal.name) return;
    setDeleteVendorModal(prev => ({ ...prev, isSubmitting: true, error: null }));
    try {
      const activeShopId = currentShopId || (user?.shopId ? (typeof user.shopId === 'object' ? (user.shopId._id || user.shopId.id) : user.shopId) : 1);
      const res = await deleteVendor({
        name: deleteVendorModal.name,
        shopId: activeShopId
      });

      toast.success(res?.message || `Vendor "${deleteVendorModal.name}" deleted successfully!`);
      setDeleteVendorModal({ isOpen: false, name: '', isSubmitting: false, error: null });

      await loadVendors();
      if (fetchData) fetchData();
    } catch (err) {
      console.error(err);
      setDeleteVendorModal(prev => ({
        ...prev,
        isSubmitting: false,
        error: err?.response?.data?.message || err.message || 'Failed to delete vendor'
      }));
    }
  };

  // WhatsApp quick contact
  const handleWhatsApp = (phone, name) => {
    if (!phone) return;
    const clean = phone.replace(/[^0-9]/g, '');
    const target = clean.startsWith('0') ? `92${clean.slice(1)}` : clean;
    const msg = `Hello ${name}, this is ${user?.shopName || 'our store'}.`;
    window.open(`https://api.whatsapp.com/send?phone=${target}&text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Metrics
  const stats = useMemo(() => {
    const total = vendors.length;
    const withPhone = vendors.filter(v => v.phone && v.phone.trim()).length;
    const locations = new Set(vendors.map(v => (v.location || v.farmLocation || '').trim().toLowerCase()).filter(Boolean)).size;
    return { total, withPhone, locations };
  }, [vendors]);

  // Dynamic Today's Vendor Stats
  const todayVendorStats = useMemo(() => {
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

    const addedList = vendors.filter(v => isMatchToday(v.createdAt || v.date));
    const addedToday = addedList.length;
    const withPhoneToday = addedList.filter(v => v.phone && v.phone.trim()).length;
    return {
      addedToday,
      withPhoneToday,
      totalActive: stats.total,
      totalLocations: stats.locations
    };
  }, [vendors, stats]);

  // Filtered vendors
  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      if (appliedStartDate || appliedEndDate) {
        if (!isDateInSelectedRange(v.createdAt)) return false;
      }
      const vName = (v.name || '').toLowerCase();
      const vPhone = (v.phone || '').toLowerCase();
      const vLoc = (v.location || v.farmLocation || '').toLowerCase();
      const vEmail = (v.email || '').toLowerCase();
      const vNotes = (v.notes || '').toLowerCase();
      const q = searchTerm.toLowerCase().trim();

      const matchesSearch = !q || vName.includes(q) || vPhone.includes(q) || vLoc.includes(q) || vEmail.includes(q) || vNotes.includes(q);

      if (!matchesSearch) return false;

      if (filterType === 'WITH_PHONE') return Boolean(v.phone && v.phone.trim());
      if (filterType === 'WITH_LOCATION') return Boolean((v.location || v.farmLocation || '').trim());

      return true;
    });
  }, [vendors, searchTerm, filterType, appliedStartDate, appliedEndDate]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-teal-900 via-slate-900 to-zinc-950 p-4 sm:p-5 rounded-3xl border border-teal-500/30 shadow-2xl text-white">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-teal-500/20 border border-teal-400/40 rounded-2xl text-teal-300 shadow-inner">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-widest text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded-full border border-teal-500/30">
                Supplier &amp; Farm Directory
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-500/40">
                🏪 {Number(currentShopId) === 1 ? 'Maidan Branch' : currentShopId ? `Branch #${currentShopId}` : 'Maidan Branch'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white mt-0.5">
              Vendors &amp; Suppliers Directory
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setAddVendorModal(prev => ({ ...prev, isOpen: true, error: null }))}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-zinc-950 rounded-2xl font-black text-xs uppercase tracking-wider shadow-[0_4px_16px_rgba(245,158,11,0.4)] flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer border-t border-t-amber-200 border-b-2 border-b-amber-700"
          >
            <Plus className="w-4 h-4 text-zinc-950 stroke-[3]" />
            <span>Add New Vendor</span>
          </button>
          <button
            onClick={loadVendors}
            disabled={loading}
            className="p-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl text-white transition-all cursor-pointer"
            title="Refresh Vendors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border-2 border-slate-200 rounded-2xl p-3.5 shadow-sm space-y-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-[10px] font-black uppercase tracking-wider">
              <span>Total Vendors</span>
              <Building2 className="w-4 h-4 text-teal-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              <CountUpNumber value={stats.total} />
            </div>
            <p className="text-[9px] font-bold text-slate-400">Registered egg suppliers &amp; farms</p>
          </div>
        </div>

        <div className="bg-white border-2 border-slate-200 rounded-2xl p-3.5 shadow-sm space-y-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-[10px] font-black uppercase tracking-wider">
              <span>With Phone Number</span>
              <Phone className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">
              <CountUpNumber value={stats.withPhone} />
            </div>
            <p className="text-[9px] font-bold text-emerald-600 uppercase">Available for Direct Contact</p>
          </div>
          <div className="mt-3 pt-2 border-t-2 border-slate-200 flex items-center justify-between text-xs sm:text-[13px] font-black bg-slate-100 -mx-3.5 -mb-3.5 px-3.5 py-2.5 rounded-b-2xl text-slate-800">
            <span className="text-slate-700">CONNECTIVITY:</span>
            <span className="text-slate-900 font-black">{stats.total > 0 ? Math.round((stats.withPhone / stats.total) * 100) : 0}% Verified</span>
          </div>
        </div>

        <div className="bg-white border-2 border-slate-200 rounded-2xl p-3.5 shadow-sm space-y-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-[10px] font-black uppercase tracking-wider">
              <span>Locations / Cities</span>
              <MapPin className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-blue-600 mt-1">
              <CountUpNumber value={stats.locations} />
            </div>
            <p className="text-[9px] font-bold text-blue-600 uppercase">Farms &amp; Supply Regions</p>
          </div>
          <div className="mt-3 pt-2 border-t-2 border-slate-200 flex items-center justify-between text-xs sm:text-[13px] font-black bg-slate-100 -mx-3.5 -mb-3.5 px-3.5 py-2.5 rounded-b-2xl text-slate-800">
            <span className="text-slate-700">REGIONAL NETWORK:</span>
            <span className="text-slate-900 font-black">{stats.locations} Cities Active</span>
          </div>
        </div>
      </div>

      {/* ─── DEDICATED TODAY'S VENDOR DIRECTORY SUMMARY (GRAY & BIGGER SIZE) ─── */}
      <div className="bg-slate-100 border-2 border-slate-300 rounded-3xl p-5 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-slate-700 animate-pulse" />
            Today's Vendors &amp; Farm Suppliers Activity (Daily Breakdown)
          </span>
          <span className="text-xs bg-white text-slate-800 border-2 border-slate-300 px-3 py-1 rounded-xl font-bold shadow-xs">
            {todayVendorStats.addedToday} Added Today &bull; {todayVendorStats.totalActive} Active Suppliers
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Card 1: Vendors Added Today */}
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-teal-800">1. Vendors Added Today</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-2">{todayVendorStats.addedToday} New</div>
            <span className="text-[10px] font-bold text-slate-600 truncate mt-1">Newly Registered Suppliers</span>
          </div>

          {/* Card 2: Today Verified Contacts */}
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">2. Today Verified Contacts</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-2">{todayVendorStats.withPhoneToday} Contacts</div>
            <span className="text-[10px] font-bold text-slate-600 truncate mt-1">With Phone Number</span>
          </div>

          {/* Card 3: Active Supplier Farms */}
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-800">3. Active Supply Farms</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-2">{todayVendorStats.totalLocations} Cities</div>
            <span className="text-[10px] font-bold text-slate-600 truncate mt-1">Regional Supply Network</span>
          </div>

          {/* Card 4: Total Directory Suppliers */}
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-900">4. Total Directory</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-2">{todayVendorStats.totalActive} Suppliers</div>
            <span className="text-[10px] font-bold text-slate-600 truncate mt-1">Full Vendor Network</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search vendor name, phone, city, notes..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs font-bold text-slate-900 outline-none focus:border-teal-600 focus:bg-white transition-all"
          />
        </div>

        {/* Calendar Date Range Filter */}
        <div className="flex items-center flex-wrap gap-1.5 p-1 rounded-xl border border-slate-200 bg-slate-50 shadow-sm text-slate-800 shrink-0">
          <div className="flex items-center gap-1 pl-1">
            <Calendar className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Start:</span>
            <input
              type="date"
              value={vendorStartDate}
              onChange={(e) => {
                const val = e.target.value;
                setVendorStartDate(val);
                handleApplyDateFilter(val, vendorEndDate);
              }}
              className="w-[118px] sm:w-[126px] px-1.5 py-1 rounded-lg text-xs font-bold outline-none border border-slate-300 bg-white text-slate-900 focus:border-teal-500 cursor-pointer"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">End:</span>
            <input
              type="date"
              value={vendorEndDate}
              onChange={(e) => {
                const val = e.target.value;
                setVendorEndDate(val);
                handleApplyDateFilter(vendorStartDate, val);
              }}
              className="w-[118px] sm:w-[126px] px-1.5 py-1 rounded-lg text-xs font-bold outline-none border border-slate-300 bg-white text-slate-900 focus:border-teal-500 cursor-pointer"
            />
          </div>
          <button
            onClick={() => handleApplyDateFilter()}
            className="px-2.5 py-1 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 active:scale-95 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-sm transition-all cursor-pointer shrink-0"
            title="Filter vendors by date range"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filter</span>
          </button>
          {(appliedStartDate || appliedEndDate || vendorStartDate || vendorEndDate) && (
            <button
              onClick={handleClearDateFilter}
              className="px-2 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer flex items-center gap-0.5 active:scale-95 shrink-0"
              title="Clear date filter"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
          {(appliedStartDate || appliedEndDate) && (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase bg-teal-50 text-teal-700 border border-teal-300 whitespace-nowrap">
              Active: {appliedStartDate && appliedEndDate ? `${appliedStartDate} to ${appliedEndDate}` : (appliedStartDate ? `From ${appliedStartDate}` : `Up to ${appliedEndDate}`)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto justify-between sm:justify-end">
          <div className="flex items-center gap-1.5">
            {[
              { id: 'ALL', label: 'All Vendors' },
              { id: 'WITH_PHONE', label: 'With Phone' },
              { id: 'WITH_LOCATION', label: 'With Location' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${filterType === tab.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* List vs Grid View Switcher */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${viewMode === 'list'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-950'
                }`}
              title="List View"
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${viewMode === 'grid'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-950'
                }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Grid</span>
            </button>
          </div>
        </div>
      </div>

      {/* Vendors Display: List or Grid */}
      {filteredVendors.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center space-y-3">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-black text-slate-800 uppercase">No Vendors Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchTerm ? `No vendor matches "${searchTerm}"` : 'No registered vendors found. Click "+ Add New Vendor" to create your first supplier.'}
          </p>
        </div>
      ) : viewMode === 'list' ? (
        /* ─── LIST VIEW (TABLE) ─── */
        <div className="bg-white border-2 border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-800 table-auto">
              <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3.5 text-center w-12 whitespace-nowrap">#</th>
                  <th className="p-3.5 whitespace-nowrap">Vendor / Farm Name</th>
                  <th className="p-3.5 whitespace-nowrap">Contact Phone</th>
                  <th className="p-3.5 whitespace-nowrap">Location / City</th>
                  <th className="p-3.5 whitespace-nowrap">Email &amp; Notes</th>
                  <th className="p-3.5 text-center whitespace-nowrap">Status</th>
                  <th className="p-3.5 text-center w-36 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredVendors.map((vendor, idx) => (
                  <tr
                    key={vendor.id || idx}
                    className="hover:bg-teal-50/40 transition-colors group"
                  >
                    {/* Serial Number */}
                    <td className="p-3.5 text-center whitespace-nowrap align-middle">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-black inline-block">
                        #{idx + 1}
                      </span>
                    </td>

                    {/* Vendor Name with Avatar */}
                    <td className="p-3.5 align-middle">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-700 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                          {(vendor.name || 'V').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <span className="block font-black text-slate-900 uppercase text-xs truncate max-w-[220px]">
                            {vendor.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold block">
                            ID: VEND-{String(vendor.id || idx + 1).padStart(3, '0')}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="p-3.5 align-middle whitespace-nowrap">
                      {vendor.phone ? (
                        <div className="flex items-center gap-2">
                          <a
                            href={`tel:${vendor.phone}`}
                            className="font-bold text-slate-800 hover:text-teal-700 flex items-center gap-1.5"
                          >
                            <Phone className="w-3.5 h-3.5 text-teal-600" />
                            {vendor.phone}
                          </a>
                          <button
                            type="button"
                            onClick={() => handleWhatsApp(vendor.phone, vendor.name)}
                            className="p-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors cursor-pointer"
                            title="Chat on WhatsApp"
                          >
                            <Send className="w-3 h-3 text-emerald-600" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No phone</span>
                      )}
                    </td>

                    {/* Location */}
                    <td className="p-3.5 align-middle whitespace-nowrap">
                      {vendor.location || vendor.farmLocation ? (
                        <span className="flex items-center gap-1.5 font-bold text-slate-700">
                          <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          {vendor.location || vendor.farmLocation}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>

                    {/* Email & Notes */}
                    <td className="p-3.5 align-middle">
                      <div className="max-w-[220px]">
                        {vendor.email && (
                          <div className="flex items-center gap-1.5 text-slate-700 text-[11px] font-medium truncate">
                            <Mail className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span className="truncate">{vendor.email}</span>
                          </div>
                        )}
                        {vendor.notes && (
                          <div className="flex items-center gap-1.5 text-slate-500 text-[10.5px] truncate">
                            <FileText className="w-3 h-3 text-amber-500 shrink-0" />
                            <span className="truncate">{vendor.notes}</span>
                          </div>
                        )}
                        {!vendor.email && !vendor.notes && (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="p-3.5 text-center whitespace-nowrap align-middle">
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[9px] font-black uppercase tracking-wider inline-block">
                        Active
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-center whitespace-nowrap align-middle">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditVendorModal({
                            isOpen: true,
                            oldName: vendor.name,
                            name: vendor.name,
                            phone: vendor.phone || '',
                            location: vendor.location || vendor.farmLocation || '',
                            email: vendor.email || '',
                            notes: vendor.notes || '',
                            isSubmitting: false,
                            error: null
                          })}
                          className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-black uppercase flex items-center gap-1 transition-colors cursor-pointer"
                          title="Edit Vendor"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-amber-700" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteVendorModal({
                            isOpen: true,
                            name: vendor.name,
                            isSubmitting: false,
                            error: null
                          })}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl transition-colors cursor-pointer"
                          title="Delete Vendor"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ─── GRID VIEW (CARDS) ─── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredVendors.map((vendor, idx) => (
            <div
              key={vendor.id || idx}
              className="bg-white border-2 border-slate-200 hover:border-teal-500 rounded-3xl p-4 shadow-sm hover:shadow-md transition-all space-y-3 flex flex-col justify-between group"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-11 h-11 bg-gradient-to-br from-teal-500 to-emerald-700 text-white rounded-2xl flex items-center justify-center font-black text-lg shrink-0 shadow-md">
                    {(vendor.name || 'V').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-slate-900 group-hover:text-teal-700 transition-colors uppercase leading-tight line-clamp-1">
                      {vendor.name}
                    </h3>
                    <span className="inline-block mt-0.5 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-black uppercase rounded-full">
                      Active Vendor
                    </span>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditVendorModal({
                      isOpen: true,
                      oldName: vendor.name,
                      name: vendor.name,
                      phone: vendor.phone || '',
                      location: vendor.location || vendor.farmLocation || '',
                      email: vendor.email || '',
                      notes: vendor.notes || '',
                      isSubmitting: false,
                      error: null
                    })}
                    className="p-1.5 rounded-xl bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-700 border border-slate-200 transition-colors cursor-pointer"
                    title="Edit Vendor"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteVendorModal({
                      isOpen: true,
                      name: vendor.name,
                      isSubmitting: false,
                      error: null
                    })}
                    className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 border border-slate-200 transition-colors cursor-pointer"
                    title="Delete Vendor"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Vendor Details */}
              <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span className="font-bold truncate">
                    {vendor.phone ? vendor.phone : <span className="text-slate-400 font-normal">No phone number</span>}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="font-bold truncate">
                    {vendor.location || vendor.farmLocation ? (vendor.location || vendor.farmLocation) : <span className="text-slate-400 font-normal">No location specified</span>}
                  </span>
                </div>

                {vendor.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="font-medium text-[11px] truncate">{vendor.email}</span>
                  </div>
                )}

                {vendor.notes && (
                  <div className="flex items-start gap-2 pt-1 border-t border-slate-200/60 mt-1">
                    <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span className="text-[10.5px] text-slate-500 font-medium line-clamp-2">{vendor.notes}</span>
                  </div>
                )}
              </div>

              {/* WhatsApp direct contact if phone exists */}
              {vendor.phone && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => handleWhatsApp(vendor.phone, vendor.name)}
                    className="w-full py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-[11px] font-black uppercase flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Send className="w-3 h-3 text-emerald-600" />
                    <span>Chat on WhatsApp</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── ADD NEW VENDOR MODAL ─── */}
      {addVendorModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => !addVendorModal.isSubmitting && setAddVendorModal(prev => ({ ...prev, isOpen: false }))} />

          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl z-10 overflow-hidden flex flex-col p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 border border-amber-300 rounded-2xl text-amber-700">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase">Add New Vendor</h3>
                  <p className="text-[11px] text-slate-500 font-bold">Register a new egg supplier or poultry farm</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddVendorModal(prev => ({ ...prev, isOpen: false }))}
                disabled={addVendorModal.isSubmitting}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addVendorModal.error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{addVendorModal.error}</span>
              </div>
            )}

            <form onSubmit={handleCreateVendor} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-700 uppercase">
                  Vendor / Farm Name *
                </label>
                <input
                  type="text"
                  required
                  value={addVendorModal.name}
                  onChange={(e) => setAddVendorModal(prev => ({ ...prev, name: e.target.value, error: null }))}
                  placeholder="e.g. Online POS Farm, Dir Farm, Mardan Farm, Attock Farm..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-3 text-xs font-bold text-slate-900 outline-none focus:border-amber-500 focus:bg-white transition-all shadow-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-700 uppercase flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>Contact Phone</span>
                  </label>
                  <input
                    type="text"
                    value={addVendorModal.phone}
                    onChange={(e) => setAddVendorModal(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="0300-1234567"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-3 text-xs font-bold text-slate-900 outline-none focus:border-amber-500 focus:bg-white transition-all shadow-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-700 uppercase flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>Location / City</span>
                  </label>
                  <input
                    type="text"
                    value={addVendorModal.location}
                    onChange={(e) => setAddVendorModal(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Peshawar, Mardan, Swat, Dir, Attock..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-3 text-xs font-bold text-slate-900 outline-none focus:border-amber-500 focus:bg-white transition-all shadow-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-700 uppercase">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={addVendorModal.email}
                  onChange={(e) => setAddVendorModal(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="vendor@example.com"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-3 text-xs font-bold text-slate-900 outline-none focus:border-amber-500 focus:bg-white transition-all shadow-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-700 uppercase">
                  Notes / Description (Optional)
                </label>
                <textarea
                  rows="2"
                  value={addVendorModal.notes}
                  onChange={(e) => setAddVendorModal(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Notes on egg quality, poultry capacity, or payment arrangements..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 px-3 text-xs font-bold text-slate-900 outline-none focus:border-amber-500 focus:bg-white transition-all shadow-sm"
                />
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-center gap-2.5 text-[11px] text-amber-900 font-bold">
                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                <span>This vendor will be saved to your database and suggested when adding new purchases.</span>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setAddVendorModal(prev => ({ ...prev, isOpen: false }))}
                  disabled={addVendorModal.isSubmitting}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-xs uppercase transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addVendorModal.isSubmitting}
                  className="flex-[1.5] py-2.5 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-zinc-950 rounded-xl font-black text-xs uppercase shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 border-t border-t-amber-200 border-b-2 border-b-amber-700"
                >
                  {addVendorModal.isSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-zinc-950" /> : <CheckCircle2 className="w-4 h-4 text-zinc-950" />}
                  <span>{addVendorModal.isSubmitting ? 'Saving...' : 'Save & Register Vendor'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── EDIT VENDOR MODAL ─── */}
      {editVendorModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => !editVendorModal.isSubmitting && setEditVendorModal(prev => ({ ...prev, isOpen: false }))} />

          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl z-10 overflow-hidden flex flex-col p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-teal-100 border border-teal-300 rounded-2xl text-teal-700">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase">Edit Vendor Information</h3>
                  <p className="text-[11px] text-slate-500 font-bold">Update vendor contact and location details</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditVendorModal(prev => ({ ...prev, isOpen: false }))}
                disabled={editVendorModal.isSubmitting}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editVendorModal.error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editVendorModal.error}</span>
              </div>
            )}

            <form onSubmit={handleUpdateVendor} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-700 uppercase">
                  Vendor / Farm Name *
                </label>
                <input
                  type="text"
                  required
                  value={editVendorModal.name}
                  onChange={(e) => setEditVendorModal(prev => ({ ...prev, name: e.target.value, error: null }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-3 text-xs font-bold text-slate-900 outline-none focus:border-teal-500 focus:bg-white transition-all shadow-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-700 uppercase flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>Contact Phone</span>
                  </label>
                  <input
                    type="text"
                    value={editVendorModal.phone}
                    onChange={(e) => setEditVendorModal(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="0300-1234567"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-3 text-xs font-bold text-slate-900 outline-none focus:border-teal-500 focus:bg-white transition-all shadow-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-700 uppercase flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>Location / City</span>
                  </label>
                  <input
                    type="text"
                    value={editVendorModal.location}
                    onChange={(e) => setEditVendorModal(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Peshawar, Mardan, Swat, Dir..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-3 text-xs font-bold text-slate-900 outline-none focus:border-teal-500 focus:bg-white transition-all shadow-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-700 uppercase">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editVendorModal.email}
                  onChange={(e) => setEditVendorModal(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="vendor@example.com"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-3 text-xs font-bold text-slate-900 outline-none focus:border-teal-500 focus:bg-white transition-all shadow-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-700 uppercase">
                  Notes / Description
                </label>
                <textarea
                  rows="2"
                  value={editVendorModal.notes}
                  onChange={(e) => setEditVendorModal(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 px-3 text-xs font-bold text-slate-900 outline-none focus:border-teal-500 focus:bg-white transition-all shadow-sm"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditVendorModal(prev => ({ ...prev, isOpen: false }))}
                  disabled={editVendorModal.isSubmitting}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-xs uppercase transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editVendorModal.isSubmitting}
                  className="flex-[1.5] py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-black text-xs uppercase shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {editVendorModal.isSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <CheckCircle2 className="w-4 h-4 text-white" />}
                  <span>{editVendorModal.isSubmitting ? 'Updating...' : 'Update Vendor'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DELETE VENDOR MODAL ─── */}
      {deleteVendorModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => !deleteVendorModal.isSubmitting && setDeleteVendorModal(prev => ({ ...prev, isOpen: false }))} />

          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl z-10 overflow-hidden flex flex-col p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 border border-rose-300 rounded-2xl text-rose-700">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 uppercase">Delete Vendor</h3>
                <p className="text-[11px] text-slate-500 font-bold">Remove vendor from registry</p>
              </div>
            </div>

            {deleteVendorModal.error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-bold">
                {deleteVendorModal.error}
              </div>
            )}

            <p className="text-xs text-slate-700 font-medium">
              Are you sure you want to delete vendor <strong className="text-slate-950 font-black">"{deleteVendorModal.name}"</strong>?
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteVendorModal(prev => ({ ...prev, isOpen: false }))}
                disabled={deleteVendorModal.isSubmitting}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-xs uppercase cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteVendor}
                disabled={deleteVendorModal.isSubmitting}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs uppercase shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {deleteVendorModal.isSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Trash2 className="w-4 h-4 text-white" />}
                <span>{deleteVendorModal.isSubmitting ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
