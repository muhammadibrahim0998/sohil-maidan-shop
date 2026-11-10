import { useMemo } from 'react';
import { ShoppingBag, CreditCard, Banknote, TrendingUp, Package, Clock, CheckCircle, XCircle } from 'lucide-react';
import { CountUpNumber } from './CountUpNumber.jsx';
import { motion } from 'framer-motion';

/**
 * SalesSummaryCard
 * Shows every individual Sale (POS/Cash) and Order (EasyPaisa/Online)
 * directly from the database. No fake data. Numbers match MySQL database exactly.
 */
export function SalesSummaryCard({ sales = [], checkoutOrders = [] }) {
  const stats = useMemo(() => {
    const validSales   = sales.filter(s => s.status !== 'returned' && s.status !== 'cancelled');
    const posTotal     = validSales.reduce((s, r) => s + (r.totalAmount || 0), 0);
    const posCount     = validSales.length;

    const paidOrders   = checkoutOrders.filter(o => o.paymentStatus === 'PAID');
    const onlineTotal  = paidOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
    const onlineCount  = paidOrders.length;

    const pendingOrders  = checkoutOrders.filter(o => o.paymentStatus !== 'PAID' && o.paymentStatus !== 'FAILED');
    const pendingTotal   = pendingOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
    const pendingCount   = pendingOrders.length;

    const grandTotal = posTotal + onlineTotal;
    const grandCount = posCount + onlineCount;

    return { validSales, posTotal, posCount, paidOrders, onlineTotal, onlineCount,
             pendingOrders, pendingTotal, pendingCount, grandTotal, grandCount };
  }, [sales, checkoutOrders]);

  const fmt = (n) => Number(n || 0).toLocaleString('en-PK');

  const StatusBadge = ({ status }) => {
    const map = {
      completed:  { label: 'Completed',  cls: 'bg-emerald-100 text-emerald-700', Icon: CheckCircle },
      returned:   { label: 'Returned',   cls: 'bg-rose-100 text-rose-700',       Icon: XCircle },
      PAID:       { label: 'PAID',       cls: 'bg-emerald-100 text-emerald-700', Icon: CheckCircle },
      PROCESSING: { label: 'Processing', cls: 'bg-amber-100 text-amber-700',     Icon: Clock },
      pending:    { label: 'Pending',    cls: 'bg-amber-100 text-amber-700',     Icon: Clock },
    };
    const cfg = map[status] || { label: status, cls: 'bg-zinc-100 text-zinc-600', Icon: Package };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${cfg.cls}`}>
        <cfg.Icon className="w-3 h-3" />{cfg.label}
      </span>
    );
  };

  return (
    <div className="bg-white border border-zinc-100 rounded-[2rem] p-6 sm:p-8 shadow-sm space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-green-500/10 rounded-2xl border border-green-500/20">
          <TrendingUp className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <h3 className="text-lg font-black text-zinc-900 uppercase tracking-[0.15em]">Total Sales &amp; Payments</h3>
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
            Live Verified Database Records
          </p>
        </div>
      </div>

      {/* Grand Total Banner */}
      <div className="bg-zinc-900 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black text-amber-400 uppercase tracking-[0.25em] mb-1">
            Grand Total Sales
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Rs. <CountUpNumber value={stats.grandTotal} />
          </h2>
          <p className="text-zinc-400 text-[11px] font-bold uppercase mt-1">
            POS <span className="text-white font-black">{stats.posCount}</span>
            {' '}+ Online <span className="text-white font-black">{stats.onlineCount}</span>
            {' '}= <span className="text-amber-400 font-black">{stats.grandCount}</span> records
          </p>
        </div>
        <div className="flex gap-4 text-center shrink-0">
          <div>
            <p className="text-[9px] text-zinc-500 uppercase font-bold mb-1">POS / Cash</p>
            <p className="text-xl font-black text-emerald-400">
              Rs. <CountUpNumber value={stats.posTotal} />
            </p>
          </div>
          <div className="w-px bg-zinc-700" />
          <div>
            <p className="text-[9px] text-zinc-500 uppercase font-bold mb-1">EasyPaisa</p>
            <p className="text-xl font-black text-blue-400">
              Rs. <CountUpNumber value={stats.onlineTotal} />
            </p>
          </div>
          {stats.pendingCount > 0 && (
            <>
              <div className="w-px bg-zinc-700" />
              <div>
                <p className="text-[9px] text-zinc-500 uppercase font-bold mb-1">Pending</p>
                <p className="text-xl font-black text-amber-400">
                  Rs. <CountUpNumber value={stats.pendingTotal} />
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── POS / Cash Sales Records ─── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
            <Banknote className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-zinc-800 uppercase tracking-wider">Cash / POS Sales</p>
            <p className="text-[9px] text-zinc-400 font-bold">
              Cash Transactions — {stats.posCount} record(s)
            </p>
          </div>
          <span className="text-sm font-black text-emerald-600 shrink-0">Rs. {fmt(stats.posTotal)}</span>
        </div>

        {stats.validSales.length === 0 ? (
          <p className="text-xs text-zinc-400 text-center py-4 bg-zinc-50 rounded-xl">
            No POS sales yet
          </p>
        ) : (
          <div className="space-y-2">
            {stats.validSales.map((sale, i) => (
              <motion.div
                key={sale._id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between bg-emerald-50/60 border border-emerald-100 rounded-xl px-4 py-3 gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-zinc-800 truncate">
                      {sale.customerName || 'Walk-in Customer'}
                    </p>
                    <p className="text-[9px] text-zinc-400 font-bold">
                      {sale.items?.length || 0} items ·{' '}
                      {sale.cashierName || 'Admin'} ·{' '}
                      {sale.saleDate ? new Date(sale.saleDate).toLocaleDateString('en-PK') : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={sale.status} />
                  <span className="text-sm font-black text-emerald-700 whitespace-nowrap">
                    Rs. {fmt(sale.totalAmount)}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ─── EasyPaisa / Online Orders ─── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <CreditCard className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-zinc-800 uppercase tracking-wider">EasyPaisa / Online Orders</p>
            <p className="text-[9px] text-zinc-400 font-bold">
              Digital / EasyPaisa Orders — {checkoutOrders.length} record(s)
            </p>
          </div>
          <span className="text-sm font-black text-blue-600 shrink-0">Rs. {fmt(stats.onlineTotal)}</span>
        </div>

        {checkoutOrders.length === 0 ? (
          <p className="text-xs text-zinc-400 text-center py-4 bg-zinc-50 rounded-xl">
            No online orders yet
          </p>
        ) : (
          <div className="space-y-2">
            {checkoutOrders.map((order, i) => {
              const isPaid    = order.paymentStatus === 'PAID';
              const isPending = !isPaid && order.paymentStatus !== 'FAILED';
              const rowBg = isPaid
                ? 'bg-blue-50/60 border-blue-100'
                : isPending
                  ? 'bg-amber-50/60 border-amber-100'
                  : 'bg-rose-50/40 border-rose-100';
              const amtColor = isPaid ? 'text-blue-700' : isPending ? 'text-amber-700' : 'text-rose-500';

              return (
                <motion.div
                  key={order._id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`flex items-center justify-between border rounded-xl px-4 py-3 gap-3 ${rowBg}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-zinc-800 truncate">
                        {order.shippingDetails?.fullName || 'Online Customer'}
                      </p>
                      <p className="text-[9px] text-zinc-400 font-bold">
                        {order.paymentMethod || 'EASYPAISA'} ·{' '}
                        {order.shippingDetails?.phone || '—'} ·{' '}
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-PK') : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={order.paymentStatus} />
                    <StatusBadge status={order.orderStatus} />
                    <span className={`text-sm font-black whitespace-nowrap ${amtColor}`}>
                      Rs. {fmt(order.totalAmount)}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
