import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Receipt, 
  Building2, 
  FileText, 
  Package, 
  AlertTriangle, 
  Calendar, 
  PieChart, 
  BarChart3, 
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

export function ShopAdminCharts({
  sales = [],
  products = [],
  expenses = [],
  damaged = [],
  dashStats = {},
  profitReportStats = null,
  currency = 'Rs.',
  startDate = '',
  endDate = ''
}) {
  const [activeHoverPoint, setActiveHoverPoint] = useState(null);
  const [activeDonutSegment, setActiveDonutSegment] = useState(null);

  // ─── 1. Calculate Daily Trend Data for the Area/Line Graph ─────────────────────
  const trendData = useMemo(() => {
    const days = [];

    if (startDate && endDate) {
      const s = new Date(startDate);
      const e = new Date(endDate);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        const diffDays = Math.min(Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1), 60);
        for (let i = 0; i < diffDays; i++) {
          const d = new Date(s);
          d.setDate(s.getDate() + i);
          const dateStr = d.toISOString().split('T')[0];
          const label = d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short' });
          days.push({
            dateStr,
            label,
            revenue: 0,
            cash: 0,
            bank: 0,
            credit: 0,
            ordersCount: 0,
            unitsCount: 0
          });
        }
      }
    }

    // Default to last 14 days if no calendar range selected
    if (days.length === 0) {
      const now = new Date();
      const count = 14;
      for (let i = count - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const label = d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short' });
        days.push({
          dateStr,
          label,
          revenue: 0,
          cash: 0,
          bank: 0,
          credit: 0,
          ordersCount: 0,
          unitsCount: 0
        });
      }
    }

    const dayMap = new Map(days.map(item => [item.dateStr, item]));

    (sales || []).forEach(s => {
      if (!s) return;
      const d = new Date(s.saleDate || s.createdAt || s.date || Date.now());
      if (isNaN(d.getTime())) return;
      const dStr = d.toISOString().split('T')[0];
      const entry = dayMap.get(dStr);
      if (entry) {
        const total = Number(s.totalAmount) || Number(s.amount) || Number(s.finalTotal) || 0;
        const pMethod = String(s.paymentMethod || 'CASH').toUpperCase();
        const cash = Number(s.cashPaid) || (pMethod === 'CASH' ? total : 0);
        const bank = Number(s.bankPaid) || (pMethod.includes('BANK') || pMethod.includes('ONLINE') || pMethod.includes('EASYPAISA') ? total : 0);
        const credit = Number(s.dueAmount) || (pMethod === 'CREDIT' || pMethod === 'DUE' ? total : 0);

        entry.revenue += total;
        entry.cash += cash;
        entry.bank += bank;
        entry.credit += credit;
        entry.ordersCount += 1;

        (s.items || []).forEach(item => {
          entry.unitsCount += Number(item.quantity) || 1;
        });
      }
    });

    // If active sales are recorded in sales list or fallback to dashStats
    const maxRevenue = Math.max(...days.map(d => d.revenue), 1000);
    const totalRev = days.reduce((sum, d) => sum + d.revenue, 0);
    const avgRev = days.length > 0 ? Math.round(totalRev / days.length) : 0;
    const peakDay = [...days].sort((a, b) => b.revenue - a.revenue)[0];

    return {
      days,
      maxRevenue,
      totalRev,
      avgRev,
      peakDay
    };
  }, [sales, startDate, endDate]);

  // ─── 2. Calculate Financial Inflow vs. Cost Deductions ──────────────────────────
  const financialAnatomy = useMemo(() => {
    // 1. Gross Revenue
    let totalSalesRev = (sales || []).reduce((sum, s) => sum + (Number(s.totalAmount) || Number(s.amount) || 0), 0);
    if (totalSalesRev === 0 && Number(dashStats?.totalRevenue) > 0) {
      totalSalesRev = Number(dashStats.totalRevenue);
    }
    if (profitReportStats && Number(profitReportStats.totalRevenue) > 0) {
      totalSalesRev = Number(profitReportStats.totalRevenue);
    }

    // 2. Purchases Cost
    let totalPurchasesCost = (products || []).reduce((sum, p) => {
      const e = Number(p.eggQuantity || 0);
      const peti = Number(p.petiQuantity || 0);
      const tray = Number(p.trayQuantity || 0);
      const totalEggs = (peti * 360) + (tray * 30) + e;
      const cost = Number(p.totalPurchaseCost || p.purchaseCost || p.totalCost) ||
        (Number(p.costPrice || 0) * (totalEggs > 0 ? (totalEggs / (p.unitType === 'peti' ? 360 : p.unitType === 'tray' ? 30 : 1)) : Number(p.stock || 0)));
      return sum + Math.round(cost || 0);
    }, 0);
    if (profitReportStats && Number(profitReportStats.totalPurchasesCost) > 0) {
      totalPurchasesCost = Number(profitReportStats.totalPurchasesCost);
    }

    // 3. Operating Expenses
    let totalOperatingExpenses = (expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    if (profitReportStats && Number(profitReportStats.totalExpenses) > 0) {
      totalOperatingExpenses = Number(profitReportStats.totalExpenses);
    }

    // 4. Damaged Loss
    let totalDamagedLoss = (damaged || []).reduce((sum, d) => {
      const loss = Number(d.totalLoss) > 0 ? Number(d.totalLoss) : (Number(d.lossAmount) || Number(d.amount) || ((Number(d.quantity || d.deductedEggs || 0)) * (Number(d.unitPrice || 0))) || 0);
      return sum + loss;
    }, 0);
    if (profitReportStats && Number(profitReportStats.totalDamagedLoss) > 0) {
      totalDamagedLoss = Number(profitReportStats.totalDamagedLoss);
    }

    // 5. Net Profit
    let netProfit = totalSalesRev - totalPurchasesCost - totalOperatingExpenses - totalDamagedLoss;
    if (profitReportStats && typeof profitReportStats.finalNetProfit === 'number') {
      netProfit = profitReportStats.finalNetProfit;
    }

    const netProfitMargin = totalSalesRev > 0 ? ((netProfit / totalSalesRev) * 100).toFixed(1) : '0.0';
    const maxVal = Math.max(totalSalesRev, totalPurchasesCost, totalOperatingExpenses + totalDamagedLoss, 1);

    return {
      totalSalesRev,
      totalPurchasesCost,
      totalOperatingExpenses,
      totalDamagedLoss,
      netProfit,
      netProfitMargin,
      maxVal
    };
  }, [sales, products, expenses, damaged, dashStats, profitReportStats]);

  // ─── 3. Payment Channels Breakdown (Cash vs Bank vs Credit) ───────────────────
  const paymentBreakdown = useMemo(() => {
    let cashTotal = 0;
    let bankTotal = 0;
    let creditTotal = 0;

    (sales || []).forEach(s => {
      const total = Number(s.totalAmount) || Number(s.amount) || 0;
      const pMethod = String(s.paymentMethod || 'CASH').toUpperCase();
      const hasDetailedBreakdown = s.cashPaid !== undefined || s.bankPaid !== undefined || s.dueAmount !== undefined;

      if (hasDetailedBreakdown) {
        cashTotal += (Number(s.cashPaid) || 0);
        bankTotal += (Number(s.bankPaid) || 0);
        creditTotal += (Number(s.dueAmount) || 0);
      } else {
        const isBank = pMethod === 'BANK_TRANSFER' || pMethod === 'BANK' || pMethod === 'ONLINE' || pMethod === 'EASYPAISA';
        const isCredit = pMethod === 'CREDIT' || pMethod === 'DUE' || s.isCredit;

        if (isCredit) {
          creditTotal += total;
        } else if (isBank) {
          bankTotal += total;
        } else {
          cashTotal += total;
        }
      }
    });

    const grandTotal = cashTotal + bankTotal + creditTotal || (financialAnatomy.totalSalesRev || 1);
    const cashPct = Math.round((cashTotal / grandTotal) * 100) || (grandTotal === 1 ? 0 : 100);
    const bankPct = Math.round((bankTotal / grandTotal) * 100) || 0;
    const creditPct = Math.max(0, 100 - cashPct - bankPct);

    return {
      cashTotal,
      bankTotal,
      creditTotal,
      grandTotal,
      cashPct,
      bankPct,
      creditPct
    };
  }, [sales, financialAnatomy.totalSalesRev]);

  // ─── 4. Top Selling Products & Stock Velocity ─────────────────────────────────
  const topProductsData = useMemo(() => {
    const productStats = new Map();

    (sales || []).forEach(s => {
      (s.items || []).forEach(it => {
        const name = it.name || it.title || 'Product';
        const qty = Number(it.quantity) || 1;
        const sub = Number(it.subtotal || (Number(it.price || 0) * qty)) || 0;

        if (!productStats.has(name)) {
          productStats.set(name, {
            name,
            totalSoldQty: 0,
            totalRevenue: 0,
            unitType: it.selectedUnit || it.unitType || 'tray'
          });
        }
        const curr = productStats.get(name);
        curr.totalSoldQty += qty;
        curr.totalRevenue += sub;
      });
    });

    let list = Array.from(productStats.values()).sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 5);

    // If no sales items yet, fall back to active catalog products
    if (list.length === 0 && (products || []).length > 0) {
      list = (products || []).slice(0, 5).map(p => ({
        name: p.name,
        totalSoldQty: Number(p.stock || 0),
        totalRevenue: Math.round(Number(p.stock || 0) * Number(p.price || p.salePrice || 0)),
        unitType: p.unitType || 'peti'
      }));
    }

    const maxRev = Math.max(...list.map(p => p.totalRevenue), 1);

    return {
      list,
      maxRev
    };
  }, [sales, products]);

  // ─── 5. SVG Area Curve Calculations ───────────────────────────────────────────
  const chartHeight = 160;
  const chartWidth = 560;
  const paddingX = 24;
  const paddingY = 20;

  const points = useMemo(() => {
    const { days, maxRevenue } = trendData;
    if (days.length === 0) return [];
    const usableW = chartWidth - paddingX * 2;
    const usableH = chartHeight - paddingY * 2;

    return days.map((d, idx) => {
      const x = paddingX + (idx / Math.max(1, days.length - 1)) * usableW;
      const y = chartHeight - paddingY - (d.revenue / maxRevenue) * usableH;
      return { x, y, data: d, index: idx };
    });
  }, [trendData]);

  // Generate cubic bezier SVG path
  const { linePath, areaPath } = useMemo(() => {
    if (points.length === 0) return { linePath: '', areaPath: '' };
    if (points.length === 1) {
      const p = points[0];
      return {
        linePath: `M ${p.x} ${p.y} L ${p.x + 1} ${p.y}`,
        areaPath: `M ${p.x} ${chartHeight - paddingY} L ${p.x} ${p.y} L ${p.x + 1} ${p.y} L ${p.x + 1} ${chartHeight - paddingY} Z`
      };
    }

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const mx = (p0.x + p1.x) / 2;
      d += ` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`;
    }

    const first = points[0];
    const last = points[points.length - 1];
    const area = `${d} L ${last.x} ${chartHeight - paddingY} L ${first.x} ${chartHeight - paddingY} Z`;

    return { linePath: d, areaPath: area };
  }, [points]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
      
      {/* ─── Executive Header with Live Analytics Badge & Timeframe Selector (Light Gray Theme) ──────── */}
      <div className="bg-gradient-to-r from-slate-100 via-gray-100 to-slate-100 p-4 sm:p-5 rounded-3xl border border-slate-300 shadow-sm text-slate-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-100 border border-emerald-300 rounded-2xl text-emerald-700 shadow-xs shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                Live Dynamic Analytics
              </span>
              <span className="text-slate-400 text-xs">•</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Real-Time Financial Curves
              </span>
            </div>
            <h2 className="text-base sm:text-xl font-black uppercase tracking-tight text-slate-900 mt-1">
              Shop Performance &amp; Revenue Analytics
            </h2>
            <p className="text-xs text-slate-600 font-medium hidden sm:block">
              Interactive financial curves, stock movements, and real-time revenue distributions.
            </p>
          </div>
        </div>

        {/* Calendar Synchronization Status Badge */}
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/90 px-3.5 py-2 rounded-2xl text-emerald-800 shadow-xs">
          <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-[11px] font-black uppercase tracking-wider">
            {startDate && endDate 
              ? `${startDate} → ${endDate}`
              : startDate
                ? `From ${startDate}`
                : endDate
                  ? `Until ${endDate}`
                  : 'Calendar Filter Active'}
          </span>
        </div>
      </div>

      {/* ─── GRID 1: REVENUE TREND CURVE (AREA GRAPH) + PAYMENT DISTRIBUTION (DONUT) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ─── 1. DYNAMIC SALES & REVENUE AREA/LINE GRAPH (2 COLUMNS) ─────────────── */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4">
          
          {/* Header with Stats KPI Badges */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-700">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                  Daily Sales &amp; Revenue Trend Curve
                </h3>
              </div>
              <p className="text-[10.5px] text-slate-500 font-bold uppercase tracking-wider mt-0.5 pl-8">
                Live Daily Trajectory &amp; Volume
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-xl text-right">
                <span className="text-[8.5px] font-bold text-emerald-600 uppercase block">Period Sales</span>
                <span className="text-xs font-black text-emerald-800">
                  {currency} {trendData.totalRev.toLocaleString('en-PK')}
                </span>
              </div>
              <div className="px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-xl text-right">
                <span className="text-[8.5px] font-bold text-blue-600 uppercase block">Daily Avg</span>
                <span className="text-xs font-black text-blue-800">
                  {currency} {trendData.avgRev.toLocaleString('en-PK')}
                </span>
              </div>
            </div>
          </div>

          {/* SVG Area & Line Chart */}
          <div className="relative w-full overflow-hidden bg-gradient-to-b from-slate-50/70 to-white rounded-2xl p-2 border border-slate-100">
            <svg 
              viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
              className="w-full h-44 sm:h-52 overflow-visible select-none"
            >
              <defs>
                <linearGradient id="emeraldAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                  <stop offset="50%" stopColor="#059669" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>

                <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#10b981" floodOpacity="0.35" />
                </filter>
              </defs>

              {/* Background Horizontal Guide Lines */}
              {[0.25, 0.5, 0.75, 1].map((ratio, i) => {
                const y = chartHeight - paddingY - (chartHeight - paddingY * 2) * ratio;
                const val = Math.round(trendData.maxRevenue * ratio);
                return (
                  <g key={i}>
                    <line 
                      x1={paddingX} 
                      y1={y} 
                      x2={chartWidth - paddingX} 
                      y2={y} 
                      stroke="#e2e8f0" 
                      strokeDasharray="4 4" 
                      strokeWidth="1" 
                    />
                    <text 
                      x={paddingX + 4} 
                      y={y - 3} 
                      fill="#94a3b8" 
                      fontSize="8.5" 
                      fontWeight="bold"
                    >
                      {currency} {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                    </text>
                  </g>
                );
              })}

              {/* Area Gradient Fill */}
              {areaPath && (
                <path 
                  d={areaPath} 
                  fill="url(#emeraldAreaGradient)" 
                  className="transition-all duration-700 ease-out"
                />
              )}

              {/* The Smooth Spline Line */}
              {linePath && (
                <path 
                  d={linePath} 
                  fill="none" 
                  stroke="#059669" 
                  strokeWidth="3.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  filter="url(#glowFilter)"
                  className="transition-all duration-700 ease-out"
                />
              )}

              {/* Interactive Data Points & Hover Targets */}
              {points.map((pt, i) => {
                const isHovered = activeHoverPoint?.index === i;
                const isPeak = trendData.peakDay?.dateStr === pt.data.dateStr && pt.data.revenue > 0;

                return (
                  <g key={i} className="cursor-pointer">
                    {/* Hover target circle (invisible large hit area) */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="14"
                      fill="transparent"
                      onMouseEnter={() => setActiveHoverPoint(pt)}
                      onMouseLeave={() => setActiveHoverPoint(null)}
                      onTouchStart={() => setActiveHoverPoint(pt)}
                    />

                    {/* Peak badge indicator */}
                    {isPeak && !isHovered && (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="6.5"
                        fill="#f59e0b"
                        stroke="#ffffff"
                        strokeWidth="2.5"
                        className="animate-ping"
                      />
                    )}

                    {/* Point Outer Ring */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? '6.5' : isPeak ? '5.5' : '3.5'}
                      fill={isHovered ? '#10b981' : isPeak ? '#f59e0b' : '#059669'}
                      stroke="#ffffff"
                      strokeWidth={isHovered ? '2.5' : '1.5'}
                      className="transition-all duration-200"
                    />
                  </g>
                );
              })}

              {/* Bottom X-Axis Date Labels */}
              {points.map((pt, i) => {
                const total = points.length;
                const step = total > 14 ? 4 : total > 7 ? 2 : 1;
                if (i % step !== 0 && i !== total - 1) return null;

                return (
                  <text
                    key={`lbl_${i}`}
                    x={pt.x}
                    y={chartHeight - 4}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize="9"
                    fontWeight="bold"
                    className="select-none uppercase"
                  >
                    {pt.data.label}
                  </text>
                );
              })}
            </svg>

            {/* Dynamic Floating Tooltip */}
            {activeHoverPoint && (
              <div 
                className="absolute z-30 bg-slate-950 text-white rounded-2xl p-2.5 shadow-2xl border border-slate-700 pointer-events-none text-xs transform -translate-x-1/2 -translate-y-full transition-all duration-150 animate-in fade-in zoom-in-95"
                style={{ 
                  left: `${(activeHoverPoint.x / chartWidth) * 100}%`, 
                  top: `${Math.max(12, (activeHoverPoint.y / chartHeight) * 100 - 8)}%` 
                }}
              >
                <div className="flex items-center gap-1.5 pb-1 border-b border-slate-800">
                  <Calendar className="w-3 h-3 text-emerald-400" />
                  <span className="font-extrabold text-[10.5px] uppercase tracking-wider text-slate-200">
                    {activeHoverPoint.data.label}
                  </span>
                </div>
                <div className="mt-1 space-y-0.5 text-[11px]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400 font-bold">Revenue:</span>
                    <span className="font-black text-emerald-400">
                      {currency} {activeHoverPoint.data.revenue.toLocaleString('en-PK')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[9.5px]">
                    <span className="text-slate-400 font-bold">Invoices:</span>
                    <span className="font-bold text-white">
                      {activeHoverPoint.data.ordersCount} Bills
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Graph Footer Legend & Insight */}
          <div className="flex items-center justify-between text-xs pt-1 flex-wrap gap-2">
            <div className="flex items-center gap-4 text-[10.5px] font-bold text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm"></span> Sales Trajectory
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm"></span> Peak Day High
              </span>
            </div>
            {trendData.peakDay && trendData.peakDay.revenue > 0 && (
              <span className="text-[10px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl">
                🌟 Peak: {trendData.peakDay.label} ({currency} {trendData.peakDay.revenue.toLocaleString('en-PK')})
              </span>
            )}
          </div>
        </div>

        {/* ─── 2. PAYMENT CHANNELS BREAKDOWN (DYNAMIC DONUT / RADIAL CHART) ──────── */}
        <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="p-1.5 bg-amber-100 rounded-lg text-amber-700">
                <PieChart className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                  Payment Channels Distribution
                </h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  Cash, Bank &amp; Credit Split
                </p>
              </div>
            </div>

            {/* SVG Donut Chart with Center Display */}
            <div className="relative flex items-center justify-center my-4">
              <svg viewBox="0 0 160 160" className="w-40 h-40 sm:w-44 sm:h-44 -rotate-90 transform">
                {/* Background Ring */}
                <circle
                  cx="80"
                  cy="80"
                  r="58"
                  fill="transparent"
                  stroke="#f1f5f9"
                  strokeWidth="18"
                />

                {/* Cash Segment (Amber / Gold) */}
                <circle
                  cx="80"
                  cy="80"
                  r="58"
                  fill="transparent"
                  stroke="#f59e0b"
                  strokeWidth={activeDonutSegment === 'cash' ? '22' : '18'}
                  strokeDasharray={`${(paymentBreakdown.cashPct * 3.64).toFixed(1)} 364`}
                  strokeDashoffset="0"
                  strokeLinecap="round"
                  className="transition-all duration-300 cursor-pointer"
                  onMouseEnter={() => setActiveDonutSegment('cash')}
                  onMouseLeave={() => setActiveDonutSegment(null)}
                />

                {/* Bank Segment (Emerald Green) */}
                <circle
                  cx="80"
                  cy="80"
                  r="58"
                  fill="transparent"
                  stroke="#10b981"
                  strokeWidth={activeDonutSegment === 'bank' ? '22' : '18'}
                  strokeDasharray={`${(paymentBreakdown.bankPct * 3.64).toFixed(1)} 364`}
                  strokeDashoffset={`-${(paymentBreakdown.cashPct * 3.64).toFixed(1)}`}
                  strokeLinecap="round"
                  className="transition-all duration-300 cursor-pointer"
                  onMouseEnter={() => setActiveDonutSegment('bank')}
                  onMouseLeave={() => setActiveDonutSegment(null)}
                />

                {/* Credit Segment (Indigo / Blue) */}
                {paymentBreakdown.creditPct > 0 && (
                  <circle
                    cx="80"
                    cy="80"
                    r="58"
                    fill="transparent"
                    stroke="#3b82f6"
                    strokeWidth={activeDonutSegment === 'credit' ? '22' : '18'}
                    strokeDasharray={`${(paymentBreakdown.creditPct * 3.64).toFixed(1)} 364`}
                    strokeDashoffset={`-${((paymentBreakdown.cashPct + paymentBreakdown.bankPct) * 3.64).toFixed(1)}`}
                    strokeLinecap="round"
                    className="transition-all duration-300 cursor-pointer"
                    onMouseEnter={() => setActiveDonutSegment('credit')}
                    onMouseLeave={() => setActiveDonutSegment(null)}
                  />
                )}
              </svg>

              {/* Center Donut Hub */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  {activeDonutSegment === 'cash' ? 'Cash Share' :
                   activeDonutSegment === 'bank' ? 'Bank Share' :
                   activeDonutSegment === 'credit' ? 'Credit Share' : 'Total Sales'}
                </span>
                <span className="text-sm sm:text-base font-black text-slate-900 tracking-tight mt-0.5">
                  {activeDonutSegment === 'cash' ? `${paymentBreakdown.cashPct}%` :
                   activeDonutSegment === 'bank' ? `${paymentBreakdown.bankPct}%` :
                   activeDonutSegment === 'credit' ? `${paymentBreakdown.creditPct}%` :
                   `${currency} ${(paymentBreakdown.grandTotal / 1000).toFixed(0)}k`}
                </span>
                <span className="text-[8.5px] font-bold text-slate-500 uppercase">
                  {sales.length} Invoices
                </span>
              </div>
            </div>
          </div>

          {/* Donut Legend Cards */}
          <div className="space-y-2">
            {/* Cash Card */}
            <div 
              onMouseEnter={() => setActiveDonutSegment('cash')}
              onMouseLeave={() => setActiveDonutSegment(null)}
              className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                activeDonutSegment === 'cash' ? 'bg-amber-50 border-amber-300 shadow-sm scale-[1.02]' : 'bg-slate-50/70 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500 shrink-0"></div>
                <div>
                  <span className="text-[11px] font-black text-slate-900 block leading-tight">Cash In Hand</span>
                  <span className="text-[9px] text-amber-700 font-bold">In Drawer</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-black text-slate-900 block">
                  {currency} {paymentBreakdown.cashTotal.toLocaleString('en-PK')}
                </span>
                <span className="text-[9.5px] font-black text-amber-600">{paymentBreakdown.cashPct}%</span>
              </div>
            </div>

            {/* Bank Card */}
            <div 
              onMouseEnter={() => setActiveDonutSegment('bank')}
              onMouseLeave={() => setActiveDonutSegment(null)}
              className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                activeDonutSegment === 'bank' ? 'bg-emerald-50 border-emerald-300 shadow-sm scale-[1.02]' : 'bg-slate-50/70 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0"></div>
                <div>
                  <span className="text-[11px] font-black text-slate-900 block leading-tight">Bank / Online</span>
                  <span className="text-[9px] text-emerald-700 font-bold">EasyPaisa &amp; Transfer</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-black text-slate-900 block">
                  {currency} {paymentBreakdown.bankTotal.toLocaleString('en-PK')}
                </span>
                <span className="text-[9.5px] font-black text-emerald-600">{paymentBreakdown.bankPct}%</span>
              </div>
            </div>

            {/* Credit Card */}
            <div 
              onMouseEnter={() => setActiveDonutSegment('credit')}
              onMouseLeave={() => setActiveDonutSegment(null)}
              className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                activeDonutSegment === 'credit' ? 'bg-blue-50 border-blue-300 shadow-sm scale-[1.02]' : 'bg-slate-50/70 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500 shrink-0"></div>
                <div>
                  <span className="text-[11px] font-black text-slate-900 block leading-tight">Credit / Accounts Receivable</span>
                  <span className="text-[9px] text-blue-700 font-bold">Customer Outstanding</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-black text-slate-900 block">
                  {currency} {paymentBreakdown.creditTotal.toLocaleString('en-PK')}
                </span>
                <span className="text-[9.5px] font-black text-blue-600">{paymentBreakdown.creditPct}%</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ─── GRID 2: FINANCIAL PROPORTIONAL BARS + TOP EGG PRODUCTS VELOCITY ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ─── 3. FINANCIAL ANATOMY (COMPARATIVE PROPORTIONAL BAR METERS) ─────────── */}
        <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-100 rounded-lg text-blue-700">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                  Financial Inflow vs. Cost Deductions
                </h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  Gross Revenue, Restocks &amp; Operating Deductions
                </p>
              </div>
            </div>
            
            <div className="px-3 py-1 bg-gradient-to-r from-emerald-500/10 to-teal-500/20 border border-emerald-300 rounded-xl text-right">
              <span className="text-[8.5px] font-bold text-emerald-800 uppercase block">Net Margin</span>
              <span className="text-xs font-black text-emerald-700">
                {financialAnatomy.netProfitMargin}%
              </span>
            </div>
          </div>

          <div className="space-y-4 pt-1">
            {/* Bar 1: Total Sales Revenue (+) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-emerald-800 font-black">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  (+) Total Gross Sales Revenue
                </span>
                <span className="font-black text-emerald-700">
                  + {currency} {financialAnatomy.totalSalesRev.toLocaleString('en-PK')}
                </span>
              </div>
              <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-green-600 rounded-full transition-all duration-700 shadow-sm"
                  style={{ width: `${Math.min(100, Math.max(8, (financialAnatomy.totalSalesRev / financialAnatomy.maxVal) * 100))}%` }}
                />
              </div>
            </div>

            {/* Bar 2: Purchases / Restocks Cost (-) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-blue-800 font-black">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  (-) Product Restocks &amp; Purchases Cost
                </span>
                <span className="font-black text-blue-700">
                  - {currency} {financialAnatomy.totalPurchasesCost.toLocaleString('en-PK')}
                </span>
              </div>
              <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-700 shadow-sm"
                  style={{ width: `${Math.min(100, Math.max(5, (financialAnatomy.totalPurchasesCost / financialAnatomy.maxVal) * 100))}%` }}
                />
              </div>
            </div>

            {/* Bar 3: Operating Expenses (-) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-rose-800 font-black">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  (-) Shop Operating Expenses
                </span>
                <span className="font-black text-rose-700">
                  - {currency} {financialAnatomy.totalOperatingExpenses.toLocaleString('en-PK')}
                </span>
              </div>
              <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                <div 
                  className="h-full bg-gradient-to-r from-rose-500 to-pink-600 rounded-full transition-all duration-700 shadow-sm"
                  style={{ width: `${Math.min(100, Math.max(4, (financialAnatomy.totalOperatingExpenses / financialAnatomy.maxVal) * 100))}%` }}
                />
              </div>
            </div>

            {/* Bar 4: Damaged Product Losses (-) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-amber-800 font-black">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  (-) Damaged Product Stock Losses
                </span>
                <span className="font-black text-amber-700">
                  - {currency} {financialAnatomy.totalDamagedLoss.toLocaleString('en-PK')}
                </span>
              </div>
              <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-600 rounded-full transition-all duration-700 shadow-sm"
                  style={{ width: `${Math.min(100, Math.max(3, (financialAnatomy.totalDamagedLoss / financialAnatomy.maxVal) * 100))}%` }}
                />
              </div>
            </div>

            {/* Summary Box: Pure Realized Net Profit */}
            <div className="pt-2">
              <div className="p-3.5 bg-gradient-to-r from-emerald-900 via-teal-950 to-slate-950 text-white rounded-2xl border-2 border-emerald-500/40 flex items-center justify-between shadow-md">
                <div>
                  <span className="text-[9.5px] font-black uppercase tracking-widest text-emerald-400 block">
                    (=) Pure Realized Net Operating Profit
                  </span>
                  <span className="text-[10px] text-slate-300 font-medium">
                    After All Bills, Restocks &amp; Breakage Deducted
                  </span>
                </div>
                <div className="text-right">
                  <span className={`text-base sm:text-lg font-black ${financialAnatomy.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {currency} {financialAnatomy.netProfit.toLocaleString('en-PK')}
                  </span>
                  <span className="text-[9px] text-emerald-300 font-bold block">
                    {financialAnatomy.netProfitMargin}% Margin
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ─── 4. TOP PRODUCTS DEMAND & STOCK HEALTH METERS ──────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-violet-100 rounded-lg text-violet-700">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                  Top Selling Products &amp; Stock Velocity
                </h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  Ranked by Units Sold &amp; Revenue Generated
                </p>
              </div>
            </div>

            <span className="text-[9.5px] font-bold text-violet-800 bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-xl uppercase tracking-wider">
              High Demand
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {topProductsData.list.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-bold text-xs uppercase tracking-wider border border-dashed border-slate-200 rounded-2xl">
                No product sales recorded yet.
              </div>
            ) : (
              topProductsData.list.map((prod, idx) => {
                const pct = Math.round((prod.totalRevenue / topProductsData.maxRev) * 100);
                return (
                  <div key={idx} className="p-3 bg-slate-50/70 hover:bg-slate-100/80 border border-slate-200 rounded-2xl transition-all space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-violet-100 text-violet-800 border border-violet-200 rounded text-[9.5px] font-black">
                          #{idx + 1}
                        </span>
                        <span className="font-extrabold text-slate-900 uppercase truncate max-w-[160px]">
                          {prod.name}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-emerald-700 block">
                          {currency} {prod.totalRevenue.toLocaleString('en-PK')}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">
                          {prod.totalSoldQty} {prod.unitType}s sold
                        </span>
                      </div>
                    </div>

                    {/* Progress velocity meter */}
                    <div className="h-2 w-full bg-slate-200/80 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-violet-600 via-indigo-500 to-emerald-500 rounded-full transition-all duration-700"
                        style={{ width: `${Math.max(10, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}

            {/* Inventory Quick Health summary */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700 mt-2">
              <span className="flex items-center gap-1.5 text-[10.5px]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Catalog Products Count:
              </span>
              <span className="font-black text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 text-[11px]">
                {products.length} Products Active
              </span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
