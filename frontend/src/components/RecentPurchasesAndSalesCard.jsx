import { useMemo, useState } from 'react';
import { ShoppingBag, Truck, Banknote, CreditCard, Image as ImageIcon, ShieldCheck, X, ExternalLink, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function RecentPurchasesAndSalesCard({ products = [], sales = [], checkoutOrders = [] }) {
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  // 1. Recent Purchased Inventory Lots
  const recentPurchases = useMemo(() => {
    return [...products]
      .sort((a, b) => new Date(b.createdAt || b.lastUpdated || 0) - new Date(a.createdAt || a.lastUpdated || 0))
      .slice(0, 5);
  }, [products]);

  // 2. Recent Sales (POS + Online)
  const recentSales = useMemo(() => {
    const posSalesList = sales.map(s => ({
      id: s._id,
      type: 'POS Sale',
      name: s.items?.[0]?.name || 'Egg Order',
      qtyText: `${s.items?.[0]?.quantity || 1} units`,
      amount: s.totalAmount || 0,
      profit: s.totalProfit || 0,
      paymentMethod: s.paymentMethod || 'Cash',
      date: s.createdAt ? new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'
    }));

    const onlineOrdersList = checkoutOrders.map(o => ({
      id: o._id,
      type: 'Online Order',
      name: o.items?.[0]?.name || 'Online Egg Order',
      qtyText: `${o.items?.[0]?.quantity || 1} units`,
      amount: o.totalAmount || 0,
      profit: (o.totalAmount || 0) * 0.15,
      paymentMethod: 'EasyPaisa',
      date: o.createdAt ? new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'
    }));

    return [...posSalesList, ...onlineOrdersList]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);
  }, [sales, checkoutOrders]);

  const fmt = (n) => Number(n || 0).toLocaleString('en-PK');

  return (
    <div className="bg-white border border-zinc-100 rounded-[2rem] p-6 sm:p-8 shadow-sm space-y-6">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Column 1: Recent Purchased Products & Prices */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-600">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-zinc-900 uppercase tracking-wider">
                  Recent Purchases &amp; Prices
                </h4>
                <p className="text-[9px] text-zinc-400 font-bold uppercase">
                  Newly Stocked Inventory Lots
                </p>
              </div>
            </div>
            <span className="text-[9px] font-black text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 uppercase">
              {recentPurchases.length} Items
            </span>
          </div>

          {recentPurchases.length === 0 ? (
            <p className="text-xs font-bold text-zinc-400 text-center py-6 bg-zinc-50 rounded-2xl">
              No recent purchases recorded yet.
            </p>
          ) : (
            <div className="space-y-2.5">
              {recentPurchases.map((item, idx) => {
                const petis = item.petiQuantity || (item.stock ? (item.stock / 360).toFixed(1) : 0);
                return (
                  <div
                    key={item._id || idx}
                    className="p-3 bg-zinc-50/80 border border-zinc-100 hover:border-amber-300 rounded-2xl flex items-center justify-between gap-3 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0 font-black text-amber-800 text-xs">
                        📦
                      </div>
                      <div className="min-w-0">
                        <h5 className="text-xs font-black text-zinc-900 truncate">{item.name}</h5>
                        <p className="text-[9px] font-bold text-zinc-400 uppercase">
                          Supplier: <span className="text-zinc-700 font-black">{item.supplierName || 'Farm'}</span> • {petis} Petis
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-xs font-black text-amber-600">Rs. {fmt(item.totalPurchaseCost)}</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`px-2 py-0.2 rounded text-[8px] font-black uppercase ${
                          item.paymentMethod === 'Cash' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {item.paymentMethod || 'Cash'}
                        </span>
                        {item.paymentReceipt && (
                          <button
                            onClick={() => setSelectedReceipt(item.paymentReceipt)}
                            className="p-0.5 text-teal-600 hover:text-teal-800"
                            title="View Receipt"
                          >
                            <ImageIcon className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Column 2: Recent Customer Sales & Prices */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-zinc-900 uppercase tracking-wider">
                  Recent Sales &amp; Revenue
                </h4>
                <p className="text-[9px] text-zinc-400 font-bold uppercase">
                  Latest Customer Sale Orders
                </p>
              </div>
            </div>
            <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 uppercase">
              {recentSales.length} Transactions
            </span>
          </div>

          {recentSales.length === 0 ? (
            <p className="text-xs font-bold text-zinc-400 text-center py-6 bg-zinc-50 rounded-2xl">
              No recent sales recorded yet.
            </p>
          ) : (
            <div className="space-y-2.5">
              {recentSales.map((sale, idx) => (
                <div
                  key={sale.id || idx}
                  className="p-3 bg-zinc-50/80 border border-zinc-100 hover:border-emerald-300 rounded-2xl flex items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0 text-emerald-700">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h5 className="text-xs font-black text-zinc-900 truncate">{sale.name}</h5>
                      <p className="text-[9px] font-bold text-zinc-400 uppercase">
                        {sale.type} • {sale.qtyText}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-xs font-black text-emerald-600">Rs. {fmt(sale.amount)}</span>
                    <span className="text-[8px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded mt-0.5 border border-emerald-200">
                      + Rs. {fmt(sale.profit)} Profit
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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
