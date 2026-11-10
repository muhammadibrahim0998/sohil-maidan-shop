import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Package, Eye, Trash2, CheckCircle2, Clock, X, RefreshCw, Printer,
  Truck, Home, XCircle, CreditCard, MapPin, Phone, User as UserIcon,
  Calendar, Filter
} from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useProducts } from '../contexts/ProductContext';
import { getShopOrders, updateOrderStatus, deleteOrder, deleteOrderProof } from '../services/api';

const PAYMENT_BADGE = {
  PENDING: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  PAID: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  FAILED: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
};

const ORDER_BADGE = {
  PROCESSING: 'bg-[#1E293B] text-blue-400 border-blue-500/20',
  SHIPPED: 'bg-[#1E293B] text-indigo-400 border-indigo-500/20',
  DELIVERED: 'bg-[#1E293B] text-emerald-400 border-emerald-500/20',
  CANCELLED: 'bg-[#1E293B] text-rose-400 border-rose-500/20',
};

const fmt = (n) => `Rs. ${(n || 0).toLocaleString('en-PK')}`;

export function OrdersManagement({ shopId = null }) {
  const { user } = useUser();
  const { fetchData } = useProducts() || {};
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [selectedProofImage, setSelectedProofImage] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [orderStartDate, setOrderStartDate] = useState('');
  const [orderEndDate, setOrderEndDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');

  const handleApplyDateFilter = (startVal = orderStartDate, endVal = orderEndDate) => {
    setAppliedStartDate(startVal);
    setAppliedEndDate(endVal);
  };

  const handleClearDateFilter = () => {
    setOrderStartDate('');
    setOrderEndDate('');
    setAppliedStartDate('');
    setAppliedEndDate('');
  };

  const parseSafeDate = (val) => {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    if (typeof val === 'number') {
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }
    const str = String(val).trim();
    if (!str) return null;
    const isoStr = str.includes(' ') && !str.includes('T') ? str.replace(' ', 'T') : str;
    let d = new Date(isoStr);
    if (!isNaN(d.getTime())) return d;
    const m = str.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) {
      d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  };

  const isDateInSelectedRange = (rawDate) => {
    if (!rawDate) return false;
    const d = parseSafeDate(rawDate);
    if (!d) return false;

    const activeStart = appliedStartDate || orderStartDate;
    const activeEnd = appliedEndDate || orderEndDate;

    if (activeStart || activeEnd) {
      const pad = (n) => String(n).padStart(2, '0');
      const localYMD = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const utcYMD = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

      let startTs = null;
      if (activeStart) {
        const parts = activeStart.split('-').map(Number);
        if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
          startTs = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0).getTime();
        }
      }
      let endTs = null;
      if (activeEnd) {
        const parts = activeEnd.split('-').map(Number);
        if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
          endTs = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999).getTime();
        }
      }

      const itemTs = d.getTime();

      if (activeStart && activeEnd) {
        const inStr = (localYMD >= activeStart && localYMD <= activeEnd) ||
                      (utcYMD >= activeStart && utcYMD <= activeEnd);
        const inTs = (startTs !== null && itemTs >= startTs) && (endTs !== null && itemTs <= endTs);
        return inStr || inTs;
      }
      if (activeStart) {
        const inStr = localYMD >= activeStart || utcYMD >= activeStart;
        const inTs = startTs !== null && itemTs >= startTs;
        return inStr || inTs;
      }
      if (activeEnd) {
        const inStr = localYMD <= activeEnd || utcYMD <= activeEnd;
        const inTs = endTs !== null && itemTs <= endTs;
        return inStr || inTs;
      }
      return true;
    }

    return true;
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (shopId) params.shopId = shopId;
      if (paymentFilter !== 'ALL') params.paymentStatus = paymentFilter;
      if (statusFilter !== 'ALL') params.orderStatus = statusFilter;
      const data = await getShopOrders(params);
      let list = data.orders || [];
      if (shopId && Array.isArray(list)) {
        list = list.filter(o => {
          const sid = String(o.shopId?.id || o.shopId?._id || (typeof o.shopId === 'object' ? '' : o.shopId) || '');
          const sname = String(o.shopId?.name || '').toLowerCase();
          const target = String(shopId).toLowerCase();
          if (!sid && !sname) return true;
          return sid === target || sname === target;
        });
      }
      setOrders(list);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [paymentFilter, statusFilter, shopId]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 8000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleUpdateOrderStatus = async (orderId, paymentStatus) => {
    setBusyId(orderId);
    try {
      const data = await updateOrderStatus(orderId, { paymentStatus });
      setOrders(prev => prev.map(o => o._id === orderId ? data.order : o));
      if (fetchData) fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update payment status');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteProof = async (orderId) => {
    setBusyId(orderId);
    try {
      await deleteOrderProof(orderId);
      setOrders(prev => prev.map(o => o._id === orderId ? { ...o, paymentProof: null } : o));
      if (selectedProofImage?.orderId === orderId) {
        setSelectedProofImage(null);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete payment proof');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!orderId) return;
    setBusyId(orderId);
    try {
      await deleteOrder(orderId);
      setOrders(prev => prev.filter(o => String(o._id || o.id) !== String(orderId)));
      setDeleteTarget(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete order');
    } finally {
      setBusyId(null);
    }
  };

  const handlePrintSingleOrder = (ord) => {
    const customerName = ord.customerId?.fullName || ord.shippingDetails?.fullName || 'Registered Customer';
    const customerPhone = ord.shippingDetails?.phone || ord.customerId?.phone || '';
    const orderDate = new Date(ord.createdAt).toLocaleString();
    const totalAmount = ord.totalAmount || 0;
    const items = ord.items || [];
    const paymentMethod = ord.paymentMethod || 'ONLINE';
    const paymentStatus = ord.paymentStatus || 'PENDING';

    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Please allow popups to print the customer order record');
      return;
    }

    let itemsHtml = items.map((item, idx) => `
      <tr>
        <td style="padding:10px; border:1px solid #cbd5e1; text-align:center;">${idx + 1}</td>
        <td style="padding:10px; border:1px solid #cbd5e1; font-weight:bold;">${item.name}</td>
        <td style="padding:10px; border:1px solid #cbd5e1; text-align:center; font-weight:bold; color:#059669;">${item.quantity}</td>
        <td style="padding:10px; border:1px solid #cbd5e1; text-align:right;">RS ${(item.price || 0).toLocaleString()}</td>
        <td style="padding:10px; border:1px solid #cbd5e1; text-align:right; font-weight:bold;">RS ${((item.quantity || 1) * (item.price || 0)).toLocaleString()}</td>
      </tr>
    `).join('');

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Customer Order Receipt - ${customerName}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #0f172a; background: #ffffff; }
            .header { text-align: center; border-bottom: 3px double #059669; padding-bottom: 15px; margin-bottom: 25px; }
            .header h1 { margin: 0; color: #047857; text-transform: uppercase; font-size: 24px; font-weight: 900; }
            .header p { margin: 4px 0 0; color: #475569; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; }
            .meta { display: flex; justify-content: space-between; font-size: 12px; font-weight: 800; margin-bottom: 20px; background: #f8fafc; padding: 14px 20px; border-radius: 12px; border: 1px solid #e2e8f0; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { background: #f1f5f9; text-transform: uppercase; font-weight: 900; font-size: 11px; color: #475569; padding: 10px; border: 1px solid #cbd5e1; text-align: left; }
            .total-bar { margin-top: 20px; padding: 15px 20px; background: #ecfdf5; border: 2px solid #a7f3d0; border-radius: 12px; display: flex; justify-content: space-between; font-weight: 900; font-size: 16px; color: #047857; }
            .footer { margin-top: 50px; display: flex; justify-content: space-between; font-size: 11px; font-weight: 800; color: #64748b; }
            .sign { border-top: 2px solid #cbd5e1; width: 200px; text-align: center; padding-top: 6px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${user?.shopName || 'POS STORE'}</h1>
            <p>Registered Customer Order Receipt</p>
          </div>
          <div class="meta">
            <div>
              <span style="color:#059669; text-transform:uppercase;">Customer Name:</span> <strong style="font-size:14px;">${customerName}</strong><br/>
              ${customerPhone ? `<span>Phone: ${customerPhone}</span><br/>` : ''}
              <span>Payment Method: <strong>${paymentMethod}</strong> (${paymentStatus})</span>
            </div>
            <div style="text-align:right;">
              <span>Order Date: ${orderDate}</span><br/>
              <span>Order ID: #${String(ord._id || ord.id || '').slice(-8).toUpperCase()}</span>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="text-align:center;">#</th>
                <th>Item Description</th>
                <th style="text-align:center;">Qty</th>
                <th style="text-align:right;">Unit Price</th>
                <th style="text-align:right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div class="total-bar">
            <span>TOTAL ORDER AMOUNT:</span>
            <span>RS ${totalAmount.toLocaleString('en-PK')}</span>
          </div>
          <div class="footer">
            <div class="sign">Customer Signature</div>
            <div class="sign">${user?.shopName || 'Authorized'} Stamp</div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  const displayedOrders = useMemo(() => {
    if (!appliedStartDate && !appliedEndDate) return orders;
    return orders.filter(ord => isDateInSelectedRange(ord.createdAt || ord.orderDate));
  }, [orders, appliedStartDate, appliedEndDate]);

  // Dynamic Today's Order Stats
  const todayOrderStats = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const isMatchToday = (raw) => {
      if (!raw) return false;
      const d = new Date(raw);
      if (isNaN(d.getTime())) return false;
      if (d.toDateString() === now.toDateString()) return true;
      const dLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (dLocal === localToday) return true;
      return d.toISOString().split('T')[0] === todayStr;
    };

    let todayCount = 0;
    let todayTotal = 0;
    let todayPaid = 0;
    let todayPending = 0;

    (orders || []).forEach(o => {
      if (isMatchToday(o.createdAt || o.orderDate)) {
        todayCount += 1;
        const tot = Number(o.totalAmount) || 0;
        todayTotal += tot;
        if (String(o.paymentStatus).toUpperCase() === 'PAID') {
          todayPaid += tot;
        } else {
          todayPending += tot;
        }
      }
    });

    return { todayCount, todayTotal, todayPaid, todayPending };
  }, [orders]);

  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border-subtle)] shadow-sm p-6 overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-700 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[var(--color-border-subtle)]">
        <div className="space-y-1.5">
          <h3 className="text-2xl font-black text-[var(--color-text-primary)] tracking-tighter flex items-center gap-3 uppercase">
            Customer EasyPaisa & Orders Verification
            <span className="text-[9px] font-black bg-emerald-600/10 text-emerald-500 px-2.5 py-0.5 rounded-full border border-emerald-600/20 uppercase tracking-widest">
              {displayedOrders.length} Orders
            </span>
          </h3>
          <div className="text-[10px] text-[var(--color-text-muted)] font-black uppercase tracking-[0.2em]">
            Inspect transaction screenshot proofs & manage payment statuses for your shop
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Calendar Date Range Filter */}
          <div className="flex items-center flex-wrap gap-1.5 p-1 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-base)] shadow-sm">
            <div className="flex items-center gap-1 pl-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">Start:</span>
              <input
                type="date"
                value={orderStartDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setOrderStartDate(val);
                  handleApplyDateFilter(val, orderEndDate);
                }}
                className="w-[118px] sm:w-[126px] px-1.5 py-1 rounded-lg text-xs font-bold outline-none border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] text-[var(--color-text-primary)] focus:border-emerald-500 cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">End:</span>
              <input
                type="date"
                value={orderEndDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setOrderEndDate(val);
                  handleApplyDateFilter(orderStartDate, val);
                }}
                className="w-[118px] sm:w-[126px] px-1.5 py-1 rounded-lg text-xs font-bold outline-none border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] text-[var(--color-text-primary)] focus:border-emerald-500 cursor-pointer"
              />
            </div>
            <button
              onClick={() => handleApplyDateFilter()}
              className="px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-sm transition-all cursor-pointer shrink-0"
              title="Filter orders by date range"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filter</span>
            </button>
            {(appliedStartDate || appliedEndDate || orderStartDate || orderEndDate) && (
              <button
                onClick={handleClearDateFilter}
                className="px-2 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/30 transition-all cursor-pointer flex items-center gap-0.5 active:scale-95 shrink-0"
                title="Clear date filter"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
            {(appliedStartDate || appliedEndDate) && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 whitespace-nowrap">
                Active: {appliedStartDate && appliedEndDate ? `${appliedStartDate} to ${appliedEndDate}` : (appliedStartDate ? `From ${appliedStartDate}` : `Up to ${appliedEndDate}`)}
              </span>
            )}
          </div>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer"
          >
            <option value="ALL">All Payments</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="FAILED">Failed</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer"
          >
            <option value="ALL">All Delivery</option>
            <option value="PROCESSING">Processing</option>
            <option value="SHIPPED">Shipped</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <button
            onClick={fetchOrders}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-md active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Orders
          </button>
        </div>
      </div>

      {/* ─── DEDICATED TODAY'S ORDERS & EASYPAISA LIVE SUMMARY BANNER ─── */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-emerald-500/10 border-2 border-emerald-400/80 rounded-2xl p-3.5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-emerald-800">
              TODAY'S ORDERS &amp; EASYPAISA SUMMARY (LIVE)
            </span>
            <span className="text-[10px] font-bold bg-emerald-200/70 text-emerald-900 px-2 py-0.5 rounded-full">
              {new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-black">
            <div className="bg-emerald-100 text-emerald-900 px-3 py-1 rounded-xl border border-emerald-300">
              Today Orders: <strong>{todayOrderStats.todayCount}</strong>
            </div>
            <div className="bg-teal-100 text-teal-900 px-3 py-1 rounded-xl border border-teal-300">
              Today Volume: <strong>{fmt(todayOrderStats.todayTotal)}</strong>
            </div>
            <div className="bg-sky-100 text-sky-900 px-3 py-1 rounded-xl border border-sky-300">
              Paid / Verified: <strong>{fmt(todayOrderStats.todayPaid)}</strong>
            </div>
            <div className="bg-amber-100 text-amber-900 px-3 py-1 rounded-xl border border-amber-300">
              Pending Verification: <strong>{fmt(todayOrderStats.todayPending)}</strong>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-500 text-xs font-bold text-center">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-slate-400 font-bold">Loading shop orders and payment receipts...</div>
      ) : displayedOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-[var(--color-surface-base)] rounded-3xl border-2 border-dashed border-[var(--color-border-subtle)] text-center space-y-3">
          <Package className="w-12 h-12 text-zinc-300" />
          <p className="text-lg font-black text-[var(--color-text-primary)] uppercase tracking-tighter">No Orders Found</p>
          <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em]">{appliedStartDate || appliedEndDate ? 'No orders found matching the selected date range' : 'Customer orders for your shop will appear here'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {displayedOrders.map((ord) => (
            <div key={ord._id || ord.id} className="bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-3xl p-6 shadow-xl flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-black px-3 py-1 bg-slate-800 text-white rounded-lg">#{String(ord._id || ord.id || '').slice(-6).toUpperCase()}</span>
                  <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${ord.paymentMethod === 'EASYPAISA' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-indigo-500/20 text-indigo-400'}`}>
                    {ord.paymentMethod}
                  </span>
                  <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${ord.paymentStatus === 'PAID' ? 'bg-emerald-600 text-white' : ord.paymentStatus === 'FAILED' ? 'bg-rose-600 text-white' : 'bg-amber-500/20 text-amber-400'}`}>
                    {ord.paymentStatus}
                  </span>
                  <span className="text-xs font-bold text-slate-400">{new Date(ord.createdAt).toLocaleString()}</span>
                </div>

                <div className="text-sm font-bold text-[var(--color-text-primary)]">
                  Customer: <span className="text-emerald-500">{ord.customerId?.fullName || ord.shippingDetails?.fullName || 'Customer'}</span> ({ord.shippingDetails?.phone || ord.customerId?.phone || 'No phone'})
                </div>

                {ord.transactionId && (
                  <div className="text-xs font-bold text-slate-400">
                    Transaction ID / Sender: <span className="text-amber-500 font-mono">{ord.transactionId}</span>
                  </div>
                )}

                <div className="text-xs text-slate-400">
                  Items: {ord.items?.map(i => `${i.name} x${i.quantity}`).join(', ')} | Total: <span className="font-black text-emerald-500 text-sm">RS {ord.totalAmount?.toLocaleString()}</span>
                </div>
              </div>

              {/* Proof Screenshot Section (Only if uploaded) & Action Buttons */}
              <div className="flex items-center gap-4">
                {ord.paymentProof && (
                  <div className="relative group shrink-0">
                    <div
                      onClick={() => setSelectedProofImage({ url: ord.paymentProof, orderId: ord._id || ord.id })}
                      className="cursor-pointer group relative border-2 border-emerald-500/60 rounded-2xl overflow-hidden shadow-lg bg-black/40 hover:scale-105 transition-all"
                    >
                      <img src={ord.paymentProof} alt="Payment Proof" className="w-20 h-20 object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[9px] font-black uppercase tracking-wider transition-all">
                        View Proof
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteProof(ord._id || ord.id); }}
                      title="Delete Screenshot"
                      className="absolute -top-2 -right-2 p-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-full shadow-lg transition-all z-10 hover:scale-110"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex flex-col gap-1 w-36 sm:w-40 shrink-0">
                  {ord.paymentStatus !== 'PAID' && (
                    <button
                      onClick={() => handleUpdateOrderStatus(ord._id || ord.id, 'PAID')}
                      disabled={busyId === (ord._id || ord.id)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[9.5px] font-black uppercase tracking-wider shadow-xs active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer transition-all"
                    >
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                      <span>Approve (PAID)</span>
                    </button>
                  )}
                  {ord.paymentStatus !== 'FAILED' && (
                    <button
                      onClick={() => handleUpdateOrderStatus(ord._id || ord.id, 'FAILED')}
                      disabled={busyId === (ord._id || ord.id)}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[9.5px] font-black uppercase tracking-wider shadow-xs active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer transition-all"
                    >
                      <XCircle className="w-3 h-3 shrink-0" />
                      <span>Reject Payment</span>
                    </button>
                  )}
                  {ord.paymentProof && (
                    <button
                      onClick={() => handleDeleteProof(ord._id || ord.id)}
                      disabled={busyId === (ord._id || ord.id)}
                      className="px-2 py-1 bg-rose-500/10 hover:bg-rose-600 text-rose-500 hover:text-white border border-rose-500/30 rounded-lg text-[9px] font-bold uppercase transition-all shadow-xs active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3 shrink-0" />
                      <span>Delete Screenshot</span>
                    </button>
                  )}
                  <button
                    onClick={() => handlePrintSingleOrder(ord)}
                    className="px-2 py-1 bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-500/40 rounded-lg text-[9px] font-bold uppercase transition-all shadow-xs active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                    title="Print Single Customer Order Record"
                  >
                    <Printer className="w-3 h-3 shrink-0" />
                    <span>Print Order</span>
                  </button>
                  <button
                    onClick={() => setDeleteTarget(ord)}
                    disabled={busyId === (ord._id || ord.id)}
                    className="px-2 py-1 bg-zinc-800/80 hover:bg-rose-900/60 text-slate-300 hover:text-rose-300 border border-slate-700/60 rounded-lg text-[9px] font-bold uppercase transition-all shadow-xs active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3 shrink-0" />
                    <span>Delete Order</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Screenshot Modal */}
      {selectedProofImage && (
        <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setSelectedProofImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-3xl p-4 shadow-2xl flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <div className="w-full flex justify-between items-center pb-3 mb-3 border-b border-slate-800 gap-4">
              <h3 className="text-sm font-black text-emerald-400 uppercase tracking-wider">Transaction Payment Screenshot Proof</h3>
              <div className="flex items-center gap-2">
                {selectedProofImage.orderId && (
                  <button
                    onClick={() => handleDeleteProof(selectedProofImage.orderId)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Screenshot
                  </button>
                )}
                <button onClick={() => setSelectedProofImage(null)} className="p-2 hover:bg-white/10 rounded-full text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <img src={selectedProofImage.url || selectedProofImage} alt="Full Payment Proof" className="max-h-[75vh] w-auto object-contain rounded-2xl border border-slate-800" />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}
        >
          <div className="w-full max-w-sm bg-[var(--color-surface-card)] rounded-2xl shadow-2xl border border-[var(--color-border-subtle)] p-6 text-center space-y-4">
            <div className="w-14 h-14 mx-auto bg-rose-500/10 rounded-full flex items-center justify-center">
              <XCircle className="w-7 h-7 text-rose-500" />
            </div>
            <p className="font-black text-[var(--color-text-primary)] uppercase tracking-tight">Delete this order?</p>
            <p className="text-xs text-zinc-500">Order #{String(deleteTarget?._id || deleteTarget?.id || '').slice(-6).toUpperCase()} will be permanently removed. This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl font-black text-[10px] uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteOrder(deleteTarget._id || deleteTarget.id)}
                disabled={busyId === (deleteTarget._id || deleteTarget.id)}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50"
              >
                {busyId === (deleteTarget._id || deleteTarget.id) ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}