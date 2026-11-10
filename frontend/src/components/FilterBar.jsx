import React from 'react';
import { Search, Filter, X, ChevronDown } from 'lucide-react';
import { useProducts } from '../contexts/ProductContext';

export function FilterBar() {
  const {
    searchTerm, setSearchTerm,
    categoryFilter, setCategoryFilter,
    statusFilter, setStatusFilter,
    categories
  } = useProducts();

  // Helper for status dot colors
  const getStatusColor = (status) => {
    switch (status) {
      case 'Low Stock': return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]';
      case 'Out of Stock': return 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]';
      case 'In Stock': return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]';
      default: return 'bg-green-600 shadow-[0_0_8px_rgba(37,99,235,0.3)]';
    }
  };

  return (
    <div className="w-full sticky top-0 z-30 rounded-2xl glass-light border-b border-zinc-200/50 p-3 transition-all duration-300">
      <div className="max-w-[1600px] mx-auto space-y-3">
        <div className="flex flex-col lg:flex-row gap-2">


          {/* Filters Wrapper */}
          <div className="flex flex-wrap sm:flex-nowrap gap-2">

            {/* Category Select */}
            <div className="relative flex items-center bg-white px-3 py-2 rounded-xl border border-zinc-200 hover:border-zinc-300 focus-within:border-green-600 focus-within:ring-4 focus-within:ring-green-/5 transition-all">
              <Filter className="w-3.5 h-3.5 text-zinc-400 mr-2" />
              <select
                className="appearance-none bg-transparent pr-6 text-[10px] font-black text-zinc-900 uppercase tracking-widest cursor-pointer outline-none"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 w-3 h-3 text-zinc-400 pointer-events-none" />
            </div>

            {/* Status Select */}
            <div className="relative flex items-center bg-white px-3 py-2 rounded-xl border border-zinc-200 hover:border-zinc-300 focus-within:border-green-600 focus-within:ring-4 focus-within:ring-green-/5 transition-all">
              <div className={`w-1.5 h-1.5 rounded-full mr-2.5 ${getStatusColor(statusFilter)} transition-all duration-500`}></div>
              <select
                className="appearance-none bg-transparent pr-6 text-[10px] font-black text-zinc-900 uppercase tracking-widest cursor-pointer outline-none"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Status</option>
                <option value="In Stock">In Stock</option>
                <option value="Low Stock">Low Stock</option>
                <option value="Out of Stock">Out of Stock</option>
              </select>
              <ChevronDown className="absolute right-2.5 w-3 h-3 text-zinc-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Active Filters: Minimalist Badges */}
        {(searchTerm || categoryFilter !== "All" || statusFilter !== "All") && (
          <div className="flex flex-wrap items-center gap-2 pt-2 animate-in fade-in slide-in-from-top-1 duration-300">

            {categoryFilter !== "All" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary text-white text-[9px] font-bold rounded-lg border border-green-600 uppercase tracking-tighter">
                {categoryFilter}
                <X className="w-3 h-3 cursor-pointer hover:text-green-" onClick={() => setCategoryFilter("All")} />
              </span>
            )}

            {statusFilter !== "All" && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-bold rounded-md border uppercase tracking-tighter ${statusFilter === 'Low Stock' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                }`}>
                {statusFilter}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setStatusFilter("All")} />
              </span>
            )}

            <button
              onClick={() => { setSearchTerm(""); setCategoryFilter("All"); setStatusFilter("All"); }}
              className="text-[9px] font-black text-zinc-400 hover:text-rose-500 uppercase tracking-widest transition-colors ml-auto"
            >
              Clear All
            </button>
          </div>
        )}
      </div>
    </div>
  );
}