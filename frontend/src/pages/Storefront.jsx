import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProducts } from '../contexts/ProductContext';
import { FilterBar } from '../components/FilterBar';
import { ProductCard } from '../components/ProductCard';
import { Plus } from 'lucide-react';
import { useUser } from '../contexts/UserContext';

export function Storefront({ onAdd, onEdit, onDelete, onView }) {
  const { category, status } = useParams();
  const navigate = useNavigate();
  const { user, isShopAdmin } = useUser();
  const {
    filteredProducts,
    setCategoryFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    loading
  } = useProducts();

  // Sync URL params with global context filters automatically
  useEffect(() => {
    if (category) {
      setCategoryFilter(category);
      setStatusFilter("All"); // Reset status if category clicked
    } else if (status) {
      setCategoryFilter("All");
      setStatusFilter(status === "low" ? "Low Stock" : status === "out" ? "Out of Stock" : "All");
    } else {
      // Base /store page
      setCategoryFilter("All");
      setStatusFilter("All");
    }

    // Cleanup if leaving store
    return () => {
      setCategoryFilter("All");
      setStatusFilter("All");
    };
  }, [category, status, setCategoryFilter, setStatusFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full mx-auto px-4 py-4">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-2 h-7 bg-green-500 rounded-full shadow-[0_0_10px_rgba(22,163,74,0.5)]"></div>
            <h2 className="text-2xl font-black text-[var(--color-text-primary)] tracking-tighter capitalize leading-none">
              {category ? `${category}` : status ? `${status}` : "Master Catalog"}
            </h2>
          </div>
          <p className="text-[12px] text-[var(--color-text-secondary)] font-bold pl-5 uppercase tracking-wider">Manage stock and add items to sales cart.</p>
        </div>
        {(isShopAdmin() || isSuperAdmin()) && (
          <button
            onClick={() => onAdd(category || null)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-[var(--color-text-primary)] rounded-xl text-xs font-bold shadow-xl shadow-[var(--color-primary)]/20 transition-all active:scale-95 w-full md:w-auto justify-center uppercase tracking-tight cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            ADD NEW PRODUCT
          </button>
        )}
      </div>

      <div className="bg-surface-card rounded-2xl border border-[var(--color-border-subtle)] shadow-2xl mb-4">
        <FilterBar />
      </div>

      {filteredProducts.length === 0 ? (
        <div className="text-center py-20 bg-surface-card rounded-3xl border border-[var(--color-border-subtle)] shadow-2xl mt-6">
          <p className="text-[var(--color-text-secondary)] font-bold mb-2">
            {searchTerm ? `No results found for "${searchTerm}"` : "No products match your criteria."}
          </p>
          <div className="flex flex-col items-center gap-4 mt-4">
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="text-xs font-black uppercase tracking-widest text-green-600 hover:text-green-700 transition-colors"
              >
                Clear Search Term
              </button>
            )}
            <button
              onClick={() => navigate('/store')}
              className="text-xs font-black uppercase tracking-widest text-[var(--color-text-secondary)] hover:text-rose-500 transition-colors"
            >
              Show All Products
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mt-2">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              onEdit={onEdit}
              onDelete={onDelete}
              onView={onView}
            />
          ))}
        </div>
      )}
    </div>
  );
}
