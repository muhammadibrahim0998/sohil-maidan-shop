import {
  ShoppingBag, ShoppingCart, Eye, Edit2, Trash2, AlertTriangle, Package, XCircle, Lock
} from 'lucide-react';
import { useProducts } from '../contexts/ProductContext';
import { useUser } from '../contexts/UserContext';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../utils/imageHelper';

export function ProductCard({ product, onEdit, onDelete, onView }) {
  const { addToCart } = useProducts();
  const { isShopAdmin, isSuperAdmin } = useUser();
  const navigate = useNavigate();

  const handleView = (e) => {
    e.stopPropagation();
    if (onView) onView(product);
    else navigate(`/product/${product._id}`);
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    if (onEdit) onEdit(product);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (onDelete) onDelete(product);
  };

  const stock = Number(product.stock) || 0;
  const minStock = Number(product.minStock) || 5;
  const isOutOfStock = stock <= 0;
  const isLowStock = stock > 0 && stock <= minStock;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ duration: 0.2 }}
      onClick={handleView}
      className={`group w-full bg-[#1E293B] border rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col cursor-pointer select-none ${
        isOutOfStock 
          ? 'border-red-500/40 opacity-80' 
          : isLowStock 
          ? 'border-amber-500/60 shadow-amber-500/10' 
          : 'border-slate-700/60 hover:border-emerald-500/50'
      }`}
    >
      {/* Aspect Square Image Container */}
      <div className="relative aspect-square w-full bg-slate-900 overflow-hidden">
        <img
          src={getImageUrl((product.images && product.images.length > 0 && product.images[0]) ? product.images[0] : (product.image || '/egg2.png'))}
          alt={product.name}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = '/egg2.png';
          }}
          className={`w-full h-full object-contain p-2 group-hover:scale-110 transition-transform duration-500 ${isOutOfStock ? 'grayscale opacity-60' : ''}`}
        />

        {/* Category Badge - Top Left */}
        {product.category && (
          <div className="absolute top-3 left-3 bg-[#111827]/90 px-3 py-1 rounded-full text-[9px] font-black text-emerald-400 uppercase tracking-widest border border-slate-700/80 backdrop-blur-md">
            {product.category}
          </div>
        )}

        {/* Stock Status Badge - Top Right */}
        <div className="absolute top-3 right-3">
          {isOutOfStock ? (
            <span className="bg-red-600/90 text-white text-[9px] font-black uppercase px-2.5 py-1 rounded-full border border-red-400 shadow-md backdrop-blur-md flex items-center gap-1">
              <XCircle className="w-2.5 h-2.5" /> Out of Stock
            </span>
          ) : isLowStock ? (
            <span className="bg-amber-500 text-zinc-950 text-[9px] font-black uppercase px-2.5 py-1 rounded-full border border-amber-300 shadow-md backdrop-blur-md flex items-center gap-1 animate-pulse">
              <AlertTriangle className="w-2.5 h-2.5" /> Low Stock ({stock})
            </span>
          ) : (
            <span className="bg-emerald-600/90 text-white text-[9px] font-black uppercase px-2.5 py-1 rounded-full border border-emerald-400/60 shadow-md backdrop-blur-md flex items-center gap-1">
              <Package className="w-2.5 h-2.5" /> In Stock ({stock})
            </span>
          )}
        </div>
      </div>

      {/* Item Info & Actions */}
      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
        <div className="space-y-2 text-left">
          <h3 className="font-black text-white text-sm leading-snug line-clamp-1 uppercase tracking-tight group-hover:text-emerald-300 transition-colors">
            {product.name}
          </h3>
          
          {/* Explicit Unit Pricing Breakdown (Peti, Tray, Egg) */}
          {(() => {
            const price = Number(product.price) || 0;
            const unit = product.unitType || 'peti';
            const petiRate = product.pricePerPeti || (unit === 'peti' ? price : unit === 'tray' ? price * 12 : price * 360);
            const trayRate = product.pricePerTray || (unit === 'tray' ? price : unit === 'peti' ? price / 12 : price * 30);
            const eggRate = product.pricePerEgg || (unit === 'egg' ? price : unit === 'tray' ? price / 30 : price / 360);

            return (
              <div className="grid grid-cols-3 gap-1 p-2 bg-slate-900/90 rounded-xl border border-slate-700/80 text-[10px] font-black">
                <div className="text-center border-r border-slate-700/60 pr-1">
                  <span className="text-[7px] text-amber-400 font-bold uppercase block">Peti (Box)</span>
                  <span className="text-white text-[11px]">Rs.{Math.round(petiRate).toLocaleString()}</span>
                </div>
                <div className="text-center border-r border-slate-700/60 px-1">
                  <span className="text-[7px] text-teal-400 font-bold uppercase block">Tray</span>
                  <span className="text-white text-[11px]">Rs.{Math.round(trayRate).toLocaleString()}</span>
                </div>
                <div className="text-center pl-1">
                  <span className="text-[7px] text-emerald-400 font-bold uppercase block">Single Egg</span>
                  <span className="text-white text-[11px]">Rs.{eggRate < 100 ? eggRate.toFixed(1) : Math.round(eggRate)}</span>
                </div>
              </div>
            );
          })()}

          {/* Low Stock / Out of Stock Alert Banner */}
          {isLowStock && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 font-black text-[10px] uppercase justify-center shadow-sm">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>Low Stock: Only {stock} remaining!</span>
            </div>
          )}

          {isOutOfStock && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 font-black text-[10px] uppercase justify-center shadow-sm">
              <XCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
              <span>Out of Stock (0 remaining)</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex flex-col gap-1.5 w-full pt-1">
          {/* Add to Cart / Add to Bill button (Locked in Red if Out of Stock) */}
          {isOutOfStock ? (
            <button
              disabled
              className="w-full py-2 px-2 rounded-xl bg-red-600/90 text-white font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md border border-red-500 cursor-not-allowed opacity-90"
              title="Out of Stock - Purchase more to restock"
            >
              <Lock className="w-3.5 h-3.5 text-red-100" />
              <span>Out of Stock (Locked)</span>
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (stock > 0) addToCart(product);
              }}
              className="w-full py-2 px-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md border-t border-emerald-400/30 border-b-2 border-emerald-950 active:translate-y-[1px] transition-all cursor-pointer"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>{isShopAdmin() || isSuperAdmin() ? '+ ADD TO BILL' : '+ Add to Cart'}</span>
            </button>
          )}

          <div className="grid grid-cols-3 gap-1.5 w-full">
            <button
              onClick={handleView}
              className="py-1.5 px-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-[9px] uppercase tracking-wider flex items-center justify-center gap-1 border border-slate-600/60 shadow-md active:translate-y-[1px] transition-all cursor-pointer"
              title="View Details"
            >
              <Eye className="w-3 h-3 text-emerald-400" />
              <span>View</span>
            </button>

            <button
              onClick={handleEdit}
              className="py-1.5 px-1 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-[9px] uppercase tracking-wider flex items-center justify-center gap-1 shadow-md border-t border-blue-400/30 border-b-2 border-indigo-900 active:translate-y-[1px] transition-all cursor-pointer"
              title="Edit Product"
            >
              <Edit2 className="w-3 h-3" />
              <span>Edit</span>
            </button>

            <button
              onClick={handleDelete}
              className="py-1.5 px-1 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-[9px] uppercase tracking-wider flex items-center justify-center gap-1 shadow-md border-t border-rose-400/30 border-b-2 border-rose-950 active:translate-y-[1px] transition-all cursor-pointer"
              title="Delete Product"
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}