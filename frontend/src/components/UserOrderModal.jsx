import React, { useState, useEffect, useCallback } from 'react';
import { useCustomerAuth } from '../contexts/CustomerAuthContext.jsx';
import { Package, Truck, CreditCard, Clock, CheckCircle2, XCircle, X, MapPin, Phone, User } from 'lucide-react';

const PAYMENT_STATUS_COLORS = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-300 font-bold',
  PAID: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
  FAILED: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
};

const ORDER_STATUS_COLORS = {
  PROCESSING: 'bg-blue-100 text-blue-800 border-blue-300 font-bold',
  SHIPPED: 'bg-indigo-100 text-indigo-800 border-indigo-300 font-bold',
  DELIVERED: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
  CANCELLED: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
};

const getBadgeClass = (map, value) =>
  map[value] || 'bg-slate-100 text-slate-800 border-slate-300 font-bold';

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatCurrency = (amount) => 'Rs. ' + (amount || 0).toLocaleString('en-PK');

const getProductSummary = (items) => {
  if (!items || items.length === 0) return '—';
  return items.map((p) => `${p.name} (x${p.quantity})`).join(', ');
};

export default function UserOrderModal({ setOrderOpen }) {
  const { getMyOrders } = useCustomerAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyOrders();
      setOrders(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load your orders.');
    } finally {
      setLoading(false);
    }
  }, [getMyOrders]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const closeModal = () => {
    if (setOrderOpen) setOrderOpen(false);
  };

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[999] overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
    >
      <div className="relative w-full max-w-4xl rounded-3xl bg-white text-slate-900 shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-600">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">My Orders & Payment Status</h2>
              <p className="text-xs font-bold text-slate-500">
                Track your EasyPaisa & online order statuses ({orders.length} orders found)
              </p>
            </div>
          </div>
          <button
            onClick={closeModal}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[75vh] overflow-y-auto bg-slate-50/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500/30 border-t-emerald-600"></div>
              <p className="mt-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Loading your orders…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
              <XCircle className="w-12 h-12 text-rose-500" />
              <p className="text-sm font-bold text-rose-600">{error}</p>
              <button
                onClick={fetchOrders}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition shadow-sm cursor-pointer"
              >
                Try again
              </button>
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <Package className="w-14 h-14 text-slate-400" />
              <p className="text-base font-black text-slate-800 uppercase tracking-tight">No orders placed yet</p>
              <p className="text-xs text-slate-500 max-w-sm">Your checked-out orders will appear here with live payment status updates (PAID, PENDING, or FAILED).</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order._id}
                  onClick={() => setSelectedOrder(order)}
                  className="bg-white hover:bg-slate-50/80 border border-slate-200 rounded-2xl p-5 shadow-sm transition-all cursor-pointer hover:border-emerald-500/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-xs font-black px-3 py-1 bg-slate-900 text-emerald-400 rounded-lg">
                        #{String(order._id || order.id || '').slice(-6).toUpperCase()}
                      </span>
                      <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {order.paymentMethod || 'COD'}
                      </span>
                      <span className={`text-[10px] font-black uppercase px-3 py-0.5 rounded-full border ${getBadgeClass(PAYMENT_STATUS_COLORS, order.paymentStatus)}`}>
                        {order.paymentStatus === 'PAID' ? 'PAID ✅' : order.paymentStatus === 'FAILED' ? 'UNPAID / FAILED ❌' : 'PENDING ⏳'}
                      </span>
                      <span className={`text-[10px] font-black uppercase px-3 py-0.5 rounded-full border ${getBadgeClass(ORDER_STATUS_COLORS, order.orderStatus)}`}>
                        {order.orderStatus}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-slate-600 truncate" title={getProductSummary(order.items)}>
                      Items: <span className="text-slate-900">{getProductSummary(order.items)}</span>
                    </div>

                    <div className="text-[11px] font-medium text-slate-400">
                      Date: {formatDate(order.createdAt)}
                    </div>
                  </div>

                  <div className="flex flex-row sm:flex-col items-end justify-between w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-right">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Total Amount</span>
                      <span className="text-lg font-black text-emerald-600">{formatCurrency(order.totalAmount)}</span>
                    </div>
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider underline mt-1">
                      View Details →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-3 bg-white flex justify-between items-center text-xs text-slate-500">
          <span>Click any order for full breakdown</span>
          <button onClick={closeModal} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl uppercase tracking-wider transition cursor-pointer">
            Close
          </button>
        </div>
      </div>

      {/* Single Order Detail Modal */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedOrder(null); }}
        >
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4 text-slate-900 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-black text-base text-emerald-700 uppercase tracking-tight">
                Order #{String(selectedOrder._id || selectedOrder.id || '').slice(-6).toUpperCase()} Details
              </h3>
              <button onClick={() => setSelectedOrder(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-bold">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 uppercase tracking-wider text-[10px]">Payment Status</span>
                <span className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase ${getBadgeClass(PAYMENT_STATUS_COLORS, selectedOrder.paymentStatus)}`}>
                  {selectedOrder.paymentStatus}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500 uppercase tracking-wider text-[10px]">Delivery Status</span>
                <span className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase ${getBadgeClass(ORDER_STATUS_COLORS, selectedOrder.orderStatus)}`}>
                  {selectedOrder.orderStatus}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500 uppercase tracking-wider text-[10px]">Payment Method</span>
                <span className="text-slate-800 uppercase font-black">{selectedOrder.paymentMethod}</span>
              </div>

              {selectedOrder.transactionId && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 uppercase tracking-wider text-[10px]">Transaction Ref</span>
                  <span className="text-amber-700 font-mono font-bold">{selectedOrder.transactionId}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 space-y-2">
                <p className="text-slate-400 uppercase tracking-widest text-[10px]">Ordered Items</p>
                {selectedOrder.items?.map((it, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-800">{it.name} × {it.quantity}</span>
                    <span className="text-emerald-700 font-black">{formatCurrency(it.price * it.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-sm font-black">
                <span className="text-slate-500 uppercase tracking-wider text-xs">Total Amount</span>
                <span className="text-emerald-700 text-base">{formatCurrency(selectedOrder.totalAmount)}</span>
              </div>

              {selectedOrder.paymentProof && (
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <p className="text-slate-400 uppercase tracking-widest text-[10px]">Payment Proof Screenshot</p>
                  <img src={selectedOrder.paymentProof} alt="Payment Proof" className="w-full max-h-56 object-contain rounded-2xl border border-slate-200 bg-slate-50" />
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedOrder(null)}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition shadow-md mt-2 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}