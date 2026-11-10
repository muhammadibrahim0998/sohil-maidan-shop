import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useProducts } from '../contexts/ProductContext';
import { AnalyticsCards } from '../components/AnalyticsCards';
import { RevenueCards } from '../components/RevenueCards';
import { InventoryTable } from '../components/InventoryTable';
import { SalesHistory } from '../components/SalesHistory';
import { LowStockBanner } from '../components/LowStockBanner';
import { TeamManagement } from '../components/TeamManagement';
import { ShiftHistory } from '../components/ShiftHistory';
import { OrdersManagement } from '../components/OrdersManagement';
import { useUser } from '../contexts/UserContext';
import { Users, LayoutDashboard, Plus, History, Package, Truck } from 'lucide-react';
import { IntelligenceFeed } from '../components/IntelligenceFeed';
import { UpdateBanner } from '../components/UpdateBanner';
import { TopSellingProducts } from '../components/TopSellingProducts';
import { SalesSummaryCard } from '../components/SalesSummaryCard';
import { SupplierPurchaseSummaryCard } from '../components/SupplierPurchaseSummaryCard';
import { ProfitLossSummaryCard } from '../components/ProfitLossSummaryCard';
import { PurchasesManagement } from '../components/PurchasesManagement';
import { RecentPurchasesAndSalesCard } from '../components/RecentPurchasesAndSalesCard';
import { PurchasedVsSoldStockCard } from '../components/PurchasedVsSoldStockCard';
import { PurchasedProductsLedgerCard } from '../components/PurchasedProductsLedgerCard';

