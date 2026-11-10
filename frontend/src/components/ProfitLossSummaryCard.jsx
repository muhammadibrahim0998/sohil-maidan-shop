import { useMemo, useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Wallet, ShoppingBag, Truck, AlertTriangle, ShieldCheck } from 'lucide-react';
import { CountUpNumber } from './CountUpNumber.jsx';
import api from '../services/api';

export function ProfitLossSummaryCard({ sales = [], products = [], checkoutOrders = [] }) {
  const [expenses, setExpenses] = useState([]);
  const [damagedProducts, setDamagedProducts] = useState([]);

  useEffect(() => {
    // Fetch store expenses & damaged products dynamically
    api.get('/expenses').then(res => {
      if (Array.isArray(res.data)) setExpenses(res.data);
    }).catch(() => {});

    api.get('/damaged-products').then(res => {
      if (Array.isArray(res.data)) setDamagedProducts(res.data);
    }).catch(() => {});
  }, [sales, products]);

  const stats = useMemo(() => {
    // 1. Total Stock Purchased Investment
    const totalPurchasesInvestment = products.reduce((sum, p) => {
      const cost = Number(p.totalPurchaseCost) || (Number(p.costPrice) > 0 ? (Number(p.stock || 0) * (Number(p.costPrice) / (p.unitType === 'egg' ? 1 : p.unitType === 'tray' ? 30 : 360))) : 0);
      return sum + cost;
    }, 0);

    // 2. Sales Revenue (POS + Approved Online Checkout)
    const validSales = sales.filter(s => s.status !== 'returned' && s.status !== 'cancelled');
    const posRevenue = validSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const posProfit = validSales.reduce((sum, s) => sum + (s.totalProfit || 0), 0);

    const paidOrders = checkoutOrders.filter(o => o.paymentStatus === 'PAID');
    const onlineRevenue = paidOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    // Estimated 15% profit margin for online checkout if profit not stored
    const onlineProfit = paidOrders.reduce((sum, o) => sum + ((o.totalAmount || 0) * 0.15), 0);

    const totalSalesRevenue = posRevenue + onlineRevenue;
    const grossProfit = posProfit + onlineProfit;

    // 3. Expenses & Damage Losses
    const totalExpensesAmount = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalDamageAmount = damagedProducts.reduce((sum, d) => {
      const loss = Number(d.totalLoss) > 0
        ? Number(d.totalLoss)
        : (Number(d.lossAmount) || (Number(d.costPrice || d.unitPrice || 0) * (Number(d.quantity || d.deductedEggs || 1))) || 0);
      return sum + loss;
    }, 0);

    const totalDeductions = totalExpensesAmount + totalDamageAmount;

    // 4. Net Profit / Net Loss
    const netProfitOrLoss = grossProfit - totalDeductions;
    const isNetProfit = netProfitOrLoss >= 0;

    return {
      totalPurchasesInvestment,
      totalSalesRevenue,
      grossProfit,
      totalExpensesAmount,
      totalDamageAmount,
      totalDeductions,
      netProfitOrLoss,
      isNetProfit
    };
  }, [sales, products, checkoutOrders, expenses, damagedProducts]);

  const fmt = (n) => Number(n || 0).toLocaleString('en-PK');

  return (
    <div className="bg-white border border-zinc-100 rounded-[2rem] p-6 sm:p-8 shadow-sm space-y-6">
      
      {/* Header with Profit / Loss Status Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-2xl border ${stats.isNetProfit ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'bg-rose-500/10 border-rose-500/20 text-rose-600'}`}>
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-zinc-900 uppercase tracking-[0.15em]">
              Financial Profit &amp; Loss Ledger
            </h3>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
              Live Investment, Revenue, Gross &amp; Net Performance
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider border flex items-center gap-2 shadow-sm ${
          stats.isNetProfit 
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
            : 'bg-rose-50 text-rose-700 border-rose-200'
        }`}>
          {stats.isNetProfit ? <TrendingUp className="w-4 h-4 text-emerald-600" /> : <TrendingDown className="w-4 h-4 text-rose-600" />}
          <span>Status: {stats.isNetProfit ? 'Net Profit' : 'Net Loss'}</span>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Stock Investment Spent */}
        <div className="p-5 bg-zinc-900 text-white rounded-2xl border border-zinc-800 shadow-md">
          <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest block mb-1">
            Total Inventory Cost
          </span>
          <h4 className="text-2xl font-black text-white tracking-tight">
            Rs. <CountUpNumber value={stats.totalPurchasesInvestment} />
          </h4>
          <span className="text-[9px] text-zinc-400 font-bold uppercase mt-1 block">
            Money Spent Buying Inventory Stock
          </span>
        </div>

        {/* Total Gross Sales Revenue */}
        <div className="p-5 bg-blue-50/70 border border-blue-100 rounded-2xl">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-black text-blue-700 uppercase tracking-widest">
              Total Sales Revenue
            </span>
            <ShoppingBag className="w-4 h-4 text-blue-600" />
          </div>
          <h4 className="text-2xl font-black text-blue-700 tracking-tight">
            Rs. <CountUpNumber value={stats.totalSalesRevenue} />
          </h4>
          <span className="text-[9px] text-blue-600/80 font-bold uppercase mt-1 block">
            Gross Revenue Received
          </span>
        </div>

        {/* Gross Profit */}
        <div className="p-5 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">
              Gross Profit
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <h4 className="text-2xl font-black text-emerald-700 tracking-tight">
            Rs. <CountUpNumber value={stats.grossProfit} />
          </h4>
          <span className="text-[9px] text-emerald-600/80 font-bold uppercase mt-1 block">
            Revenue minus Cost of Goods Sold
          </span>
        </div>

        {/* Net Profit / Net Loss */}
        <div className={`p-5 rounded-2xl border ${
          stats.isNetProfit 
            ? 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-emerald-500 shadow-xl' 
            : 'bg-gradient-to-br from-rose-600 to-red-700 text-white border-rose-500 shadow-xl'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-white/90">
              {stats.isNetProfit ? 'Net Profit' : 'Net Loss'}
            </span>
            {stats.isNetProfit ? <ShieldCheck className="w-5 h-5 text-emerald-200" /> : <AlertTriangle className="w-5 h-5 text-rose-200" />}
          </div>
          <h4 className="text-2xl font-black tracking-tight text-white">
            Rs. <CountUpNumber value={Math.abs(stats.netProfitOrLoss)} />
          </h4>
          <span className="text-[9px] text-white/80 font-bold uppercase mt-1 block">
            {stats.isNetProfit ? 'Net Gain after Expenses & Damages' : 'Net Deficit after Expenses & Damages'}
          </span>
        </div>

      </div>

      {/* Expenses & Damage Breakdown Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-zinc-50/70 p-4 rounded-2xl border border-zinc-100 text-xs">
        <div>
          <span className="text-[9px] font-bold text-zinc-400 uppercase block">Shop Expenses</span>
          <span className="font-black text-zinc-800">Rs. {fmt(stats.totalExpensesAmount)}</span>
        </div>
        <div>
          <span className="text-[9px] font-bold text-rose-500 uppercase block">Egg Damage &amp; Loss</span>
          <span className="font-black text-rose-600">Rs. {fmt(stats.totalDamageAmount)}</span>
        </div>
        <div>
          <span className="text-[9px] font-bold text-zinc-500 uppercase block">Total Deductions</span>
          <span className="font-black text-zinc-900">Rs. {fmt(stats.totalDeductions)}</span>
        </div>
      </div>

    </div>
  );
}
