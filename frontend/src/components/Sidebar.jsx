import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useProducts } from '../contexts/ProductContext';
import { useUser } from '../contexts/UserContext';
import {
  LayoutDashboard,
  Store,
  AlertTriangle,
  XCircle,
  Settings,
  Users,
  LogOut,
  HelpCircle,
  Moon,
  Sun,
  Menu,
  UserCircle2,
  // Category Icons
  ShoppingBasket,
  Shirt,
  Home,
  Watch,
  Smartphone,
  Layers,
  Footprints,
  Building2,
  Package,
  Search,
  Truck,
  Receipt,
  ShieldCheck
} from 'lucide-react';
import { useTheme } from 'next-themes';
import companyLogo from '../image/logo.png';

export function Sidebar({ isMobileOpen, onCloseMobile, isCollapsed, onToggleSidebar }) {
  const { categories } = useProducts();
  const { user, isSuperAdmin, isShopAdmin, isPageAllowed, logout } = useUser();
  const location = useLocation();
  const { theme, setTheme } = useTheme();

  // Default theme handles hydration, ensure window is defined
  const currentTheme = theme === 'system' && typeof window !== 'undefined'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  const isActive = (path) => location.pathname === path;

  const handleLinkClick = () => {
    if (window.innerWidth < 768 && onCloseMobile) {
      onCloseMobile();
    }
  };

  // Helper to get category-specific icon
  const getCategoryIcon = (category) => {
    const cat = category.toLowerCase();
    if (cat.includes('grocery')) return ShoppingBasket;
    if (cat.includes('apparel') || cat.includes('cloth')) return Shirt;
    if (cat.includes('home') || cat.includes('decor')) return Home;
    if (cat.includes('accessories')) return Watch;
    if (cat.includes('electronic') || cat.includes('tech')) return Smartphone;
    if (cat.includes('footwear') || cat.includes('shoe')) return Footprints;
    if (cat.includes('package') || cat.includes('acc')) return Package;
    return Layers;
  };

  const NavItem = ({ to, icon: Icon, label, alert = false, onClick }) => {
    const active = isActive(to);

    return (
      <Link
        to={to}
        onClick={(e) => {
          handleLinkClick();
          if (onClick) onClick(e);
        }}
        className={`flex items-center group px-3.5 py-2.5 mx-3 rounded-xl text-[13.5px] font-black tracking-wide transition-all duration-200 ease-out cursor-pointer ${active
          ? "bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 text-zinc-950 font-black border-t-2 border-t-amber-200 border-x border-x-amber-600 border-b-4 border-b-amber-900 shadow-[0_6px_20px_rgba(245,158,11,0.6),inset_0_1px_0_rgba(255,255,255,0.5)] translate-x-1.5 scale-[1.02]"
          : "bg-gradient-to-b from-[#186337] to-[#0e3f21] text-white font-black border-t-2 border-t-white/35 border-x border-x-emerald-600/40 border-b-4 border-b-[#072513] shadow-[0_4px_10px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.22)] hover:bg-gradient-to-r hover:from-amber-400 hover:via-amber-500 hover:to-yellow-400 hover:text-zinc-950 hover:border-t-2 hover:border-t-amber-200 hover:border-x hover:border-x-amber-600 hover:border-b-4 hover:border-b-amber-900 hover:shadow-[0_8px_22px_rgba(245,158,11,0.65),inset_0_1px_0_rgba(255,255,255,0.5)] hover:translate-x-2 hover:scale-[1.03] active:translate-y-1 active:border-b-2"
          } ${isCollapsed ? 'justify-center mx-auto w-10 h-10 px-0' : 'gap-3'}`}
        title={isCollapsed ? label : undefined}
      >
        <div className="relative flex items-center justify-center">
          <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${active ? "text-zinc-950" : "text-emerald-300 group-hover:text-zinc-950"}`} />
          {alert && (
            <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-[#111827] ${alert === 'low' ? 'bg-amber-400' : 'bg-red-500'}`}></div>
          )}
        </div>
        <span className={`flex-1 whitespace-nowrap tracking-wide font-black ${active ? 'text-zinc-950' : 'text-white group-hover:text-zinc-950 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.95)]'} ${isCollapsed ? 'hidden' : ''}`}>{label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`absolute md:relative top-0 h-full flex flex-col bg-gradient-to-b from-[#15803d] via-[#16a34a] to-[#166534] text-white backdrop-blur-xl transition-[transform,width] duration-300 ease-[cubic-bezier(0.4,0,0,2,1)] transform-gpu will-change-transform border-r-4 border-r-emerald-500/40 z-[100] md:z-20 overflow-hidden shadow-[18px_0_50px_rgba(22,101,52,0.4),_10px_0_30px_rgba(34,197,94,0.3)] ${isCollapsed ? 'w-16' : 'w-56'
          } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >

        {/* User Profile - 3D Shape */}
        <div className={`mx-3 mt-3 mb-3 rounded-2xl flex items-center ${isCollapsed ? 'justify-center mx-auto w-10 h-10' : 'px-3 py-2.5 gap-3'} bg-gradient-to-b from-[#186337] to-[#0e3f21] border-t-2 border-t-white/40 border-x border-x-emerald-500/40 border-b-4 border-b-[#072513] shadow-[0_6px_14px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.3)] transition-all duration-300`}>
          <div className="relative shrink-0">
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#072513] rounded-full shadow-md animate-pulse"></div>
            <div className="p-1 rounded-xl bg-black/25 border border-white/20 shadow-inner">
              <UserCircle2 className="w-6 h-6 text-emerald-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
            </div>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col flex-1 overflow-hidden min-w-0">
              <span className="text-xs font-black text-white truncate leading-tight drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.95)]" title={user?.fullName || user?.username || 'User'}>
                {user?.fullName || user?.username || 'System User'}
              </span>
              <span className="text-[9px] font-black text-amber-300 uppercase tracking-widest mt-0.5 truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] bg-black/35 px-1.5 py-0.5 rounded-md w-fit border border-amber-400/30">
                {user?.role?.replace('_', ' ') || "Staff"}
              </span>
            </div>
          )}
        </div>


        {/* Navigation Main Block */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide py-1">

          <div className="mb-2">
            <div className="space-y-0.5">
              {/* Dashboard */}
              {(isSuperAdmin() || (isShopAdmin() && isPageAllowed('dashboard'))) && (
                <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
              )}

              {/* All Products */}
              {!isSuperAdmin() && isPageAllowed('store') && (
                <NavItem to="/store" icon={Store} label="All Products" />
              )}

              {/* Only Shop Admin can view purchases */}
              {isShopAdmin() && isPageAllowed('purchases') && (
                <NavItem to="/purchases" icon={Truck} label="Purchases" />
              )}

              {/* Vendors / Suppliers Management (Shop Admin only) */}
              {isShopAdmin() && isPageAllowed('vendors') && (
                <NavItem to="/vendors" icon={Building2} label="Vendors (Ledger)" />
              )}
              {isShopAdmin() && isPageAllowed('vendorDirectory') && (
                <NavItem to="/vendor-directory" icon={Building2} label="Vendor Profiles (Add/Remove)" />
              )}

              {/* Customer & Vendor Payment Ledgers */}
              {!isSuperAdmin() && isPageAllowed('customerPaymentLedger') && (
                <NavItem to="/customer-payment-ledger" icon={Users} label="Customer Payment Ledger" />
              )}
              {!isSuperAdmin() && isPageAllowed('vendorPaymentLedger') && (
                <NavItem to="/vendor-payment-ledger" icon={Truck} label="Vendor Payment Ledger" />
              )}

              {/* Only Shop Admin & Super Admin can manage teams */}
              {(isSuperAdmin() || (isShopAdmin() && isPageAllowed('team'))) && (
                <NavItem to="/team" icon={Users} label="Team Management" />
              )}

              {/* Super Admin only: Role Permissions */}
              {isSuperAdmin() && (
                <NavItem to="/role-permissions" icon={ShieldCheck} label="Role Permissions" />
              )}
            </div>
          </div>

          {/* Categories Section */}
          {!isSuperAdmin() && isPageAllowed('store') && categories.filter(c => c !== "All").length > 0 && (
            <div className="mb-2">
              {!isCollapsed && (
                <p className="px-5 text-[10px] font-black text-emerald-300/70 mb-1 tracking-widest uppercase">Categories</p>
              )}
              <div className="space-y-0.5">
                {categories.filter(c => c !== "All").map(cat => {
                  const active = isActive(`/store/category/${cat}`);
                  return (
                    <Link
                      key={cat}
                      to={`/store/category/${cat}`}
                      onClick={handleLinkClick}
                      className={`flex items-center group px-3 py-1.5 mx-3 rounded-xl text-xs font-black italic tracking-wide transition-all duration-300 ease-out ${active
                        ? "bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 text-zinc-950 border-t border-t-amber-200 border-b-4 border-b-amber-800 shadow-[0_8px_22px_rgba(245,158,11,0.6)] translate-x-1"
                        : "text-white hover:text-zinc-950 hover:bg-gradient-to-r hover:from-amber-500 hover:to-amber-600 border-t border-t-transparent hover:border-t-amber-200 border-b-4 border-b-transparent hover:border-b-amber-800 hover:shadow-[0_8px_22px_rgba(245,158,11,0.6)] hover:translate-x-1.5 hover:scale-105"
                        } ${isCollapsed ? 'justify-center mx-auto w-10 h-10 px-0' : 'gap-3'}`}
                      title={isCollapsed ? cat : undefined}
                    >
                      <div className="relative flex items-center justify-center w-4 h-4">
                        {(() => {
                          const CategoryIcon = getCategoryIcon(cat);
                          return <CategoryIcon className={`w-4 h-4 transition-colors duration-300 ${active ? "text-zinc-950" : "text-white group-hover:text-zinc-950"}`} />;
                        })()}
                      </div>
                      {!isCollapsed && <span className="capitalize whitespace-nowrap tracking-wide">{cat}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Health / Notifications like in image */}
          {!isSuperAdmin() && isPageAllowed('store') && (
            <div className="mb-2">
              {!isCollapsed && (
                <p className="px-5 text-[10px] font-black text-emerald-300/70 mb-1 tracking-widest uppercase">Notifications</p>
              )}
              <div className="space-y-0.5">
                <NavItem to="/store/status/low" icon={AlertTriangle} label="Low Stock" alert="low" />
                <NavItem to="/store/status/out" icon={XCircle} label="Out of Stock" alert="high" />
              </div>
            </div>
          )}

          {/* Settings / Footer Area - now part of the scroll flow */}
          <div className="pb-3 pt-2 border-t border-white/10 mt-2 mx-3">
            {!isCollapsed && (
              <p className="px-5 text-[10px] font-black text-emerald-300/70 mb-1 tracking-widest uppercase">Settings</p>
            )}

            <div className="space-y-0.5">
              <NavItem to="/help" icon={HelpCircle} label="Help" />
              {(isSuperAdmin() || (isShopAdmin() && isPageAllowed('settings'))) && (
                <NavItem to="/settings" icon={Settings} label="Settings" />
              )}
              <NavItem to="#" icon={LogOut} label="Logout" onClick={logout} />
            </div>

          </div>
        </div>
      </aside>
    </>
  );
}