export function ShopAdminDashboard({
  onAddProduct, onEditProduct, onDeleteProduct, onViewProduct, onExport,
  onEditSale, onDeleteSale, onReturnSale, onViewSale,
  dailySales, monthlySales, yearlySales, totalRevenue, dailyProfit, monthlyProfit, yearlyProfit
}) {
  const [activeTab, setTab] = useState(() => sessionStorage.getItem('shopAdminTab') || 'inventory');
  const setActiveTab = (tab) => {
    setTab(tab);
    sessionStorage.setItem('shopAdminTab', tab);
  };
  const { user, isShopAdmin } = useUser();
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [secondsAgo, setSecondsAgo] = useState(0);

  const {
    products, loading,
    sales, getStockStatus
  } = useProducts();

  // Update "last updated" timestamp whenever sales or products change
  useEffect(() => {
    setLastUpdated(new Date());
    setSecondsAgo(0);
  }, [sales, products]);

  // Tick every second for the "X seconds ago" display
  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsAgo(Math.floor((new Date() - lastUpdated) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  const [checkoutOrders, setCheckoutOrders] = useState([]);

  useEffect(() => {
    api.get('/customers/all')
      .then(res => {
        if (res.data?.count !== undefined) {
          setTotalCustomers(res.data.count);
        }
      })
      .catch(() => {});

    // Also fetch EasyPaisa/checkout orders for combined revenue
    api.get('/checkout/orders')
      .then(res => {
        if (res.data?.orders) {
          setCheckoutOrders(res.data.orders);
        }
      })
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 bg-[var(--color-background)] min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  // ─── Calculate top level sums ───────────────────────────────────────
  const totalValue = products.reduce((sum, product) => sum + (product.price * product.stock), 0);
  const totalStockEggs = products.reduce((sum, product) => sum + (product.stock || 0), 0);
  const totalPetis = products.reduce((sum, product) => sum + (product.petiQuantity || ((product.stock || 0) / 360)), 0);

  // Combine POS sales + EasyPaisa checkout orders
  const validOrders = checkoutOrders.filter(o => o.paymentStatus !== 'FAILED');
  const totalSalesCount = sales.length + validOrders.length;

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-8 animate-in fade-in duration-700 bg-[var(--color-background)] min-h-screen text-[var(--color-text-primary)]">

      {/* Premium Update Banner */}
      <UpdateBanner />

      {/* Main Overview Section - Upgraded with @container and Premium Tokens */}
      <div className="@container mb-10 flex flex-col @md:flex-row @md:items-center justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            {/* The "Branding" accent bar */}
            <div className="w-2.5 h-12 bg-[var(--color-primary)] rounded-full shadow-sm"></div>
            <h2 className="text-4xl @lg:text-5xl font-black tracking-tighter leading-none text-[var(--color-text-primary)]">
              Business Overview
            </h2>
          </div>
          <p className="text-[var(--color-text-secondary)] font-bold pl-6 max-w-2xl leading-relaxed text-sm uppercase tracking-tight">
            Real-time summary of your inventory health, sales performance, and recent activity levels.
          </p>
        </div>
        {/* LIVE indicator */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest shadow-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-600"></span>
            </span>
            Live Data
          </div>
          <p className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-widest">
            {secondsAgo === 0 ? 'Updated just now' : `Updated ${secondsAgo}s ago`} · Auto-refresh every 8s
          </p>
        </div>
      </div>

      {/* Tab Switcher & Actions - Upgraded with Glassmorphism feel */}
      {(isShopAdmin() || isSuperAdmin()) && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10 w-full animate-in slide-in-from-left-4">
          <div className="flex items-center gap-2 bg-[var(--color-surface-card)] p-2 rounded-xl border border-[var(--color-border-subtle)] shadow-sm overflow-x-auto w-full md:w-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center gap-2.5 px-6 py-2.5 rounded-[1.25rem] font-black text-[10px] uppercase tracking-[0.15em] transition-all ${activeTab === 'inventory'
                ? 'bg-green-600 text-[var(--color-text-primary)] shadow-sm'
                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Inventory & Sales
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`flex items-center gap-2.5 px-6 py-2.5 rounded-[1.25rem] font-black text-[10px] uppercase tracking-[0.15em] transition-all ${activeTab === 'team'
                ? 'bg-green-600 text-[var(--color-text-primary)] shadow-sm'
                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
            >
              <Users className="w-3.5 h-3.5" />
              Team Management
            </button>
            <button
              onClick={() => setActiveTab('shifts')}
              className={`flex items-center gap-2.5 px-6 py-2.5 rounded-[1.25rem] font-black text-[10px] uppercase tracking-[0.15em] transition-all ${activeTab === 'shifts'
                ? 'bg-green-600 text-[var(--color-text-primary)] shadow-sm'
                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
            >
              <History className="w-3.5 h-3.5" />
              Shift Records
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`flex items-center gap-2.5 px-6 py-2.5 rounded-[1.25rem] font-black text-[10px] uppercase tracking-[0.15em] transition-all ${activeTab === 'orders'
                ? 'bg-green-600 text-[var(--color-text-primary)] shadow-sm'
                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
            >
              <Package className="w-3.5 h-3.5" />
              EasyPaisa & Customer Orders
            </button>
            <button
              onClick={() => setActiveTab('purchases')}
              className={`flex items-center gap-2.5 px-6 py-2.5 rounded-[1.25rem] font-black text-[10px] uppercase tracking-[0.15em] transition-all ${activeTab === 'purchases'
                ? 'bg-green-600 text-[var(--color-text-primary)] shadow-sm'
                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
            >
              <Truck className="w-3.5 h-3.5" />
              Purchases Ledger
            </button>
          </div>

          <button
            onClick={onAddProduct}
            className="btn-primary flex justify-center items-center gap-3 px-8 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] transition-all whitespace-nowrap w-full sm:w-auto self-start sm:self-auto group"
          >
            <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
            Add Product
          </button>
        </div>
      )}

      {/* Logic Branching (Kept exactly as provided) */}
      {activeTab === 'team' && isShopAdmin() ? (
        <TeamManagement />
      ) : activeTab === 'shifts' && isShopAdmin() ? (
        <ShiftHistory />
      ) : activeTab === 'orders' && isShopAdmin() ? (
        <OrdersManagement />
      ) : activeTab === 'purchases' && isShopAdmin() ? (
        <PurchasesManagement
          products={products}
          sales={sales}
          shopId={user?.shopId}
          onAddProduct={onAddProduct}
          onEditProduct={onEditProduct}
          onDeleteProduct={onDeleteProduct}
          onViewProduct={onViewProduct}
        />
      ) : (
        <>
          {/* ShopAdmin Financial Profit & Loss & Investment Ledger */}
          <ProfitLossSummaryCard sales={sales} products={products} checkoutOrders={checkoutOrders} />
          <RevenueCards
            dailySales={dailySales}
            monthlySales={monthlySales}
            yearlySales={yearlySales}
            totalRevenue={totalRevenue}
            dailyProfit={dailyProfit}
            monthlyProfit={monthlyProfit}
            yearlyProfit={yearlyProfit}
          />

          {/* Sales & Payment Summary — Live from DB */}
          <SalesSummaryCard sales={sales} checkoutOrders={checkoutOrders} />

          {/* Purchased Petis/Trays vs Sold Petis/Trays Analytics Card */}
          <PurchasedVsSoldStockCard products={products} sales={sales} checkoutOrders={checkoutOrders} />

          {/* Purchased Products & Cost Price Ledger Table Card */}
          <PurchasedProductsLedgerCard
            products={products}
            onAddProduct={onAddProduct}
            onEditProduct={onEditProduct}
            onDeleteProduct={onDeleteProduct}
            onViewProduct={onViewProduct}
          />

          {/* Supplier Inventory Purchases & Payments Breakdown */}
          <SupplierPurchaseSummaryCard products={products} />

          {/* Live Recent Purchased Products vs Sales Revenue */}
          <RecentPurchasesAndSalesCard products={products} sales={sales} checkoutOrders={checkoutOrders} />

          <IntelligenceFeed products={products} />

          <AnalyticsCards
            totalProducts={products.length}
            totalValue={totalValue}
            lowStockProducts={products.filter(p => p.stock > 0 && p.stock <= p.minStock)}
            outOfStockProducts={products.filter(p => p.stock === 0)}
            totalStockUnits={totalStockEggs}
            totalCustomers={totalCustomers}
            totalSalesCount={totalSalesCount}
            totalPetis={Number(totalPetis.toFixed(1))}
          />


          {/* Top Selling Products - Dynamic from DB */}
          <div className="mt-10">
            <div className="flex items-center gap-3 px-2 mb-6">
              <div className="w-2 h-7 bg-amber-500/30 rounded-full"></div>
              <h3 className="text-2xl font-black text-[var(--color-text-primary)] uppercase tracking-[0.2em]">Top Selling Products</h3>
            </div>
            <TopSellingProducts sales={sales} products={products} />
          </div>

          {/* Vertical Stack: Table & Activity - Upgraded spacing and card containers */}
          <div className="flex flex-col gap-12 mt-10">

            {/* Inventory Table Section */}
            <section id="inventory-table" className="w-full space-y-6">
              <div className="flex items-center gap-3 px-2">
                <div className="w-2 h-7 bg-green-600/30 rounded-full"></div>
                <h3 className="text-2xl font-black text-[var(--color-text-primary)] uppercase tracking-[0.2em]">Global Inventory</h3>
              </div>
              <div className="rich-card overflow-hidden">
                <InventoryTable
                  onEdit={onEditProduct}
                  onDelete={onDeleteProduct}
                  onView={onViewProduct}
                  onExport={onExport}
                />
              </div>
            </section>

            {/* Recent Activity Section */}
            <section className="w-full space-y-6">
              <div className="flex items-center justify-between px-2">
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-[var(--color-text-primary)] uppercase tracking-[0.2em]">Recent Shop Activity</h3>
                  <p className="text-[10px] text-green-600 font-black tracking-[0.4em] uppercase">SYNCED WITH CLOUD</p>
                </div>
              </div>
              <div className="rich-card overflow-hidden">
                <SalesHistory
                  sales={sales}
                  handleDeleteSale={onDeleteSale}
                  openEditSaleModal={onEditSale}
                  onReturnSale={onReturnSale}
                  onViewSale={onViewSale}
                  onExport={onExport}
                />
              </div>
            </section>
          </div>
        </>
      )}

    </div>
  );
}
