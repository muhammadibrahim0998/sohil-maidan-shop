import { Trash2, Edit, Download, Receipt, ShoppingBag, RotateCcw, Eye, FileSpreadsheet, Calendar } from 'lucide-react';
import { getBackendBaseUrl } from '../services/api';
import { useUser } from '../contexts/UserContext';

export function SalesHistory({
  sales,
  handleDeleteSale,
  openEditSaleModal,
  onReturnSale,
  onViewSale,
  onExport
}) {
  const { isPageOpAllowed } = useUser();
  const isEditAllowed = isPageOpAllowed ? isPageOpAllowed('sales', 'edit') : true;
  const isDeleteAllowed = isPageOpAllowed ? isPageOpAllowed('sales', 'delete') : true;
  const fmt = (n) => `Rs. ${(n || 0).toLocaleString('en-PK')}`;

  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border-subtle)] shadow-sm p-6 overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="flex items-center justify-between mb-6 pb-5 border-b border-[var(--color-border-subtle)]">
        <div className="space-y-1.5">
          <h3 className="text-xl font-black text-[var(--color-text-primary)] tracking-tighter flex items-center gap-3 uppercase">
            Transaction Logs
            <span className="text-[9px] font-black bg-green-600/10 text-[var(--color-primary)] px-2.5 py-0.5 rounded-full border border-green-/20 uppercase tracking-widest">
              {sales.length} Ops
            </span>
          </h3>
          <div className="text-[9px] text-[var(--color-text-muted)] font-black uppercase tracking-[0.3em] flex items-center gap-2">
            <div className="w-1 h-1 bg-green-600 rounded-full animate-pulse"></div>
            Real-time Fiscal Intelligence
          </div>
        </div>
        <button
          onClick={onExport}
          disabled={sales.length === 0}
          className="flex items-center gap-2.5 px-5 py-2.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] transition-all border border-emerald-500/20 disabled:opacity-20 disabled:cursor-not-allowed group"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          Export
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {sales.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-24 bg-[var(--color-surface-base)] rounded-[3rem] border-2 border-dashed border-[var(--color-border-subtle)] text-center space-y-6">
            <div className="w-20 h-20 bg-[var(--color-surface-base)] rounded-full flex items-center justify-center text-slate-700 shadow-inner border border-[var(--color-border-subtle)]">
              <Receipt className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <p className="text-xl font-black text-[var(--color-text-primary)] uppercase tracking-tighter">Zero Activity Detected</p>
              <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.3em]">System history is currently decoupled</p>
            </div>
          </div>
        ) : (
          sales.map((sale, index) => (
            <div
              key={sale._id}
              className="group bg-[var(--color-surface-base)] rounded-xl border border-[var(--color-border-subtle)] p-6 shadow-sm hover:bg-[var(--color-surface-card)] hover:border-green-/20 transition-all duration-400 animate-in fade-in zoom-in-95 relative overflow-hidden"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Subtle background glow */}
              <div className="absolute -top-16 -right-16 w-32 h-32 bg-green-600/5 rounded-full blur-[60px] group-hover:bg-green-600/10 transition-all"></div>

              {/* Card Header: Metadata */}
              <div className="flex items-start justify-between gap-4 mb-8 relative z-10">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Entry ID</span>
                    <span className="text-xs font-black text-[var(--color-text-primary)] mono tracking-widest bg-[var(--color-background)] px-2 py-1 rounded-lg">#{String(sale._id || sale.id || '').slice(-6).toUpperCase()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--color-text-muted)] bg-[var(--color-surface-base)] w-fit px-3 py-1.5 rounded-xl border border-[var(--color-border-subtle)]">
                    <Calendar className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                    <p className="text-[9px] font-black uppercase tracking-widest leading-none">
                      {new Date(sale.saleDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: '2-digit' })} • {new Date(sale.saleDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                {sale.status === 'returned' ? (
                  <span className="px-4 py-1.5 bg-rose-500/10 text-rose-500 text-[10px] font-black rounded-full border border-rose-500/20 uppercase tracking-widest shadow-lg">Returned</span>
                ) : (
                  <span className="px-4 py-1.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-black rounded-full border border-emerald-500/20 uppercase tracking-widest shadow-lg">Cleared</span>
                )}
              </div>

              {/* Card Body: Valuation & Items */}
              <div className="space-y-5 relative z-10">
                <div className="p-5 bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border-subtle)] shadow-sm group-hover:border-green-/10 transition-all">
                  <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] mb-1.5">Total Transaction Value</p>
                  <p className={`text-2xl font-black font-mono tracking-tighter ${sale.status === 'returned' ? 'text-rose-500/50 line-through' : 'text-[var(--color-text-primary)]'}`}>
                    {fmt(sale.totalAmount)}
                  </p>
                </div>

                <div className="space-y-2.5">
                  <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] pl-1">Inventory Outflow</p>
                  <div className="flex flex-wrap gap-2">
                    {sale.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-xl transition-all">
                        <span className="text-[10px] font-black text-[var(--color-text-primary)] uppercase tracking-tight">{item.name}</span>
                        <div className="w-[1.5px] h-2.5 bg-[var(--color-surface-base)] rounded-full" />
                        <span className="text-[10px] font-black text-[var(--color-primary)]">x{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card Footer: Detailed Actions */}
              <div className="flex items-center justify-between pt-5 mt-6 border-t border-[var(--color-border-subtle)] relative z-10">
                <div className="flex items-center gap-1.5">
                  <button onClick={() => onViewSale(sale)} className="p-2.5 bg-[var(--color-surface-base)] hover:bg-[var(--color-surface-base)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded-xl transition-all border border-[var(--color-border-subtle)]" title="View"><Eye className="w-4 h-4" /></button>
                  {sale.status !== 'returned' && (
                    <button onClick={() => onReturnSale(sale._id)} className="p-2.5 bg-[var(--color-surface-base)] hover:bg-rose-500/10 text-[var(--color-text-muted)] hover:text-rose-500 rounded-xl transition-all border border-[var(--color-border-subtle)]" title="Return Archive"><RotateCcw className="w-4 h-4" /></button>
                  )}
                  {isEditAllowed && <button onClick={() => openEditSaleModal(sale)} className="p-2.5 bg-[var(--color-surface-base)] hover:bg-green-600 hover:text-[var(--color-text-primary)] rounded-xl transition-all border border-[var(--color-border-subtle)]" title="Modify Record"><Edit className="w-4 h-4" /></button>}
                </div>
                <div className="flex items-center gap-1.5">
                  {sale.invoiceUrl && (
                    <button
                      onClick={() => {
                        const apiUrl = getBackendBaseUrl();
                        window.open(`${apiUrl}${sale.invoiceUrl}`, '_blank');
                      }}
                      className="p-2.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-[var(--color-text-primary)] rounded-xl transition-all border border-emerald-500/20"
                      title="Download Invoice"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                  {isDeleteAllowed && <button onClick={() => handleDeleteSale(sale)} className="p-2.5 bg-[var(--color-surface-base)] hover:bg-rose-600 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded-xl transition-all border border-[var(--color-border-subtle)]" title="Purge Record"><Trash2 className="w-4 h-4" /></button>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
