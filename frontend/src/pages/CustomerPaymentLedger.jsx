import React, { useState, useMemo, useEffect } from 'react';
import {
  Wallet,
  DollarSign,
  Building2,
  CreditCard,
  Users,
  Search,
  Filter,
  Calendar,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Package,
  Layers,
  Banknote,
  Receipt,
  ChevronDown,
  ChevronUp,
  FileText,
  ArrowRight,
  X,
  Sparkles,
  Pencil,
  Trash2,
  Tag,
  MoreVertical
} from 'lucide-react';
import api, { getPaymentLedger, getCustomerCredits, getSales, updateSale, deleteSale } from '../services/api';
import { useProducts } from '../contexts/ProductContext';
import { useUser } from '../contexts/UserContext';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function CustomerPaymentLedger({ shopId: propShopId }) {
  const { user, isPageOpAllowed } = useUser();
  const { sales = [], products = [], categories = [], fetchData } = useProducts();

  // Local state
  const [viewMode, setViewMode] = useState('transactions'); // 'transactions' | 'customerwise'
  const [expandedCustomers, setExpandedCustomers] = useState({});
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('ALL'); // 'ALL' | 'CASH' | 'BANK' | 'SPLIT' | 'CREDIT'
  const [customerCredits, setCustomerCredits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Edit & Delete Modal States
  const [editingSale, setEditingSale] = useState(null);
  const [editFormData, setEditFormData] = useState({
    customerName: '',
    customerPhone: '',
    category: 'Eggs',
    totalAmount: 0,
    cashPaid: 0,
    bankPaid: 0,
    dueAmount: 0,
    paymentMethod: 'CASH'
  });
  const [deletingSale, setDeletingSale] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTxnMenuId, setActiveTxnMenuId] = useState(null);

  const activeShopId = propShopId || (user?.shopId ? (typeof user.shopId === 'object' ? (user.shopId._id || user.shopId.id) : String(user.shopId)) : null);
  const isEditAllowed = isPageOpAllowed ? isPageOpAllowed('customerPaymentLedger', 'edit', activeShopId) : true;
  const isDeleteAllowed = isPageOpAllowed ? isPageOpAllowed('customerPaymentLedger', 'delete', activeShopId) : true;

  // Dynamic Ledger data from API
  const [ledgerApiData, setLedgerApiData] = useState({
    summary: null,
    sales: []
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [ledgerRes, creditsRes, salesRes] = await Promise.allSettled([
        getPaymentLedger(activeShopId),
        getCustomerCredits(activeShopId),
        getSales(activeShopId)
      ]);

      let salesData = [];
      if (ledgerRes.status === 'fulfilled' && ledgerRes.value?.success && Array.isArray(ledgerRes.value.sales) && ledgerRes.value.sales.length > 0) {
        salesData = ledgerRes.value.sales;
      }

      // Dynamic fallback: If payment-ledger API returned 0 sales, fallback to getSales direct query
      if (salesData.length === 0 && salesRes.status === 'fulfilled' && Array.isArray(salesRes.value) && salesRes.value.length > 0) {
        salesData = salesRes.value.map(s => {
          let itemsList = [];
          if (Array.isArray(s.items)) itemsList = s.items;
          else if (typeof s.items === 'string' && s.items.trim()) {
            try { itemsList = JSON.parse(s.items); if (typeof itemsList === 'string') itemsList = JSON.parse(itemsList); } catch {}
          }
          if (!Array.isArray(itemsList)) itemsList = [];

          let totalPetis = Number(s.petisBought) || 0;
          let totalEggs = Number(s.eggsBought) || 0;
          let desc = s.itemsDescription || '';

          if (itemsList.length > 0) {
            itemsList.forEach(it => {
              const qty = Number(it.quantity) || 1;
              const u = (it.unitLabel || it.unit || 'peti').toLowerCase();
              if (u.includes('peti')) { totalPetis += qty; totalEggs += qty * 360; }
              else if (u.includes('tray')) { totalPetis += qty / 12; totalEggs += qty * 30; }
              else { totalEggs += qty; totalPetis += qty / 360; }
            });
            if (!desc) desc = itemsList.map(i => `${i.rawProductName || i.name || 'Eggs'} (${i.quantity || 1} ${i.unitLabel || i.unit || 'x'})`).join(', ');
          } else if (totalPetis === 0 && totalEggs === 0 && (Number(s.totalAmount) || 0) > 0) {
            totalPetis = Number(((Number(s.totalAmount) || 0) / 1050).toFixed(2)) || 1;
            totalEggs = Math.round(totalPetis * 360);
            desc = `Eggs Stock (${totalPetis} Petis • ${totalEggs} Eggs)`;
          }

          const totalAmt = Number(s.totalAmount) || 0;
          const cash = Number(s.cashPaid) || (s.paymentMethod === 'CASH' ? totalAmt : 0);
          const bank = Number(s.bankPaid) || (s.paymentMethod !== 'CASH' && !s.isCredit ? totalAmt : 0);
          const due = Number(s.dueAmount) || (s.isCredit ? totalAmt : 0);

          return {
            id: s._id || s.id,
            shopId: s.shopId,
            date: s.saleDate || s.createdAt,
            invoiceNumber: s.invoiceNumber || `INV-${String(s.serialNumber || s.id).slice(-5)}`,
            customerName: s.customerName || (due > 0 ? 'Credit Customer' : 'Walk-in Customer'),
            customerPhone: s.customerPhone || '',
            customerEmail: s.customerEmail || '',
            totalAmount: totalAmt,
            cashPaid: cash,
            bankPaid: bank,
            dueAmount: due,
            paymentMethod: String(s.paymentMethod || 'CASH').toUpperCase(),
            petisBought: totalPetis > 0 ? Number(totalPetis.toFixed(2)) : 0,
            eggsBought: Math.round(totalEggs),
            itemsDescription: desc || 'Eggs Stock',
            items: itemsList,
            category: s.category || (itemsList[0]?.category) || 'Eggs',
            status: due === 0 ? 'PAID' : (cash > 0 || bank > 0 ? 'PARTIAL' : 'CREDIT')
          };
        });
      }

      setLedgerApiData({
        summary: (ledgerRes.status === 'fulfilled' && ledgerRes.value?.summary) || null,
        sales: salesData
      });

      if (creditsRes.status === 'fulfilled' && Array.isArray(creditsRes.value)) {
        setCustomerCredits(creditsRes.value);
      }

      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Error loading Customer Payment Ledger data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeShopId]);

  const handleRefresh = async () => {
    if (fetchData) await fetchData();
    await loadData();
  };

  const fmt = (num) => Number(num || 0).toLocaleString('en-PK');

  // Quick preset helper
  const applyPreset = (preset) => {
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'today') {
      const str = toYMD(today);
      setStartDate(str);
      setEndDate(str);
    } else if (preset === 'month') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(toYMD(startOfMonth));
      setEndDate(toYMD(today));
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Date filter helper
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

  const isInDateRange = (itemDate) => {
    if (!startDate && !endDate) return true;
    if (!itemDate) return true;
    const date = parseSafeDate(itemDate);
    if (!date) return true;

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
  };

  // 1. Process Customer Sales Ledger List
  // 1. Process and Normalize Raw Customer Sales Ledger List
  const normalizedSales = useMemo(() => {
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

        if (cash === 0 && bank === 0 && due === 0) {
          if (pMethod === 'CASH') cash = total;
          else if (pMethod.includes('BANK') || pMethod.includes('ONLINE') || pMethod.includes('EASYPAISA')) bank = total;
          else if (pMethod.includes('CREDIT') || pMethod.includes('DUE')) due = total;
          else cash = total;
        }

        let itemsList = [];
        if (Array.isArray(s.items)) {
          itemsList = s.items;
        } else if (typeof s.items === 'string') {
          try { itemsList = JSON.parse(s.items); } catch {}
        }

        let totalPetisBought = Number(s.petisBought) || 0;
        let totalEggsBought = Number(s.eggsBought) || 0;
        let totalPetisCount = 0;
        let totalTraysCount = 0;
        let totalLooseEggsCount = 0;
        let itemsSummary = [];
        let determinedCategory = s.category || itemsList[0]?.category || '';

        if (itemsList.length > 0) {
          itemsSummary = [];
          itemsList.forEach(it => {
            const qty = Number(it.quantity) || 1;
            const uType = (it.unitLabel || it.unit || it.unitType || '').toLowerCase();
            const itemName = (it.rawProductName || it.name || '').toLowerCase();

            let petiCount = 0;
            let eggCount = 0;

            if (uType.includes('peti') || itemName.includes('peti')) {
              petiCount = qty;
              eggCount = qty * 360;
              totalPetisCount += qty;
            } else if (uType.includes('tray') || itemName.includes('tray')) {
              petiCount = qty / 12;
              eggCount = qty * 30;
              totalTraysCount += qty;
            } else {
              petiCount = qty / 360;
              eggCount = qty;
              totalLooseEggsCount += qty;
            }

            if (Number(it.petiQuantity) > 0) petiCount = Number(it.petiQuantity);
            if (Number(it.totalEggs) > 0) eggCount = Number(it.totalEggs);

            totalPetisBought += petiCount;
            totalEggsBought += eggCount;
            itemsSummary.push(`${it.rawProductName || it.name || 'Eggs'} (${qty} ${it.unitLabel || it.unit || 'units'})`);
            if (!determinedCategory && it.category) determinedCategory = it.category;
          });
        } else {
          totalPetisCount = totalPetisBought;
          if (totalEggsBought === 0 && totalPetisBought > 0) {
            totalEggsBought = totalPetisBought * 360;
          }
        }

        const finalItemsDesc = itemsSummary.length > 0
          ? itemsSummary.join(', ')
          : (s.itemsDescription && s.itemsDescription !== 'Eggs Stock' ? s.itemsDescription : 'Eggs Stock');

        if (!determinedCategory) {
          determinedCategory = 'Eggs';
        }

        return {
          id: s._id || s.id,
          date: s.saleDate || s.date || s.createdAt,
          invoiceNumber: s.invoiceNumber || `INV-${String(s.serialNumber || s.id).slice(-5)}`,
          customerName: s.customerName || (due > 0 ? 'Credit Customer' : 'Walk-in Customer'),
          customerPhone: s.customerPhone || '',
          category: determinedCategory,
          totalAmount: total,
          cashPaid: cash,
          bankPaid: bank,
          dueAmount: due,
          paymentMethod: pMethod,
          petisBought: totalPetisBought > 0 ? Number(totalPetisBought.toFixed(2)) : (totalPetisCount > 0 ? totalPetisCount : 0),
          petisCount: totalPetisCount,
          traysCount: totalTraysCount,
          eggsCount: totalLooseEggsCount,
          eggsBought: Math.round(totalEggsBought > 0 ? totalEggsBought : (totalPetisCount * 360 + totalTraysCount * 30 + totalLooseEggsCount)),
          totalEggsCount: Math.round(totalEggsBought > 0 ? totalEggsBought : (totalPetisCount * 360 + totalTraysCount * 30 + totalLooseEggsCount)),
          itemsDescription: finalItemsDesc,
          items: itemsList,
          isCredit: due > 0 || pMethod.includes('CREDIT')
        };
      });
  }, [ledgerApiData.sales, sales]);

  // Date Filtered Sales
  const allDateFilteredSales = useMemo(() => {
    return normalizedSales
      .filter(item => isInDateRange(item.date))
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [normalizedSales, startDate, endDate]);

  // 2. Stats calculation (Computed from all date-filtered records so top 4 cards always retain accurate totals)
  const stats = useMemo(() => {
    const customerTotalRevenue = allDateFilteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalCashReceived = allDateFilteredSales.reduce((sum, s) => sum + s.cashPaid, 0);
    const totalBankReceived = allDateFilteredSales.reduce((sum, s) => sum + s.bankPaid, 0);
    const customerCreditDueTotal = allDateFilteredSales.reduce((sum, s) => sum + s.dueAmount, 0);
    const totalPetisSold = allDateFilteredSales.reduce((sum, s) => sum + s.petisBought, 0);
    const totalInvoices = allDateFilteredSales.length;

    return {
      customerTotalRevenue,
      totalCashReceived,
      totalBankReceived,
      customerCreditDueTotal,
      totalPetisSold,
      totalInvoices
    };
  }, [allDateFilteredSales]);

  // Master Today Customer Payment Stats
  const todayStats = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const isMatchToday = (raw) => {
      if (!raw) return false;
      const d = new Date(raw);
      if (isNaN(d.getTime())) return false;
      if (d.toDateString() === now.toDateString()) return true;
      const dLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (dLocal === localToday) return true;
      return d.toISOString().split('T')[0] === todayStr;
    };

    const todayList = (normalizedSales || []).filter(s => isMatchToday(s.date || s.createdAt || s.saleDate));
    const customerTotalRevenue = todayList.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
    const totalCashReceived = todayList.reduce((sum, s) => sum + (Number(s.cashPaid) || 0), 0);
    const totalBankReceived = todayList.reduce((sum, s) => sum + (Number(s.bankPaid) || 0), 0);
    const customerCreditDueTotal = todayList.reduce((sum, s) => sum + (Number(s.dueAmount) || 0), 0);
    const totalPetisSold = todayList.reduce((sum, s) => sum + (Number(s.petisBought) || 0), 0);
    const totalInvoices = todayList.length;

    return {
      customerTotalRevenue,
      totalCashReceived,
      totalBankReceived,
      customerCreditDueTotal,
      totalPetisSold,
      totalInvoices
    };
  }, [normalizedSales]);

  // 3. Filtered Customer Sales Ledger List (Filtered by Search Term & Clickable Payment Filter)
  const customerLedgerList = useMemo(() => {
    return allDateFilteredSales
      .filter(item => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (
          item.customerName.toLowerCase().includes(q) ||
          item.customerPhone.toLowerCase().includes(q) ||
          item.invoiceNumber.toLowerCase().includes(q) ||
          item.itemsDescription.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        );
      })
      .filter(item => {
        if (paymentMethodFilter === 'ALL') return true;
        if (paymentMethodFilter === 'CASH') return item.cashPaid > 0 || String(item.paymentMethod).toUpperCase() === 'CASH';
        if (paymentMethodFilter === 'BANK') return item.bankPaid > 0 || String(item.paymentMethod).toUpperCase().includes('BANK') || String(item.paymentMethod).toUpperCase().includes('ONLINE') || String(item.paymentMethod).toUpperCase().includes('EASYPAISA');
        if (paymentMethodFilter === 'SPLIT') return (item.cashPaid > 0 && item.bankPaid > 0) || (item.dueAmount > 0 && (item.cashPaid > 0 || item.bankPaid > 0));
        if (paymentMethodFilter === 'CREDIT') return item.dueAmount > 0 || item.isCredit || String(item.paymentMethod).toUpperCase().includes('CREDIT') || String(item.paymentMethod).toUpperCase().includes('DUE');
        return true;
      });
  }, [allDateFilteredSales, searchTerm, paymentMethodFilter]);

  // 4. Grouped Customer Ledger
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
          totalPetis: 0,
          totalTrays: 0,
          totalEggsCount: 0,
          transactions: []
        };
      }
      map[key].totalAmount += item.totalAmount;
      map[key].cashPaid += item.cashPaid;
      map[key].bankPaid += item.bankPaid;
      map[key].creditDue += item.dueAmount;
      map[key].totalPetis += (item.petisCount || item.petisBought || 0);
      map[key].totalTrays += (item.traysCount || 0);
      map[key].totalEggsCount += (item.totalEggsCount || item.eggsBought || 0);
      map[key].transactions.push(item);
    });
    return Object.values(map).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [customerLedgerList]);

  const toggleCustomer = (custName) => {
    setExpandedCustomers(prev => ({
      ...prev,
      [custName]: !prev[custName]
    }));
  };

  // Open Edit Modal
  const handleOpenEdit = (txn) => {
    if (!isEditAllowed) {
      toast.error("🔒 Super Admin Approval Required: Customer info / invoice editing is locked for this branch.");
      return;
    }
    setEditingSale(txn);
    setEditFormData({
      customerName: txn.customerName || '',
      customerPhone: txn.customerPhone || '',
      category: txn.category || 'Eggs',
      totalAmount: txn.totalAmount || 0,
      cashPaid: txn.cashPaid || 0,
      bankPaid: txn.bankPaid || 0,
      dueAmount: txn.dueAmount || 0,
      paymentMethod: txn.paymentMethod || 'CASH'
    });
  };

  // Submit Edit
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingSale) return;

    setActionLoading(true);
    try {
      const payload = {
        customerName: editFormData.customerName,
        customerPhone: editFormData.customerPhone,
        totalAmount: Number(editFormData.totalAmount) || 0,
        cashPaid: Number(editFormData.cashPaid) || 0,
        bankPaid: Number(editFormData.bankPaid) || 0,
        dueAmount: Number(editFormData.dueAmount) || 0,
        paymentMethod: editFormData.paymentMethod
      };

      try {
        await api.put(`/sales/${editingSale.id}`, payload);
      } catch (saleErr) {
        await api.put(`/sales/customer-payment-ledger/${editingSale.id}`, {
          customerName: payload.customerName,
          customerPhone: payload.customerPhone,
          totalAmount: payload.totalAmount,
          cashPaid: payload.cashPaid,
          bankPaid: payload.bankPaid,
          dueAmount: payload.dueAmount,
          paymentMethod: payload.paymentMethod,
          category: editFormData.category || 'Eggs',
          status: payload.dueAmount === 0 ? 'PAID' : 'PARTIAL'
        });
      }
      toast.success('Sale invoice updated successfully!');
      setEditingSale(null);
      await handleRefresh();
    } catch (err) {
      console.error('Update sale error:', err);
      toast.error(err.response?.data?.message || err.message || 'Failed to update sale invoice');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Delete
  const handleConfirmDelete = async () => {
    if (!deletingSale) return;
    if (!isDeleteAllowed) {
      toast.error("🔒 Super Admin Approval Required: Customer ledger / invoice deletion is locked for this branch.");
      return;
    }

    setActionLoading(true);
    try {
      try {
        await api.delete(`/sales/${deletingSale.id}`);
      } catch (delErr) {
        await api.delete(`/sales/customer-payment-ledger/${deletingSale.id}`);
      }
      toast.success(`Invoice ${deletingSale.invoiceNumber} deleted successfully!`);
      setDeletingSale(null);
      await handleRefresh();
    } catch (err) {
      console.error('Delete sale error:', err);
      toast.error(err.response?.data?.message || err.message || 'Failed to delete sale invoice');
    } finally {
      setActionLoading(false);
    }
  };

  // Print Single Transaction Invoice
  const handlePrintSingleTransaction = (txn) => {
    if (!txn) return;
    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Please allow popups to print invoice');
      return;
    }
    const itemsHtml = Array.isArray(txn.items) && txn.items.length > 0
      ? txn.items.map((it, idx) => `
          <tr>
            <td style="padding: 6px; border: 1px solid #ddd; text-align: center;">${idx + 1}</td>
            <td style="padding: 6px; border: 1px solid #ddd;">${it.rawProductName || it.name || 'Eggs'}</td>
            <td style="padding: 6px; border: 1px solid #ddd; text-align: center;">${it.quantity || 1} ${it.unitLabel || it.unit || ''}</td>
            <td style="padding: 6px; border: 1px solid #ddd; text-align: right;">Rs. ${Number(it.price || it.unitPrice || 0).toLocaleString('en-PK')}</td>
            <td style="padding: 6px; border: 1px solid #ddd; text-align: right;">Rs. ${Number((it.price || it.unitPrice || 0) * (it.quantity || 1)).toLocaleString('en-PK')}</td>
          </tr>
        `).join('')
      : `
          <tr>
            <td style="padding: 6px; border: 1px solid #ddd; text-align: center;">1</td>
            <td style="padding: 6px; border: 1px solid #ddd;">${txn.itemsDescription || 'Eggs'}</td>
            <td style="padding: 6px; border: 1px solid #ddd; text-align: center;">${txn.petisBought > 0 ? txn.petisBought + ' Petis' : '1'}</td>
            <td style="padding: 6px; border: 1px solid #ddd; text-align: right;">Rs. ${Number(txn.totalAmount || 0).toLocaleString('en-PK')}</td>
            <td style="padding: 6px; border: 1px solid #ddd; text-align: right;">Rs. ${Number(txn.totalAmount || 0).toLocaleString('en-PK')}</td>
          </tr>
        `;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice - ${txn.invoiceNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #111; max-width: 600px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 15px; }
            .header h2 { margin: 0; color: #065f46; font-size: 22px; text-transform: uppercase; }
            .header p { margin: 4px 0 0; font-size: 11px; color: #6b7280; }
            .meta-table, .items-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px; }
            .meta-table td { padding: 4px 0; }
            .items-table th { background: #f3f4f6; padding: 6px; border: 1px solid #ddd; text-align: left; }
            .totals { margin-top: 10px; border-top: 2px dashed #9ca3af; padding-top: 10px; font-size: 13px; }
            .total-row { display: flex; justify-content: space-between; padding: 3px 0; }
            .footer { text-align: center; margin-top: 25px; font-size: 10px; color: #9ca3af; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>${user?.shopName || 'POS STORE'}</h2>
            <p>Customer Sales & Payment Invoice</p>
          </div>
          <table class="meta-table">
            <tr>
              <td><strong>Invoice #:</strong> ${txn.invoiceNumber}</td>
              <td style="text-align: right;"><strong>Date:</strong> ${new Date(txn.date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
            </tr>
            <tr>
              <td><strong>Customer:</strong> ${txn.customerName}</td>
              <td style="text-align: right;"><strong>Phone:</strong> ${txn.customerPhone || 'N/A'}</td>
            </tr>
            <tr>
              <td><strong>Category:</strong> ${txn.category || 'Eggs'}</td>
              <td style="text-align: right;"><strong>Payment:</strong> ${txn.paymentMethod || 'CASH'}</td>
            </tr>
          </table>
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 30px; text-align: center;">#</th>
                <th>Product / Description</th>
                <th style="text-align: center;">Quantity</th>
                <th style="text-align: right;">Rate</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div class="totals">
            <div class="total-row"><span>Gross Total:</span><strong>Rs. ${Number(txn.totalAmount || 0).toLocaleString('en-PK')}</strong></div>
            <div class="total-row" style="color: #047857;"><span>Cash Paid:</span><strong>Rs. ${Number(txn.cashPaid || 0).toLocaleString('en-PK')}</strong></div>
            <div class="total-row" style="color: #1d4ed8;"><span>Bank Paid:</span><strong>Rs. ${Number(txn.bankPaid || 0).toLocaleString('en-PK')}</strong></div>
            ${txn.dueAmount > 0 ? `<div class="total-row" style="color: #b45309;"><span>Credit Due:</span><strong>Rs. ${Number(txn.dueAmount || 0).toLocaleString('en-PK')}</strong></div>` : ''}
            <div class="total-row" style="font-size: 15px; font-weight: bold; border-top: 1px solid #ddd; margin-top: 5px; padding-top: 5px;">
              <span>Payment Status:</span>
              <span>${txn.dueAmount === 0 ? 'PAID' : (txn.cashPaid > 0 || txn.bankPaid > 0 ? 'PARTIAL' : 'CREDIT')}</span>
            </div>
          </div>
          <div class="footer">
            <p>Thank you for your business! • Computer Generated Invoice</p>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  // PDF Export
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text('CUSTOMER PAYMENT LEDGER', 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()} | Range: ${startDate || 'All'} to ${endDate || 'Present'}`, 14, 22);

    const tableData = customerLedgerList.map(c => [
      c.invoiceNumber,
      new Date(c.date).toLocaleDateString(),
      c.customerName,
      c.customerPhone || '-',
      c.category,
      c.itemsDescription,
      `${c.petisBought} P`,
      `Rs. ${fmt(c.cashPaid)}`,
      `Rs. ${fmt(c.bankPaid)}`,
      `Rs. ${fmt(c.dueAmount)}`,
      `Rs. ${fmt(c.totalAmount)}`,
      c.dueAmount === 0 ? 'PAID' : (c.cashPaid > 0 || c.bankPaid > 0 ? 'PARTIAL' : 'CREDIT')
    ]);

    autoTable(doc, {
      startY: 28,
      head: [['Invoice #', 'Date', 'Customer', 'Phone', 'Category', 'Products', 'Petis', 'Cash Paid', 'Bank Paid', 'Credit Due', 'Total (Rs)', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] },
      foot: [[
        'Total', '', '', '', '', '',
        `${stats.totalPetisSold.toFixed(1)} P`,
        `Rs. ${fmt(stats.totalCashReceived)}`,
        `Rs. ${fmt(stats.totalBankReceived)}`,
        `Rs. ${fmt(stats.customerCreditDueTotal)}`,
        `Rs. ${fmt(stats.customerTotalRevenue)}`,
        ''
      ]],
      footStyles: { fillColor: [244, 244, 245], textColor: [0, 0, 0], fontStyle: 'bold' }
    });

    doc.save(`Customer_Payment_Ledger_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  // Print Summary Report for Cash, Bank, Credit or Total
  const handlePrintSummaryReport = (reportType) => {
    let filteredTxns = [];
    let title = '';
    let themeColor = '#059669';
    let summaryText = '';
    let totalMainAmount = 0;

    if (reportType === 'CASH') {
      filteredTxns = customerLedgerList.filter(t => Number(t.cashPaid || 0) > 0);
      title = 'CUSTOMER CASH INFLOW REPORT';
      themeColor = '#059669';
      totalMainAmount = stats.totalCashReceived;
      summaryText = `Total Cash Collected: Rs. ${Number(totalMainAmount).toLocaleString('en-PK')}`;
    } else if (reportType === 'BANK') {
      filteredTxns = customerLedgerList.filter(t => Number(t.bankPaid || 0) > 0);
      title = 'CUSTOMER BANK / ONLINE TRANSFERS REPORT';
      themeColor = '#2563eb';
      totalMainAmount = stats.totalBankReceived;
      summaryText = `Total Bank Received: Rs. ${Number(totalMainAmount).toLocaleString('en-PK')}`;
    } else if (reportType === 'CREDIT') {
      filteredTxns = customerLedgerList.filter(t => Number(t.dueAmount || 0) > 0);
      title = 'CUSTOMER OUTSTANDING CREDIT / DUE REPORT';
      themeColor = '#d97706';
      totalMainAmount = stats.customerCreditDueTotal;
      summaryText = `Total Credit Due: Rs. ${Number(totalMainAmount).toLocaleString('en-PK')}`;
    } else {
      filteredTxns = [...customerLedgerList];
      title = 'CUSTOMER TOTAL REVENUE & SALES REPORT';
      themeColor = '#0d9488';
      totalMainAmount = stats.customerTotalRevenue;
      summaryText = `Total Combined Revenue: Rs. ${Number(totalMainAmount).toLocaleString('en-PK')}`;
    }

    if (filteredTxns.length === 0) {
      toast.info(`No ${reportType.toLowerCase()} records found to print.`);
      return;
    }

    const printWin = window.open('', '_blank');
    if (!printWin) {
      toast.error('Pop-up blocked. Please allow pop-ups to print the report.');
      return;
    }

    let rowsHtml = filteredTxns.map((t, idx) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 6px 8px; text-align: center;">${idx + 1}</td>
        <td style="padding: 6px 8px; text-align: center;">${new Date(t.date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
        <td style="padding: 6px 8px; text-align: center; font-weight: bold;">${t.invoiceNumber}</td>
        <td style="padding: 6px 8px; font-weight: bold;">${t.customerName}${t.customerPhone ? `<br><small style="color: #6b7280; font-weight: normal;">${t.customerPhone}</small>` : ''}</td>
        <td style="padding: 6px 8px; text-align: center;"><span style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">${t.category || 'Eggs'}</span></td>
        <td style="padding: 6px 8px; font-size: 11px;">${t.itemsDescription || (Array.isArray(t.items) ? t.items.map(it => (it.rawProductName || it.name) + ' x' + it.quantity).join(', ') : '-')}</td>
        <td style="padding: 6px 8px; text-align: center; font-weight: bold; color: #065f46;">${t.petisBought > 0 ? t.petisBought + ' P' : '-'}</td>
        <td style="padding: 6px 8px; text-align: right; font-weight: bold; color: #047857;">${Number(t.cashPaid || 0) > 0 ? 'Rs. ' + Number(t.cashPaid).toLocaleString('en-PK') : '-'}</td>
        <td style="padding: 6px 8px; text-align: right; font-weight: bold; color: #1d4ed8;">${Number(t.bankPaid || 0) > 0 ? 'Rs. ' + Number(t.bankPaid).toLocaleString('en-PK') : '-'}</td>
        <td style="padding: 6px 8px; text-align: right; font-weight: bold; color: #b45309;">${Number(t.dueAmount || 0) > 0 ? 'Rs. ' + Number(t.dueAmount).toLocaleString('en-PK') : '-'}</td>
        <td style="padding: 6px 8px; text-align: right; font-weight: bold;">Rs. ${Number(t.totalAmount || 0).toLocaleString('en-PK')}</td>
      </tr>
    `).join('');

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 25px; color: #111827; }
            .header { text-align: center; border-bottom: 3px solid ${themeColor}; padding-bottom: 12px; margin-bottom: 15px; }
            .header h1 { margin: 0; color: ${themeColor}; font-size: 24px; text-transform: uppercase; letter-spacing: 0.5px; }
            .header h3 { margin: 4px 0 0; font-size: 14px; color: #374151; }
            .header p { margin: 4px 0 0; font-size: 11px; color: #6b7280; }
            .summary-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 16px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
            .summary-title { font-size: 14px; font-weight: bold; color: ${themeColor}; }
            .summary-stats { font-size: 12px; color: #4b5563; }
            table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
            th { background: #f3f4f6; padding: 8px; border: 1px solid #d1d5db; text-transform: uppercase; font-size: 10px; font-weight: 800; color: #374151; }
            td { border: 1px solid #e5e7eb; }
            tfoot tr td { background: #f3f4f6; font-weight: 900; font-size: 12px; border-top: 2px solid ${themeColor}; padding: 8px; }
            .footer { text-align: center; margin-top: 25px; font-size: 10px; color: #9ca3af; border-top: 1px dashed #d1d5db; padding-top: 8px; }
            @media print {
              body { padding: 10px; }
              @page { size: landscape; margin: 10mm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${user?.shopName || 'POS STORE'}</h1>
            <h3>${title}</h3>
            <p>Generated: ${new Date().toLocaleString('en-PK')} | Date Filter: ${startDate || 'All'} to ${endDate || 'Present'}</p>
          </div>
          <div class="summary-card">
            <div class="summary-title">${summaryText}</div>
            <div class="summary-stats">Total Records: <strong>${filteredTxns.length}</strong> | Petis Sold: <strong>${filteredTxns.reduce((acc, t) => acc + (t.petisBought || t.petisCount || 0), 0)} P</strong></div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                <th>Date</th>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Category</th>
                <th>Products</th>
                <th>Petis</th>
                <th style="text-align: right;">Cash Paid</th>
                <th style="text-align: right;">Bank Paid</th>
                <th style="text-align: right;">Credit Due</th>
                <th style="text-align: right;">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="6" style="text-align: right;">TOTAL SUMMARY:</td>
                <td style="text-align: center; color: #065f46;">${filteredTxns.reduce((acc, t) => acc + (t.petisBought || t.petisCount || 0), 0)} P</td>
                <td style="text-align: right; color: #047857;">Rs. ${Number(filteredTxns.reduce((acc, t) => acc + Number(t.cashPaid || 0), 0)).toLocaleString('en-PK')}</td>
                <td style="text-align: right; color: #1d4ed8;">Rs. ${Number(filteredTxns.reduce((acc, t) => acc + Number(t.bankPaid || 0), 0)).toLocaleString('en-PK')}</td>
                <td style="text-align: right; color: #b45309;">Rs. ${Number(filteredTxns.reduce((acc, t) => acc + Number(t.dueAmount || 0), 0)).toLocaleString('en-PK')}</td>
                <td style="text-align: right;">Rs. ${Number(filteredTxns.reduce((acc, t) => acc + Number(t.totalAmount || 0), 0)).toLocaleString('en-PK')}</td>
              </tr>
            </tfoot>
          </table>
          <div class="footer">
            <p>${user?.shopName || 'POS Store'} • Financial & Sales Management System • Computer Generated Report</p>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <div className="w-full space-y-3.5 text-zinc-900 animate-in fade-in duration-300">
      
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Header Bar */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-emerald-200/90 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0 border-t border-emerald-300">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-900 uppercase">
                Customer Payment Ledger
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                👥 Customer Flow
              </span>
            </div>
            <p className="text-[11px] font-bold text-zinc-500 tracking-wide mt-0.5">
              Live customer cash inflows, bank transfers, credit due &amp; product sales breakdown
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-zinc-600" />
            <span>Print</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-900/10 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 4 Requested KPI Cards: Cash -> Bank -> Credit -> Total */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 4 Clickable KPI Cards: Cash -> Bank -> Credit -> Total (Compact & Close) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-3.5 py-2 bg-gradient-to-r from-emerald-700 via-emerald-800 to-teal-800 text-white rounded-xl shadow-xs">
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-emerald-300" />
            <span className="text-[11px] font-black uppercase tracking-widest">👥 Customer Payment Summary</span>
          </div>
          <span className="text-[10px] font-bold text-emerald-100">
            Total {stats.totalInvoices} Invoices | {stats.totalPetisSold.toFixed(1)} Petis
          </span>
        </div>

        <div className="w-full grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          
          {/* 1. Cash Card */}
          <div
            onClick={() => setPaymentMethodFilter(prev => prev === 'CASH' ? 'ALL' : 'CASH')}
            className={`p-3 rounded-xl border-2 shadow-xs transition-all cursor-pointer active:scale-95 flex flex-col justify-between min-h-[96px] ${
              paymentMethodFilter === 'CASH'
                ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-400/40 shadow-sm'
                : 'bg-white border-emerald-200/90 hover:border-emerald-400 hover:shadow-xs'
            }`}
            title="Click to view Cash Inflow transactions & ledger"
          >
            <div>
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1 truncate">
                  💵 Cash Inflow
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrintSummaryReport('CASH');
                    }}
                    className="p-1 rounded-md border border-emerald-300 bg-white hover:bg-emerald-100 text-emerald-700 hover:text-emerald-900 transition-all cursor-pointer shadow-2xs hover:scale-105"
                    title="Print Total Cash Record"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                  <div className={`p-1 rounded-md border transition-colors shrink-0 ${
                    paymentMethodFilter === 'CASH'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  }`}>
                    <Banknote className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
              <div className="text-base sm:text-lg font-black text-emerald-700 tracking-tight leading-tight">
                Rs. {fmt(stats.totalCashReceived)}
              </div>
              <p className="text-[8.5px] font-bold text-zinc-400 uppercase mt-0.5 tracking-tight truncate">Direct Cash Inflow</p>
            </div>
          </div>

          {/* 2. Bank Card */}
          <div
            onClick={() => setPaymentMethodFilter(prev => prev === 'BANK' ? 'ALL' : 'BANK')}
            className={`p-3 rounded-xl border-2 shadow-xs transition-all cursor-pointer active:scale-95 flex flex-col justify-between min-h-[96px] ${
              paymentMethodFilter === 'BANK'
                ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-400/40 shadow-sm'
                : 'bg-white border-blue-200/90 hover:border-blue-400 hover:shadow-xs'
            }`}
            title="Click to view Bank / Online transactions & ledger"
          >
            <div>
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-800 flex items-center gap-1 truncate">
                  🏦 Bank / Online
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrintSummaryReport('BANK');
                    }}
                    className="p-1 rounded-md border border-blue-300 bg-white hover:bg-blue-100 text-blue-700 hover:text-blue-900 transition-all cursor-pointer shadow-2xs hover:scale-105"
                    title="Print Total Bank Record"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                  <div className={`p-1 rounded-md border transition-colors shrink-0 ${
                    paymentMethodFilter === 'BANK'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-blue-50 text-blue-600 border-blue-200'
                  }`}>
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
              <div className="text-base sm:text-lg font-black text-blue-700 tracking-tight leading-tight">
                Rs. {fmt(stats.totalBankReceived)}
              </div>
              <p className="text-[8.5px] font-bold text-zinc-400 uppercase mt-0.5 tracking-tight truncate">Transferred to Bank</p>
            </div>
          </div>

          {/* 3. Credit Card */}
          <div
            onClick={() => setPaymentMethodFilter(prev => prev === 'CREDIT' ? 'ALL' : 'CREDIT')}
            className={`p-3 rounded-xl border-2 shadow-xs transition-all cursor-pointer active:scale-95 flex flex-col justify-between min-h-[96px] ${
              paymentMethodFilter === 'CREDIT'
                ? 'bg-amber-50/90 border-amber-500 ring-2 ring-amber-400/40 shadow-sm'
                : 'bg-white border-amber-200/90 hover:border-amber-400 hover:shadow-xs'
            }`}
            title="Click to view Credit / Receivable Due ledger"
          >
            <div>
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1 truncate">
                  📋 Credit (Due)
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrintSummaryReport('CREDIT');
                    }}
                    className="p-1 rounded-md border border-amber-300 bg-white hover:bg-amber-100 text-amber-700 hover:text-amber-900 transition-all cursor-pointer shadow-2xs hover:scale-105"
                    title="Print Total Credit Record"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                  <div className={`p-1 rounded-md border transition-colors shrink-0 ${
                    paymentMethodFilter === 'CREDIT'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-amber-50 text-amber-600 border-amber-200'
                  }`}>
                    <CreditCard className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
              <div className="text-base sm:text-lg font-black text-amber-600 tracking-tight leading-tight">
                Rs. {fmt(stats.customerCreditDueTotal)}
              </div>
              <p className="text-[8.5px] font-bold text-zinc-400 uppercase mt-0.5 tracking-tight truncate">Outstanding Balance</p>
            </div>
          </div>

          {/* 4. Total Card */}
          <div
            onClick={() => setPaymentMethodFilter('ALL')}
            className={`p-3 rounded-xl border-2 shadow-xs transition-all cursor-pointer active:scale-95 flex flex-col justify-between min-h-[96px] ${
              paymentMethodFilter === 'ALL'
                ? 'bg-teal-50/90 border-teal-600 ring-2 ring-teal-500/40 shadow-sm'
                : 'bg-white border-teal-200/90 hover:border-teal-400 hover:shadow-xs'
            }`}
            title="Click to view Total Gross Revenue transactions & ledger"
          >
            <div>
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-teal-900 flex items-center gap-1 truncate">
                  💰 Total Revenue
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrintSummaryReport('TOTAL');
                    }}
                    className="p-1 rounded-md border border-teal-300 bg-white hover:bg-teal-100 text-teal-700 hover:text-teal-900 transition-all cursor-pointer shadow-2xs hover:scale-105"
                    title="Print Total Revenue Record"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                  <div className={`p-1 rounded-md border transition-colors shrink-0 ${
                    paymentMethodFilter === 'ALL'
                      ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                      : 'bg-teal-50 text-teal-700 border-teal-200'
                  }`}>
                    <Wallet className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
              <div className="text-base sm:text-lg font-black text-teal-950 tracking-tight leading-tight">
                Rs. {fmt(stats.customerTotalRevenue)}
              </div>
              <p className="text-[8.5px] font-bold text-zinc-500 uppercase mt-0.5 tracking-tight truncate">All Sales Combined</p>
            </div>
          </div>

        </div>

        {/* Dedicated Today Customer Payment Summary (Separate Div Below with Cards) */}
        <div className="mt-4 bg-slate-100 border-2 border-slate-300 rounded-3xl p-5 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-slate-700 animate-pulse" />
              Today's Customer Inflow &amp; Ledger (Daily Breakdown)
            </span>
            <span className="text-xs bg-white text-slate-800 border-2 border-slate-300 px-3 py-1 rounded-xl font-bold shadow-xs">
              {todayStats.totalInvoices} Invoices Today &bull; {todayStats.totalPetisSold.toFixed(1)} Boxes Sold
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">1. Today Cash Inflow</span>
              <div className="text-lg sm:text-xl font-black text-slate-900 mt-2">Rs. {fmt(todayStats.totalCashReceived)}</div>
              <span className="text-[10px] font-bold text-slate-600 truncate mt-1">Direct Cash Received</span>
            </div>
            <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-800">2. Today Bank Inflow</span>
              <div className="text-lg sm:text-xl font-black text-slate-900 mt-2">Rs. {fmt(todayStats.totalBankReceived)}</div>
              <span className="text-[10px] font-bold text-slate-600 truncate mt-1">Transferred to Bank</span>
            </div>
            <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">3. Today Credit Due</span>
              <div className="text-lg sm:text-xl font-black text-slate-900 mt-2">Rs. {fmt(todayStats.customerCreditDueTotal)}</div>
              <span className="text-[10px] font-bold text-slate-600 truncate mt-1">Customer Due Balance</span>
            </div>
            <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-teal-900">4. Total Today Revenue</span>
              <div className="text-lg sm:text-xl font-black text-slate-900 mt-2">Rs. {fmt(todayStats.customerTotalRevenue)}</div>
              <span className="text-[10px] font-bold text-slate-600 truncate mt-1">All Sales Combined</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Filter and Date Calendar Range Bar (Smart & Compact) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-2 sm:p-2.5 shadow-xs space-y-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          
          {/* Sub-View Switcher */}
          <div className="flex items-center gap-1 p-0.5 bg-zinc-100 rounded-lg w-fit">
            <button
              onClick={() => setViewMode('transactions')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                viewMode === 'transactions'
                  ? 'bg-white text-emerald-700 shadow-xs border border-zinc-200'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <FileText className="w-3 h-3" />
              <span>Invoices ({customerLedgerList.length})</span>
            </button>

            <button
              onClick={() => setViewMode('customerwise')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                viewMode === 'customerwise'
                  ? 'bg-white text-emerald-700 shadow-xs border border-zinc-200'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Users className="w-3 h-3" />
              <span>Customer-wise ({groupedCustomerLedger.length})</span>
            </button>
          </div>

          {/* Calendar Date Picker: Start Date & End Date */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-0.5">
              <Calendar className="w-3 h-3 text-emerald-600 shrink-0" />
              <div className="flex items-center gap-1">
                <span className="text-[9.5px] font-black uppercase text-zinc-400">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-[11px] font-bold text-zinc-800 focus:outline-none cursor-pointer"
                  title="Start Date"
                />
              </div>
              <ArrowRight className="w-2.5 h-2.5 text-zinc-300" />
              <div className="flex items-center gap-1">
                <span className="text-[9.5px] font-black uppercase text-zinc-400">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-[11px] font-bold text-zinc-800 focus:outline-none cursor-pointer"
                  title="End Date"
                />
              </div>
              {(startDate || endDate) && (
                <button
                  onClick={() => applyPreset('all')}
                  className="ml-0.5 p-0.5 hover:bg-zinc-200 rounded text-zinc-400 hover:text-zinc-700 cursor-pointer"
                  title="Clear Dates"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Quick date shortcuts */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => applyPreset('today')}
                className="px-2 py-1 rounded-md text-[9.5px] font-black uppercase bg-zinc-100 hover:bg-emerald-50 hover:text-emerald-700 text-zinc-600 border border-zinc-200 cursor-pointer transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => applyPreset('month')}
                className="px-2 py-1 rounded-md text-[9.5px] font-black uppercase bg-zinc-100 hover:bg-emerald-50 hover:text-emerald-700 text-zinc-600 border border-zinc-200 cursor-pointer transition-colors"
              >
                Month
              </button>
              <button
                onClick={() => applyPreset('all')}
                className="px-2 py-1 rounded-md text-[9.5px] font-black uppercase bg-zinc-100 hover:bg-zinc-200 text-zinc-600 border border-zinc-200 cursor-pointer transition-colors"
              >
                All
              </button>
            </div>
          </div>
        </div>

        {/* Search & Method Filters (Compact) */}
        <div className="flex items-center gap-2 pt-1.5 border-t border-zinc-100 flex-wrap max-w-2xl">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3 h-3 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search customer, phone, inv #..."
              className="w-full pl-7 pr-2.5 py-1 rounded-md border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-emerald-500 focus:outline-none text-[11px] font-bold transition-all"
            />
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Filter className="w-2.5 h-2.5 text-zinc-400 shrink-0" />
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="px-2 py-1 rounded-md border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-emerald-500 focus:outline-none text-[11px] font-bold transition-all cursor-pointer"
            >
              <option value="ALL">All Payment Types</option>
              <option value="CASH">Cash Only</option>
              <option value="BANK">Bank / Online</option>
              <option value="SPLIT">Split (Cash + Bank)</option>
              <option value="CREDIT">Credit Only (Due)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* VIEW 1: Compact Full-Width Transactions Table with Category & Actions */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {viewMode === 'transactions' && (
        <div className="bg-white border border-gray-300 rounded-xl shadow-xs overflow-hidden w-full">
          <div className="px-3.5 py-2.5 border-b border-gray-300 flex items-center justify-between bg-gray-50/70">
            <div>
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-zinc-900">
                Customer Sales &amp; Payment Transactions
              </h2>
              <p className="text-[9.5px] font-bold text-zinc-400 uppercase">
                Every sale invoice with products, category, cash, bank, credit &amp; actions
              </p>
            </div>
            <span className="text-[10.5px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 shrink-0">
              {customerLedgerList.length} Records
            </span>
          </div>

          <div className="overflow-x-auto w-full pb-2">
            <table className="w-full text-left text-xs border-collapse border border-gray-300">
              <thead className="bg-gray-100 border-b border-gray-300 text-zinc-900 uppercase text-[10px] font-black tracking-wider">
                <tr>
                  <th className="py-2.5 px-2 text-center whitespace-nowrap border border-gray-300">Date</th>
                  <th className="py-2.5 px-2 text-center whitespace-nowrap border border-gray-300">Invoice #</th>
                  <th className="py-2.5 px-2.5 text-left whitespace-nowrap border border-gray-300">Customer</th>
                  <th className="py-2.5 px-2 text-center whitespace-nowrap border border-gray-300">Category</th>
                  <th className="py-2.5 px-2 text-center whitespace-nowrap border border-gray-300">Products (Box • Pack • Piece)</th>
                  <th className="py-2.5 px-2 text-center whitespace-nowrap border border-gray-300">Box • Piece</th>
                  <th className="py-2.5 px-2 text-right whitespace-nowrap border border-gray-300">Cash Paid</th>
                  <th className="py-2.5 px-2 text-right whitespace-nowrap border border-gray-300">Bank Paid</th>
                  <th className="py-2.5 px-2 text-right whitespace-nowrap border border-gray-300">Credit Due</th>
                  <th className="py-2.5 px-2 text-right whitespace-nowrap border border-gray-300">Total</th>
                  <th className="py-2.5 px-2 text-center whitespace-nowrap border border-gray-300">Status</th>
                  <th className="py-2.5 px-2 text-center whitespace-nowrap border border-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="font-bold text-zinc-800">
                {customerLedgerList.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-zinc-400 border border-gray-300">
                      <Users className="w-6 h-6 mx-auto mb-1 opacity-30" />
                      <p className="text-xs uppercase font-black">No customer transactions match your filter</p>
                    </td>
                  </tr>
                ) : (
                  customerLedgerList.map((txn, idx) => {
                    const isNearBottom = idx >= customerLedgerList.length - 2 && customerLedgerList.length > 2;
                    return (
                    <tr key={txn.id} className="hover:bg-gray-50/80 border-b border-gray-300 transition-colors">
                      <td className="py-2 px-2 text-center whitespace-nowrap font-black text-zinc-900 text-[11px] border border-gray-300">
                        {new Date(txn.date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-2 px-2 text-center whitespace-nowrap font-black text-zinc-950 text-xs border border-gray-300">
                        {txn.invoiceNumber}
                      </td>
                      <td className="py-2 px-2.5 max-w-[125px] border border-gray-300">
                        <div className="font-black text-zinc-950 text-xs truncate" title={txn.customerName}>{txn.customerName}</div>
                        {txn.customerPhone && (
                          <div className="text-[9.5px] text-zinc-500 font-bold truncate">{txn.customerPhone}</div>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center whitespace-nowrap border border-gray-300">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-900 border border-emerald-300">
                          <Tag className="w-2.5 h-2.5" />
                          {txn.category || 'Eggs'}
                        </span>
                      </td>
                      <td className="py-2 px-2 max-w-[215px] border border-gray-300">
                        <div className="flex items-center justify-center gap-1.5 flex-nowrap whitespace-nowrap">
                          {Array.isArray(txn.items) && txn.items.length > 0 ? (
                            <div className="flex items-center gap-1 shrink-0">
                              {txn.items.map((it, iIdx) => (
                                <span
                                  key={iIdx}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-black bg-gray-100 text-gray-900 border border-gray-300"
                                  title={`${it.name || it.rawProductName} (Qty: ${it.quantity} ${it.unitLabel || it.unit || ''})`}
                                >
                                  <span className="truncate max-w-[65px] font-black">{it.rawProductName || it.name}</span>
                                  <span className="font-black px-1 rounded text-[7.5px] bg-gray-300 text-gray-950">
                                    x{it.quantity}
                                  </span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="text-[10px] font-black text-zinc-800 truncate">{txn.itemsDescription}</div>
                          )}

                          {/* Compact Simple 3-Box strip for Master Box • Inner Pack • Piece on the same line */}
                          <div className="flex items-center gap-0.5 shrink-0">
                            <div className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-center min-w-[34px]">
                              <span className="text-[7px] font-black text-gray-600 uppercase block leading-none">Box (360)</span>
                              <span className="text-[10px] font-black text-gray-950 leading-tight block mt-0.5">
                                {txn.petisCount > 0 ? txn.petisCount : (txn.petisBought > 0 ? txn.petisBought : '0')}
                              </span>
                            </div>
                            <div className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-center min-w-[34px]">
                              <span className="text-[7px] font-black text-gray-600 uppercase block leading-none">Pack (12)</span>
                              <span className="text-[10px] font-black text-gray-950 leading-tight block mt-0.5">
                                {txn.traysCount > 0 ? txn.traysCount : '0'}
                              </span>
                            </div>
                            <div className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-center min-w-[38px]">
                              <span className="text-[7px] font-black text-gray-600 uppercase block leading-none">Piece (1)</span>
                              <span className="text-[10px] font-black text-gray-950 leading-tight block mt-0.5">
                                {txn.totalEggsCount > 0 ? txn.totalEggsCount.toLocaleString('en-PK') : (txn.eggsBought > 0 ? txn.eggsBought.toLocaleString('en-PK') : '0')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center whitespace-nowrap border border-gray-300">
                        <div className="font-black text-emerald-800 text-[11px]">
                          {txn.petisBought > 0 ? `${txn.petisBought} Boxes` : `${txn.petisCount || 0} Boxes`}
                        </div>
                        <div className="text-[8.5px] font-bold text-zinc-500">
                          {txn.totalEggsCount > 0 ? `${txn.totalEggsCount.toLocaleString('en-PK')} Pieces` : ''}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right whitespace-nowrap font-black text-emerald-800 text-[11px] border border-gray-300">
                        {txn.cashPaid > 0 ? `Rs. ${fmt(txn.cashPaid)}` : <span className="text-zinc-300">-</span>}
                      </td>
                      <td className="py-2 px-2 text-right whitespace-nowrap font-black text-blue-800 text-[11px] border border-gray-300">
                        {txn.bankPaid > 0 ? `Rs. ${fmt(txn.bankPaid)}` : <span className="text-zinc-300">-</span>}
                      </td>
                      <td className="py-2 px-2 text-right whitespace-nowrap font-black text-amber-700 text-[11px] border border-gray-300">
                        {txn.dueAmount > 0 ? `Rs. ${fmt(txn.dueAmount)}` : <span className="text-zinc-300">-</span>}
                      </td>
                      <td className="py-2 px-2 text-right whitespace-nowrap font-black text-zinc-950 text-xs border border-gray-300">
                        Rs. {fmt(txn.totalAmount)}
                      </td>
                      <td className="py-2 px-2 text-center whitespace-nowrap border border-gray-300">
                        {txn.dueAmount === 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300">
                            Paid
                          </span>
                        ) : txn.cashPaid > 0 || txn.bankPaid > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider bg-blue-100 text-blue-900 border border-blue-300">
                            Partial
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                            Credit
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center whitespace-nowrap border border-gray-300 relative">
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveTxnMenuId(activeTxnMenuId === txn.id ? null : txn.id);
                            }}
                            className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                              activeTxnMenuId === txn.id
                                ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-500/20'
                                : 'bg-white hover:bg-gray-100 text-gray-800 border-gray-300'
                            }`}
                            title="Actions"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {activeTxnMenuId === txn.id && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTxnMenuId(null);
                                }}
                              />
                              <div
                                className={`absolute right-0 ${isNearBottom ? 'bottom-full mb-1' : 'top-full mt-1'} w-40 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-50 text-left animate-in fade-in zoom-in-95 duration-100`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="px-3 py-1 text-[8.5px] font-black text-gray-400 uppercase tracking-wider border-b border-gray-100 mb-0.5">
                                  Actions
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveTxnMenuId(null);
                                    handlePrintSingleTransaction(txn);
                                  }}
                                  className="w-full px-2.5 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-50 flex items-center gap-2 transition-colors cursor-pointer"
                                >
                                  <Printer className="w-3 h-3 text-blue-600 shrink-0" />
                                  <span>Print Invoice</span>
                                </button>
                                {isEditAllowed && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveTxnMenuId(null);
                                      handleOpenEdit(txn);
                                    }}
                                    className="w-full px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <Pencil className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span>Edit Invoice</span>
                                  </button>
                                )}
                                {isDeleteAllowed && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveTxnMenuId(null);
                                      setDeletingSale(txn);
                                    }}
                                    className="w-full px-2.5 py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3 text-rose-600 shrink-0" />
                                    <span>Delete Sale</span>
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* VIEW 2: Customer-wise Grouped Ledger */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {viewMode === 'customerwise' && (
        <div className="space-y-3">
          {groupedCustomerLedger.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center text-zinc-400">
              <Users className="w-7 h-7 mx-auto mb-1.5 opacity-30" />
              <p className="text-xs uppercase font-black">No customer ledger records available</p>
            </div>
          ) : (
            groupedCustomerLedger.map((cust) => {
              const isExpanded = !!expandedCustomers[cust.customerName];
              return (
                <div key={cust.customerName} className="bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden transition-all">
                  
                  {/* Customer Summary Bar */}
                  <div
                    onClick={() => toggleCustomer(cust.customerName)}
                    className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-zinc-50/70 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs shrink-0">
                        {cust.customerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs sm:text-sm font-black text-zinc-900 uppercase">{cust.customerName}</h3>
                          <span className="text-[9.5px] font-black bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">
                            {cust.transactions.length} sales
                          </span>
                        </div>
                        {cust.customerPhone && (
                          <p className="text-[10px] font-bold text-zinc-400">{cust.customerPhone}</p>
                        )}
                      </div>
                    </div>

                    {/* Summary metrics */}
                    <div className="flex items-center gap-3 sm:gap-5 flex-wrap justify-between sm:justify-end">
                      <div className="text-right">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase block">Cash Paid</span>
                        <span className="text-xs font-black text-emerald-700">Rs. {fmt(cust.cashPaid)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase block">Bank Paid</span>
                        <span className="text-xs font-black text-blue-700">Rs. {fmt(cust.bankPaid)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase block">Credit Due</span>
                        <span className={`text-xs font-black ${cust.creditDue > 0 ? 'text-amber-600' : 'text-zinc-400'}`}>
                          Rs. {fmt(cust.creditDue)}
                        </span>
                      </div>
                      <div className="text-right pl-3 border-l border-zinc-200">
                        <span className="text-[9px] font-bold text-zinc-500 uppercase block">Total Sales</span>
                        <span className="text-xs sm:text-sm font-black text-zinc-900">Rs. {fmt(cust.totalAmount)}</span>
                      </div>
                      <div className="text-zinc-400">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Invoices / Products List */}
                  {isExpanded && (
                    <div className="border-t border-zinc-100 bg-zinc-50/50 p-3.5 space-y-2.5 animate-in fade-in duration-200">
                      <h4 className="text-[9.5px] font-black uppercase tracking-wider text-zinc-500">
                        Purchased Products &amp; Invoice Breakdown
                      </h4>

                      <div className="overflow-x-auto rounded-xl border border-gray-300 bg-white shadow-xs">
                        <table className="w-full text-left text-xs border-collapse border border-gray-300">
                          <thead className="bg-gray-100 border-b border-gray-300 text-zinc-900 text-[10px] font-black uppercase tracking-wider">
                            <tr>
                              <th className="py-2.5 px-2 text-center whitespace-nowrap border border-gray-300">Date</th>
                              <th className="py-2.5 px-2 text-center whitespace-nowrap border border-gray-300">Invoice #</th>
                              <th className="py-2.5 px-2 text-center whitespace-nowrap border border-gray-300">Category</th>
                              <th className="py-2.5 px-2 text-center whitespace-nowrap border border-gray-300">Product Details</th>
                              <th className="py-2.5 px-2 text-center whitespace-nowrap border border-gray-300">Petis</th>
                              <th className="py-2.5 px-2 text-right whitespace-nowrap border border-gray-300">Cash</th>
                              <th className="py-2.5 px-2 text-right whitespace-nowrap border border-gray-300">Bank</th>
                              <th className="py-2.5 px-2 text-right whitespace-nowrap border border-gray-300">Credit Due</th>
                              <th className="py-2.5 px-2 text-right whitespace-nowrap border border-gray-300">Total</th>
                              <th className="py-2.5 px-2 text-center whitespace-nowrap border border-gray-300">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="font-bold text-zinc-800">
                            {cust.transactions.map((t, tIdx) => {
                              const isNearBottomSub = tIdx >= cust.transactions.length - 2 && cust.transactions.length > 2;
                              const menuId = `custwise-${t.id}`;
                              return (
                              <tr key={t.id} className="hover:bg-gray-50/80 border-b border-gray-300 transition-colors">
                                <td className="py-2 px-2 text-center whitespace-nowrap font-black text-zinc-900 text-[11px] border border-gray-300">
                                  {new Date(t.date).toLocaleDateString('en-PK')}
                                </td>
                                <td className="py-2 px-2 text-center font-black text-zinc-950 whitespace-nowrap text-xs border border-gray-300">
                                  {t.invoiceNumber}
                                </td>
                                <td className="py-2 px-2 text-center whitespace-nowrap border border-gray-300">
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-900 border border-emerald-300">
                                    {t.category || 'Eggs'}
                                  </span>
                                </td>
                                <td className="py-2 px-2 max-w-[215px] text-zinc-800 text-[11px] border border-gray-300">
                                  {Array.isArray(t.items) && t.items.length > 0 ? (
                                    <div className="w-full flex flex-col items-center justify-center text-center">
                                      <div className="flex flex-wrap items-center justify-center gap-1 mb-1">
                                        {t.items.map((it, iIdx) => (
                                          <span
                                            key={iIdx}
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-black bg-emerald-50 text-emerald-900 border border-emerald-200"
                                          >
                                            <span className="truncate max-w-[70px]">{it.rawProductName || it.name}</span>
                                            <span className="font-black text-emerald-950 bg-emerald-200 px-1 rounded text-[7.5px]">x{it.quantity}</span>
                                          </span>
                                        ))}
                                      </div>
                                      <div className="grid grid-cols-3 gap-0.5 text-center w-full max-w-[130px] mx-auto">
                                        <div className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded">
                                          <span className="text-[7px] font-black text-gray-600 uppercase block leading-none">Peti</span>
                                          <span className="text-[10px] font-black text-gray-950 leading-tight block mt-0.5">{t.petisCount > 0 ? t.petisCount : (t.petisBought > 0 ? t.petisBought : '0')}</span>
                                        </div>
                                        <div className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded">
                                          <span className="text-[7px] font-black text-gray-600 uppercase block leading-none">Tray</span>
                                          <span className="text-[10px] font-black text-gray-950 leading-tight block mt-0.5">{t.traysCount > 0 ? t.traysCount : '0'}</span>
                                        </div>
                                        <div className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded">
                                          <span className="text-[7px] font-black text-gray-600 uppercase block leading-none">Egg</span>
                                          <span className="text-[10px] font-black text-gray-950 leading-tight block mt-0.5">{t.totalEggsCount > 0 ? t.totalEggsCount.toLocaleString('en-PK') : (t.eggsBought > 0 ? t.eggsBought.toLocaleString('en-PK') : '0')}</span>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="font-black">{t.itemsDescription}</span>
                                  )}
                                </td>
                                <td className="py-2 px-2 text-center font-black text-emerald-800 text-[11px] border border-gray-300">
                                  {t.petisBought > 0 ? `${t.petisBought} P` : '-'}
                                </td>
                                <td className="py-2 px-2 text-right text-emerald-800 font-black text-[11px] border border-gray-300">
                                  {t.cashPaid > 0 ? `Rs. ${fmt(t.cashPaid)}` : '-'}
                                </td>
                                <td className="py-2 px-2 text-right text-blue-800 font-black text-[11px] border border-gray-300">
                                  {t.bankPaid > 0 ? `Rs. ${fmt(t.bankPaid)}` : '-'}
                                </td>
                                <td className="py-2 px-2 text-right text-amber-700 font-black text-[11px] border border-gray-300">
                                  {t.dueAmount > 0 ? `Rs. ${fmt(t.dueAmount)}` : '-'}
                                </td>
                                <td className="py-2 px-2 text-right font-black text-zinc-950 text-xs border border-gray-300">
                                  Rs. {fmt(t.totalAmount)}
                                </td>
                                <td className="py-2 px-2 text-center whitespace-nowrap border border-gray-300 relative">
                                  <div className="relative inline-block text-left">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveTxnMenuId(activeTxnMenuId === menuId ? null : menuId);
                                      }}
                                      className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                                        activeTxnMenuId === menuId
                                          ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-500/20'
                                          : 'bg-white hover:bg-gray-100 text-gray-800 border-gray-300'
                                      }`}
                                      title="Actions"
                                    >
                                      <MoreVertical className="w-3.5 h-3.5" />
                                    </button>

                                    {activeTxnMenuId === menuId && (
                                      <>
                                        <div
                                          className="fixed inset-0 z-40"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveTxnMenuId(null);
                                          }}
                                        />
                                        <div
                                          className={`absolute right-0 ${isNearBottomSub ? 'bottom-full mb-1' : 'top-full mt-1'} w-40 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-50 text-left animate-in fade-in zoom-in-95 duration-100`}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <div className="px-3 py-1 text-[8.5px] font-black text-gray-400 uppercase tracking-wider border-b border-gray-100 mb-0.5">
                                            Actions
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveTxnMenuId(null);
                                              handlePrintSingleTransaction(t);
                                            }}
                                            className="w-full px-2.5 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-50 flex items-center gap-2 transition-colors cursor-pointer"
                                          >
                                            <Printer className="w-3 h-3 text-blue-600 shrink-0" />
                                            <span>Print Invoice</span>
                                          </button>
                                          {isEditAllowed && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setActiveTxnMenuId(null);
                                                handleOpenEdit(t);
                                              }}
                                              className="w-full px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 transition-colors cursor-pointer"
                                            >
                                              <Pencil className="w-3 h-3 text-emerald-600 shrink-0" />
                                              <span>Edit Invoice</span>
                                            </button>
                                          )}
                                          {isDeleteAllowed && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setActiveTxnMenuId(null);
                                                setDeletingSale(t);
                                              }}
                                              className="w-full px-2.5 py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                                            >
                                              <Trash2 className="w-3 h-3 text-rose-600 shrink-0" />
                                              <span>Delete Invoice</span>
                                            </button>
                                          )}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                              );
                            })}
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
      {/* EDIT MODAL */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {editingSale && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-zinc-900 uppercase">Edit Sale Invoice</h3>
                  <p className="text-[10px] text-zinc-400 font-bold">{editingSale.invoiceNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingSale(null)}
                className="p-1 rounded-lg text-zinc-400 hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={editFormData.customerName}
                    onChange={(e) => setEditFormData({ ...editFormData, customerName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50 font-bold focus:bg-white focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Customer Phone</label>
                  <input
                    type="text"
                    value={editFormData.customerPhone}
                    onChange={(e) => setEditFormData({ ...editFormData, customerPhone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50 font-bold focus:bg-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Category</label>
                <select
                  value={editFormData.category}
                  onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50 font-bold focus:bg-white focus:border-emerald-500 focus:outline-none"
                >
                  {categories && categories.length > 0 ? (
                    categories.filter(c => c !== 'All').map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))
                  ) : (
                    <>
                      <option value="Eggs">Eggs</option>
                      <option value="Poultry">Poultry</option>
                      <option value="Feed">Feed</option>
                    </>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2.5 pt-1">
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Total (Rs)</label>
                  <input
                    type="number"
                    value={editFormData.totalAmount}
                    onChange={(e) => {
                      const total = Number(e.target.value) || 0;
                      const paid = Number(editFormData.cashPaid || 0) + Number(editFormData.bankPaid || 0);
                      setEditFormData({
                        ...editFormData,
                        totalAmount: total,
                        dueAmount: Math.max(0, total - paid)
                      });
                    }}
                    className="w-full px-2.5 py-2 rounded-xl border border-zinc-200 bg-zinc-50 font-black text-zinc-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-emerald-700 mb-1">Cash Paid (Rs)</label>
                  <input
                    type="number"
                    value={editFormData.cashPaid}
                    onChange={(e) => {
                      const cash = Number(e.target.value) || 0;
                      const paid = cash + Number(editFormData.bankPaid || 0);
                      const total = Number(editFormData.totalAmount || 0);
                      setEditFormData({
                        ...editFormData,
                        cashPaid: cash,
                        dueAmount: Math.max(0, total - paid)
                      });
                    }}
                    className="w-full px-2.5 py-2 rounded-xl border border-zinc-200 bg-zinc-50 font-black text-emerald-700 focus:bg-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-blue-700 mb-1">Bank Paid (Rs)</label>
                  <input
                    type="number"
                    value={editFormData.bankPaid}
                    onChange={(e) => {
                      const bank = Number(e.target.value) || 0;
                      const paid = Number(editFormData.cashPaid || 0) + bank;
                      const total = Number(editFormData.totalAmount || 0);
                      setEditFormData({
                        ...editFormData,
                        bankPaid: bank,
                        dueAmount: Math.max(0, total - paid)
                      });
                    }}
                    className="w-full px-2.5 py-2 rounded-xl border border-zinc-200 bg-zinc-50 font-black text-blue-700 focus:bg-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-amber-600 mb-1">Remaining Due / Credit (Rs)</label>
                <input
                  type="number"
                  value={editFormData.dueAmount}
                  onChange={(e) => setEditFormData({ ...editFormData, dueAmount: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 font-black text-amber-700 focus:bg-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setEditingSale(null)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 text-zinc-600 font-black uppercase text-[11px] hover:bg-zinc-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[11px] shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {deletingSale && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-sm font-black text-zinc-900 uppercase">Delete Invoice Record</h3>
              <p className="text-xs text-zinc-500 mt-1">
                Are you sure you want to permanently delete invoice <span className="font-black text-zinc-900">{deletingSale.invoiceNumber}</span> for <span className="font-black text-zinc-900">{deletingSale.customerName}</span>?
              </p>
            </div>

            <div className="flex items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingSale(null)}
                className="px-4 py-2 rounded-xl border border-zinc-200 text-zinc-600 font-black uppercase text-xs hover:bg-zinc-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={actionLoading}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black uppercase text-xs shadow-sm cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default CustomerPaymentLedger;
