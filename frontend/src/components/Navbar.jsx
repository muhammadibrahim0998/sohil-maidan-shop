import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, ShoppingCart, Receipt, Download, LogOut, TrendingUp, Menu, Store, Plus } from 'lucide-react';
import { useShift } from '../contexts/ShiftContext';
import { useUser } from '../contexts/UserContext';
import { useSettings } from '../contexts/SettingsContext';
import { useProducts } from '../contexts/ProductContext';
import companyLogo from '../image/logo.png';

export function Navbar({
  isCollapsed,
  onToggleSidebar,
  cartCount,
  onCartClick,
  onAddProduct,
  onNewSale,
  onExport,
  onShiftClick,
  dailySales,
  monthlySales,
  yearlySales,
  dailyProfit,
  monthlyProfit,
  yearlyProfit,
  onMenuClick,
  onSearchToggle,
  user
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentSession } = useShift();
  const { logout, isSuperAdmin, isShopAdmin, isCustomer } = useUser();
  const { settings } = useSettings();
  const { searchTerm, setSearchTerm } = useProducts();
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const fmt = (n) => `${settings.currency || 'Rs.'} ${(n || 0).toLocaleString('en-PK')}`;
  const shopName = settings?.shopName || 'NexFlow';
  const logoUrl = settings?.logoUrl || null;

  return (
    <nav className="sticky top-0 z-50 w-full bg-gradient-to-r from-[#166534] via-[#16a34a] to-[#15803d] backdrop-blur-xl border-b-4 border-b-emerald-500 shadow-[0_15px_50px_rgba(22,101,52,0.4),_0_10px_30px_rgba(34,197,94,0.3)] transition-all duration-300">
      <div className="flex items-center justify-between h-20 gap-2 sm:gap-4 px-4 sm:px-6 max-w-[1600px] mx-auto">

        {/* Left: Branding */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (window.innerWidth >= 768) {
                if (onToggleSidebar) onToggleSidebar();
              } else {
                if (onMenuClick) onMenuClick();
              }
            }}
            className="p-2.5 -ml-2 text-white bg-[#14532d] hover:bg-gradient-to-r hover:from-emerald-500 hover:to-[#14532d] hover:border-t-emerald-300 rounded-xl transition-all duration-300 ease-out shadow-[0_4px_12px_rgba(0,0,0,0.3)] border-t border-t-white/30 border-b-4 border-b-[#0f3d20] hover:scale-110 hover:-translate-y-0.5 active:translate-y-[2px] active:scale-95 cursor-pointer"
            aria-label="Toggle Menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div
            className="flex items-center gap-3 group cursor-pointer"
            onClick={() => {
              if (isSuperAdmin() || isShopAdmin()) {
                navigate('/');
              } else {
                navigate('/shop');
              }
            }}
          >
            <div className="relative bg-white rounded-xl w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center shrink-0 shadow-[0_8px_20px_rgba(37,99,235,0.6),_0_2px_6px_rgba(30,58,138,0.5)] overflow-hidden border-2 border-white/80 ring-2 ring-blue-500/60 group-hover:scale-110 group-hover:rotate-3 group-hover:border-blue-300 group-hover:ring-blue-400 group-hover:shadow-[0_12px_32px_rgba(59,130,246,0.85),_0_4px_12px_rgba(37,99,235,0.7)] transition-all duration-300 ease-out p-0.5">
              {logoUrl ? (
                <img src={logoUrl} alt={shopName} className="w-full h-full object-cover rounded-lg" />
              ) : (
                <img src={companyLogo} alt="Attock Shop" className="w-full h-full object-cover rounded-lg" />
              )}
            </div>
            <div className="hidden md:flex flex-col">
              <h1 className="text-base font-black tracking-tight text-yellow-300 group-hover:text-amber-200 uppercase italic drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] group-hover:drop-shadow-[0_0_12px_rgba(251,191,36,0.8)] leading-none transition-all duration-300">
                {user?.role === 'super_admin' ? 'S-K TRADERS' : (shopName || 'MAIDAN BRANCH').toUpperCase()}
              </h1>
              <span className="text-[9px] font-black text-emerald-300 group-hover:text-emerald-200 uppercase tracking-widest leading-tight mt-1 transition-all duration-300">
                {user?.role === 'super_admin' ? 'SUPER ADMIN' : 'MAIDAN BRANCH'}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 flex justify-center max-w-sm mx-auto">
          <div className="relative w-full group">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (e.target.value && location.pathname.includes('/category/')) {
                  navigate('/store');
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  navigate('/store');
                }
              }}
              placeholder={isSuperAdmin() ? "Search shops..." : "Search inventory..."}
              className="w-full bg-white/95 backdrop-blur-sm rounded-full py-3 flex items-center pl-6 pr-14 text-sm font-black text-gray-900 placeholder:text-gray-500 focus:bg-white focus:ring-4 focus:ring-blue-400/50 hover:bg-white transition-all duration-300 shadow-[inset_0_2px_6px_rgba(0,0,0,0.15),_0_8px_24px_rgba(37,99,235,0.55),_0_2px_8px_rgba(30,58,138,0.4)] hover:shadow-[0_12px_36px_rgba(59,130,246,0.85)] border-b-4 border-blue-600 focus:border-blue-500"
            />
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-[#166534] to-[#14532d] hover:from-emerald-500 hover:to-emerald-700 text-white p-2 rounded-full transition-all duration-300 ease-out shadow-[0_4px_12px_rgba(0,0,0,0.3)] border-t border-t-white/30 border-b-2 border-b-[#0f3d20] hover:scale-115 hover:-rotate-12 active:scale-95 cursor-pointer"
              onClick={() => {
                if (searchTerm) navigate('/store');
              }}
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {!isSuperAdmin() && (
            <>
              <button onClick={onShiftClick} className="hidden sm:flex items-center gap-2.5 px-4 py-2.5 rounded-full border-t border-white/30 hover:border-t-emerald-300 border-b-4 border-b-[#0f3d20] bg-gradient-to-r from-[#166534] to-[#14532d] hover:from-emerald-500 hover:to-[#166534] transition-all duration-300 ease-out shadow-[0_4px_12px_rgba(0,0,0,0.3)] hover:scale-108 hover:-translate-y-0.5 active:translate-y-[2px] cursor-pointer">
                <div className={`w-2.5 h-2.5 rounded-full ${currentSession ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]'}`} />
                <span className="text-xs font-black text-white uppercase tracking-widest">
                  {currentSession?.shiftType || 'No Active Shift'}
                </span>
              </button>

              <div className="h-8 w-px bg-white/30 mx-1 hidden sm:block"></div>

              {(isCustomer() || isShopAdmin() || isSuperAdmin()) && (
                <button
                  onClick={() => {
                    if (onCartClick) onCartClick();
                    else navigate(user?.shopId?._id ? `/shop/${user.shopId._id}` : '/shop');
                  }}
                  className="relative p-3 bg-gradient-to-r from-[#166534] to-[#14532d] hover:from-emerald-500 hover:to-emerald-700 text-white rounded-full transition-all duration-300 ease-out border-t border-white/30 hover:border-t-emerald-200 border-b-4 border-b-[#0f3d20] shadow-[0_4px_12px_rgba(0,0,0,0.3)] hover:scale-115 hover:-translate-y-1 active:scale-95 flex items-center justify-center cursor-pointer"
                  title={isShopAdmin() || isSuperAdmin() ? "View Customer Sale & POS Bill Cart" : "View Shopping Cart"}
                >
                  {(isShopAdmin() || isSuperAdmin()) ? (
                    <Receipt className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <ShoppingCart className="w-5 h-5 shadow-sm" />
                  )}
                  {cartCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-yellow-400 text-black text-[10px] font-black h-5.5 w-5.5 rounded-full flex items-center justify-center border-2 border-[#14532d] shadow-[0_3px_8px_rgba(0,0,0,0.5)] animate-bounce">
                      {cartCount}
                    </span>
                  )}
                </button>
              )}
            </>
          )}

          <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-white/30 ml-1 h-12">
            <div className="hidden md:flex flex-col items-end justify-center group cursor-pointer">
              <span className="text-sm font-black text-white italic leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] group-hover:text-emerald-300 transition-colors duration-300">{user?.fullName}</span>
              <span className="text-[10px] font-black text-emerald-300 uppercase tracking-widest mt-1">{user?.role?.replace('_', ' ')}</span>
            </div>
            <button onClick={logout} className="p-3 bg-gradient-to-r from-[#166534] to-[#14532d] hover:from-rose-600 hover:to-rose-900 text-white rounded-full transition-all duration-300 ease-out border-t border-white/30 hover:border-t-rose-300 border-b-4 border-b-[#0f3d20] hover:border-b-rose-950 shadow-[0_8px_18px_rgba(0,0,0,0.5)] hover:shadow-[0_12px_28px_rgba(244,63,94,0.7)] hover:scale-115 hover:-translate-y-1 active:scale-95 cursor-pointer">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}