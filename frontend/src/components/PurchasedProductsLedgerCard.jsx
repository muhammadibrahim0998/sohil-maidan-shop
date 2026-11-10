import { useMemo, useState } from 'react';
import { Truck, Box, Banknote, CreditCard, Image as ImageIcon, ExternalLink, ShieldCheck, X, Search, DollarSign, Trash2, Edit2, Eye } from 'lucide-react';
import { CountUpNumber } from './CountUpNumber.jsx';
import { motion, AnimatePresence } from 'framer-motion';

export function PurchasedProductsLedgerCard({ products = [], onAddProduct, onEditProduct, onDeleteProduct, onViewProduct }) {
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Purchased items list (filtered & sorted by latest)
  const purchasedProducts = useMemo(() => {
    return products
      .filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (p.supplierName && p.supplierName.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesSearch;
      })
      .sort((a, b) => new Date(b.createdAt || b.lastUpdated || 0) - new Date(a.createdAt || a.lastUpdated || 0));
  }, [products, searchTerm]);

  // Overall Purchased Summary
  const stats = useMemo(() => {
    let grandPurchaseCost = 0;
    let totalPetisBought = 0;
    let totalTraysBought = 0;
    let cashPaid = 0;
    let onlinePaid = 0;
    let totalDue = 0;

    products.forEach(p => {
      const stockEggs = Number(p.stock || 0);
      const petis = p.petiQuantity || (stockEggs ? stockEggs / 360 : 0);
      const trays = p.trayQuantity || (stockEggs ? stockEggs / 30 : 0);

      totalPetisBought += petis;
      totalTraysBought += trays;

      const unitCost = Number(p.costPrice) > 0 ? Number(p.costPrice) : Number(p.price || 0);
      const unitDivisor = p.unitType === 'egg' ? 1 : p.unitType === 'tray' ? 30 : 360;

      const cost = Number(p.totalPurchaseCost) > 0
        ? Number(p.totalPurchaseCost)
        : (petis > 0 ? petis * unitCost : (stockEggs > 0 ? stockEggs * (unitCost / unitDivisor) : 0));

      const hasReceipt = !!(
        (p.paymentReceipt && typeof p.paymentReceipt === 'string' && p.paymentReceipt.trim()) ||
        (p.receipt && typeof p.receipt === 'string' && p.receipt.trim()) ||
        (p.paymentProof && typeof p.paymentProof === 'string' && p.paymentProof.trim())
      );
      
      const pMethodLower = String(p.paymentMethod || 'Cash').trim().toLowerCase();
      
      const isOnline = p.isOnlinePayment === true || hasReceipt || (
        pMethodLower.includes('bank') || 
        pMethodLower.includes('easy') || 
        pMethodLower.includes('jazz') || 
        pMethodLower.includes('online') || 
        pMethodLower.includes('cheque') || 
        pMethodLower.includes('transfer') ||
        pMethodLower.includes('card')
      );

      const isCredit = !isOnline && (
        pMethodLower.includes('credit') || 
        pMethodLower.includes('due')
      );

      // Strict Routed Paid vs Due (Credit) calculation (No overlap)
      const isCreditMethod = isCredit || pMethodLower.includes('credit') || pMethodLower.includes('due') || pMethodLower.includes('partial');
      const hasExplicitDue = p.dueAmountToSupplier !== undefined && p.dueAmountToSupplier !== null && Number(p.dueAmountToSupplier) > 0;
      
      let due = 0;
      let paid = 0;

      if (hasExplicitDue || isCreditMethod) {
        const rawDue = hasExplicitDue ? Number(p.dueAmountToSupplier) : cost;
        due = Math.min(cost, Math.max(0, rawDue));
        paid = Math.max(0, cost - due);
      } else {
        // 100% Cash / Bank Paid (No Credit)
        paid = cost;
        due = 0;
      }

      grandPurchaseCost += cost;
      totalDue += due;
      cashPaid += paid;
    });

    return {
      grandPurchaseCost,
      totalPetisBought: Number(totalPetisBought.toFixed(1)),
      totalTraysBought: Math.round(totalTraysBought),
      cashPaid,
      totalDue
    };
  }, [products]);

  const fmt = (n) => Number(n || 0).toLocaleString('en-PK');

  return (
    <div className="bg-white border border-zinc-100 rounded-[2rem] p-6 sm:p-8 shadow-sm space-y-6">

      {/* Header Banner & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-2xl text-teal-600">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-zinc-900 uppercase tracking-tight italic">
              Purchased Products &amp; Cost Price Ledger
            </h3>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Complete Record of Stock Bought, Cost Prices, Suppliers &amp; Receipts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-zinc-100 px-3 py-1.5 rounded-xl">
            <Search className="w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Purchased Product or Supplier..."
              className="bg-transparent text-xs font-bold outline-none text-zinc-800 placeholder:text-zinc-400 w-48 sm:w-64"
            />
          </div>

          <button
            onClick={onAddProduct}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
          >
            + Add Stock
          </button>
        </div>
      </div>

      {/* Summary KPI 4 Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-zinc-900 text-white rounded-2xl border border-zinc-800 flex flex-col justify-between">
          <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest block mb-1">
            Total Purchased
          </span>
          <h4 className="text-xl sm:text-2xl font-black tracking-tight">
            Rs. <CountUpNumber value={stats.grandPurchaseCost} />
          </h4>
          <span className="text-[9px] text-zinc-400 font-bold uppercase mt-1 block">Total Investment</span>
        </div>

        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl flex flex-col justify-between">
          <span className="text-[9px] font-black text-amber-700 uppercase tracking-widest block mb-1">
            Stock Bought
          </span>
          <h4 className="text-xl sm:text-2xl font-black text-amber-900 tracking-tight">
            {stats.totalPetisBought} Petis
          </h4>
          <span className="text-[9px] font-bold text-amber-800 uppercase mt-1 block">
            {stats.totalTraysBought.toLocaleString()} Trays Total
          </span>
        </div>

        {/* Cash Paid Box */}
        <div className="p-4 bg-emerald-500 text-white rounded-2xl border border-emerald-600 shadow-md flex flex-col justify-between">
          <span className="text-[9px] font-black text-emerald-100 uppercase tracking-widest block mb-1">
            💵 Cash Paid
          </span>
          <h4 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Rs. <CountUpNumber value={stats.cashPaid} />
          </h4>
          <span className="text-[10px] text-emerald-100 font-bold uppercase mt-1 block">
            Physical Cash Handover
          </span>
        </div>

        {/* Supplier Due Balance Box */}
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl flex flex-col justify-between">
          <span className="text-[9px] font-black text-rose-700 uppercase tracking-widest block mb-1">
            ⚠️ Due Balance (Credit)
          </span>
          <h4 className="text-xl sm:text-2xl font-black text-rose-700 tracking-tight">
            Rs. <CountUpNumber value={stats.totalDue} />
          </h4>
          <span className="text-[9px] font-bold text-rose-700 uppercase mt-1 block">
            Owed Pending Debt
          </span>
        </div>
      </div>

      {/* Purchased Products Table Box */}
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-zinc-900 text-white uppercase text-[10px] tracking-wider font-black">
              <th className="py-3 px-4">Product Name</th>
              <th className="py-3 px-4">Purchased Stock</th>
              <th className="py-3 px-4">Cost Price (Rs)</th>
              <th className="py-3 px-4">Total Cost</th>
              <th className="py-3 px-4">Supplier Name</th>
              <th className="py-3 px-4">Payment Method</th>
              <th className="py-3 px-4 text-center">Receipt Screenshot</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 font-bold text-zinc-800">
            {purchasedProducts.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-zinc-400 font-bold">
                  No purchased product records found. Click "+ Add Stock" to enter product purchases.
                </td>
              </tr>
            ) : (
              purchasedProducts.map((p, idx) => {
                const petis = p.petiQuantity || (p.stock ? (p.stock / 360).toFixed(1) : 0);
                const trays = p.trayQuantity || (p.stock ? Math.round(p.stock / 30) : 0);
                const cost = Number(p.totalPurchaseCost) || (Number(p.costPrice) > 0 ? (Number(p.stock || 0) * (Number(p.costPrice) / (p.unitType === 'egg' ? 1 : p.unitType === 'tray' ? 30 : 360))) : 0);

                return (
                  <tr key={p._id || idx} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center text-xs font-black shrink-0">
                          📦
                        </div>
                        <div>
                          <span className="font-black text-zinc-900 block">{p.name}</span>
                          <span className="text-[9px] text-zinc-400 uppercase font-bold">{p.category || 'Eggs'}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-[11px] font-black">
                        📦 {petis} Petis ({trays} Trays)
                      </span>
                    </td>

                    <td className="py-3 px-4 text-amber-600 font-black">
                      Rs. {fmt(p.costPrice || (cost / (petis || 1)))} / {p.unitType || 'peti'}
                    </td>

                    <td className="py-3 px-4 font-black text-zinc-900">
                      Rs. {fmt(cost)}
                    </td>

                    <td className="py-3 px-4 text-teal-700 font-black">
                      {p.supplierName || 'Wholesale Farm'}
                    </td>

                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        p.paymentMethod === 'Cash' 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}>
                        {p.paymentMethod || 'Cash'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      {p.paymentReceipt ? (
                        <button
                          onClick={() => setSelectedReceipt(p.paymentReceipt)}
                          className="px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-700 rounded-lg text-[10px] font-black uppercase inline-flex items-center gap-1 hover:bg-teal-100 transition-all"
                        >
                          <ImageIcon className="w-3.5 h-3.5" /> View Receipt
                        </button>
                      ) : (
                        <span className="text-[10px] text-zinc-400 italic">No Image</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onEditProduct && onEditProduct(p)}
                          className="px-2.5 py-1 bg-zinc-900 hover:bg-black text-white rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 cursor-pointer"
                          title="Edit Product"
                        >
                          <Edit2 className="w-2.5 h-2.5" /> Edit
                        </button>
                        {onDeleteProduct && (
                          <button
                            onClick={() => onDeleteProduct(p)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 cursor-pointer"
                            title="Delete Product"
                          >
                            <Trash2 className="w-2.5 h-2.5" /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Receipt Modal Modal */}
      <AnimatePresence>
        {selectedReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <div className="relative max-w-lg w-full bg-zinc-900 border border-zinc-700 rounded-3xl p-4 text-white shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-xs font-black uppercase text-teal-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> Supplier Payment Screenshot / Receipt
                </span>
                <button
                  onClick={() => setSelectedReceipt(null)}
                  className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-[70vh] overflow-hidden rounded-2xl border border-zinc-800 bg-black flex items-center justify-center">
                <img src={selectedReceipt} alt="Supplier Receipt" className="w-full h-full object-contain max-h-[65vh]" />
              </div>

              <div className="flex justify-between items-center pt-2">
                <a
                  href={selectedReceipt}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-black text-teal-400 underline hover:text-teal-300"
                >
                  Open Original Image in New Tab
                </a>
                <button
                  onClick={() => setSelectedReceipt(null)}
                  className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-black uppercase"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
