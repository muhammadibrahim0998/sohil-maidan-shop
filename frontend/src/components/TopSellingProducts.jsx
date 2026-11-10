import { useMemo } from 'react';
import { TrendingUp, Package, ShoppingBag, DollarSign, Award } from 'lucide-react';
import { CountUpNumber } from './CountUpNumber.jsx';
import { motion } from 'framer-motion';

export function TopSellingProducts({ sales = [], products = [] }) {
  // Build a map: productId -> { name, totalQty, totalAmount, price, image }
  const topProducts = useMemo(() => {
    const map = {};

    for (const sale of sales) {
      if (sale.status === 'returned' || sale.status === 'cancelled') continue;
      for (const item of (sale.items || [])) {
        const id = item.productId?.toString() || item.name;
        if (!map[id]) {
          map[id] = {
            id,
            name: item.name || 'Unknown Product',
            totalQty: 0,
            totalAmount: 0,
            price: item.price || 0,
          };
        }
        map[id].totalQty += item.quantity || 0;
        map[id].totalAmount += item.subtotal || (item.price * item.quantity) || 0;
      }
    }

    // Enrich with product image from products list
    const productImageMap = {};
    for (const p of products) {
      productImageMap[p._id?.toString()] = p.images?.[0] || null;
    }

    return Object.values(map)
      .map(p => ({ ...p, image: productImageMap[p.id] || null }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10);
  }, [sales, products]);

  if (!topProducts.length) {
    return (
      <div className="bg-white border border-zinc-100 rounded-[2rem] p-8 shadow-sm flex flex-col items-center justify-center gap-3 py-16">
        <ShoppingBag className="w-12 h-12 text-zinc-300" />
        <p className="text-zinc-400 font-black uppercase tracking-widest text-sm">No Sales Data Yet</p>
        <p className="text-zinc-300 text-xs text-center">Complete a sale to see your top-selling products here.</p>
      </div>
    );
  }

  const maxAmount = topProducts[0]?.totalAmount || 1;

  return (
    <div className="bg-white border border-zinc-100 rounded-[2rem] p-6 sm:p-8 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
          <Award className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h3 className="text-lg font-black text-zinc-900 uppercase tracking-[0.15em]">Top Selling Products</h3>
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Based on actual sales from database</p>
        </div>
      </div>

      {/* Product List */}
      <div className="space-y-4">
        {topProducts.map((product, index) => {
          const barWidth = Math.max(4, Math.round((product.totalAmount / maxAmount) * 100));
          const rankColors = ['text-amber-500', 'text-zinc-400', 'text-orange-600'];
          const rankColor = rankColors[index] || 'text-zinc-300';
          const barColors = [
            'bg-amber-400', 'bg-zinc-300', 'bg-orange-400',
            'bg-emerald-400', 'bg-blue-400', 'bg-purple-400',
            'bg-rose-400', 'bg-cyan-400', 'bg-teal-400', 'bg-indigo-400'
          ];
          const barColor = barColors[index] || 'bg-zinc-200';

          return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.06 }}
              className="flex items-center gap-4 group"
            >
              {/* Rank */}
              <span className={`text-sm font-black w-6 text-center shrink-0 ${rankColor}`}>
                #{index + 1}
              </span>

              {/* Image or Icon */}
              <div className="w-11 h-11 rounded-xl overflow-hidden bg-zinc-100 shrink-0 border border-zinc-200 group-hover:scale-105 transition-transform">
                {product.image ? (
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-5 h-5 text-zinc-400" />
                  </div>
                )}
              </div>

              {/* Info + Bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <p className="text-xs font-black text-zinc-800 uppercase truncate tracking-tight">{product.name}</p>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest whitespace-nowrap">
                      {product.totalQty} units sold
                    </span>
                    <span className="text-sm font-black text-emerald-600 whitespace-nowrap">
                      Rs. <CountUpNumber value={product.totalAmount} />
                    </span>
                  </div>
                </div>
                {/* Progress Bar */}
                <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ duration: 0.8, delay: index * 0.06, ease: 'easeOut' }}
                    className={`h-full rounded-full ${barColor}`}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Footer summary */}
      <div className="mt-8 pt-6 border-t border-zinc-100 grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Total Products Sold</p>
          <p className="text-xl font-black text-zinc-900">
            <CountUpNumber value={topProducts.reduce((s, p) => s + p.totalQty, 0)} />
          </p>
          <p className="text-[9px] text-zinc-400 uppercase">Units</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Total Revenue</p>
          <p className="text-xl font-black text-emerald-600">
            Rs. <CountUpNumber value={topProducts.reduce((s, p) => s + p.totalAmount, 0)} />
          </p>
          <p className="text-[9px] text-zinc-400 uppercase">From Listed Sales</p>
        </div>
        <div className="text-center col-span-2 sm:col-span-1">
          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Best Seller</p>
          <p className="text-xs font-black text-amber-600 uppercase truncate">{topProducts[0]?.name || '—'}</p>
          <p className="text-[9px] text-zinc-400 uppercase">Highest Revenue</p>
        </div>
      </div>
    </div>
  );
}
