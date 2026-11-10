import React, { useState, useMemo, useEffect } from 'react';
import {
  Wallet,
  DollarSign,
  Building2,
  CreditCard,
  Truck,
  Users,
  Search,
  Filter,
  Calendar,
  Printer,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Package,
  Layers,
  Banknote,
  Receipt,
  ChevronRight,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import api, { getPaymentLedger, getPurchaseCredits, getCustomerCredits } from '../services/api';
import { useProducts } from '../contexts/ProductContext';
import { useUser } from '../contexts/UserContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function PaymentLedger({ shopId: propShopId }) {
  const { user, isShopAdmin, isSuperAdmin } = useUser();
  const { sales = [], products = [], fetchData } = useProducts();

  // Local state
  const [activeTab, setActiveTab] = useState('customers'); // 'customers' | 'suppliers' | 'cashbank' | 'vendorledger' | 'customerledger'
  const [expandedVendors, setExpandedVendors] = useState({});
  const [expandedCustomers, setExpandedCustomers] = useState({});
  const [dateFilter, setDateFilter] = useState('ALL'); // 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('ALL'); // 'ALL' | 'CASH' | 'BANK' | 'SPLIT' | 'CREDIT'
  const [checkoutOrders, setCheckoutOrders] = useState([]);
  const [customerCredits, setCustomerCredits] = useState([]);
  const [purchaseCredits, setPurchaseCredits] = useState([]);
  const [loadingExtra, setLoadingExtra] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const activeShopId = propShopId || (user?.shopId ? (typeof user.shopId === 'object' ? (user.shopId._id || user.shopId.id) : String(user.shopId)) : null);

  // Dynamic Ledger data fetched straight from the API
  const [ledgerApiData, setLedgerApiData] = useState({
    summary: null,
    sales: [],
    purchases: []
  });
  const [loadingLedger, setLoadingLedger] = useState(true);

  const loadLedgerData = async () => {
    setLoadingLedger(true);
    try {
      const res = await getPaymentLedger(activeShopId);
      if (res && res.success) {
        setLedgerApiData({
          summary: res.summary || null,
          sales: Array.isArray(res.sales) ? res.sales : [],
          purchases: Array.isArray(res.purchases) ? res.purchases : []
        });
      }
    } catch (err) {
      console.error('Error loading dynamic payment ledger:', err);
    } finally {
      setLoadingLedger(false);
    }
  };

  useEffect(() => {
    loadLedgerData();
  }, [activeShopId]);

  // Load auxiliary data (checkout orders, customer credits, purchase credits)
  const loadAuxData = async () => {
    setLoadingExtra(true);
    try {
      const [ordersRes, ccRes, pcRes] = await Promise.allSettled([
        api.get('/checkout/orders'),
        getCustomerCredits(activeShopId),
        getPurchaseCredits(activeShopId)
      ]);

      if (ordersRes.status === 'fulfilled' && ordersRes.value.data?.orders) {
        setCheckoutOrders(ordersRes.value.data.orders);
      }
      if (ccRes.status === 'fulfilled' && Array.isArray(ccRes.value)) {
        setCustomerCredits(ccRes.value);
      }
      if (pcRes.status === 'fulfilled' && Array.isArray(pcRes.value)) {
        setPurchaseCredits(pcRes.value);
      }
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Error loading ledger extra data:', err);
    } finally {
      setLoadingExtra(false);
    }
  };

  useEffect(() => {
    loadAuxData();
  }, [activeShopId]);

  const handleRefresh = async () => {
    if (fetchData) await fetchData();
    await Promise.allSettled([loadAuxData(), loadLedgerData()]);
  };

  // Helper formatting currency
  const fmt = (num) => Number(num || 0).toLocaleString('en-PK');

  const parseSafeDate = (val) => {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    if (typeof val === 'number') {
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }
    const str = String(val).trim();
    if (!str) return null;
    const isoStr = str.includes(' ') && !str.includes('T') ? str.replace(' ', 'T') : str;
    let d = new Date(isoStr);
    if (!isNaN(d.getTime())) return d;
    const m = str.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) {
      d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  };

  // Date Range filter helper
  const isInDateRange = (itemDate) => {
    if (!itemDate) return true;
    const date = parseSafeDate(itemDate);
    if (!date) return true;

    const now = new Date();
    if (dateFilter === 'ALL') return true;

    if (dateFilter === 'TODAY') {
      const today = new Date();
      return (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      );
    }

    if (dateFilter === 'WEEK') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      return date >= oneWeekAgo && date <= now;
    }

    if (dateFilter === 'MONTH') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return date >= startOfMonth && date <= now;
    }

    if (dateFilter === 'CUSTOM') {
      const pad = (n) => String(n).padStart(2, '0');
      const localYMD = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      const utcYMD = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

      let startTs = null;
      if (startDate) {
        const parts = startDate.split('-').map(Number);
        if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
          startTs = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0).getTime();
        }
      }
      let endTs = null;
      if (endDate) {
        const parts = endDate.split('-').map(Number);
        if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
          endTs = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999).getTime();
        }
      }

      const itemTs = date.getTime();

      if (startDate && endDate) {
        const inStr = (localYMD >= startDate && localYMD <= endDate) ||
                      (utcYMD >= startDate && utcYMD <= endDate);
        const inTs = (startTs !== null && itemTs >= startTs) && (endTs !== null && itemTs <= endTs);
        return inStr || inTs;
      }
      if (startDate) {
        const inStr = localYMD >= startDate || utcYMD >= startDate;
        const inTs = startTs !== null && itemTs >= startTs;
        return inStr || inTs;
      }
      if (endDate) {
        const inStr = localYMD <= endDate || utcYMD <= endDate;
        const inTs = endTs !== null && itemTs <= endTs;
        return inStr || inTs;
      }
      return true;
    }

    return true;
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Process Customer Sales Ledger List
  // ──────────────────────────────────────────────────────────────────────────
  const customerLedgerList = useMemo(() => {
    const rawList = (ledgerApiData.sales && ledgerApiData.sales.length > 0)
      ? ledgerApiData.sales
      : (sales || []);

    return (rawList || [])
      .filter(s => s && s.status !== 'cancelled')
      .map(s => {
        const total = Number(s.totalAmount) || 0;
        let cash = Number(s.cashPaid) || 0;
        let bank = Number(s.bankPaid) || 0;
        let due = Number(s.dueAmount) || 0;
        const pMethod = String(s.paymentMethod || 'CASH').toUpperCase();

        // If breakdown fields weren't explicitly stored, infer from paymentMethod
        if (cash === 0 && bank === 0 && due === 0) {
          if (pMethod === 'CASH') cash = total;
          else if (pMethod.includes('BANK') || pMethod.includes('ONLINE') || pMethod.includes('EASYPAISA')) bank = total;
          else if (pMethod.includes('CREDIT') || pMethod.includes('DUE')) due = total;
          else cash = total;
        }

        // Calculate total petis / eggs bought in this transaction
        let totalPetisBought = Number(s.petisBought) || 0;
        let totalEggsBought = Number(s.eggsBought) || 0;
        let itemsSummary = s.itemsDescription ? [s.itemsDescription] : [];

        if (totalPetisBought === 0 && Array.isArray(s.items)) {
          itemsSummary = [];
          s.items.forEach(it => {
            const qty = Number(it.quantity) || 1;
            const uType = it.unit || it.unitType || 'peti';
            let petiCount = 0;
            let eggCount = 0;

            if (uType === 'peti') {
              petiCount = qty;
              eggCount = qty * 360;
            } else if (uType === 'tray') {
              petiCount = qty / 12;
              eggCount = qty * 30;
            } else {
              petiCount = qty / 360;
              eggCount = qty;
            }

            if (Number(it.petiQuantity) > 0) {
              petiCount = Number(it.petiQuantity);
            }
            if (Number(it.totalEggs) > 0) {
              eggCount = Number(it.totalEggs);
            }

            totalPetisBought += petiCount;
            totalEggsBought += eggCount;
            itemsSummary.push(`${it.name || it.rawProductName || 'Eggs'} (${qty} ${uType})`);
          });
        }

        return {
          id: s._id || s.id,
          date: s.saleDate || s.date || s.createdAt,
          invoiceNumber: s.invoiceNumber || `INV-${String(s.serialNumber || s.id).slice(-5)}`,
          customerName: s.customerName || (due > 0 ? 'Credit Customer' : 'Walk-in Customer'),
          customerPhone: s.customerPhone || '',
          totalAmount: total,
          cashPaid: cash,
          bankPaid: bank,
          dueAmount: due,
          paymentMethod: pMethod,
          petisBought: totalPetisBought > 0 ? Number(totalPetisBought.toFixed(2)) : 0,
          eggsBought: Math.round(totalEggsBought),
          itemsDescription: itemsSummary.join(', ') || 'Eggs Stock',
          isCredit: due > 0 || pMethod.includes('CREDIT')
        };
      })
      .filter(item => isInDateRange(item.date))
      .filter(item => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (
          item.customerName.toLowerCase().includes(q) ||
          item.customerPhone.toLowerCase().includes(q) ||
          item.invoiceNumber.toLowerCase().includes(q) ||
          item.itemsDescription.toLowerCase().includes(q)
        );
      })
      .filter(item => {
        if (paymentMethodFilter === 'ALL') return true;
        if (paymentMethodFilter === 'CASH') return item.cashPaid > 0 && item.bankPaid === 0 && item.dueAmount === 0;
        if (paymentMethodFilter === 'BANK') return item.bankPaid > 0 && item.cashPaid === 0 && item.dueAmount === 0;
        if (paymentMethodFilter === 'SPLIT') return (item.cashPaid > 0 && item.bankPaid > 0) || (item.dueAmount > 0 && (item.cashPaid > 0 || item.bankPaid > 0));
        if (paymentMethodFilter === 'CREDIT') return item.dueAmount > 0;
        return true;
      })
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [ledgerApiData.sales, sales, dateFilter, startDate, endDate, searchTerm, paymentMethodFilter]);

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Process Supplier Purchases & Credit List
  // ──────────────────────────────────────────────────────────────────────────
  const supplierLedgerList = useMemo(() => {
    // If backend provided live purchases list from DB, use it
    if (ledgerApiData.purchases && ledgerApiData.purchases.length > 0) {
      return ledgerApiData.purchases
        .map(p => ({
          id: p.id,
          date: p.date,
          supplierName: p.supplierName || 'Farm Vendor',
          supplierPhone: p.supplierPhone || '',
          supplierLocation: p.supplierLocation || '',
          productName: p.productName || 'Eggs Stock',
          petisPurchased: Number(p.petisPurchased) || 0,
          totalCost: Math.round(Number(p.totalCost) || 0),
          amountPaid: Math.round(Number(p.amountPaid) || 0),
          cashPaid: Math.round(Number(p.cashPaid) || 0),
          bankPaid: Math.round(Number(p.bankPaid) || 0),
          dueAmount: Math.round(Number(p.dueAmount) || 0),
          paymentMethod: p.paymentMethod || (Number(p.dueAmount) > 0 ? 'Credit' : 'Cash'),
          status: Number(p.dueAmount) === 0 ? 'PAID' : (Number(p.amountPaid) > 0 ? 'PARTIAL' : 'UNPAID')
        }))
        .filter(item => isInDateRange(item.date))
        .filter(item => {
          if (!searchTerm) return true;
          const q = searchTerm.toLowerCase();
          return (
            item.supplierName.toLowerCase().includes(q) ||
            item.supplierPhone.toLowerCase().includes(q) ||
            item.productName.toLowerCase().includes(q)
          );
        })
        .filter(item => {
          if (paymentMethodFilter === 'ALL') return true;
          if (paymentMethodFilter === 'CASH') return item.cashPaid > 0 && item.bankPaid === 0 && item.dueAmount === 0;
          if (paymentMethodFilter === 'BANK') return item.bankPaid > 0 && item.cashPaid === 0 && item.dueAmount === 0;
          if (paymentMethodFilter === 'SPLIT') return (item.cashPaid > 0 && item.bankPaid > 0) || (item.dueAmount > 0 && (item.cashPaid > 0 || item.bankPaid > 0));
          if (paymentMethodFilter === 'CREDIT') return item.dueAmount > 0;
          return true;
        })
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    }

    return (products || [])
      .map(p => {
        const totalCost = Number(p.totalPurchaseCost) > 0
          ? Number(p.totalPurchaseCost)
          : (Number(p.petiQuantity || 0) > 0 && Number(p.costPrice || 0) > 0
            ? Number(p.petiQuantity) * Number(p.costPrice)
            : Number(p.stock || 0) * (Number(p.costPrice || p.price || 0) / (p.unitType === 'egg' ? 1 : p.unitType === 'tray' ? 30 : 360)));

        const dueAmt = Number(p.dueAmountToSupplier) >= 0 ? Number(p.dueAmountToSupplier) : 0;
        const paidAmt = Number(p.amountPaidToSupplier) >= 0 ? Number(p.amountPaidToSupplier) : Math.max(0, totalCost - dueAmt);
        
        let cashAmt = Number(p.cashPaidToSupplier) || 0;
        let bankAmt = Number(p.bankPaidToSupplier) || 0;

        if (cashAmt === 0 && bankAmt === 0 && paidAmt > 0) {
          if (p.isOnlinePayment) bankAmt = paidAmt;
          else cashAmt = paidAmt;
        }

        const petis = Number(p.petiQuantity) > 0
          ? Number(p.petiQuantity)
          : (Number(p.stock) > 0 ? Number((p.stock / 360).toFixed(2)) : 0);

        return {
          id: p._id || p.id,
          date: p.createdAt || p.lastUpdated,
          supplierName: p.supplierName || 'Farm Vendor',
          supplierPhone: p.supplierPhone || '',
          productName: p.name || 'Eggs Batch',
          petisPurchased: petis,
          totalCost: Math.round(totalCost),
          amountPaid: Math.round(paidAmt),
          cashPaid: Math.round(cashAmt),
          bankPaid: Math.round(bankAmt),
          dueAmount: Math.round(dueAmt),
          paymentMethod: p.paymentMethod || (dueAmt > 0 ? 'Credit' : 'Cash'),
          status: dueAmt === 0 ? 'PAID' : (paidAmt > 0 ? 'PARTIAL' : 'UNPAID')
        };
      })
      .filter(item => isInDateRange(item.date))
      .filter(item => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (
          item.supplierName.toLowerCase().includes(q) ||
          item.supplierPhone.toLowerCase().includes(q) ||
          item.productName.toLowerCase().includes(q)
        );
      })
      .filter(item => {
        if (paymentMethodFilter === 'ALL') return true;
        if (paymentMethodFilter === 'CASH') return item.cashPaid > 0 && item.bankPaid === 0 && item.dueAmount === 0;
        if (paymentMethodFilter === 'BANK') return item.bankPaid > 0 && item.cashPaid === 0 && item.dueAmount === 0;
        if (paymentMethodFilter === 'SPLIT') return (item.cashPaid > 0 && item.bankPaid > 0) || (item.dueAmount > 0 && (item.cashPaid > 0 || item.bankPaid > 0));
        if (paymentMethodFilter === 'CREDIT') return item.dueAmount > 0;
        return true;
      })
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [ledgerApiData.purchases, products, dateFilter, startDate, endDate, searchTerm, paymentMethodFilter]);

  // ──────────────────────────────────────────────────────────────────────────
  // 2b. Grouped Vendor Ledger (by vendor name)
  // ──────────────────────────────────────────────────────────────────────────
  const groupedVendorLedger = useMemo(() => {
    const map = {};
    supplierLedgerList.forEach(item => {
      const key = item.supplierName || 'Unknown Vendor';
      if (!map[key]) {
        map[key] = {
          vendorName: key,
          vendorPhone: item.supplierPhone || '',
          totalCost: 0,
          cashPaid: 0,
          bankPaid: 0,
          creditDue: 0,
          products: []
        };
      }
      map[key].totalCost += item.totalCost;
      map[key].cashPaid += item.cashPaid;
      map[key].bankPaid += item.bankPaid;
      map[key].creditDue += item.dueAmount;
      map[key].products.push({
        id: item.id,
        productName: item.productName,
        petisPurchased: item.petisPurchased,
        totalCost: item.totalCost,
        cashPaid: item.cashPaid,
        bankPaid: item.bankPaid,
        dueAmount: item.dueAmount,
        date: item.date,
        status: item.status
      });
    });
    return Object.values(map).sort((a, b) => b.totalCost - a.totalCost);
  }, [supplierLedgerList]);

  // ──────────────────────────────────────────────────────────────────────────
  // 1b. Grouped Customer Ledger (by customer name)
  // ──────────────────────────────────────────────────────────────────────────
  const groupedCustomerLedger = useMemo(() => {
    const map = {};
    customerLedgerList.forEach(item => {
      const key = item.customerName || 'Walk-in Customer';
      if (!map[key]) {
        map[key] = {
          customerName: key,
          customerPhone: item.customerPhone || '',
          totalAmount: 0,
          cashPaid: 0,
          bankPaid: 0,
          creditDue: 0,
          transactions: []
        };
      }
      map[key].totalAmount += item.totalAmount;
      map[key].cashPaid += item.cashPaid;
      map[key].bankPaid += item.bankPaid;
      map[key].creditDue += item.dueAmount;
      map[key].transactions.push({
        id: item.id,
        invoiceNumber: item.invoiceNumber,
        itemsDescription: item.itemsDescription,
        petisBought: item.petisBought,
        totalAmount: item.totalAmount,
        cashPaid: item.cashPaid,
        bankPaid: item.bankPaid,
        dueAmount: item.dueAmount,
        date: item.date
      });
    });
    return Object.values(map).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [customerLedgerList]);

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Top KPI Aggregates (Live Computed)
  // ──────────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    // A. Customer Sales / Inflow
    const customerTotalRevenue = customerLedgerList.reduce((sum, s) => sum + s.totalAmount, 0);
    const customerCashTotal = customerLedgerList.reduce((sum, s) => sum + s.cashPaid, 0);
    const customerBankTotal = customerLedgerList.reduce((sum, s) => sum + s.bankPaid, 0);
    const customerCreditDueTotal = customerLedgerList.reduce((sum, s) => sum + s.dueAmount, 0);
    const totalCustomerPetisSold = customerLedgerList.reduce((sum, s) => sum + (s.petisBought || 0), 0);

    // Online EasyPaisa / Checkout orders
    const paidOnlineOrders = checkoutOrders.filter(o => o.paymentStatus === 'PAID');
    const onlineCashTotal = paidOnlineOrders.filter(o => o.paymentMethod === 'COD').reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
    const onlineBankTotal = paidOnlineOrders.filter(o => o.paymentMethod !== 'COD').reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

    const totalCashReceived = customerCashTotal + onlineCashTotal;
    const totalBankReceived = customerBankTotal + onlineBankTotal;
    const totalPaymentsCollected = totalCashReceived + totalBankReceived;

    // B. Supplier Purchases / Outflow
    const supplierTotalCost = supplierLedgerList.reduce((sum, p) => sum + p.totalCost, 0);
    const supplierCashPaid = supplierLedgerList.reduce((sum, p) => sum + p.cashPaid, 0);
    const supplierBankPaid = supplierLedgerList.reduce((sum, p) => sum + p.bankPaid, 0);
    const supplierCreditDueTotal = supplierLedgerList.reduce((sum, p) => sum + p.dueAmount, 0);
    const totalSupplierPetisBought = supplierLedgerList.reduce((sum, p) => sum + (p.petisPurchased || 0), 0);
    const totalSupplierPaid = supplierCashPaid + supplierBankPaid;

    // C. Net Reconciliation
    const netCashFlow = totalCashReceived - supplierCashPaid;
    const netBankFlow = totalBankReceived - supplierBankPaid;
    const netTotalFlow = totalPaymentsCollected - totalSupplierPaid;

    return {
      totalPaymentsCollected,
      totalCashReceived,
      totalBankReceived,
      customerCreditDueTotal,
      customerTotalRevenue,
      totalCustomerPetisSold,

      supplierTotalCost,
      supplierCashPaid,
      supplierBankPaid,
      supplierCreditDueTotal,
      totalSupplierPaid,
      totalSupplierPetisBought,

      netCashFlow,
      netBankFlow,
      netTotalFlow
    };
  }, [customerLedgerList, supplierLedgerList, checkoutOrders]);

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Export & Print Handlers
  // ──────────────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(16);
    doc.text(`${user?.shopName || 'POS System'} - Payment & Financial Ledger`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()} | Filter: ${dateFilter}`, 14, 22);

    if (activeTab === 'customers' || activeTab === 'overview') {
      const tableData = customerLedgerList.map(c => [
        c.invoiceNumber,
        new Date(c.date).toLocaleDateString(),
        c.customerName,
        c.customerPhone || '-',
        `${c.petisBought} Petis`,
        `Rs. ${fmt(c.totalAmount)}`,
        `Rs. ${fmt(c.cashPaid)}`,
        `Rs. ${fmt(c.bankPaid)}`,
        `Rs. ${fmt(c.dueAmount)}`,
        c.paymentMethod
      ]);

      autoTable(doc, {
        startY: 28,
        head: [['Invoice #', 'Date', 'Customer', 'Phone', 'Petis', 'Total (Rs)', 'Cash Paid', 'Bank Paid', 'Credit Due', 'Method']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [22, 163, 74] },
        foot: [[
          'Total', '', '', '',
          `${stats.totalCustomerPetisSold.toFixed(1)} Petis`,
          `Rs. ${fmt(stats.customerTotalRevenue)}`,
          `Rs. ${fmt(stats.totalCashReceived)}`,
          `Rs. ${fmt(stats.totalBankReceived)}`,
          `Rs. ${fmt(stats.customerCreditDueTotal)}`,
          ''
        ]],
        footStyles: { fillColor: [244, 244, 245], textColor: [0, 0, 0], fontStyle: 'bold' }
      });
    } else {
      const tableData = supplierLedgerList.map(s => [
        s.supplierName,
        s.productName,
        new Date(s.date).toLocaleDateString(),
        `${s.petisPurchased} Petis`,
        `Rs. ${fmt(s.totalCost)}`,
        `Rs. ${fmt(s.cashPaid)}`,
        `Rs. ${fmt(s.bankPaid)}`,
        `Rs. ${fmt(s.dueAmount)}`,
        s.status
      ]);

      autoTable(doc, {
        startY: 28,
        head: [['Supplier', 'Product', 'Date', 'Petis', 'Total Cost', 'Cash Paid', 'Bank Paid', 'Pending Due', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [217, 119, 6] },
        foot: [[
          'Total', '', '',
          `${stats.totalSupplierPetisBought.toFixed(1)} Petis`,
          `Rs. ${fmt(stats.supplierTotalCost)}`,
          `Rs. ${fmt(stats.supplierCashPaid)}`,
          `Rs. ${fmt(stats.supplierBankPaid)}`,
          `Rs. ${fmt(stats.supplierCreditDueTotal)}`,
          ''
        ]],
        footStyles: { fillColor: [244, 244, 245], textColor: [0, 0, 0], fontStyle: 'bold' }
      });
    }

    doc.save(`Payment_Ledger_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-6 space-y-6 animate-in fade-in duration-500 text-zinc-900">
      
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Page Header with 3D Accents */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-zinc-200 rounded-3xl p-5 sm:p-7 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0 border-t border-emerald-300">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 uppercase">
                Payment Ledger &amp; Cash Flow
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                Live Ledger
              </span>
            </div>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mt-0.5">
              Comprehensive ledger of cash flow, bank transactions, customer credits &amp; supplier payables
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleRefresh}
            disabled={loadingExtra}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingExtra ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-zinc-600" />
            <span>Print</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-900/10 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Customer & Vendor KPI Summary Groups */}
      {/* ─────────────────────────────────────────────────────────────────── */}

      {/* ── CUSTOMER Summary ── */}
      <div className="bg-white border border-emerald-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 border-b border-emerald-700">
          <Users className="w-4 h-4 text-white" />
          <span className="text-xs font-black uppercase tracking-widest text-white">👥 Customer</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-zinc-100">

          {/* Customer Cash */}
          <div className="p-4 space-y-1 hover:bg-emerald-50/50 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">💵 Cash</span>
              <div className="p-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                <Banknote className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-lg font-black text-emerald-700 tracking-tight">Rs. {fmt(stats.totalCashReceived)}</div>
            <p className="text-[9px] font-bold text-zinc-400 uppercase">Cash Received</p>
          </div>

          {/* Customer Bank */}
          <div className="p-4 space-y-1 hover:bg-blue-50/50 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">🏦 Bank</span>
              <div className="p-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                <Building2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-lg font-black text-blue-700 tracking-tight">Rs. {fmt(stats.totalBankReceived)}</div>
            <p className="text-[9px] font-bold text-zinc-400 uppercase">Bank Received</p>
          </div>

          {/* Customer Credit */}
          <div className="p-4 space-y-1 hover:bg-amber-50/50 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">📋 Credit</span>
              <div className="p-1 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
                <CreditCard className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-lg font-black text-amber-600 tracking-tight">Rs. {fmt(stats.customerCreditDueTotal)}</div>
            <p className="text-[9px] font-bold text-zinc-400 uppercase">Credit Due</p>
          </div>

          {/* Customer Total */}
          <div className="p-4 space-y-1 bg-emerald-50/30 hover:bg-emerald-100/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">💰 Total</span>
              <div className="p-1 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200">
                <Wallet className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-lg font-black text-emerald-900 tracking-tight">Rs. {fmt(stats.customerTotalRevenue)}</div>
            <p className="text-[9px] font-bold text-zinc-400 uppercase">Total Revenue</p>
          </div>

        </div>
      </div>

      {/* ── VENDOR Summary ── */}
      <div className="bg-white border border-orange-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-500 border-b border-orange-600">
          <Truck className="w-4 h-4 text-white" />
          <span className="text-xs font-black uppercase tracking-widest text-white">🚚 Vendor</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-zinc-100">

          {/* Vendor Cash Paid */}
          <div className="p-4 space-y-1 hover:bg-emerald-50/50 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">💵 Cash</span>
              <div className="p-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                <Banknote className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-lg font-black text-emerald-700 tracking-tight">Rs. {fmt(stats.supplierCashPaid)}</div>
            <p className="text-[9px] font-bold text-zinc-400 uppercase">Cash Paid</p>
          </div>

          {/* Vendor Bank Paid */}
          <div className="p-4 space-y-1 hover:bg-blue-50/50 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">🏦 Bank</span>
              <div className="p-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                <Building2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-lg font-black text-blue-700 tracking-tight">Rs. {fmt(stats.supplierBankPaid)}</div>
            <p className="text-[9px] font-bold text-zinc-400 uppercase">Bank Paid</p>
          </div>

          {/* Vendor Credit Due */}
          <div className="p-4 space-y-1 hover:bg-rose-50/50 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">📋 Credit</span>
              <div className="p-1 rounded-lg bg-rose-50 text-rose-600 border border-rose-100">
                <CreditCard className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-lg font-black text-rose-600 tracking-tight">Rs. {fmt(stats.supplierCreditDueTotal)}</div>
            <p className="text-[9px] font-bold text-zinc-400 uppercase">Credit Remaining</p>
          </div>

          {/* Vendor Total */}
          <div className="p-4 space-y-1 bg-orange-50/30 hover:bg-orange-100/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">💰 Total</span>
              <div className="p-1 rounded-lg bg-orange-100 text-orange-700 border border-orange-200">
                <DollarSign className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-lg font-black text-orange-900 tracking-tight">Rs. {fmt(stats.supplierTotalCost)}</div>
            <p className="text-[9px] font-bold text-zinc-400 uppercase">Total Cost</p>
          </div>

        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Cash vs Bank Balance & Flow Reconciliation Banner */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        
        {/* Net Cash In Hand */}
        <div className="bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 border border-emerald-200 rounded-2xl p-4.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              <Banknote className="w-4 h-4 text-emerald-600" />
              💵 Net Cash Flow
            </span>
            <span className={`text-xs font-black px-2 py-0.5 rounded-md ${stats.netCashFlow >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
              {stats.netCashFlow >= 0 ? '+ In Surplus' : '- Deficit'}
            </span>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-2xl font-black text-emerald-800 tracking-tight">
              Rs. {fmt(stats.netCashFlow)}
            </span>
          </div>
          <div className="text-[10.5px] text-zinc-500 font-bold flex justify-between border-t border-emerald-100 pt-2">
            <span>Customer In: +Rs. {fmt(stats.totalCashReceived)}</span>
            <span>Supplier Out: -Rs. {fmt(stats.supplierCashPaid)}</span>
          </div>
        </div>

        {/* Net Bank Balance */}
        <div className="bg-gradient-to-br from-blue-50 via-white to-blue-50/40 border border-blue-200 rounded-2xl p-4.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-blue-600" />
              🏦 Net Bank Flow
            </span>
            <span className={`text-xs font-black px-2 py-0.5 rounded-md ${stats.netBankFlow >= 0 ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'}`}>
              {stats.netBankFlow >= 0 ? '+ In Surplus' : '- Deficit'}
            </span>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-2xl font-black text-blue-800 tracking-tight">
              Rs. {fmt(stats.netBankFlow)}
            </span>
          </div>
          <div className="text-[10.5px] text-zinc-500 font-bold flex justify-between border-t border-blue-100 pt-2">
            <span>Customer In: +Rs. {fmt(stats.totalBankReceived)}</span>
            <span>Supplier Out: -Rs. {fmt(stats.supplierBankPaid)}</span>
          </div>
        </div>

        {/* Petis Volume Traded */}
        <div className="bg-gradient-to-br from-amber-50 via-white to-amber-50/40 border border-amber-200 rounded-2xl p-4.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-amber-600" />
              📦 Egg Petis Volume
            </span>
            <span className="text-xs font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
              Eggs Trading
            </span>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-2xl font-black text-amber-800 tracking-tight">
              {stats.totalCustomerPetisSold.toFixed(1)} Petis Sold
            </span>
          </div>
          <div className="text-[10.5px] text-zinc-500 font-bold flex justify-between border-t border-amber-100 pt-2">
            <span>Sold: {stats.totalCustomerPetisSold.toFixed(1)} Petis</span>
            <span>Purchased: {stats.totalSupplierPetisBought.toFixed(1)} Petis</span>
          </div>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Navigation Tabs & Filter Bar */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-zinc-200 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4">
        
        {/* Main Tab Switcher */}
        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setActiveTab('customers')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'customers'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/20'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>👥 Customer Ledger ({customerLedgerList.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('suppliers')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'suppliers'
                  ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-900/20'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>🚚 Supplier Purchases &amp; Due ({supplierLedgerList.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('cashbank')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'cashbank'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>🏦 Cash &amp; Bank Ledger</span>
            </button>

            <button
              onClick={() => setActiveTab('vendorledger')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'vendorledger'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-900/20'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>📦 Vendor Payment Ledger ({groupedVendorLedger.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('customerledger')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'customerledger'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-900/20'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>👤 Customer Payment Ledger ({groupedCustomerLedger.length})</span>
            </button>
          </div>

          {/* Quick Date Filters */}
          <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-xl">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'TODAY', label: 'Today' },
              { id: 'WEEK', label: '7 Days' },
              { id: 'MONTH', label: 'This Month' },
              { id: 'CUSTOM', label: 'Custom' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setDateFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  dateFilter === f.id
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Filter Row: Search, Date Inputs, Payment Method */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Customer, Phone, Invoice, Farm..."
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-9 pr-4 py-2 text-xs font-black text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-emerald-500 shadow-inner"
            />
          </div>

          {/* Payment Method Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mr-1">Filter:</span>
            {[
              { id: 'ALL', label: 'All' },
              { id: 'CASH', label: 'Cash Only' },
              { id: 'BANK', label: 'Bank Only' },
              { id: 'SPLIT', label: 'Split' },
              { id: 'CREDIT', label: 'Credit Only' }
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setPaymentMethodFilter(m.id)}
                className={`px-2.5 py-1.5 rounded-lg text-[10.5px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                  paymentMethodFilter === m.id
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                    : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers (if CUSTOM selected) */}
          {dateFilter === 'CUSTOM' && (
            <div className="flex items-center gap-2 w-full sm:w-auto animate-in fade-in">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs font-black text-zinc-700 outline-none"
              />
              <span className="text-zinc-400 text-xs font-bold">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs font-black text-zinc-700 outline-none"
              />
            </div>
          )}

        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: Customer Sales & Payments Detailed Ledger */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'customers' && (
        <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm overflow-hidden space-y-0">
          
          <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-base font-black text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                Customer Payment Breakdown &amp; Petis Ledger
              </h3>
              <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-tight">
                Customer petis volume, cash collected, bank transfers and outstanding credit balance
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-black text-zinc-900 bg-zinc-100 px-3 py-1 rounded-full border border-zinc-200">
                Total Records: {customerLedgerList.length}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-[10.5px] font-black uppercase text-zinc-500 tracking-wider">
                  <th className="py-3 px-4">Invoice / Date</th>
                  <th className="py-3 px-4">Customer Details</th>
                  <th className="py-3 px-4 text-center">Petis Bought</th>
                  <th className="py-3 px-4 text-right">Total Bill</th>
                  <th className="py-3 px-4 text-right text-emerald-700">💵 Cash Paid</th>
                  <th className="py-3 px-4 text-right text-blue-700">🏦 Bank Paid</th>
                  <th className="py-3 px-4 text-right text-rose-700">📋 Credit Due</th>
                  <th className="py-3 px-4 text-center">Payment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs font-bold text-zinc-700">
                {customerLedgerList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-zinc-400 font-bold">
                      No customer payment records found matching your filters.
                    </td>
                  </tr>
                ) : (
                  customerLedgerList.map((row) => (
                    <tr key={row.id} className="hover:bg-zinc-50/80 transition-colors">
                      {/* Invoice & Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-black text-zinc-900 block">{row.invoiceNumber}</span>
                        <span className="text-[10px] text-zinc-400 font-bold block">
                          {row.date ? new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                        </span>
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <div className="font-black text-zinc-900">{row.customerName}</div>
                        {row.customerPhone && (
                          <div className="text-[10px] text-zinc-500 font-bold">{row.customerPhone}</div>
                        )}
                        <div className="text-[9.5px] text-zinc-400 truncate max-w-xs">{row.itemsDescription}</div>
                      </td>

                      {/* Petis Bought */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 font-black text-xs">
                          <Package className="w-3.5 h-3.5 text-amber-600" />
                          {row.petisBought} Petis
                        </span>
                        {row.eggsBought > 0 && (
                          <span className="block text-[9.5px] text-zinc-400 font-bold mt-0.5">
                            ({fmt(row.eggsBought)} Eggs)
                          </span>
                        )}
                      </td>

                      {/* Total Amount */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-black text-zinc-900 text-sm">
                        Rs. {fmt(row.totalAmount)}
                      </td>

                      {/* Cash Paid */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-black text-emerald-700">
                        {row.cashPaid > 0 ? (
                          <span className="bg-emerald-50 text-emerald-800 px-2 py-1 rounded-lg border border-emerald-200">
                            Rs. {fmt(row.cashPaid)}
                          </span>
                        ) : (
                          <span className="text-zinc-400 font-medium">Rs. 0</span>
                        )}
                      </td>

                      {/* Bank Paid */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-black text-blue-700">
                        {row.bankPaid > 0 ? (
                          <span className="bg-blue-50 text-blue-800 px-2 py-1 rounded-lg border border-blue-200">
                            Rs. {fmt(row.bankPaid)}
                          </span>
                        ) : (
                          <span className="text-zinc-400 font-medium">Rs. 0</span>
                        )}
                      </td>

                      {/* Due Amount / Credit */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-black">
                        {row.dueAmount > 0 ? (
                          <span className="bg-rose-50 text-rose-700 px-2 py-1 rounded-lg border border-rose-200">
                            Rs. {fmt(row.dueAmount)}
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-bold text-[11px] flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                          </span>
                        )}
                      </td>

                      {/* Payment Status Badge */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          row.dueAmount === 0 && row.bankPaid > 0 && row.cashPaid === 0
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : row.dueAmount === 0 && row.cashPaid > 0 && row.bankPaid === 0
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : row.dueAmount === 0 && row.cashPaid > 0 && row.bankPaid > 0
                            ? 'bg-amber-50 text-amber-900 border-amber-200'
                            : row.dueAmount > 0 && (row.cashPaid > 0 || row.bankPaid > 0)
                            ? 'bg-purple-50 text-purple-800 border-purple-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}>
                          {row.dueAmount === 0 && row.bankPaid > 0 && row.cashPaid === 0
                            ? '🏦 Bank'
                            : row.dueAmount === 0 && row.cashPaid > 0 && row.bankPaid === 0
                            ? '💵 Cash'
                            : row.dueAmount === 0
                            ? '🔀 Split Paid'
                            : (row.cashPaid > 0 || row.bankPaid > 0)
                            ? '⚠️ Partial Credit'
                            : '📋 Full Credit'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* Table Footer Totals */}
              <tfoot>
                <tr className="bg-zinc-100 border-t-2 border-zinc-200 font-black text-xs text-zinc-900">
                  <td className="py-3 px-4" colSpan={2}>
                    Total Summary ({customerLedgerList.length} Transactions)
                  </td>
                  <td className="py-3 px-4 text-center text-amber-900">
                    {stats.totalCustomerPetisSold.toFixed(1)} Petis
                  </td>
                  <td className="py-3 px-4 text-right text-zinc-950 text-sm">
                    Rs. {fmt(stats.customerTotalRevenue)}
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-800 text-sm">
                    Rs. {fmt(stats.totalCashReceived)}
                  </td>
                  <td className="py-3 px-4 text-right text-blue-800 text-sm">
                    Rs. {fmt(stats.totalBankReceived)}
                  </td>
                  <td className="py-3 px-4 text-right text-rose-700 text-sm">
                    Rs. {fmt(stats.customerCreditDueTotal)}
                  </td>
                  <td className="py-3 px-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: Supplier Purchases & Credit Due Detailed Ledger */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'suppliers' && (
        <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm overflow-hidden space-y-0">
          
          <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-base font-black text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-600" />
                Supplier / Farm Purchases &amp; Credit Ledger
              </h3>
              <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-tight">
                Supplier payments, cash and bank disbursements and vendor outstanding credit
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-black text-zinc-900 bg-zinc-100 px-3 py-1 rounded-full border border-zinc-200">
                Total Purchases: {supplierLedgerList.length}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-[10.5px] font-black uppercase text-zinc-500 tracking-wider">
                  <th className="py-3 px-4">Supplier / Farm</th>
                  <th className="py-3 px-4">Product / Item</th>
                  <th className="py-3 px-4 text-center">Petis Bought</th>
                  <th className="py-3 px-4 text-right">Total Cost</th>
                  <th className="py-3 px-4 text-right text-emerald-700">💵 Cash Paid</th>
                  <th className="py-3 px-4 text-right text-blue-700">🏦 Bank Paid</th>
                  <th className="py-3 px-4 text-right text-rose-700">📋 Pending Credit</th>
                  <th className="py-3 px-4 text-center">Payment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs font-bold text-zinc-700">
                {supplierLedgerList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-zinc-400 font-bold">
                      No supplier purchases found matching your filters.
                    </td>
                  </tr>
                ) : (
                  supplierLedgerList.map((row) => (
                    <tr key={row.id} className="hover:bg-zinc-50/80 transition-colors">
                      {/* Supplier */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-black text-zinc-900 block">{row.supplierName}</span>
                        {row.supplierPhone && (
                          <span className="text-[10px] text-zinc-500 font-bold block">{row.supplierPhone}</span>
                        )}
                        <span className="text-[9.5px] text-zinc-400 block">
                          {row.date ? new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                        </span>
                      </td>

                      {/* Product */}
                      <td className="py-3.5 px-4 font-black text-zinc-900">
                        {row.productName}
                      </td>

                      {/* Petis */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 font-black text-xs">
                          <Package className="w-3.5 h-3.5 text-amber-600" />
                          {row.petisPurchased} Petis
                        </span>
                      </td>

                      {/* Total Cost */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-black text-zinc-900 text-sm">
                        Rs. {fmt(row.totalCost)}
                      </td>

                      {/* Cash Paid */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-black text-emerald-700">
                        {row.cashPaid > 0 ? (
                          <span className="bg-emerald-50 text-emerald-800 px-2 py-1 rounded-lg border border-emerald-200">
                            Rs. {fmt(row.cashPaid)}
                          </span>
                        ) : (
                          <span className="text-zinc-400 font-medium">Rs. 0</span>
                        )}
                      </td>

                      {/* Bank Paid */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-black text-blue-700">
                        {row.bankPaid > 0 ? (
                          <span className="bg-blue-50 text-blue-800 px-2 py-1 rounded-lg border border-blue-200">
                            Rs. {fmt(row.bankPaid)}
                          </span>
                        ) : (
                          <span className="text-zinc-400 font-medium">Rs. 0</span>
                        )}
                      </td>

                      {/* Due Amount / Credit */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-black">
                        {row.dueAmount > 0 ? (
                          <span className="bg-rose-50 text-rose-700 px-2 py-1 rounded-lg border border-rose-200">
                            Rs. {fmt(row.dueAmount)}
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-bold text-[11px] flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Fully Paid
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          row.status === 'PAID'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : row.status === 'PARTIAL'
                            ? 'bg-amber-50 text-amber-900 border-amber-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}>
                          {row.status === 'PAID'
                            ? '✓ Fully Paid'
                            : row.status === 'PARTIAL'
                            ? '⚠️ Partial Paid'
                            : '📋 Unpaid Credit'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* Table Footer Totals */}
              <tfoot>
                <tr className="bg-zinc-100 border-t-2 border-zinc-200 font-black text-xs text-zinc-900">
                  <td className="py-3 px-4" colSpan={2}>
                    Total Purchases Summary ({supplierLedgerList.length} Batches)
                  </td>
                  <td className="py-3 px-4 text-center text-amber-900">
                    {stats.totalSupplierPetisBought.toFixed(1)} Petis
                  </td>
                  <td className="py-3 px-4 text-right text-zinc-950 text-sm">
                    Rs. {fmt(stats.supplierTotalCost)}
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-800 text-sm">
                    Rs. {fmt(stats.supplierCashPaid)}
                  </td>
                  <td className="py-3 px-4 text-right text-blue-800 text-sm">
                    Rs. {fmt(stats.supplierBankPaid)}
                  </td>
                  <td className="py-3 px-4 text-right text-rose-700 text-sm">
                    Rs. {fmt(stats.supplierCreditDueTotal)}
                  </td>
                  <td className="py-3 px-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: Cash vs Bank Balance & Detailed Reconciliation */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'cashbank' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Cash Ledger Column */}
          <div className="bg-white border border-zinc-200 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-zinc-900 uppercase tracking-tight">
                    💵 Cash In Hand Reconciliation
                  </h3>
                  <p className="text-[11px] font-bold text-zinc-400 uppercase">
                    Detailed physical cash transactions and daily cash journal
                  </p>
                </div>
              </div>
              <span className="text-xl font-black text-emerald-700">
                Rs. {fmt(stats.netCashFlow)}
              </span>
            </div>

            <div className="space-y-2.5 text-xs font-bold text-zinc-700">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-black text-emerald-800 block">Customer Cash Inflow (+)</span>
                  <span className="text-xs text-zinc-500 font-bold">Total collected from customers</span>
                </div>
                <span className="text-base font-black text-emerald-700">+ Rs. {fmt(stats.totalCashReceived)}</span>
              </div>

              <div className="p-3 bg-rose-50/70 border border-rose-200/80 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-black text-rose-800 block">Supplier Cash Paid Out (-)</span>
                  <span className="text-xs text-zinc-500 font-bold">Total cash paid to egg suppliers</span>
                </div>
                <span className="text-base font-black text-rose-700">- Rs. {fmt(stats.supplierCashPaid)}</span>
              </div>

              <div className="p-3 bg-zinc-100 border border-zinc-300 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-black text-zinc-900 block">Net Available Cash Balance</span>
                  <span className="text-xs text-zinc-500 font-bold">Current Physical Cash Position</span>
                </div>
                <span className="text-lg font-black text-zinc-900">Rs. {fmt(stats.netCashFlow)}</span>
              </div>
            </div>
          </div>

          {/* Bank Ledger Column */}
          <div className="bg-white border border-zinc-200 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-800 border border-blue-200">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-zinc-900 uppercase tracking-tight">
                    🏦 Bank Accounts Reconciliation
                  </h3>
                  <p className="text-[11px] font-bold text-zinc-400 uppercase">
                    Consolidated bank accounts and digital transfer accounts
                  </p>
                </div>
              </div>
              <span className="text-xl font-black text-blue-700">
                Rs. {fmt(stats.netBankFlow)}
              </span>
            </div>

            <div className="space-y-2.5 text-xs font-bold text-zinc-700">
              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-black text-blue-800 block">Bank Transfer Inflow (+)</span>
                  <span className="text-xs text-zinc-500 font-bold">Received via Bank &amp; EasyPaisa</span>
                </div>
                <span className="text-base font-black text-blue-700">+ Rs. {fmt(stats.totalBankReceived)}</span>
              </div>

              <div className="p-3 bg-rose-50/70 border border-rose-200/80 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-black text-rose-800 block">Supplier Bank Paid Out (-)</span>
                  <span className="text-xs text-zinc-500 font-bold">Transferred to farm supplier banks</span>
                </div>
                <span className="text-base font-black text-rose-700">- Rs. {fmt(stats.supplierBankPaid)}</span>
              </div>

              <div className="p-3 bg-zinc-100 border border-zinc-300 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-black text-zinc-900 block">Net Available Bank Balance</span>
                  <span className="text-xs text-zinc-500 font-bold">Current Bank Liquidity Position</span>
                </div>
                <span className="text-lg font-black text-zinc-900">Rs. {fmt(stats.netBankFlow)}</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: Vendor Payment Ledger - Grouped by Vendor */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'vendorledger' && (
        <div className="space-y-4">
          {/* Summary Header */}
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-4 flex flex-wrap gap-4 items-center justify-between">
            <div>
              <h3 className="text-base font-black text-orange-900 uppercase tracking-wider flex items-center gap-2">
                <Truck className="w-4 h-4 text-orange-600" />
                Vendor Payment Ledger
              </h3>
              <p className="text-[11px] font-bold text-orange-700/70 mt-0.5">Total vendors: {groupedVendorLedger.length} | د هر vendor لپاره summary او products</p>
            </div>
            {/* Grand totals in one line */}
            <div className="flex flex-wrap gap-3 text-xs font-black">
              <span className="px-3 py-1.5 rounded-xl bg-white border border-orange-200 text-zinc-900">
                💰 Total: Rs. {fmt(groupedVendorLedger.reduce((s,v)=>s+v.totalCost,0))}
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                💵 Cash: Rs. {fmt(groupedVendorLedger.reduce((s,v)=>s+v.cashPaid,0))}
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800">
                🏦 Bank: Rs. {fmt(groupedVendorLedger.reduce((s,v)=>s+v.bankPaid,0))}
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                📋 Credit: Rs. {fmt(groupedVendorLedger.reduce((s,v)=>s+v.creditDue,0))}
              </span>
            </div>
          </div>

          {groupedVendorLedger.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center text-zinc-400 font-bold">
              No vendor records found.
            </div>
          ) : (
            groupedVendorLedger.map((vendor) => {
              const isExpanded = !!expandedVendors[vendor.vendorName];
              return (
                <div key={vendor.vendorName} className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
                  {/* Vendor Summary Row (one line) */}
                  <button
                    onClick={() => setExpandedVendors(prev => ({ ...prev, [vendor.vendorName]: !prev[vendor.vendorName] }))}
                    className="w-full flex flex-wrap items-center gap-2 px-5 py-4 hover:bg-zinc-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white font-black text-sm shrink-0 shadow">
                        {vendor.vendorName.charAt(0).toUpperCase()}
                      </div>
                      <div className="text-left min-w-0">
                        <div className="font-black text-zinc-900 text-sm truncate">{vendor.vendorName}</div>
                        {vendor.vendorPhone && <div className="text-[10px] text-zinc-500 font-bold">{vendor.vendorPhone}</div>}
                        <div className="text-[10px] text-zinc-400 font-bold">{vendor.products.length} product{vendor.products.length !== 1 ? 's' : ''}</div>
                      </div>
                    </div>

                    {/* Summary inline badges */}
                    <div className="flex flex-wrap gap-2 items-center text-[11px] font-black">
                      <span className="px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-800 border border-zinc-200">
                        Total: Rs. {fmt(vendor.totalCost)}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                        💵 Cash: Rs. {fmt(vendor.cashPaid)}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                        🏦 Bank: Rs. {fmt(vendor.bankPaid)}
                      </span>
                      <span className={`px-2.5 py-1 rounded-lg border font-black ${
                        vendor.creditDue > 0
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {vendor.creditDue > 0 ? `📋 Credit: Rs. ${fmt(vendor.creditDue)}` : '✓ Fully Paid'}
                      </span>
                      <ChevronRight className={`w-4 h-4 text-zinc-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                  </button>

                  {/* Expanded Product List */}
                  {isExpanded && (
                    <div className="border-t border-zinc-100 bg-zinc-50/50">
                      <div className="px-5 py-2 bg-zinc-100/70 border-b border-zinc-200">
                        <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Products Received from {vendor.vendorName}</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="text-[10px] font-black uppercase text-zinc-500 border-b border-zinc-200">
                              <th className="py-2 px-5">Product Name</th>
                              <th className="py-2 px-4 text-center">Petis</th>
                              <th className="py-2 px-4 text-right">Total Cost</th>
                              <th className="py-2 px-4 text-right text-emerald-700">💵 Cash</th>
                              <th className="py-2 px-4 text-right text-blue-700">🏦 Bank</th>
                              <th className="py-2 px-4 text-right text-rose-700">📋 Credit</th>
                              <th className="py-2 px-4 text-center">Status</th>
                              <th className="py-2 px-4 text-right">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 text-xs font-bold text-zinc-700">
                            {vendor.products.map((prod, idx) => (
                              <tr key={prod.id || idx} className="hover:bg-white transition-colors">
                                <td className="py-2.5 px-5 font-black text-zinc-900">{prod.productName}</td>
                                <td className="py-2.5 px-4 text-center">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-black">
                                    <Package className="w-3 h-3" />{prod.petisPurchased} Petis
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 text-right font-black text-zinc-900">Rs. {fmt(prod.totalCost)}</td>
                                <td className="py-2.5 px-4 text-right">
                                  {prod.cashPaid > 0
                                    ? <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">Rs. {fmt(prod.cashPaid)}</span>
                                    : <span className="text-zinc-400">Rs. 0</span>}
                                </td>
                                <td className="py-2.5 px-4 text-right">
                                  {prod.bankPaid > 0
                                    ? <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">Rs. {fmt(prod.bankPaid)}</span>
                                    : <span className="text-zinc-400">Rs. 0</span>}
                                </td>
                                <td className="py-2.5 px-4 text-right">
                                  {prod.dueAmount > 0
                                    ? <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">Rs. {fmt(prod.dueAmount)}</span>
                                    : <span className="text-emerald-600 flex items-center justify-end gap-1"><CheckCircle2 className="w-3 h-3" /> Paid</span>}
                                </td>
                                <td className="py-2.5 px-4 text-center">
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                    prod.status === 'PAID' ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : prod.status === 'PARTIAL' ? 'bg-amber-50 text-amber-900 border-amber-200'
                                    : 'bg-rose-50 text-rose-800 border-rose-200'
                                  }`}>{prod.status === 'PAID' ? '✓ Paid' : prod.status === 'PARTIAL' ? '⚠ Partial' : '📋 Unpaid'}</span>
                                </td>
                                <td className="py-2.5 px-4 text-right text-[10px] text-zinc-400 font-bold">
                                  {prod.date ? new Date(prod.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 5: Customer Payment Ledger - Grouped by Customer */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'customerledger' && (
        <div className="space-y-4">
          {/* Summary Header */}
          <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-2xl p-4 flex flex-wrap gap-4 items-center justify-between">
            <div>
              <h3 className="text-base font-black text-teal-900 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-600" />
                Customer Payment Ledger
              </h3>
              <p className="text-[11px] font-bold text-teal-700/70 mt-0.5">Total customers: {groupedCustomerLedger.length} | د هر customer لپاره summary او transactions</p>
            </div>
            {/* Grand totals in one line */}
            <div className="flex flex-wrap gap-3 text-xs font-black">
              <span className="px-3 py-1.5 rounded-xl bg-white border border-teal-200 text-zinc-900">
                💰 Total: Rs. {fmt(groupedCustomerLedger.reduce((s,c)=>s+c.totalAmount,0))}
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                💵 Cash: Rs. {fmt(groupedCustomerLedger.reduce((s,c)=>s+c.cashPaid,0))}
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800">
                🏦 Bank: Rs. {fmt(groupedCustomerLedger.reduce((s,c)=>s+c.bankPaid,0))}
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
                📋 Credit Due: Rs. {fmt(groupedCustomerLedger.reduce((s,c)=>s+c.creditDue,0))}
              </span>
            </div>
          </div>

          {groupedCustomerLedger.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center text-zinc-400 font-bold">
              No customer records found.
            </div>
          ) : (
            groupedCustomerLedger.map((customer) => {
              const isExpanded = !!expandedCustomers[customer.customerName];
              return (
                <div key={customer.customerName} className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
                  {/* Customer Summary Row (one line) */}
                  <button
                    onClick={() => setExpandedCustomers(prev => ({ ...prev, [customer.customerName]: !prev[customer.customerName] }))}
                    className="w-full flex flex-wrap items-center gap-2 px-5 py-4 hover:bg-zinc-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white font-black text-sm shrink-0 shadow">
                        {customer.customerName.charAt(0).toUpperCase()}
                      </div>
                      <div className="text-left min-w-0">
                        <div className="font-black text-zinc-900 text-sm truncate">{customer.customerName}</div>
                        {customer.customerPhone && <div className="text-[10px] text-zinc-500 font-bold">{customer.customerPhone}</div>}
                        <div className="text-[10px] text-zinc-400 font-bold">{customer.transactions.length} transaction{customer.transactions.length !== 1 ? 's' : ''}</div>
                      </div>
                    </div>

                    {/* Summary inline badges - all in one line */}
                    <div className="flex flex-wrap gap-2 items-center text-[11px] font-black">
                      <span className="px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-800 border border-zinc-200">
                        Total: Rs. {fmt(customer.totalAmount)}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                        💵 Cash: Rs. {fmt(customer.cashPaid)}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                        🏦 Bank: Rs. {fmt(customer.bankPaid)}
                      </span>
                      <span className={`px-2.5 py-1 rounded-lg border font-black ${
                        customer.creditDue > 0
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {customer.creditDue > 0 ? `📋 Credit: Rs. ${fmt(customer.creditDue)}` : '✓ Fully Paid'}
                      </span>
                      <ChevronRight className={`w-4 h-4 text-zinc-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                  </button>

                  {/* Expanded Transactions List */}
                  {isExpanded && (
                    <div className="border-t border-zinc-100 bg-zinc-50/50">
                      <div className="px-5 py-2 bg-zinc-100/70 border-b border-zinc-200">
                        <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Transactions for {customer.customerName}</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="text-[10px] font-black uppercase text-zinc-500 border-b border-zinc-200">
                              <th className="py-2 px-5">Invoice / Date</th>
                              <th className="py-2 px-4">Products</th>
                              <th className="py-2 px-4 text-center">Petis</th>
                              <th className="py-2 px-4 text-right">Total</th>
                              <th className="py-2 px-4 text-right text-emerald-700">💵 Cash</th>
                              <th className="py-2 px-4 text-right text-blue-700">🏦 Bank</th>
                              <th className="py-2 px-4 text-right text-amber-700">📋 Credit</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 text-xs font-bold text-zinc-700">
                            {customer.transactions.map((txn, idx) => (
                              <tr key={txn.id || idx} className="hover:bg-white transition-colors">
                                <td className="py-2.5 px-5">
                                  <div className="font-black text-zinc-900">{txn.invoiceNumber}</div>
                                  <div className="text-[10px] text-zinc-400">{txn.date ? new Date(txn.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</div>
                                </td>
                                <td className="py-2.5 px-4 text-[10px] text-zinc-500 max-w-xs truncate">{txn.itemsDescription}</td>
                                <td className="py-2.5 px-4 text-center">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-black">
                                    <Package className="w-3 h-3" />{txn.petisBought} Petis
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 text-right font-black text-zinc-900">Rs. {fmt(txn.totalAmount)}</td>
                                <td className="py-2.5 px-4 text-right">
                                  {txn.cashPaid > 0
                                    ? <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">Rs. {fmt(txn.cashPaid)}</span>
                                    : <span className="text-zinc-400">Rs. 0</span>}
                                </td>
                                <td className="py-2.5 px-4 text-right">
                                  {txn.bankPaid > 0
                                    ? <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">Rs. {fmt(txn.bankPaid)}</span>
                                    : <span className="text-zinc-400">Rs. 0</span>}
                                </td>
                                <td className="py-2.5 px-4 text-right">
                                  {txn.dueAmount > 0
                                    ? <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">Rs. {fmt(txn.dueAmount)}</span>
                                    : <span className="text-emerald-600 flex items-center justify-end gap-1"><CheckCircle2 className="w-3 h-3" /> Paid</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

    </div>
  );
}

export default PaymentLedger;
