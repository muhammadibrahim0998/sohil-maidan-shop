import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getUsers, createUser, updateUser, deleteUser, getShops, getBranchCashSessions, updateBranchCashSession, deleteBranchCashSession } from '../services/api';
import { useUser } from '../contexts/UserContext';
import { UserPlus, ShieldCheck, User as UserIcon, Edit2, Trash2, X, Eye, EyeOff, Search, Building2, Clock, CheckCircle2, Table, LayoutGrid, RefreshCw, DollarSign, AlertCircle, Check } from 'lucide-react';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const userSchema = z.object({
  username: z.string().min(3, "Handle must be at least 3 characters"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  password: z.string().optional().or(z.literal('')),
  role: z.string(),
  status: z.enum(['active', 'inactive']),
  preferredShift: z.enum(['day', 'night', 'both']).optional(),
  shopId: z.union([z.string(), z.number(), z.null()]).optional()
});

export function TeamView() {
  const [users, setUsers] = useState([]);
  const [shops, setShops] = useState([]);
  const [cashSessions, setCashSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Tab view: 'both' | 'members' | 'sessions'
  const [viewModeTab, setViewModeTab] = useState('both');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('ALL');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('ALL');
  const [selectedSessionStatus, setSelectedSessionStatus] = useState('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, name: '' });
  const [editSessionModal, setEditSessionModal] = useState({
    isOpen: false,
    session: null,
    openingCash: '',
    status: 'open',
    notes: '',
    isSaving: false
  });
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  const { user: currentUser, isSuperAdmin: checkIsSuperAdmin } = useUser();
  const isSuper = typeof checkIsSuperAdmin === 'function' ? checkIsSuperAdmin() : currentUser?.role === 'super_admin';

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(userSchema),
    defaultValues: {
      username: '',
      fullName: '',
      password: '',
      role: 'cashier',
      status: 'active',
      preferredShift: 'day',
      shopId: ''
    }
  });

  const selectedRole = watch('role');

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      const [usersData, shopsData] = await Promise.all([
        getUsers(currentUser?.role || (isSuper ? 'super_admin' : 'shop_admin')),
        getShops().catch(() => [])
      ]);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setShops(Array.isArray(shopsData) ? shopsData : []);
    } catch (err) {
      toast.error("Failed to load team data");
    } finally {
      setLoading(false);
    }
  };

  const fetchCashSessions = async () => {
    try {
      setSessionsLoading(true);
      const data = await getBranchCashSessions(selectedBranchFilter !== 'ALL' ? selectedBranchFilter : null);
      setCashSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load branch cash sessions:", err);
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
  }, [currentUser]);

  useEffect(() => {
    fetchCashSessions();
  }, [selectedBranchFilter]);

  const getBranchName = (shopId) => {
    if (!shopId) return 'Head Office / Global';
    const found = shops.find(s => String(s.id || s._id) === String(shopId));
    if (found) return found.name;
    if (Number(shopId) === 1) return 'Maidan Branch';
    return `Branch #${shopId}`;
  };

  const handleOpenModal = (user = null, viewOnly = false) => {
    setShowPassword(false);
    setIsViewMode(viewOnly);
    setEditingUser(user);

    if (user) {
      reset({
        username: user.username || user.email || '',
        fullName: user.fullName || '',
        password: '',
        role: user.role || 'cashier',
        status: user.status || 'active',
        preferredShift: user.preferredShift || 'both',
        shopId: user.shopId !== undefined && user.shopId !== null ? String(user.shopId) : ''
      });
    } else {
      reset({
        username: '',
        fullName: '',
        password: '',
        role: 'cashier',
        status: 'active',
        preferredShift: 'both',
        shopId: shops.length > 0 ? String(shops[0].id || shops[0]._id) : '3'
      });
    }

    setIsModalOpen(true);
  };

  const onSubmit = async (data) => {
    try {
      if (!editingUser && (!data.password || data.password.length < 6)) {
        toast.error("Password must be at least 6 characters for a new member");
        return;
      }

      const payload = { ...data };
      if (!payload.password || !payload.password.trim()) {
        delete payload.password;
      }

      if (payload.role === 'super_admin' || payload.shopId === '' || payload.shopId === null || payload.shopId === undefined) {
        payload.shopId = null;
      } else {
        payload.shopId = Number(payload.shopId);
      }

      const roleHeader = currentUser?.role || (isSuper ? 'super_admin' : 'shop_admin');

      if (editingUser) {
        const targetId = editingUser._id || editingUser.id;
        await updateUser(targetId, payload, roleHeader);
        toast.success("Team member updated successfully!");
      } else {
        await createUser(payload, roleHeader);
        toast.success("Team member authorized & added to branch session table!");
      }

      setIsModalOpen(false);
      await Promise.all([fetchTeamData(), fetchCashSessions()]);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.[0]?.message || err.message || "Operation failed";
      toast.error(msg);
    }
  };

  const handleDeleteClick = (user) => {
    setDeleteModal({
      isOpen: true,
      id: user._id || user.id,
      name: user.fullName
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.id) return;
    setIsDeleting(true);
    try {
      const roleHeader = currentUser?.role || (isSuper ? 'super_admin' : 'shop_admin');
      await deleteUser(deleteModal.id, roleHeader);
      toast.success("Member removed from system");
      setDeleteModal({ isOpen: false, id: null, name: '' });
      await Promise.all([fetchTeamData(), fetchCashSessions()]);
    } catch (err) {
      const msg = err.response?.data?.message || "Deletion authorization failed";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleSessionStatus = async (session) => {
    try {
      const nextStatus = session.status === 'open' ? 'closed' : 'open';
      setCashSessions(prev => prev.map(s => {
        if (s.shopId === session.shopId && s.id === session.id) {
          return { ...s, status: nextStatus };
        }
        return s;
      }));

      await updateBranchCashSession(session.shopId, session.id, {
        status: nextStatus,
        closingCash: session.expectedCash || session.openingCash || 0,
        actualCash: session.expectedCash || session.openingCash || 0,
        closedBy: `${currentUser?.fullName || 'Admin'} (@${currentUser?.username || 'admin'})`
      });
      toast.success(`Session #${session.id} marked as ${nextStatus.toUpperCase()}`);
      await fetchCashSessions();
    } catch (err) {
      toast.error("Failed to update session status");
      await fetchCashSessions();
    }
  };

  const handleConfirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    setIsDeletingSession(true);
    try {
      const targetShopId = sessionToDelete.shopId;
      const targetId = sessionToDelete.id;

      // Optimistically remove from state so table updates immediately
      setCashSessions(prev => prev.filter(s => !(s.shopId === targetShopId && s.id === targetId)));

      await deleteBranchCashSession(targetShopId, targetId);
      toast.success(`Session #${targetId} deleted successfully`);
      setSessionToDelete(null);
      await fetchCashSessions();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to delete session record";
      toast.error(msg);
      await fetchCashSessions();
    } finally {
      setIsDeletingSession(false);
    }
  };

  const handleEditSession = (sess) => {
    setEditSessionModal({
      isOpen: true,
      session: sess,
      openingCash: sess.openingCash !== undefined ? sess.openingCash : 0,
      status: sess.status || 'open',
      notes: sess.notes || '',
      isSaving: false
    });
  };

  const handleSaveEditSession = async (e) => {
    if (e) e.preventDefault();
    if (!editSessionModal.session) return;
    const { session, openingCash, status, notes } = editSessionModal;
    setEditSessionModal(prev => ({ ...prev, isSaving: true }));
    try {
      const newOpening = Number(openingCash) || 0;
      // Optimistic update
      setCashSessions(prev => prev.map(s => {
        if (s.shopId === session.shopId && s.id === session.id) {
          return {
            ...s,
            openingCash: newOpening,
            expectedCash: newOpening + (s.totalSales || 0) - (s.totalReturns || 0),
            status,
            notes: (notes || '').trim()
          };
        }
        return s;
      }));

      await updateBranchCashSession(session.shopId, session.id, {
        openingCash: newOpening,
        status,
        notes: (notes || '').trim()
      });
      toast.success(`Session #${session.id} updated successfully!`);
      setEditSessionModal({ isOpen: false, session: null, openingCash: '', status: 'open', notes: '', isSaving: false });
      await fetchCashSessions();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to update session");
      setEditSessionModal(prev => ({ ...prev, isSaving: false }));
      await fetchCashSessions();
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !searchTerm ||
      (u.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      getBranchName(u.shopId).toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole =
      selectedRoleFilter === 'ALL' ||
      u.role === selectedRoleFilter;

    const matchesBranch =
      selectedBranchFilter === 'ALL' ||
      (selectedBranchFilter === 'GLOBAL' && !u.shopId) ||
      String(u.shopId) === String(selectedBranchFilter);

    return matchesSearch && matchesRole && matchesBranch;
  });

  const filteredSessions = cashSessions.filter((s) => {
    const matchesBranch =
      selectedBranchFilter === 'ALL' ||
      String(s.shopId) === String(selectedBranchFilter);

    const matchesStatus =
      selectedSessionStatus === 'ALL' ||
      s.status === selectedSessionStatus;

    const matchesSearch =
      !searchTerm ||
      (s.openedBy || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.branchName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.notes || '').toLowerCase().includes(searchTerm.toLowerCase());

    return matchesBranch && matchesStatus && matchesSearch;
  });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const itemVariants = {
    hidden: { y: 15, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 100 }
    }
  };

  const isCurrentSelf = (u) => {
    const selfId = currentUser?.id || currentUser?._id;
    const targetId = u.id || u._id;
    return String(selfId) === String(targetId) || u.username === currentUser?.username;
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 max-w-7xl mx-auto px-2 sm:px-4 pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-6 sm:pb-8 border-b border-[var(--color-border-subtle)] gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-[var(--color-text-primary)] tracking-tighter uppercase leading-none">
            Team & Cash Sessions
          </h1>
          <div className="text-[var(--color-text-muted)] font-bold uppercase text-[9px] sm:text-[10px] tracking-[0.2em] sm:tracking-[0.4em] mt-2 sm:mt-3 flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            Staff Accounts • Cashier Terminals • All Branches (Attock, Peshawar, Mardan)
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Tab View Switcher */}
          <div className="flex items-center bg-[var(--color-surface-base)] p-1 rounded-xl border border-[var(--color-border-subtle)] text-xs font-bold">
            <button
              onClick={() => setViewModeTab('both')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${viewModeTab === 'both' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
            >
              All
            </button>
            <button
              onClick={() => setViewModeTab('members')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${viewModeTab === 'members' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
            >
              Staff Cards
            </button>
            <button
              onClick={() => setViewModeTab('sessions')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${viewModeTab === 'sessions' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
            >
              Cash Sessions
            </button>
          </div>

          <button
            id="add-member-btn"
            onClick={() => handleOpenModal()}
            className="px-5 py-3 sm:px-6 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl sm:rounded-2xl font-black text-[11px] sm:text-xs uppercase tracking-[0.15em] shadow-lg shadow-emerald-600/25 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="whitespace-nowrap">+ Add Member</span>
          </button>
        </div>
      </div>

      {/* Dynamic Filter & Search Toolbar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-surface-card p-4 rounded-2xl border border-[var(--color-border-subtle)] shadow-sm">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="team-search-input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search staff, cashiers, or branch sessions..."
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-xl text-xs sm:text-sm font-bold text-[var(--color-text-primary)] placeholder:text-zinc-400 placeholder:font-normal outline-none focus:border-emerald-500 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs font-bold cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Branch filter pills */}
          <div className="flex items-center gap-1 bg-[var(--color-surface-base)] p-1 rounded-xl border border-[var(--color-border-subtle)]">
            <span className="text-[9px] font-black uppercase text-zinc-400 px-2">Branch:</span>
            {['ALL', '1'].map((bId) => {
              const label = bId === 'ALL' ? 'All' : 'Maidan Branch';
              const isSelected = selectedBranchFilter === bId;
              return (
                <button
                  key={bId}
                  onClick={() => setSelectedBranchFilter(bId)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    isSelected ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Quick Refresh Button */}
          <button
            onClick={() => {
              fetchTeamData();
              fetchCashSessions();
              toast.success("Synchronized all branch tables!");
            }}
            title="Refresh All Tables"
            className="p-2.5 bg-[var(--color-surface-base)] text-zinc-500 hover:text-emerald-600 hover:border-emerald-500/30 rounded-xl border border-[var(--color-border-subtle)] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${sessionsLoading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* SECTION 1: DYNAMIC BRANCH CASH SESSIONS TABLE */}
      {(viewModeTab === 'both' || viewModeTab === 'sessions') && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Table className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg sm:text-xl font-black text-[var(--color-text-primary)] uppercase tracking-tight">
                  Branch Cash Sessions Table
                </h2>
              </div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5">
                Table: <code className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono font-bold">maidan_branch__cash_sessions</code>
              </p>
            </div>

            {/* Session status filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold uppercase text-zinc-400">Status:</span>
              <button
                onClick={() => setSelectedSessionStatus('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${selectedSessionStatus === 'ALL' ? 'bg-zinc-800 text-white' : 'bg-surface-card text-zinc-600 border border-[var(--color-border-subtle)]'}`}
              >
                All ({cashSessions.length})
              </button>
              <button
                onClick={() => setSelectedSessionStatus('open')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${selectedSessionStatus === 'open' ? 'bg-emerald-600 text-white' : 'bg-surface-card text-emerald-700 border border-[var(--color-border-subtle)]'}`}
              >
                Open ({cashSessions.filter(s => s.status === 'open').length})
              </button>
              <button
                onClick={() => setSelectedSessionStatus('closed')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${selectedSessionStatus === 'closed' ? 'bg-zinc-600 text-white' : 'bg-surface-card text-zinc-600 border border-[var(--color-border-subtle)]'}`}
              >
                Closed ({cashSessions.filter(s => s.status === 'closed').length})
              </button>
            </div>
          </div>

          {sessionsLoading ? (
            <div className="flex flex-col items-center justify-center p-12 bg-surface-card rounded-2xl border border-[var(--color-border-subtle)]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mb-2"></div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Querying branch tables...</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="p-8 bg-surface-card rounded-2xl border border-[var(--color-border-subtle)] text-center">
              <p className="text-xs font-bold text-zinc-500">No cash sessions found in selected branch table.</p>
              <p className="text-[10px] text-zinc-400 mt-1">When a cashier is added, their initial terminal session will appear here automatically.</p>
            </div>
          ) : (
            <div className="overflow-x-auto bg-surface-card rounded-2xl border border-[var(--color-border-subtle)] shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-base)] text-[9px] font-black uppercase tracking-wider text-zinc-500">
                    <th className="py-3 px-4">#ID</th>
                    <th className="py-3 px-4">Branch Table</th>
                    <th className="py-3 px-4">Cashier / Opened By</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Opening Cash</th>
                    <th className="py-3 px-4">Total Sales</th>
                    <th className="py-3 px-4">Expected Cash</th>
                    <th className="py-3 px-4">Opened At</th>
                    <th className="py-3 px-4">Notes</th>
                    <th className="py-3 px-3 text-right sticky right-0 bg-[var(--color-surface-base)] shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.06)] z-10">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)] text-xs font-bold text-[var(--color-text-primary)]">
                  {filteredSessions.map((sess) => {
                    const isOpen = sess.status === 'open';
                    return (
                      <tr key={`${sess.shopId}-${sess.id}`} className="hover:bg-emerald-50/20 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-zinc-400 text-xs">#{sess.id}</td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-zinc-100 text-zinc-700 border border-zinc-200">
                            <Building2 className="w-3 h-3 text-zinc-500" />
                            {sess.branchName || `Branch #${sess.shopId}`}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-sm text-[var(--color-text-primary)]">{sess.openedBy || 'Staff Member'}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                              isOpen
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`}></span>
                            {sess.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-zinc-600">
                          Rs. {Number(sess.openingCash || 0).toLocaleString('en-PK')}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                          Rs. {Number(sess.totalSales || 0).toLocaleString('en-PK')}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-black text-[var(--color-text-primary)]">
                          Rs. {Number(sess.expectedCash || 0).toLocaleString('en-PK')}
                        </td>
                        <td className="py-3.5 px-4 text-[10px] text-zinc-500 whitespace-nowrap">
                          {sess.openedAt ? new Date(sess.openedAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-[11px] text-zinc-500 max-w-xs truncate" title={sess.notes}>
                          {sess.notes || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap sticky right-0 bg-white/95 backdrop-blur-xs shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.06)] z-10">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {/* Edit Button with small icon */}
                            <button
                              type="button"
                              onClick={() => handleEditSession(sess)}
                              title="Edit Session Details"
                              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg inline-flex items-center gap-1 text-[10px] font-black cursor-pointer transition-all shadow-2xs"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>

                            {/* Status Toggle Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleSessionStatus(sess)}
                              title={isOpen ? 'Mark as Closed' : 'Re-open Session'}
                              className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-colors cursor-pointer ${
                                isOpen
                                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {isOpen ? 'Close' : 'Re-open'}
                            </button>

                            {/* Delete Button with small icon */}
                            <button
                              type="button"
                              onClick={() => setSessionToDelete(sess)}
                              title="Delete from branch table"
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg inline-flex items-center gap-1 text-[10px] font-black cursor-pointer transition-all shadow-2xs"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: STAFF PERSONNEL CARDS GRID */}
      {(viewModeTab === 'both' || viewModeTab === 'members') && (
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg sm:text-xl font-black text-[var(--color-text-primary)] uppercase tracking-tight">
                Staff Personnel Accounts
              </h2>
            </div>
            <span className="text-[10px] font-black uppercase text-zinc-400">
              Showing {filteredUsers.length} of {users.length} members
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center p-20 bg-surface-card rounded-[2.5rem] border border-[var(--color-border-subtle)]">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mb-4"></div>
              <p className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">
                Loading team personnel & branches...
              </p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 bg-surface-card rounded-[2.5rem] border border-[var(--color-border-subtle)] text-center">
              <UserIcon className="w-12 h-12 text-zinc-300 mb-3" />
              <h3 className="text-lg font-black uppercase tracking-tight text-[var(--color-text-primary)]">No Team Members Found</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 font-bold">
                {searchTerm ? `No staff members matched "${searchTerm}"` : "Get started by authorizing your first team member."}
              </p>
              <button
                onClick={() => handleOpenModal()}
                className="mt-5 px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-700 transition-all cursor-pointer"
              >
                + Add New Member
              </button>
            </div>
          ) : (
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {filteredUsers.map((u) => {
                const isSelf = isCurrentSelf(u);
                const isAdminRole = ['admin', 'shop_admin', 'super_admin'].includes(u.role);
                return (
                  <motion.div
                    key={u._id || u.id}
                    variants={itemVariants}
                    whileHover={{
                      y: -4,
                      transition: { duration: 0.2 },
                      boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)"
                    }}
                    className="bg-surface-card p-6 sm:p-7 rounded-2xl shadow-lg border border-[var(--color-border-subtle)] relative overflow-hidden transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top card row: icon and actions */}
                      <div className="flex justify-between items-start mb-6">
                        <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 flex items-center justify-center shadow-inner">
                          {isAdminRole ? (
                            <ShieldCheck className="w-6 h-6" />
                          ) : (
                            <UserIcon className="w-6 h-6" />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <motion.button
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scale: 0.92 }}
                            onClick={() => handleOpenModal(u, true)}
                            title="View Profile"
                            className="p-2.5 bg-[var(--color-surface-base)] rounded-xl border border-[var(--color-border-subtle)] text-zinc-500 hover:text-emerald-600 hover:border-emerald-500/30 transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scale: 0.92 }}
                            onClick={() => handleOpenModal(u, false)}
                            title="Edit Member"
                            className="p-2.5 bg-[var(--color-surface-base)] rounded-xl border border-[var(--color-border-subtle)] text-zinc-500 hover:text-amber-500 hover:border-amber-500/30 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </motion.button>
                          <motion.button
                            whileHover={!isSelf ? { scale: 1.08 } : {}}
                            whileTap={!isSelf ? { scale: 0.92 } : {}}
                            onClick={() => !isSelf && handleDeleteClick(u)}
                            disabled={isSelf}
                            title={isSelf ? "Cannot delete your own account" : "Delete Member"}
                            className={`p-2.5 bg-[var(--color-surface-base)] rounded-xl border border-[var(--color-border-subtle)] transition-colors ${
                              isSelf
                                ? 'opacity-25 cursor-not-allowed text-zinc-400'
                                : 'text-zinc-500 hover:text-rose-500 hover:border-rose-500/30 cursor-pointer'
                            }`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                        </div>
                      </div>

                      {/* Member Name & Handle */}
                      <h3 className="text-xl sm:text-2xl font-black text-[var(--color-text-primary)] uppercase tracking-tight line-clamp-1">
                        {u.fullName}
                      </h3>
                      <p className="text-[11px] font-bold text-[var(--color-text-muted)] lowercase tracking-wider mb-4 line-clamp-1">
                        @{u.username || u.email}
                      </p>

                      {/* Branch & Shift Info */}
                      <div className="space-y-1.5 mb-5 text-[11px] font-bold text-zinc-600">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span className="truncate">{getBranchName(u.shopId)}</span>
                        </div>
                        {u.preferredShift && (
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            <span className="capitalize">
                              {u.preferredShift === 'both' ? 'Flexible / Both Shifts' : `${u.preferredShift} Shift`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Badges footer */}
                    <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-[var(--color-border-subtle)]">
                      <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-emerald-500/10 text-emerald-600 rounded-full border border-emerald-500/20">
                        {u.role ? u.role.replace('_', ' ') : 'MEMBER'}
                      </span>
                      <span
                        className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border ${
                          u.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {u.status === 'active' ? 'ACTIVE' : 'SUSPENDED'}
                      </span>
                      {isSelf && (
                        <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full ml-auto">
                          YOU
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>
      )}

      {/* Add / Edit / View Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-900/50"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              className="bg-surface-card rounded-[2rem] shadow-2xl w-full max-w-[460px] relative z-70 border border-[var(--color-border-subtle)] flex flex-col max-h-[92vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-[var(--color-border-subtle)] relative flex items-center justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight italic text-[var(--color-text-primary)]">
                    {isViewMode ? "User Profile" : editingUser ? "Update User" : "Add User"}
                  </h2>
                  <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mt-0.5">
                    {isViewMode ? "Staff credentials and privileges" : editingUser ? "Modify user details & authorization" : "Authorize member & assign to branch table"}
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 overflow-y-auto" autoComplete="off">
                {/* Full Identity Name */}
                <div>
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1 block mb-1">
                    Full Identity Name
                  </label>
                  <input
                    {...register("fullName")}
                    placeholder="e.g. Attock Branch Cashier"
                    autoComplete="off"
                    disabled={isViewMode}
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-xl outline-none focus:border-emerald-500 transition-colors font-bold text-xs sm:text-sm text-[var(--color-text-primary)] disabled:opacity-75"
                  />
                  {errors.fullName && <p className="text-rose-500 text-[10px] font-bold mt-1 pl-1">{errors.fullName.message}</p>}
                </div>

                {/* System Handle */}
                <div>
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1 block mb-1">
                    System Handle / Email
                  </label>
                  <input
                    {...register("username")}
                    placeholder="e.g. attockcashier@gmail.com"
                    autoComplete="off"
                    disabled={isViewMode}
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-xl outline-none focus:border-emerald-500 transition-colors font-bold text-xs sm:text-sm text-[var(--color-text-primary)] disabled:opacity-75"
                  />
                  {errors.username && <p className="text-rose-500 text-[10px] font-bold mt-1 pl-1">{errors.username.message}</p>}
                </div>

                {/* Access Pass (Password) */}
                {!isViewMode && (
                  <div>
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1 block mb-1">
                      {editingUser ? "Access Pass (Leave blank to keep unchanged)" : "Access Pass (Min 6 chars)"}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        {...register("password")}
                        placeholder={editingUser ? "••••••••" : "Enter access password"}
                        autoComplete="new-password"
                        className="w-full px-4 py-2.5 pr-10 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-xl outline-none focus:border-emerald-500 transition-all font-bold text-xs sm:text-sm text-[var(--color-text-primary)] tracking-wider"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-rose-500 text-[10px] pl-1 font-bold mt-1">{errors.password.message}</p>}
                  </div>
                )}

                {/* Auth Tier & System State */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1 block mb-1">
                      Auth Tier
                    </label>
                    <select
                      {...register("role")}
                      disabled={isViewMode}
                      className="w-full px-3 py-2.5 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-xl outline-none focus:border-emerald-500 text-xs sm:text-sm font-bold text-[var(--color-text-primary)] disabled:opacity-75 cursor-pointer"
                    >
                      <option value="cashier">Cashier</option>
                      <option value="shop_admin">Shop Admin</option>
                      {isSuper && <option value="super_admin">Super Admin</option>}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1 block mb-1">
                      System State
                    </label>
                    <select
                      {...register("status")}
                      disabled={isViewMode}
                      className="w-full px-3 py-2.5 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-xl outline-none focus:border-emerald-500 text-xs sm:text-sm font-bold text-[var(--color-text-primary)] disabled:opacity-75 cursor-pointer"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Suspended</option>
                    </select>
                  </div>
                </div>

                {/* Operational Shift */}
                <div>
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1 block mb-1">
                    Operational Shift
                  </label>
                  <select
                    {...register("preferredShift")}
                    disabled={isViewMode}
                    className="w-full px-3 py-2.5 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-xl outline-none focus:border-emerald-500 text-xs sm:text-sm font-bold text-[var(--color-text-primary)] disabled:opacity-75 cursor-pointer"
                  >
                    <option value="day">Day Shift</option>
                    <option value="night">Night Shift</option>
                    <option value="both">Flexible / Both</option>
                  </select>
                  {errors.preferredShift && <p className="text-rose-500 text-[10px] mt-1 pl-1 font-bold">{errors.preferredShift.message}</p>}
                </div>

                {/* Branch Assignment for Super Admin */}
                {isSuper && selectedRole !== 'super_admin' && (
                  <div>
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1 block mb-1">
                      Assigned Branch (Creates row in branch cash_sessions table)
                    </label>
                    <select
                      {...register("shopId")}
                      disabled={isViewMode}
                      className="w-full px-3 py-2.5 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-xl outline-none focus:border-emerald-500 text-xs sm:text-sm font-bold text-[var(--color-text-primary)] disabled:opacity-75 cursor-pointer"
                    >
                      <option value="1">Maidan Branch (maidan_branch__cash_sessions)</option>
                    </select>
                  </div>
                )}

                {/* Action Button */}
                {!isViewMode ? (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 mt-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-600/25 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? "Processing..." : editingUser ? "Finalize Update" : "Authorize Member"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenModal(editingUser, false)}
                    className="w-full py-3 mt-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer"
                  >
                    Switch to Edit Mode
                  </button>
                )}
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Cash Session Modal */}
      <AnimatePresence>
        {editSessionModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
              onClick={() => !editSessionModal.isSaving && setEditSessionModal(prev => ({ ...prev, isOpen: false }))}
            />
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-[440px] relative z-10 border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-[var(--color-text-primary)] flex items-center gap-2">
                    <Edit2 className="w-4 h-4 text-emerald-600" />
                    Edit Cash Session #{editSessionModal.session?.id}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-zinc-500">
                    <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{editSessionModal.session?.branchName || `Branch #${editSessionModal.session?.shopId}`}</span>
                    <span>•</span>
                    <span className="text-zinc-600 font-mono">{editSessionModal.session?.openedBy}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditSessionModal(prev => ({ ...prev, isOpen: false }))}
                  disabled={editSessionModal.isSaving}
                  className="p-1.5 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveEditSession} className="p-5 space-y-4">
                {/* Status Selection */}
                <div>
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1 block mb-1.5">
                    Session Status
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditSessionModal(prev => ({ ...prev, status: 'open' }))}
                      className={`py-2 px-3 rounded-xl border text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        editSessionModal.status === 'open'
                          ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm'
                          : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-300"></span>
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditSessionModal(prev => ({ ...prev, status: 'closed' }))}
                      className={`py-2 px-3 rounded-xl border text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        editSessionModal.status === 'closed'
                          ? 'bg-zinc-700 text-white border-zinc-800 shadow-sm'
                          : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-zinc-400"></span>
                      Closed
                    </button>
                  </div>
                </div>

                {/* Opening Cash Input */}
                <div>
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1 block mb-1">
                    Opening Cash Amount (Rs.)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-zinc-400">Rs.</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={editSessionModal.openingCash}
                      onChange={(e) => setEditSessionModal(prev => ({ ...prev, openingCash: e.target.value }))}
                      placeholder="0"
                      className="w-full pl-11 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-emerald-500 font-mono font-bold text-sm text-[var(--color-text-primary)]"
                    />
                  </div>
                </div>

                {/* Notes Input */}
                <div>
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1 block mb-1">
                    Notes & Remarks
                  </label>
                  <textarea
                    rows="2"
                    value={editSessionModal.notes}
                    onChange={(e) => setEditSessionModal(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Active terminal session notes..."
                    className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-emerald-500 font-normal text-xs text-[var(--color-text-primary)] resize-none"
                  />
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditSessionModal(prev => ({ ...prev, isOpen: false }))}
                    disabled={editSessionModal.isSaving}
                    className="flex-1 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editSessionModal.isSaving}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-emerald-600/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                  >
                    {editSessionModal.isSaving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Team Member Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
        onConfirm={handleConfirmDelete}
        itemName={deleteModal.name}
        isDeleting={isDeleting}
      />

      {/* Cash Session Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={!!sessionToDelete}
        onClose={() => setSessionToDelete(null)}
        onConfirm={handleConfirmDeleteSession}
        title="Delete Cash Session"
        message={`Are you sure you want to permanently delete session #${sessionToDelete?.id} from ${sessionToDelete?.branchName || 'branch table'}?`}
        itemName={sessionToDelete?.openedBy || `Session #${sessionToDelete?.id}`}
        isDeleting={isDeletingSession}
      />
    </div>
  );
}