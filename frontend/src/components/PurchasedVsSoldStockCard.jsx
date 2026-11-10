import { useMemo } from 'react';
import { Box, Package, ShoppingBag, Truck, DollarSign, TrendingUp, Layers, CheckCircle2 } from 'lucide-react';
import { CountUpNumber } from './CountUpNumber.jsx';

export function PurchasedVsSoldStockCard({ products = [], sales = [], checkoutOrders = [] }) {
  const stats = useMemo(() => {
    let totalPurchasedCost = 0;
    let totalPetisStock = 0;
    let totalTraysStock = 0;
    let totalEggsStock = 0;

    products.forEach((p) => {
      const stockEggs = Number(p.stock || 0);
      totalEggsStock += stockEggs;

      const petiQty = Number(p.petiQuantity || 0);
      const trayQty = Number(p.trayQuantity || 0);
      const eggQty = Number(p.eggQuantity || 0);

      if (petiQty > 0 || trayQty > 0 || eggQty > 0) {
        totalPetisStock += petiQty + (trayQty / 12) + (eggQty / 360);
        totalTraysStock += (petiQty * 12) + trayQty + (eggQty / 30);
      } else {
        totalPetisStock += stockEggs / 360;
        totalTraysStock += stockEggs / 30;
      }

      const cost = Number(p.totalPurchaseCost) || (Number(p.costPrice) > 0 ? (stockEggs * (Number(p.costPrice) / (p.unitType === 'egg' ? 1 : p.unitType === 'tray' ? 30 : 360))) : 0);
      totalPurchasedCost += cost;
    });

    // Calculate Sold Eggs, Trays, Petis from sales & orders
    let totalSoldEggs = 0;
    const validSales = sales.filter(s => s.status !== 'returned' && s.status !== 'cancelled');

    validSales.forEach(s => {
      s.items?.forEach(item => {
        const qty = Number(item.quantity || 0);
        const unit = item.unitType || 'egg';
        totalSoldEggs += unit === 'peti' ? qty * 360 : unit === 'tray' ? qty * 30 : qty;
      });
    });

    checkoutOrders.forEach(o => {
      if (o.paymentStatus === 'PAID') {
        o.items?.forEach(item => {
          const qty = Number(item.quantity || 0);
          totalSoldEggs += qty * 30; // default online order is tray
        });
      }
    });

    const totalSoldTrays = totalSoldEggs / 30;
    const totalSoldPetis = totalSoldEggs / 360;

    // Total Revenue Collected
    const posRevenue = validSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const onlineRevenue = checkoutOrders.filter(o => o.paymentStatus === 'PAID').reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalSalesRevenue = posRevenue + onlineRevenue;

    const totalPurchasedEggsEstimated = totalEggsStock + totalSoldEggs;
    const totalPurchasedPetisEstimated = totalPurchasedEggsEstimated / 360;
    const totalPurchasedTraysEstimated = totalPurchasedEggsEstimated / 30;
    const soldPercentage = totalPurchasedEggsEstimated > 0 ? Math.min(100, (totalSoldEggs / totalPurchasedEggsEstimated) * 100) : 0;

    return {
      totalPurchasedCost,
      totalPurchasedPetis: Number(totalPurchasedPetisEstimated.toFixed(1)),
      totalPurchasedTrays: Math.round(totalPurchasedTraysEstimated),
      totalPurchasedEggs: totalPurchasedEggsEstimated,
      totalPetisStock: Number(totalPetisStock.toFixed(1)),
      totalTraysStock: Math.round(totalTraysStock),
      totalEggsStock,
      netRemainingPetis: Number(totalPetisStock.toFixed(1)),
      netRemainingTrays: Math.round(totalTraysStock),
      netRemainingEggs: totalEggsStock,
      totalSoldPetis: Number(totalSoldPetis.toFixed(1)),
      totalSoldTrays: Math.round(totalSoldTrays),
      totalSoldEggs,
      totalSalesRevenue,
      soldPercentage: Number(soldPercentage.toFixed(1))
    };
  }, [products, sales, checkoutOrders]);

  const fmt = (n) => Number(n || 0).toLocaleString('en-PK');

  return (
    <div className="bg-white border border-zinc-100 rounded-[2rem] p-6 sm:p-8 shadow-sm space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-amber-600">
            <Box className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-zinc-900 uppercase tracking-[0.15em]">
              Purchased vs Sold Inventory &amp; Price Breakdown
            </h3>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
              Peti (Box), Tray &amp; Revenue Analytics • Purchased Minus Sold Stock
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {stats.soldPercentage}% Stock Sold
          </span>
          <span className="text-[10px] font-black text-amber-800 bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-full uppercase tracking-wider">
            📦 In-Hand: {stats.netRemainingPetis} Petis
          </span>
        </div>
      </div>

      {/* Main Grid: Purchased vs Sold Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Card 1: Purchased Stock & Price */}
        <div className="p-5 bg-gradient-to-br from-amber-500 to-amber-600 text-zinc-950 rounded-2xl border border-amber-400 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-900 flex items-center gap-1.5">
              <Truck className="w-4 h-4" /> Purchased Inventory Stock &amp; Cost
            </span>
            <span className="text-[9px] font-black bg-zinc-950 text-amber-400 px-2.5 py-0.5 rounded-full uppercase">
              Purchased - Sold = In Hand
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-zinc-950/15 p-3 rounded-xl border border-zinc-950/10">
            <div>
              <span className="text-[8px] font-black text-zinc-900 uppercase block">Total Purchased Volume</span>
              <h4 className="text-2xl font-black text-zinc-950">{stats.totalPurchasedPetis} Petis</h4>
              <span className="text-[9px] font-bold text-zinc-900">{stats.totalPurchasedTrays.toLocaleString()} Trays ({stats.totalPurchasedEggs.toLocaleString()} Eggs)</span>
              
              <div className="mt-2 pt-2 border-t border-zinc-950/20 text-[9px] font-black text-zinc-900 flex flex-col">
                <span className="text-zinc-950">📦 Remaining In-Hand: {stats.netRemainingPetis} Petis</span>
                <span className="text-zinc-800 font-bold">({stats.totalPurchasedPetis}P Purchased - {stats.totalSoldPetis}P Sold)</span>
              </div>
            </div>

            <div>
              <span className="text-[8px] font-black text-zinc-900 uppercase block">Total Purchase Cost Spent</span>
              <h4 className="text-2xl font-black text-zinc-950">Rs. {fmt(stats.totalPurchasedCost)}</h4>
              <span className="text-[9px] font-bold text-zinc-900">Supplier Stock Valuation</span>
              
              <div className="mt-2 pt-2 border-t border-zinc-950/20 text-[9px] font-black text-zinc-900 flex flex-col">
                <span className="text-zinc-950">🛒 Net In-Stock Eggs: {stats.netRemainingEggs.toLocaleString()}</span>
                <span className="text-zinc-800 font-bold">({stats.netRemainingTrays.toLocaleString()} Trays Available)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Sold Stock & Sales Revenue */}
        <div className="p-5 bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl border border-emerald-500 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/90 flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4" /> Sold Customer Stock &amp; Revenue
            </span>
            <span className="text-[9px] font-black bg-white text-emerald-800 px-2.5 py-0.5 rounded-full uppercase">
              Customer Sales
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-white/10 p-3 rounded-xl border border-white/10">
            <div>
              <span className="text-[8px] font-black text-white/80 uppercase block">Total Sold Petis &amp; Trays</span>
              <h4 className="text-2xl font-black text-white">{stats.totalSoldPetis} Petis</h4>
              <span className="text-[9px] font-bold text-white/90">{stats.totalSoldTrays.toLocaleString()} Trays ({stats.totalSoldEggs.toLocaleString()} Eggs)</span>

              <div className="mt-2 pt-2 border-t border-white/20 text-[9px] font-black text-emerald-100 flex flex-col">
                <span>Deducted from Purchases: -{stats.totalSoldPetis} Petis</span>
                <span className="text-emerald-200 font-bold">(-{stats.totalSoldEggs.toLocaleString()} Total Eggs Sold)</span>
              </div>
            </div>

            <div>
              <span className="text-[8px] font-black text-white/80 uppercase block">Total Sales Revenue Received</span>
              <h4 className="text-2xl font-black text-white">Rs. {fmt(stats.totalSalesRevenue)}</h4>
              <span className="text-[9px] font-bold text-white/90">Gross Revenue Collected</span>

              <div className="mt-2 pt-2 border-t border-white/20 text-[9px] font-black text-emerald-100 flex flex-col">
                <span>Sales Fulfillment: {stats.soldPercentage}% Complete</span>
                <span className="text-emerald-200 font-bold">In-Stock Remaining: {(100 - stats.soldPercentage).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Stock Sales Progress Bar & Calculation Equation */}
      <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-2xl space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-black gap-1">
          <span className="text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-amber-600" />
            Stock Equation: Purchased ({stats.totalPurchasedPetis} Petis) - Sold ({stats.totalSoldPetis} Petis) = Remaining ({stats.netRemainingPetis} Petis)
          </span>
          <span className="text-emerald-600">{stats.soldPercentage}% Sold ({stats.totalSoldPetis}P) • {(100 - stats.soldPercentage).toFixed(1)}% In Hand ({stats.netRemainingPetis}P)</span>
        </div>
        <div className="w-full h-3 bg-zinc-200 rounded-full overflow-hidden flex">
          <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${stats.soldPercentage}%` }} />
          <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${100 - stats.soldPercentage}%` }} />
        </div>
      </div>

    </div>
  );
}
