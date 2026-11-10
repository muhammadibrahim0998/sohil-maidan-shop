import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Trash2, Shield, User as UserIcon, AlertCircle, CheckCircle2, ChevronRight, Eye, Edit2 } from 'lucide-react';
import api from '../services/api';
import { MemberForm } from './MemberForm';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { toast } from 'sonner';

export function TeamManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, name: '' });
  const [error, setError] = useState('');
  const [editingMember, setEditingMember] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmitMember = async (data) => {
    setError('');
    try {
      if (editingMember) {
        await api.put(`/users/${editingMember._id}`, data);
        toast.success('Protocol Update Successful');
      } else {
        await api.post('/users', data);
        toast.success('Member successfully registered to NexusOS');
      }
      setIsAdding(false);
      setEditingMember(null);
      setIsViewMode(false);
      fetchUsers();
    } catch (err) {
      const msg = err.response?.data?.message || 'Authorization Protocol Failed';
      setError(msg);
      toast.error(msg);
    }
  };

  const handleEditClick = (user) => {
    setEditingMember(user);
    setIsViewMode(false);
    setIsAdding(true);
  };

  const handleViewClick = (user) => {
    setEditingMember(user);
    setIsViewMode(true);
    setIsAdding(true);
  };

  const handleDeleteClick = (user) => {
    setDeleteModal({
      isOpen: true,
      id: user._id,
      name: user.fullName
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.id) return;
    setIsDeleting(true);
    try {
      await api.delete(`/users/${deleteModal.id}`);
      toast.success('Member removed from system');
      setDeleteModal({ isOpen: false, id: null, name: '' });
      fetchUsers();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to remove staff member';
      toast.error(msg);
      setError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15
      }
    }
  };

  return (
    <div className="bg-surface-card rounded-[2.5rem] p-8 sm:p-10 shadow-2xl border border-[var(--color-border-subtle)] animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="w-2.5 h-12 bg-green-500 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.4)]"></div>
            <h2 className="text-4xl font-black text-[var(--color-text-primary)] tracking-tighter uppercase leading-none">Team Personnel</h2>
          </div>
          <p className="text-[var(--color-text-muted)] font-bold tracking-[0.4em] uppercase text-[10px] pl-6">Access Control & Authorization Layer</p>
        </div>
        {!isAdding && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsAdding(true)}
            className="flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-[var(--color-text-primary)] rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-[var(--color-primary)]/20 active:scale-95 transition-all"
          >
            <UserPlus className="w-5 h-5 transition-transform hover:rotate-12" />
            Add Member
          </motion.button>
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-12 overflow-hidden"
          >
            <MemberForm
              onSubmit={handleSubmitMember}
              initialData={editingMember}
              isViewMode={isViewMode}
              onCancel={() => {
                setIsAdding(false);
                setEditingMember(null);
                setIsViewMode(false);
              }}
              isSubmitting={loading}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center bg-[var(--color-surface-base)] rounded-xl border border-[var(--color-border-subtle)]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 shadow-[0_0_15px_rgba(37,99,235,0.3)] mb-4"></div>
          <p className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">Identifying Members...</p>
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8"
        >
          {users.map((u) => (
            <motion.div
              key={u._id}
              variants={cardVariants}
              whileHover={{ y: -3, boxShadow: "0 15px 30px -10px rgba(0, 0, 0, 0.1)" }}
              className="group relative bg-[var(--color-surface-base)] p-5 sm:p-8 rounded-xl border border-[var(--color-border-subtle)] hover:border-green-500/30 transition-all shadow-xl overflow-hidden"
            >
              <div className="flex items-start justify-between relative z-10">
                <div className="flex items-center gap-5">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner border border-[var(--color-border-subtle)] transition-transform group-hover:scale-110 ${u.role === 'admin' ? 'bg-green-500/20 text-[var(--color-primary)]' : 'bg-[var(--color-surface-base)] text-[var(--color-text-muted)]'}`}>
                    {u.role === 'admin' ? <Shield className="w-7 h-7" /> : <UserIcon className="w-7 h-7" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-lg font-black text-[var(--color-text-primary)] truncate tracking-tighter uppercase leading-tight">{u.fullName}</h4>
                    <p className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] mt-1 flex items-center gap-1.5 whitespace-nowrap overflow-hidden">
                      <span className="w-1.5 h-1.5 bg-green-500/40 rounded-full shrink-0"></span>
                      <span className="truncate">@{u.username}</span>
                      <span className="shrink-0">• {u.preferredShift === 'day' ? '☀️ Day' : u.preferredShift === 'night' ? '🌙 Night' : '🔄 Both'}</span>
                    </p>
                    {u.phoneNumber && (
                      <p className="text-[9px] font-bold text-[var(--color-text-muted)] mt-1 flex items-center gap-1.5 opacity-60">
                        <AlertCircle className="w-3 h-3" /> {u.phoneNumber}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-3 shrink-0 ml-4">
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em] border whitespace-nowrap ${u.role === 'admin' || u.role === 'shop_admin' || u.role === 'super_admin' ? 'bg-green-600/10 text-green-600 border-green-600/20' : 'bg-[var(--color-surface-base)] text-[var(--color-text-secondary)] border-[var(--color-border-subtle)]'}`}>
                    {u.role?.replace('_', ' ')}
                  </span>
                  <div className="flex gap-2">
                    <motion.button
                      whileHover={{ scale: 1.1, backgroundColor: "var(--color-green-50)" }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleViewClick(u)}
                      className="p-2.5 bg-white text-green-600 rounded-xl transition-all border border-green-100 shadow-sm"
                      title="View Profile"
                    >
                      <Eye className="w-4 h-4" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1, backgroundColor: "var(--color-amber-50)" }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleEditClick(u)}
                      className="p-2.5 bg-white text-amber-600 rounded-xl transition-all border border-amber-100 shadow-sm"
                      title="Edit Member"
                    >
                      <Edit2 className="w-4 h-4" />
                    </motion.button>
                    {u.username !== 'admin' && (
                      <motion.button
                        whileHover={{ scale: 1.1, backgroundColor: "var(--color-rose-50)" }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDeleteClick(u)}
                        className="p-2.5 bg-white text-rose-600 rounded-xl transition-all border border-rose-100 shadow-sm"
                        title="Remove Member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-[10px] font-black text-[var(--color-text-muted)] relative z-10">
                <div className="flex items-center gap-2 uppercase tracking-[0.2em]">
                  <div className={`w-2 h-2 rounded-full shadow-[0_0_8px] ${u.status === 'active' ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-slate-700 shadow-slate-700/50'}`}></div>
                  {u.status}
                </div>
                <span className="uppercase tracking-[0.1em] opacity-40">Personnel ID: {String(u._id || u.id || '').slice(-6).toUpperCase()}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
        onConfirm={handleConfirmDelete}
        itemName={deleteModal.name}
        isDeleting={isDeleting}
      />
    </div>
  );
}
