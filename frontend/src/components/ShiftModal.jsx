import React, { useState, useEffect } from 'react';
import { X, Play, StopCircle, Wallet, AlertCircle, CheckCircle2, User as UserIcon } from 'lucide-react';
import { useShift } from '../contexts/ShiftContext';
import { useUser } from '../contexts/UserContext';
import { getUsers } from '../services/api';

export function ShiftModal({ isOpen, onClose }) {
  const { currentSession, startShift, endShift, refreshSession } = useShift();
  const { user, isShopAdmin, isSuperAdmin } = useUser();
  const [cash, setCash] = useState('');
  const [shiftType, setShiftType] = useState('day');
  const [members, setMembers] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const isAdmin = isShopAdmin() || isSuperAdmin();

  useEffect(() => {
    if (isOpen) {
      refreshSession();
    }
  }, [isOpen, refreshSession]);

  useEffect(() => {
    if (isOpen && !currentSession && isAdmin) {
      const fetchMembers = async () => {
        try {
          const data = await getUsers(user.role);
          setMembers(data.filter(m => m.status === 'active'));
          setSelectedMemberId(user.id);
        } catch (err) {
          console.error("Failed to fetch members:", err);
        }
      };
      fetchMembers();
    }
  }, [isOpen, currentSession, isAdmin, user.role, user.id]);

  if (!isOpen) return null;

  const handleAction = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!currentSession) {
        await startShift(Number(cash), shiftType, selectedMemberId || user.id);
      } else {
        await endShift(Number(cash), notes);
      }
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
        setCash('');
        setNotes('');
      }, 1500);
    } catch (err) {
      setError(err.message || "Action failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />

      <div className="relative w-[95%] sm:w-[420px] bg-[var(--color-surface-card)] rounded-xl shadow-sm border border-[var(--color-border-subtle)] overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col z-10 mx-auto">
        {/* Header Decor */}
        <div className={`h-1.5 ${currentSession ? 'bg-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.3)]' : 'bg-green-500/50 shadow-[0_0_15px_rgba(37,99,235,0.3)]'}`}></div>

        <div className="p-5 sm:p-6 bg-[var(--color-surface-card)]">
          <div className="flex justify-between items-start mb-4">
            <div className="space-y-0.5">
              <h2 className="text-xl font-black text-[var(--color-text-primary)] tracking-tighter uppercase leading-none italic">
                {currentSession ? 'Terminal' : 'Shift Init'}
              </h2>
              <p className="text-[7px] text-[var(--color-text-muted)] font-bold uppercase tracking-[0.2em] leading-none">
                {currentSession ? 'Fiscal Reporting' : 'Session Authorization'}
              </p>
            </div>
            {!loading && !success && (
              <button onClick={onClose} className="p-1.5 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-base)] rounded-lg transition-all text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {success ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-5">
              <div className={`w-20 h-20 rounded-[1.5rem] flex items-center justify-center animate-bounce shadow-2xl ${currentSession ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-1.5">
                <p className="text-xl font-black text-[var(--color-text-primary)] uppercase tracking-tighter leading-none">
                  Status: {currentSession ? 'Closed' : 'Operational'}
                </p>
                <p className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase tracking-[0.1em]">Telemetry synchronized successfully.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAction} className="space-y-4">
              {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-500 text-[9px] font-black uppercase tracking-widest leading-none">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {currentSession && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] p-3 rounded-xl space-y-1 shadow-inner group/stat">
                    <span className="text-[7px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest block opacity-70">Target Recon.</span>
                    <div className="text-[11px] font-black text-[var(--color-text-primary)] font-mono">Rs. {currentSession.expectedCash.toLocaleString('en-PK')}</div>
                  </div>
                  <div className="bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] p-3 rounded-xl space-y-1 shadow-inner group/stat">
                    <span className="text-[7px] font-bold text-emerald-500 uppercase tracking-widest block opacity-70">Returns</span>
                    <div className="text-[11px] font-black text-emerald-500 font-mono">Rs. {currentSession.totalReturns?.toLocaleString('en-PK') || 0}</div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {!currentSession && (
                  <div className="space-y-4">
                    {isAdmin && (
                      <div className="space-y-2">
                        <label className="block text-[7px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest px-1 opacity-70">Assign Operator</label>
                        <div className="relative group">
                          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] scale-90">
                            <UserIcon className="w-3.5 h-3.5" />
                          </div>
                          <select
                            value={selectedMemberId}
                            onChange={(e) => setSelectedMemberId(e.target.value)}
                            className="w-full bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] focus:border-green-500/40 rounded-xl py-2.5 pl-10 pr-4 text-[9px] font-bold text-[var(--color-text-primary)] uppercase tracking-widest outline-none transition-all appearance-none cursor-pointer"
                          >
                            <option value={user.id}>Self ({user.fullName})</option>
                            {members.filter(m => m._id !== user.id).map(member => (
                              <option key={member._id} value={member._id}>
                                {member.fullName} ({member.role.replace('_', ' ')})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2.5">
                      <label className="block text-[7px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest px-1 opacity-70">Active Assignment</label>
                      <div className="grid grid-cols-2 gap-3 p-1 bg-[var(--color-surface-base)] rounded-xl border border-[var(--color-border-subtle)]">
                        <button
                          type="button"
                          onClick={() => setShiftType('day')}
                          className={`flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-[9px] uppercase tracking-wider transition-all ${shiftType === 'day'
                            ? 'bg-green-500 text-[var(--color-text-primary)] shadow-lg'
                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                            }`}
                        >
                          <div className={`w-1 h-1 rounded-full ${shiftType === 'day' ? 'bg-white animate-pulse' : 'bg-green-500/30'}`}></div>
                          Day Shift
                        </button>
                        <button
                          type="button"
                          onClick={() => setShiftType('night')}
                          className={`flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-[9px] uppercase tracking-wider transition-all ${shiftType === 'night'
                            ? 'bg-green-500 text-[var(--color-text-primary)] shadow-lg shadow-green-500/10'
                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                            }`}
                        >
                          <div className={`w-1 h-1 rounded-full ${shiftType === 'night' ? 'bg-white animate-pulse' : 'bg-green-500/30'}`}></div>
                          Night Shift
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {currentSession && (
                  <div className="p-3 bg-green-500/5 border border-green-500/10 rounded-xl flex justify-between items-center group/sales">
                    <div className="space-y-0.5">
                      <p className="text-[7px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest opacity-70">Total Shift Revenue</p>
                      <p className="text-lg font-black text-[var(--color-text-primary)] tracking-tighter leading-none">Rs. {currentSession.totalSales.toLocaleString('en-PK')}</p>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                      <Wallet className="w-4 h-4 text-[var(--color-primary)]" />
                    </div>
                  </div>
                )}

                {currentSession && (
                  <div className="relative group">
                    <label className="block text-[7px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-1.5 px-1 opacity-70">Annotations</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Shift log..."
                      className="w-full bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] focus:border-green-500/40 rounded-xl py-2 px-3 text-[9px] font-bold text-[var(--color-text-primary)] uppercase tracking-widest outline-none transition-all shadow-inner min-h-[50px] placeholder:text-slate-800"
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-4 rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-95 shadow-sm disabled:opacity-50 btn-primary`}
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    {currentSession ? <StopCircle className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {currentSession ? 'Terminate Session' : 'Initiate Shift'}
                  </>
                )}
              </button>
            </form>
          )}

          {/* Footer Info */}
          <div className="mt-4 pt-4 border-t border-[var(--color-border-subtle)] flex items-start gap-4 text-slate-600">
            <div className="w-6 h-6 rounded-lg bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] flex items-center justify-center flex-shrink-0">
              <Wallet className="w-3 h-3 text-[var(--color-primary)]/50" />
            </div>
            <p className="text-[7px] font-bold uppercase tracking-[0.1em] leading-relaxed opacity-50">
              Precision reporting of liquidity reserves is mandatory for fiscal integrity and audit compliance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
