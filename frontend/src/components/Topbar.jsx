import React from 'react';
import { Search, Plus, ShoppingCart, Download, Bell } from 'lucide-react';

export function Topbar({ onAddProduct, onNewSale, onExport }) {
  return (
    <div className="h-16 bg-surface-card/80 backdrop-blur-xl border-b border-[var(--color-border-subtle)] flex items-center justify-between px-8 sticky top-0 z-30 shadow-2xl">
      {/* Global Search */}
      <div className="flex-1 max-w-xl">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors" />
          <input
            type="text"
            placeholder="Search products, records, analytics..."
            className="w-full bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-2xl py-2.5 pl-11 pr-5 text-xs font-bold text-[var(--color-text-primary)] focus:ring-2 focus:ring-orange-500/20 transition-all outline-none placeholder:text-slate-700 uppercase tracking-widest"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-4">
        <button
          onClick={onAddProduct}
          className="hidden md:flex items-center gap-3 px-6 py-2.5 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-[var(--color-text-primary)] rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:scale-[1.05] active:scale-95 transition-all shadow-2xl shadow-[var(--color-primary)]/20"
        >
          <Plus className="w-4 h-4" />
          Product
        </button>
        <button
          onClick={onNewSale}
          className="hidden md:flex items-center gap-3 px-6 py-2.5 bg-[var(--color-surface-base)] text-[var(--color-text-primary)] rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border border-[var(--color-border-subtle)] hover:bg-white/20 transition-all active:scale-95 shadow-xl"
        >
          <ShoppingCart className="w-4 h-4" />
          Sale
        </button>
        <button
          onClick={onExport}
          className="p-2.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-base)] rounded-2xl transition-all border border-transparent hover:border-[var(--color-border-subtle)] shadow-sm"
          title="Export Reports"
        >
          <Download className="w-5 h-5" />
        </button>
        <div className="h-6 w-px bg-[var(--color-surface-base)] mx-1"></div>
        <button className="p-2.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-green-500/5 rounded-2xl transition-all relative border border-transparent hover:border-green-500/10">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-green-500 rounded-full border-2 border-[#0b0e14] shadow-[0_0_8px_rgba(37,99,235,0.5)]"></span>
        </button>
        <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[var(--color-primary)] to-rose-600 border border-[var(--color-border-subtle)] shadow-lg cursor-pointer ml-2 overflow-hidden ring-1 ring-white/5 flex items-center justify-center p-1 transition-transform hover:rotate-3">
          <div className="w-full h-full bg-[#0b0e14]/20 rounded-xl"></div>
        </div>
      </div>
    </div>
  );
}
