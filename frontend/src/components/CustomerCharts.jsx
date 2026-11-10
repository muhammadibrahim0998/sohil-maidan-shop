import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  ShoppingBag,
  ShoppingCart,
  DollarSign,
  Calendar,
  PieChart,
  BarChart3,
  Sparkles,
  Package,
  Clock,
  CheckCircle2,
  CreditCard,
  ArrowUpRight,
  Activity,
  Layers,
  Truck,
  ArrowRight
} from 'lucide-react';

export function CustomerCharts({
  orders = [],
  customer = null,
  dashStats = {},
  products = [],
  currency = 'Rs.',
  onBrowseProducts = null,
  onViewOrders = null
}) {
  const [timeframe, setTimeframe] = useState('30D'); // '7D' | '30D' | '6M' | 'ALL'
  const [activeHoverPoint, setActiveHoverPoint] = useState(null);
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(null);

  const safeCurrency = (!currency || currency === '$') ? 'Rs.' : currency;

  // ─── 1. Format and Extract All Purchases / Orders ─────────────────────────
  const validOrders = useMemo(() => {
    return (orders || []).filter(o => o && (o.totalAmount !== undefined || o.amount !== undefined || o.finalTotal !== undefined));
  }, [orders]);

  // ─── 2. Calculate Trend Data for SVG Area / Line Graph ────────────────────
  const trendData = useMemo(() => {
    const now = new Date();
    let daysCount = 30;
    if (timeframe === '7D') daysCount = 7;
    else if (timeframe === '30D') daysCount = 30;
    else if (timeframe === '6M') daysCount = 180;
    else if (timeframe === 'ALL') daysCount = 365;

    const dataPoints = [];

    if (daysCount <= 30) {
      // Daily grouping
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const label = d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short' });
        dataPoints.push({
          dateStr,
          label,
          spent: 0,
          ordersCount: 0,
          itemsCount: 0
        });
      }

      const pointMap = new Map(dataPoints.map(p => [p.dateStr, p]));

      validOrders.forEach(ord => {
        const d = new Date(ord.createdAt || ord.orderDate || ord.date || Date.now());
        if (isNaN(d.getTime())) return;
        const dStr = d.toISOString().split('T')[0];
        const entry = pointMap.get(dStr);
        if (entry) {
          const amt = Number(ord.totalAmount || ord.amount || ord.finalTotal || 0);
          entry.spent += amt;
          entry.ordersCount += 1;
          const itemsLen = Array.isArray(ord.items) ? ord.items.reduce((s, it) => s + (Number(it.quantity) || 1), 0) : 1;
          entry.itemsCount += itemsLen;
        }
      });
    } else {
      // Monthly / Weekly grouping for longer periods
      const monthsCount = Math.min(Math.ceil(daysCount / 30), 12);
      for (let i = monthsCount - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('en-PK', { month: 'short', year: '2-digit' });
        dataPoints.push({
          dateStr: mKey,
          label,
          spent: 0,
          ordersCount: 0,
          itemsCount: 0
        });
      }

      const pointMap = new Map(dataPoints.map(p => [p.dateStr, p]));

      validOrders.forEach(ord => {
        const d = new Date(ord.createdAt || ord.orderDate || ord.date || Date.now());
        if (isNaN(d.getTime())) return;
        const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const entry = pointMap.get(mKey);
        if (entry) {
          const amt = Number(ord.totalAmount || ord.amount || ord.finalTotal || 0);
          entry.spent += amt;
          entry.ordersCount += 1;
          const itemsLen = Array.isArray(ord.items) ? ord.items.reduce((s, it) => s + (Number(it.quantity) || 1), 0) : 1;
          entry.itemsCount += itemsLen;
        }
      });
    }

    const maxSpent = Math.max(...dataPoints.map(d => d.spent), 500);
    const totalSpentInPeriod = dataPoints.reduce((sum, d) => sum + d.spent, 0);
    const totalOrdersInPeriod = dataPoints.reduce((sum, d) => sum + d.ordersCount, 0);
    const avgSpentPerOrder = totalOrdersInPeriod > 0 ? Math.round(totalSpentInPeriod / totalOrdersInPeriod) : 0;
    const peakDay = [...dataPoints].sort((a, b) => b.spent - a.spent)[0];

    return {
      dataPoints,
      maxSpent,
      totalSpentInPeriod,
      totalOrdersInPeriod,
      avgSpentPerOrder,
      peakDay
    };
  }, [validOrders, timeframe]);

  // ─── 3. Category & Product Breakdown ──────────────────────────────────────
  const categoryBreakdown = useMemo(() => {
    const catMap = new Map();

    validOrders.forEach(ord => {
      (ord.items || []).forEach(it => {
        const cat = it.category || it.productCategory || 'Egg Tray';
        const qty = Number(it.quantity) || 1;
        const price = Number(it.price || it.unitPrice || 0);
        const lineTotal = Number(it.total || (price * qty)) || 0;

        if (!catMap.has(cat)) {
          catMap.set(cat, { name: cat, totalSpent: 0, totalQty: 0, ordersCount: 0 });
        }
        const c = catMap.get(cat);
        c.totalSpent += lineTotal;
        c.totalQty += qty;
        c.ordersCount += 1;
      });
    });

    const list = Array.from(catMap.values());
    const grandTotal = list.reduce((s, c) => s + c.totalSpent, 0) || 1;

    // Palette
    const colors = [
      { bg: 'bg-emerald-500', text: 'text-emerald-700', hex: '#10b981', border: 'border-emerald-300' },
      { bg: 'bg-amber-500', text: 'text-amber-700', hex: '#f59e0b', border: 'border-amber-300' },
      { bg: 'bg-blue-500', text: 'text-blue-700', hex: '#3b82f6', border: 'border-blue-300' },
      { bg: 'bg-indigo-500', text: 'text-indigo-700', hex: '#6366f1', border: 'border-indigo-300' },
      { bg: 'bg-rose-500', text: 'text-rose-700', hex: '#f43f5e', border: 'border-rose-300' },
      { bg: 'bg-teal-500', text: 'text-teal-700', hex: '#14b8a6', border: 'border-teal-300' },
    ];

    return list.map((item, idx) => {
      const color = colors[idx % colors.length];
      const pct = Math.round((item.totalSpent / grandTotal) * 100);
      return { ...item, ...color, pct };
    }).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [validOrders]);

  // ─── 4. Order Status Distribution ─────────────────────────────────────────
  const statusStats = useMemo(() => {
    let delivered = 0;
    let processing = 0;
    let pending = 0;
    let cancelled = 0;

    validOrders.forEach(o => {
      const st = String(o.status || o.orderStatus || 'DELIVERED').toUpperCase();
      if (st.includes('DELIVER') || st.includes('COMPLET') || st.includes('APPROVED')) delivered++;
      else if (st.includes('PROCESS') || st.includes('DISPATCH') || st.includes('TRANSIT')) processing++;
      else if (st.includes('CANCEL') || st.includes('REJECT')) cancelled++;
      else pending++;
    });

    const total = validOrders.length || 1;
    return [
      { label: 'Completed / Delivered', count: delivered, pct: Math.round((delivered / total) * 100), color: 'bg-emerald-500', text: 'text-emerald-700', bgLight: 'bg-emerald-50 border-emerald-200' },
      { label: 'Processing / Transit', count: processing, pct: Math.round((processing / total) * 100), color: 'bg-blue-500', text: 'text-blue-700', bgLight: 'bg-blue-50 border-blue-200' },
      { label: 'Pending Confirmation', count: pending, pct: Math.round((pending / total) * 100), color: 'bg-amber-500', text: 'text-amber-700', bgLight: 'bg-amber-50 border-amber-200' },
      { label: 'Cancelled / Returned', count: cancelled, pct: Math.round((cancelled / total) * 100), color: 'bg-rose-500', text: 'text-rose-700', bgLight: 'bg-rose-50 border-rose-200' },
    ];
  }, [validOrders]);

  // ─── SVG Coordinate Calculation for Line/Area Graph ───────────────────────
  const svgWidth = 700;
  const svgHeight = 220;
  const paddingX = 45;
  const paddingY = 25;
  const graphWidth = svgWidth - (paddingX * 2);
  const graphHeight = svgHeight - (paddingY * 2);

  const points = useMemo(() => {
    const data = trendData.dataPoints;
    if (!data || data.length === 0) return [];
    const stepX = data.length > 1 ? graphWidth / (data.length - 1) : graphWidth;

    return data.map((d, i) => {
      const x = paddingX + (i * stepX);
      const ratio = trendData.maxSpent > 0 ? (d.spent / trendData.maxSpent) : 0;
      const y = paddingY + graphHeight - (ratio * graphHeight);
      return { x, y, data: d };
    });
  }, [trendData, graphWidth, graphHeight]);

  const pathD = useMemo(() => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      d += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return d;
  }, [points]);

  const areaD = useMemo(() => {
    if (points.length === 0) return '';
    const baseY = paddingY + graphHeight;
    const startX = points[0].x;
    const endX = points[points.length - 1].x;
    return `${pathD} L ${endX} ${baseY} L ${startX} ${baseY} Z`;
  }, [pathD, points, graphHeight]);

  return (
    <div className="space-y-6 mt-6 animate-in fade-in duration-500">
      {/* ─── Top Header Card with Timeframe Controls ─── */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Customer Analytics
                </span>
                <span className="text-[10px] font-bold text-slate-400">Live Personal Ledger</span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight mt-0.5">
                📊 My Purchase &amp; Order Trends
              </h2>
            </div>
          </div>

          {/* Timeframe Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/80 self-start sm:self-auto">
            {[
              { id: '7D', label: '7 Days' },
              { id: '30D', label: '30 Days' },
              { id: '6M', label: '6 Months' },
              { id: 'ALL', label: 'All Time' },
            ].map(tf => (
              <button
                key={tf.id}
                onClick={() => setTimeframe(tf.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${timeframe === tf.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Metric Summary Chips ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-6">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-[10px] font-black uppercase tracking-wider">
              <span>Period Spending</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-2">
              {safeCurrency} {trendData.totalSpentInPeriod.toLocaleString('en-PK')}
            </p>
            <span className="text-[9.5px] font-bold text-emerald-600 mt-1">
              💰 Filtered Purchases
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-[10px] font-black uppercase tracking-wider">
              <span>Orders Placed</span>
              <ShoppingCart className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-2">
              {trendData.totalOrdersInPeriod} {trendData.totalOrdersInPeriod === 1 ? 'Order' : 'Orders'}
            </p>
            <span className="text-[9.5px] font-bold text-blue-600 mt-1">
              📦 Placed in Period
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-[10px] font-black uppercase tracking-wider">
              <span>Average Order Value</span>
              <TrendingUp className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-2">
              {safeCurrency} {trendData.avgSpentPerOrder.toLocaleString('en-PK')}
            </p>
            <span className="text-[9.5px] font-bold text-amber-600 mt-1">
              ⚖️ Avg Basket Size
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-[10px] font-black uppercase tracking-wider">
              <span>Lifetime Spent</span>
              <Sparkles className="w-4 h-4 text-indigo-600" />
            </div>
            <p className="text-lg sm:text-xl font-black text-indigo-950 tracking-tight mt-2">
              {safeCurrency} {(dashStats.totalSpent || trendData.totalSpentInPeriod).toLocaleString('en-PK')}
            </p>
            <span className="text-[9.5px] font-bold text-indigo-600 mt-1">
              🌟 All-Time Total
            </span>
          </div>
        </div>

        {/* ─── Main Interactive Chart Area ─── */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                Spending Activity Graph ({timeframe})
              </span>
            </div>
            {activeHoverPoint && (
              <div className="px-3 py-1 bg-slate-900 text-white text-[11px] font-black rounded-xl shadow-md animate-in fade-in">
                {activeHoverPoint.label}: {safeCurrency} {activeHoverPoint.spent.toLocaleString('en-PK')} ({activeHoverPoint.ordersCount} orders)
              </div>
            )}
          </div>

          <div className="relative w-full overflow-hidden bg-slate-50/80 rounded-2xl border border-slate-200 p-2 sm:p-4">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-48 sm:h-56 overflow-visible select-none"
            >
              <defs>
                <linearGradient id="customerChartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="customerLineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#059669" />
                  <stop offset="50%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#34d399" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const y = paddingY + (graphHeight * ratio);
                const val = Math.round(trendData.maxSpent * (1 - ratio));
                return (
                  <g key={idx}>
                    <line
                      x1={paddingX}
                      y1={y}
                      x2={svgWidth - paddingX}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                    <text
                      x={paddingX - 8}
                      y={y + 3}
                      textAnchor="end"
                      fontSize="9"
                      fill="#94a3b8"
                      fontWeight="bold"
                    >
                      {val > 0 ? val.toLocaleString('en-PK') : '0'}
                    </text>
                  </g>
                );
              })}

              {/* Area & Line */}
              {areaD && (
                <path
                  d={areaD}
                  fill="url(#customerChartGrad)"
                  className="transition-all duration-300"
                />
              )}
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="url(#customerLineGrad)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-300"
                />
              )}

              {/* Data Points */}
              {points.map((p, idx) => {
                const isHovered = activeHoverPoint?.dateStr === p.data.dateStr;
                const hasValue = p.data.spent > 0;
                return (
                  <g
                    key={idx}
                    className="cursor-pointer"
                    onMouseEnter={() => setActiveHoverPoint(p.data)}
                    onMouseLeave={() => setActiveHoverPoint(null)}
                  >
                    {/* Invisible Larger Hit Area */}
                    <circle cx={p.x} cy={p.y} r="14" fill="transparent" />

                    {/* Visible Point */}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isHovered ? 6.5 : (hasValue ? 4 : 2.5)}
                      fill={isHovered ? '#047857' : (hasValue ? '#10b981' : '#cbd5e1')}
                      stroke="#ffffff"
                      strokeWidth={isHovered ? 2.5 : 1.5}
                      className="transition-all duration-200"
                    />

                    {/* Label at bottom */}
                    {(points.length <= 14 || idx % Math.ceil(points.length / 10) === 0 || idx === points.length - 1) && (
                      <text
                        x={p.x}
                        y={svgHeight - 6}
                        textAnchor="middle"
                        fontSize="8.5"
                        fill="#64748b"
                        fontWeight="bold"
                      >
                        {p.data.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* ─── Bottom 2 Column Grid: Category Breakdown & Order Status ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Product & Category Distribution */}
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                  Variety &amp; Categories
                </h3>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {categoryBreakdown.length} Varieties
              </span>
            </div>

            {categoryBreakdown.length === 0 ? (
              <div className="py-12 text-center text-slate-400 font-bold text-xs">
                No purchases recorded for variety breakdown yet.
              </div>
            ) : (
              <div className="space-y-3.5">
                {categoryBreakdown.map((cat, idx) => (
                  <div
                    key={cat.name}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition-all cursor-pointer"
                    onMouseEnter={() => setActiveCategoryIndex(idx)}
                    onMouseLeave={() => setActiveCategoryIndex(null)}
                  >
                    <div className="flex items-center justify-between text-xs font-black text-slate-900 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-md ${cat.bg}`} />
                        <span>{cat.name}</span>
                      </div>
                      <span>{safeCurrency} {cat.totalSpent.toLocaleString('en-PK')} ({cat.pct}%)</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${cat.bg} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.max(cat.pct, 4)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {onBrowseProducts && (
            <button
              onClick={onBrowseProducts}
              className="mt-5 w-full py-2.5 bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Explore More Products</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right: Orders Status & Delivery Summary */}
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                  Order Status Breakdown
                </h3>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {validOrders.length} Total Orders
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {statusStats.map(st => (
                <div key={st.label} className={`p-4 rounded-2xl border ${st.bgLight} flex flex-col justify-between`}>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                    {st.label}
                  </span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <p className={`text-xl font-black ${st.text} tracking-tight`}>
                      {st.count}
                    </p>
                    <span className="text-[10px] font-black text-slate-500">
                      {st.pct}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {onViewOrders && (
            <button
              onClick={onViewOrders}
              className="mt-5 w-full py-2.5 bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>View All Order Receipts</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
