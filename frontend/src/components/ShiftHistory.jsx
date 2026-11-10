import React from 'react';
import { Calendar, User, Wallet, AlertCircle, Clock, Moon, Sun, ClipboardList } from 'lucide-react';
import { useShift } from '../contexts/ShiftContext';

export function ShiftHistory() {
    const { history, loading } = useShift();
    const fmt = (n) => `Rs. ${(n || 0).toLocaleString('en-PK')}`;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-"></div>
            </div>
        );
    }

    return (
        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border-subtle)] shadow-sm p-6 overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="flex items-center justify-between mb-8 pb-5 border-b border-[var(--color-border-subtle)]">
                <div className="space-y-1.5">
                    <h3 className="text-xl font-black text-[var(--color-text-primary)] tracking-tighter flex items-center gap-3 uppercase italic">
                        Shift Archives
                        <span className="text-[9px] font-black bg-rose-500/10 text-rose-500 px-2.5 py-0.5 rounded-full border border-rose-500/20 uppercase tracking-[0.2em] not-italic">
                            {history.length} Sessions
                        </span>
                    </h3>
                    <p className="text-[9px] text-[var(--color-text-muted)] font-black uppercase tracking-[0.3em] flex items-center gap-2">
                        <div className="w-1 h-1 bg-rose-500 rounded-full animate-pulse"></div>
                        Audited Reconciliation Records
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {history.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center py-24 bg-[var(--color-surface-base)] rounded-[3rem] border-2 border-dashed border-[var(--color-border-subtle)] text-center space-y-6">
                        <div className="w-20 h-20 bg-[var(--color-surface-base)] rounded-full flex items-center justify-center text-slate-700 shadow-inner border border-[var(--color-border-subtle)]">
                            <ClipboardList className="w-10 h-10" />
                        </div>
                        <div className="space-y-2">
                            <p className="text-xl font-black text-[var(--color-text-primary)] uppercase tracking-tighter">No Archive Data</p>
                            <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.3em]">Shift records will appear here after completion</p>
                        </div>
                    </div>
                ) : (
                    history.map((session, index) => {
                        const isDiscrepancy = Math.abs((session.actualCash || 0) - session.expectedCash) > 5;
                        const diff = (session.actualCash || 0) - session.expectedCash;

                        return (
                            <div
                                key={session._id}
                                className="group bg-[var(--color-surface-base)] rounded-xl border border-[var(--color-border-subtle)] p-6 shadow-sm hover:bg-[var(--color-surface-card)] transition-all duration-400 animate-in fade-in zoom-in-95 relative overflow-hidden flex flex-col"
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                {/* Header: Operator & Time */}
                                <div className="mb-6 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-[var(--color-text-muted)] bg-[var(--color-surface-base)] px-3 py-1.5 rounded-xl border border-[var(--color-border-subtle)]">
                                            <Calendar className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                                            <p className="text-[9px] font-black uppercase tracking-widest leading-none">
                                                {new Date(session.startTime).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })}
                                            </p>
                                        </div>
                                        {session.status === 'open' ? (
                                            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[8px] font-black rounded-full border border-emerald-500/20 uppercase tracking-[0.2em]">Active</span>
                                        ) : (
                                            <span className="px-3 py-1 bg-[var(--color-surface-base)] text-[var(--color-text-muted)] text-[8px] font-black rounded-full border border-[var(--color-border-subtle)] uppercase tracking-[0.2em]">Closed</span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-green-600/10 border border-green-/20 flex items-center justify-center shrink-0">
                                            <User className="w-5 h-5 text-[var(--color-primary)]" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[8px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest leading-none mb-1">Session Operator</p>
                                            <p className="text-sm font-black text-[var(--color-text-primary)] truncate tracking-tight uppercase italic">{session.cashierId?.fullName || 'Unknown'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Metrics Grid */}
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    <div className="p-3 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-xl space-y-1">
                                        <p className="text-[7px] font-black text-[var(--color-text-muted)] uppercase tracking-widest flex items-center gap-1.5">
                                            {session.shiftType === 'night' ? <Moon className="w-2.5 h-2.5 text-green-" /> : <Sun className="w-2.5 h-2.5 text-green-" />}
                                            Shift Type
                                        </p>
                                        <p className="text-[10px] font-black text-[var(--color-text-primary)] uppercase tracking-wider">{session.shiftType || 'Day'} Shift</p>
                                    </div>
                                    <div className="p-3 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-xl space-y-1">
                                        <p className="text-[7px] font-black text-[var(--color-text-muted)] uppercase tracking-widest flex items-center gap-1.5">
                                            <Clock className="w-2.5 h-2.5 text-[var(--color-text-muted)]" />
                                            Duration
                                        </p>
                                        <p className="text-[10px] font-black text-[var(--color-text-primary)] uppercase tracking-wider">
                                            {session.endTime ?
                                                Math.round((new Date(session.endTime) - new Date(session.startTime)) / (1000 * 60 * 60)) + ' hrs'
                                                : 'Running'}
                                        </p>
                                    </div>
                                </div>

                                {/* Financial Reconcilliation */}
                                <div className="flex-1 space-y-3">
                                    <div className="p-4 bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border-subtle)] shadow-sm">
                                        <div className="flex justify-between items-end mb-3">
                                            <div className="space-y-1">
                                                <p className="text-[7px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">Total Sales Revenue</p>
                                                <p className="text-xl font-black text-[var(--color-text-primary)] tracking-tighter">{fmt(session.totalSales)}</p>
                                            </div>
                                            <div className={`p-1.5 rounded-lg border flex items-center gap-1.5 ${isDiscrepancy ? 'bg-rose-500/10 border-rose-500/30 text-rose-500' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'}`}>
                                                <AlertCircle className="w-3 h-3" />
                                                <span className="text-[8px] font-black italic">{isDiscrepancy ? `${diff > 0 ? '+' : ''}${diff}` : 'Balanced'}</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[var(--color-border-subtle)] text-[9px] font-bold uppercase tracking-widest">
                                            <div className="space-y-1">
                                                <span className="text-slate-600 block text-[7px]">Opening</span>
                                                <span className="text-[var(--color-text-primary)]">{fmt(session.openingCash)}</span>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-slate-600 block text-[7px]">Reported</span>
                                                <span className={session.actualCash ? 'text-[var(--color-text-primary)]' : 'text-slate-600'}>
                                                    {session.actualCash ? fmt(session.actualCash) : 'PENDING'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Notes */}
                                    {session.notes && (
                                        <div className="bg-[var(--color-surface-base)] p-3 rounded-xl border border-[var(--color-border-subtle)] italic">
                                            <p className="text-[8px] text-[var(--color-text-muted)] line-clamp-2 leading-relaxed">"{session.notes}"</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
