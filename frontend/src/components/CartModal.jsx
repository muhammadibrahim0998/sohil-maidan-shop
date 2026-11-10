import React from 'react';
import { X, ShoppingBag, Trash2, ArrowRight, Plus, Minus } from 'lucide-react';
import { useProducts } from '../contexts/ProductContext';
import { motion, AnimatePresence } from 'framer-motion';

export function CartModal({ isOpen, onClose, onCheckout }) {
  const { cart, products, addToCart, removeFromCart: onRemove, clearCart: onClear, updateQuantity: onUpdateQuantity } = useProducts();
  const [customerName, setCustomerName] = React.useState('');

  if (!isOpen) return null;

  const total = (cart || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden flex justify-end">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sidebar */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="relative w-full sm:w-[420px] h-full bg-white border-l border-zinc-200 shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-zinc-900 tracking-tighter uppercase italic">Sales Cart</h2>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{cart.length} Units Staged</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400 hover:text-zinc-900">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 premium-scrollbar">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full opacity-20">
              <ShoppingBag className="w-12 h-12 mb-2" />
              <p className="text-xs font-bold uppercase tracking-widest">Cart is empty</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.productId} className="flex gap-4 p-4 bg-zinc-50 border border-zinc-100 rounded-xl group transition-all">
                <div className="w-14 h-14 bg-white rounded-lg border border-zinc-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                  {item.images?.[0] ? (
                    <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingBag className="w-4 h-4 text-zinc-300" />
                  )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  <div className="flex justify-between items-start">
                    <h4 className="text-[11px] font-black text-zinc-900 truncate uppercase pr-4 tracking-tighter">{item.name}</h4>
                    <button onClick={() => onRemove(item.productId)} className="text-zinc-300 hover:text-rose-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex justify-between items-end">
                    <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-lg p-1">
                      <button
                        onClick={() => onUpdateQuantity(item.productId, -1, 999)}
                        disabled={item.quantity <= 1}
                        className="p-1 hover:bg-zinc-100 rounded text-zinc-500 disabled:opacity-20"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-[10px] font-black text-zinc-900 w-5 text-center">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQuantity(item.productId, 1, item.stock)}
                        disabled={item.quantity >= item.stock}
                        className="p-1 hover:bg-zinc-100 rounded text-zinc-500 disabled:opacity-20"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-sm font-black text-green-600 font-mono tracking-tighter">Rs.{(item.price * item.quantity).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="p-6 bg-zinc-50 border-t border-zinc-200 space-y-4">
            {/* Customer Name Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">Customer Identifier</label>
              <input
                type="text"
                placeholder="Ex: Walk-in Customer / Ali Khan"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full bg-white border border-zinc-200 focus:border-green-500/50 rounded-xl py-3 px-4 text-xs font-bold text-zinc-900 placeholder:text-zinc-300 outline-none transition-all shadow-inner"
              />
            </div>

            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Grand Total</span>
              <span className="text-2xl font-black text-zinc-900 tracking-tighter">Rs. {total.toLocaleString()}</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={onClear}
                className="flex-1 py-3 text-[10px] font-black text-zinc-400 hover:text-rose-500 uppercase tracking-widest transition-colors"
              >
                Reset
              </button>
              <button
                onClick={() => {
                  onCheckout(customerName);
                  setCustomerName(''); // Reset for next sale
                }}
                className="flex-[3] py-4 bg-zinc-900 text-white rounded-xl font-bold text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-black transition-all active:scale-95 shadow-xl shadow-zinc-200"
              >
                Complete Sale
                <ArrowRight className="w-4 h-4 opacity-50" />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
