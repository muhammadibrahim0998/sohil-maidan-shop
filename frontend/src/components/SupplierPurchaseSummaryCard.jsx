import { useMemo, useState } from 'react';
import { Truck, Banknote, CreditCard, AlertCircle, CheckCircle2, Image as ImageIcon, ExternalLink, ShieldCheck, X, Box, Package, Egg } from 'lucide-react';
import { CountUpNumber } from './CountUpNumber.jsx';
import { motion, AnimatePresence } from 'framer-motion';

export function SupplierPurchaseSummaryCard({ products = [] }) {
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const stats = useMemo(() => {
    let totalPurchasesCost = 0;
    let cashPaid = 0;
    let onlinePaid = 0;
    let totalDue = 0;
    let supplierProductsCount = 0;

    let totalPetisCount = 0;
    let totalTraysCount = 0;
    let totalEggsCount = 0;

    products.forEach((p) => {
      const stockEggs = Number(p.stock || 0);
      totalEggsCount += stockEggs;

      const petiQty = Number(p.petiQuantity || 0);
      const trayQty = Number(p.trayQuantity || 0);
      const eggQty = Number(p.eggQuantity || 0);

      if (petiQty > 0 || trayQty > 0 || eggQty > 0) {
        totalPetisCount += petiQty + (trayQty / 12) + (eggQty / 360);
        totalTraysCount += (petiQty * 12) + trayQty + (eggQty / 30);
      } else {
        totalPetisCount += stockEggs / 360;
        totalTraysCount += stockEggs / 30;
      }

      const unitCost = Number(p.costPrice) > 0 ? Number(p.costPrice) : Number(p.price || 0);
      const unitDivisor = p.unitType === 'egg' ? 1 : p.unitType === 'tray' ? 30 : 360;

      const cost = Number(p.totalPurchaseCost) > 0
        ? Number(p.totalPurchaseCost)
        : (petiQty > 0 ? petiQty * unitCost : (stockEggs > 0 ? stockEggs * (unitCost / unitDivisor) : 0));

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

      totalPurchasesCost += cost;
      totalDue += due;

      if (p.supplierName || paid > 0 || due > 0 || hasReceipt || petiQty > 0) {
        supplierProductsCount++;
      }

      cashPaid += paid;
    });

    return {
      totalPurchasesCost: Math.round(totalPurchasesCost),
      cashPaid: Math.round(cashPaid),
      totalDue: Math.round(totalDue),
      supplierProductsCount,
      totalPetisCount: Number(totalPetisCount.toFixed(1)),
      totalTraysCount: Math.round(totalTraysCount),
      totalEggsCount,
    };
  }, [products]);

  const supplierItems = useMemo(() => {
    return products.filter((p) => p.supplierName || p.amountPaidToSupplier > 0 || p.dueAmountToSupplier > 0 || p.paymentReceipt || p.petiQuantity > 0);
  }, [products]);

  const fmt = (n) => Number(n || 0).toLocaleString('en-PK');

  return (
    <div className="bg-white border border-zinc-100 rounded-[2rem] p-6 sm:p-8 shadow-sm space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-500/10 rounded-2xl border border-teal-500/20">
            <Truck className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h3 className="text-lg font-black text-zinc-900 uppercase tracking-[0.15em]">
              Supplier Inventory Purchases &amp; Payments
            </h3>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
              Live Peti (Box) Stock &amp; Payment Ledger
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
            <Box className="w-3.5 h-3.5 text-amber-600" /> Total {stats.totalPetisCount} Petis (Boxes)
          </span>
        </div>
      </div>

      {/* Grand Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Petis Stock */}
        <div className="p-5 bg-amber-500 text-zinc-950 rounded-2xl border border-amber-400 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-900">
              Total Stock (Boxes / Petis)
            </span>
            <Box className="w-5 h-5 text-zinc-950" />
          </div>
          <h4 className="text-2xl font-black tracking-tight text-zinc-950">
            <CountUpNumber value={stats.totalPetisCount} /> Petis
          </h4>
          <span className="text-[9px] font-black text-zinc-900 uppercase mt-1 block">
            = {stats.totalTraysCount.toLocaleString()} Trays ({stats.totalEggsCount.toLocaleString()} Eggs)
          </span>
        </div>

        {/* Total Purchase Investment */}
        <div className="p-5 bg-zinc-900 text-white rounded-2xl border border-zinc-800 shadow-md flex flex-col justify-between">
          <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest block mb-1">
            Total Purchase Cost
          </span>
          <h4 className="text-2xl font-black text-white tracking-tight">
            Rs. <CountUpNumber value={stats.totalPurchasesCost} />
          </h4>
          <span className="text-[9px] text-zinc-400 font-bold uppercase mt-1 block">
            Total Inventory Purchase Value
          </span>
        </div>

        {/* Cash Paid */}
        <div className="p-5 bg-emerald-500 text-white rounded-2xl border border-emerald-600 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-black text-emerald-100 uppercase tracking-widest">
              💵 Cash Paid
            </span>
            <Banknote className="w-4 h-4 text-white" />
          </div>
          <h4 className="text-2xl font-black text-white tracking-tight">
            Rs. <CountUpNumber value={stats.cashPaid} />
          </h4>
          <span className="text-[10px] text-emerald-100 font-bold uppercase mt-1 block">
            Total Cash Handover
          </span>
        </div>

        {/* Due Balance Owed */}
        <div className="p-5 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-black text-rose-700 uppercase tracking-widest">
              ⚠️ Total Due Balance
            </span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <h4 className="text-2xl font-black text-rose-700 tracking-tight">
            Rs. <CountUpNumber value={stats.totalDue} />
          </h4>
          <span className="text-[9px] text-rose-700 font-bold uppercase mt-1 block">
            Payable to Suppliers
          </span>
        </div>
      </div>

      {/* Supplier Purchases Breakdown List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black text-zinc-800 uppercase tracking-wider">
            Purchased Petis (Boxes) &amp; Payment Details
          </h4>
          <span className="text-[9px] text-zinc-400 font-bold uppercase">
            {supplierItems.length} Product Record(s)
          </span>
        </div>

        {supplierItems.length === 0 ? (
          <div className="p-6 bg-zinc-50 border border-zinc-100 rounded-2xl text-center">
            <p className="text-xs font-bold text-zinc-400">
              No supplier purchase records yet. Add a product with Peti stock to track payments automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {supplierItems.map((item, idx) => {
              const itemPetis = item.petiQuantity || (item.stock ? (item.stock / 360).toFixed(1) : 0);
              const itemTrays = item.trayQuantity || (item.stock ? Math.round(item.stock / 30) : 0);

              return (
                <motion.div
                  key={item._id || idx}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="p-4 bg-zinc-50/70 border border-zinc-200/80 rounded-2xl flex flex-col justify-between gap-3 hover:border-teal-300 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h5 className="text-xs font-black text-zinc-900 line-clamp-1">{item.name}</h5>
                      <p className="text-[10px] text-teal-700 font-bold uppercase mt-0.5">
                        Supplier: <span className="text-zinc-800 font-black">{item.supplierName || 'Farm / Wholesaler'}</span>
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        item.paymentMethod === 'Cash' 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}>
                        Method: {item.paymentMethod || 'Cash'}
                      </span>
                      <span className="text-[9px] font-black text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-md border border-amber-200">
                        📦 {itemPetis} Petis ({itemTrays} Trays)
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-xl border border-zinc-100 text-[10px]">
                    <div>
                      <span className="text-[8px] font-bold text-zinc-400 uppercase block">Total Cost</span>
                      <span className="font-black text-zinc-900">Rs. {fmt(item.totalPurchaseCost)}</span>
                    </div>
                    <div>
                      <span className="text-[8px] font-bold text-emerald-600 uppercase block">Amount Paid</span>
                      <span className="font-black text-emerald-600">Rs. {fmt(item.amountPaidToSupplier)}</span>
                    </div>
                    <div>
                      <span className="text-[8px] font-bold text-rose-500 uppercase block">Due Balance</span>
                      <span className="font-black text-rose-500">Rs. {fmt(item.dueAmountToSupplier)}</span>
                    </div>
                  </div>

                  {/* Receipt Screenshot Section */}
                  {item.paymentReceipt && (
                    <div className="flex items-center justify-between pt-1 border-t border-zinc-100">
                      <span className="text-[9px] font-black text-teal-700 uppercase flex items-center gap-1">
                        <ImageIcon className="w-3 h-3 text-teal-600" /> Payment Screenshot Attached
                      </span>
                      <button
                        onClick={() => setSelectedReceipt(item.paymentReceipt)}
                        className="px-2 py-0.5 bg-teal-50 border border-teal-200 text-teal-700 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 hover:bg-teal-100 transition-all"
                      >
                        View Receipt <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Receipt Modal */}
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
