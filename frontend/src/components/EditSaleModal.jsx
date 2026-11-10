import React, { useState, useEffect } from 'react';
import { X, Save, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

export function EditSaleModal({ isOpen, onClose, sale, onSave }) {
  // --- ORIGINAL LOGIC START ---
  const [items, setItems] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (sale && isOpen) {
      setItems(JSON.parse(JSON.stringify(sale.items)));
    }
  }, [sale, isOpen]);

  if (!isOpen || !sale) return null;

  const handleQuantityChange = (index, newQty) => {
    if (newQty < 1) return;
    const newItems = [...items];
    newItems[index].quantity = newQty;
    newItems[index].subtotal = newItems[index].price * newQty;
    newItems[index].profit = (newItems[index].price - (newItems[index].costPrice || 0)) * newQty;
    setItems(newItems);
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
      const totalProfit = items.reduce((sum, item) => sum + (item.profit || 0), 0);

      const updatedSaleData = {
        ...sale,
        items,
        totalAmount,
        totalProfit
      };

      await onSave(updatedSaleData);
      onClose();
    } catch (error) {
      toast.error(error.message || "Failed to edit sale");
    } finally {
      setIsSubmitting(false);
    }
  };

  const originalTotal = sale.totalAmount;
  const newTotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  // --- ORIGINAL LOGIC END ---

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />

      <div className="relative w-[95%] sm:w-[500px] bg-[#1a1c1e] rounded-xl border border-[var(--color-border-subtle)] shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto scrollbar-hide z-10 mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-6 sm:p-8 bg-[#202327]/40 backdrop-blur-md border-b border-[var(--color-border-subtle)] shrink-0">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-[var(--color-text-primary)] tracking-tighter uppercase leading-none italic">Modify Record</h2>
            <p className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Tx ID: #{String(sale._id || sale.id || '').slice(-6).toUpperCase()}</p>
          </div>
          <button onClick={onClose} className="p-2.5 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-base)] rounded-xl transition-all text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Area */}
        <div className="p-8 sm:p-10 overflow-y-auto custom-scrollbar flex-1 space-y-10">
          <div className="bg-green-600/10 border border-green-/20 rounded-[1.5rem] p-6 flex gap-4 text-[var(--color-primary)] text-[10px] font-black uppercase tracking-widest leading-relaxed shadow-lg shadow-orange-950/20">
            <ShieldAlert className="w-6 h-6 flex-shrink-0" />
            <p>
              <strong className="text-green-600 block mb-1">Inventory Synchronization Warning:</strong>
              Operational overrides on quantity directly impact live stock levels. Use under authorization only.
            </p>
          </div>

          <div className="space-y-4">
            {items.map((item, idx) => {
              const originalItem = sale.items[idx];
              const diff = item.quantity - originalItem.quantity;

              return (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-xl gap-6 group hover:bg-[var(--color-surface-base)] hover:border-green-/30 transition-all shadow-xl">
                  <div className="flex-1 space-y-2">
                    <p className="text-lg font-black text-[var(--color-text-primary)] uppercase tracking-tighter leading-none">{item.name}</p>
                    <p className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-green-600/30 rounded-full"></span>
                      Unit: Rs. {item.price.toLocaleString('en-PK')}
                    </p>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="flex flex-col items-center">
                      <label className="text-[9px] uppercase font-black text-slate-600 mb-2 tracking-widest">Qty Control</label>
                      <div className="flex items-center bg-[var(--color-surface-card)] border border-[var(--color-border-subtle)] rounded-xl overflow-hidden shadow-inner">
                        <button
                          onClick={() => handleQuantityChange(idx, item.quantity - 1)}
                          className="px-4 py-2 hover:bg-[var(--color-surface-base)] text-[var(--color-text-secondary)] font-black border-r border-[var(--color-border-subtle)] transition-all"
                        >-</button>
                        <span className="w-12 text-center font-black text-xs text-[var(--color-text-primary)] font-mono">{item.quantity}</span>
                        <button
                          onClick={() => handleQuantityChange(idx, item.quantity + 1)}
                          className="px-4 py-2 hover:bg-[var(--color-surface-base)] text-[var(--color-text-secondary)] font-black border-l border-[var(--color-border-subtle)] transition-all"
                        >+</button>
                      </div>
                      {diff !== 0 && (
                        <span className={`text-[9px] font-black mt-2 uppercase tracking-widest px-2 py-0.5 rounded-full border ${diff > 0 ? 'text-rose-500 border-rose-500/20 bg-rose-500/10' : 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10'}`}>
                          {diff > 0 ? 'Stock -' : 'Stock +'}{Math.abs(diff)}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col items-end min-w-[120px]">
                      <label className="text-[9px] uppercase font-black text-slate-600 mb-2 tracking-widest">Aggregate</label>
                      <span className="font-black text-sm text-[var(--color-primary)] font-mono tracking-tighter">Rs. {item.subtotal.toLocaleString('en-PK')}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 sm:p-10 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] shrink-0 flex flex-col sm:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-8">
            <div>
              <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Previous Total</p>
              <p className="font-black text-slate-700 line-through text-sm font-mono tracking-tighter">Rs. {originalTotal.toLocaleString('en-PK')}</p>
            </div>
            <div className="h-10 w-px bg-[var(--color-surface-base)]"></div>
            <div>
              <p className="text-[9px] font-black text-[var(--color-primary)] uppercase tracking-widest mb-1">Revised Total</p>
              <p className="text-2xl font-black text-[var(--color-text-primary)] font-mono tracking-tighter">Rs. {newTotal.toLocaleString('en-PK')}</p>
            </div>
          </div>

          <div className="flex gap-4 w-full sm:w-auto">
            <button onClick={onClose} className="flex-1 sm:flex-none px-8 py-4 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] text-[var(--color-text-muted)] rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-[var(--color-surface-base)] transition-all outline-none">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSubmitting || originalTotal === newTotal}
              className="flex-1 sm:flex-none flex items-center justify-center gap-4 px-10 py-4 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-[var(--color-text-primary)] rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl shadow-[var(--color-primary)]/20 hover:scale-[1.05] disabled:opacity-20 transition-all active:scale-95 outline-none"
            >
              {isSubmitting ? <span className="animate-spin text-lg">⟳</span> : <Save className="w-5 h-5" />}
              Commit Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}