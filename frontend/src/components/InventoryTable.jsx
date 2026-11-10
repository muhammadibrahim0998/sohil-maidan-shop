import React, { useState, useRef, useEffect } from 'react';
import {
  ShoppingBag, ShoppingCart, Eye, Edit2, Trash2,
  ArrowUp, ArrowDown, ArrowUpDown, FileSpreadsheet,
  Calendar, MoreVertical, X, ChevronRight, ChevronLeft
} from 'lucide-react';
import { useProducts } from '../contexts/ProductContext';
import { useUser } from '../contexts/UserContext';
import { motion, AnimatePresence } from 'framer-motion';
import { getImageUrl } from '../utils/imageHelper';

const fadeUpVariant = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
};

const RowActions = ({ onEdit, onDelete, onView, isShopAdmin, isEditAllowed = true, isDeleteAllowed = true }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-lg transition-all ${isOpen
          ? 'bg-zinc-900 text-white shadow-lg'
          : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, x: 10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95, x: 10 }}
            className="absolute right-full mr-2 top-1/2 -translate-y-1/2 z-50 flex items-center gap-1 bg-white border border-zinc-200 p-1.5 rounded-xl shadow-xl shadow-zinc-200/50"
          >
            <button onClick={() => { onView(); setIsOpen(false); }} className="p-2 text-blue-500 hover:bg-blue-100 rounded-lg" title="View"><Eye className="w-4 h-4" /></button>
            {isShopAdmin && (
              <>
                <div className="w-px h-4 bg-zinc-200 mx-1" />
                {isEditAllowed && (
                  <button onClick={() => { onEdit(); setIsOpen(false); }} className="p-2 text-green-600 hover:text-white hover:bg-green-300 rounded-lg" title="Edit"><Edit2 className="w-4 h-4" /></button>
                )}
                {isDeleteAllowed && (
                  <button onClick={() => { onDelete(); setIsOpen(false); }} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" /></button>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export function InventoryTable({ onEdit, onDelete, onView, onExport }) {
  const { isShopAdmin, isCustomer, isPageOpAllowed } = useUser();
  const isEditAllowed = isPageOpAllowed ? isPageOpAllowed('purchases', 'edit') : true;
  const isDeleteAllowed = isPageOpAllowed ? isPageOpAllowed('purchases', 'delete') : true;
  const {
    filteredProducts: products, handleSort, sortConfig, getStockStatus,
    addToCart, currentPage, setCurrentPage, itemsPerPage, setItemsPerPage
  } = useProducts();

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 opacity-20" />;
    return sortConfig.direction === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: '2-digit' }) : 'N/A';

  const formatEggStock = (product) => {
    if (product.petiQuantity > 0 || product.trayQuantity > 0 || product.eggQuantity > 0) {
      const parts = [];
      if (product.petiQuantity > 0) parts.push(`${product.petiQuantity} Petis`);
      if (product.trayQuantity > 0) parts.push(`${product.trayQuantity} Trays`);
      if (product.eggQuantity > 0) parts.push(`${product.eggQuantity} Eggs`);
      return parts.join(' + ');
    }
    const total = product.stock || 0;
    const petis = (total / 360).toFixed(1);
    return `${total.toLocaleString()} Eggs (${petis} Petis)`;
  };

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = products.slice(startIndex, startIndex + itemsPerPage);
  const totalPages = Math.ceil(products.length / itemsPerPage) || 1;

  return (
    <div className="space-y-6">
      {/* Table Title & Quick Sort */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 px-4 mt-2">
        <div>
          <h3 className="text-2xl font-black text-zinc-900 tracking-tighter uppercase italic">Registry</h3>
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.2em] mt-1">Asset Management Protocol</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={onExport} className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-md active:scale-95">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block rich-card !rounded-b-none !border-b-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-zinc-50/50 border-b border-zinc-100">
              <tr>
                <th className="pl-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest w-[35%]">Product Detail</th>
                <th className="px-4 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Category</th>
                <th className="px-4 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Stock Status</th>
                <th className="px-4 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Pricing</th>
                <th className="px-4 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Expiry</th>
                <th className="pr-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {paginatedProducts.map((product) => {
                const status = getStockStatus(product.stock, product.minStock);
                return (
                  <motion.tr key={product._id} variants={fadeUpVariant} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className="pl-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-zinc-100 rounded-lg flex items-center justify-center border border-zinc-200 overflow-hidden shrink-0">
                          {product.images?.[0] ? (
                            <img 
                              src={getImageUrl(product.images[0])} 
                              onError={(e) => { e.target.onerror = null; e.target.src = '/egg2.png'; }} 
                              className="w-full h-full object-cover" 
                              alt=""
                            />
                          ) : (
                            <ShoppingBag className="w-4 h-4 text-zinc-300" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-zinc-900 truncate">{product.name}</div>
                          <div className="text-[9px] text-zinc-400 font-medium uppercase tracking-tighter">REF: {String(product._id || product.id || '').slice(-6).toUpperCase()}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-[9px] font-black text-zinc-500 border border-zinc-200 px-2 py-0.5 rounded uppercase tracking-tighter">{product.category}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className={`text-xs font-black ${product.stock <= product.minStock ? 'text-rose-600' : 'text-zinc-900'}`}>{formatEggStock(product)}</div>
                      <div className="text-[9px] text-zinc-400 font-bold uppercase italic">Min Alert: {product.minStock}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-xs font-black text-green-600 font-mono">Rs.{product.price.toLocaleString()}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5 text-zinc-600">
                        <Calendar className="w-3 h-3" />
                        <span className="text-[10px] font-bold uppercase">{formatDate(product.expiryDate)}</span>
                      </div>
                    </td>
                    <td className="pr-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {isCustomer() && (
                          <button onClick={() => addToCart(product)} className="p-2 text-zinc-400 hover:text-white hover:bg-green-400 rounded-lg transition-all"><ShoppingCart className="w-4 h-4" /></button>
                        )}
                        <RowActions onView={() => onView(product)} onEdit={() => onEdit(product)} onDelete={() => onDelete(product)} isShopAdmin={isShopAdmin()} isEditAllowed={isEditAllowed} isDeleteAllowed={isDeleteAllowed} />
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Improved Pagination */}
        <div className="bg-zinc-50/50 px-6 py-4 border-t border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Density</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-zinc-200 rounded-lg px-2 py-1 text-[10px] font-bold outline-none cursor-pointer"
            >
              {[10, 20, 50].map(v => <option key={v} value={v}>{v} Rows</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 hover:bg-zinc-200 rounded-lg disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-[10px] font-black text-zinc-900 uppercase tracking-widest">Page {currentPage} / {totalPages}</span>
            <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages} className="p-1.5 hover:bg-zinc-200 rounded-lg disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* Mobile Card Layout (Visible below lg) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:hidden">
        {paginatedProducts.map((product) => (
          <div key={product._id} className="rich-card p-4 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div className="flex gap-3">
                <div className="w-12 h-12 bg-zinc-100 rounded-xl border border-zinc-200 overflow-hidden flex items-center justify-center">
                  {product.images?.[0] ? (
                    <img 
                      src={getImageUrl(product.images[0])} 
                      onError={(e) => { e.target.onerror = null; e.target.src = '/egg2.png'; }} 
                      className="w-full h-full object-cover" 
                      alt=""
                    />
                  ) : (
                    <ShoppingBag className="w-5 h-5 text-zinc-300" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 line-clamp-1">{product.name}</h4>
                  <span className="text-[9px] font-black text-green-600 uppercase">{product.category}</span>
                </div>
              </div>
              <RowActions onView={() => onView(product)} onEdit={() => onEdit(product)} onDelete={() => onDelete(product)} isShopAdmin={isShopAdmin()} isEditAllowed={isEditAllowed} isDeleteAllowed={isDeleteAllowed} />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-zinc-50">
              <div>
                <p className="text-[9px] font-bold text-zinc-400 uppercase">Stock</p>
                <p className="text-xs font-black text-zinc-900">{formatEggStock(product)}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-bold text-zinc-400 uppercase">Price</p>
                <p className="text-xs font-black text-green-600">Rs.{product.price.toLocaleString()}</p>
              </div>
            </div>
            {isCustomer() && (
              <button onClick={() => addToCart(product)} className="w-full py-2 bg-green-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-green-600/20 active:scale-95">Add to Cart</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}