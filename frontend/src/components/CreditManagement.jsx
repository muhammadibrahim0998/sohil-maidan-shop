import React, { useState, useMemo, useEffect } from 'react';
import { 
  CreditCard, 
  Search, 
  Filter, 
  ArrowUpRight, 
  ArrowDownLeft, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Calendar, 
  Printer, 
  FileSpreadsheet, 
  DollarSign, 
  Building2, 
  Users, 
  Truck, 
  Package, 
  RefreshCw, 
  X, 
  ChevronRight,
  UploadCloud,
  Loader2,
  ExternalLink,
  Phone,
  Trash2,
  Sparkles
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CountUpNumber } from './CountUpNumber.jsx';
import { settleSupplierCredit, settleCreditSale, uploadImages, deletePurchaseCredit, deleteItem, getPurchaseCredits, getCustomerCredits, deleteCustomerCredit } from '../services/api';

export function CreditManagement({
  items = [],
  shopSalesList = [],
  registeredCustomersList = [],
  shopId,
  shop,
  currency = 'Rs.',
  initialTab = 'purchases',
  todayMasterMetrics,
  onRefresh,
  onOpenSettleCustomerCredit
}) {
  // Active Tab: 'purchases' or 'customers'
  const [activeTab, setActiveTab] = useState(initialTab || 'purchases');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'UNPAID' | 'PARTIAL'
  const [creditStartDate, setCreditStartDate] = useState('');
  const [creditEndDate, setCreditEndDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');

  const handleApplyDateFilter = (startVal = creditStartDate, endVal = creditEndDate) => {
    setAppliedStartDate(startVal);
    setAppliedEndDate(endVal);
  };

  const handleClearDateFilter = () => {
    setCreditStartDate('');
    setCreditEndDate('');
    setAppliedStartDate('');
    setAppliedEndDate('');
  };

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

  const isDateInSelectedRange = (rawDate) => {
    if (!rawDate) return false;
    const d = parseSafeDate(rawDate);
    if (!d) return false;

    const activeStart = appliedStartDate || creditStartDate;
    const activeEnd = appliedEndDate || creditEndDate;

    if (activeStart || activeEnd) {
      const pad = (n) => String(n).padStart(2, '0');
      const localYMD = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const utcYMD = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

      let startTs = null;
      if (activeStart) {
        const parts = activeStart.split('-').map(Number);
        if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
          startTs = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0).getTime();
        }
      }
      let endTs = null;
      if (activeEnd) {
        const parts = activeEnd.split('-').map(Number);
        if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
          endTs = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999).getTime();
        }
      }

      const itemTs = d.getTime();

      if (activeStart && activeEnd) {
        const inStr = (localYMD >= activeStart && localYMD <= activeEnd) ||
                      (utcYMD >= activeStart && utcYMD <= activeEnd);
        const inTs = (startTs !== null && itemTs >= startTs) && (endTs !== null && itemTs <= endTs);
        return inStr || inTs;
      }
      if (activeStart) {
        const inStr = localYMD >= activeStart || utcYMD >= activeStart;
        const inTs = startTs !== null && itemTs >= startTs;
        return inStr || inTs;
      }
      if (activeEnd) {
        const inStr = localYMD <= activeEnd || utcYMD <= activeEnd;
        const inTs = endTs !== null && itemTs <= endTs;
        return inStr || inTs;
      }
      return true;
    }

    return true;
  };

  // Supplier Settle Modal State
  const [settleSupplierModal, setSettleSupplierModal] = useState({
    isOpen: false,
    item: null,
    paymentMethod: 'Cash',
    amountPaid: '',
    receiptFile: null,
    receiptPreview: null,
    isSubmitting: false,
    error: null,
    successMsg: null,
  });

  // Customer Settle Modal State
  const [settleCustomerModal, setSettleCustomerModal] = useState({
    isOpen: false,
    sale: null,
    paymentMethod: 'CASH',
    amountPaid: '',
    transactionId: '',
    receiptFile: null,
    receiptPreview: null,
    isSubmitting: false,
    error: null,
    successMsg: null,
  });

  const [dbPurchaseCredits, setDbPurchaseCredits] = useState([]);
  const [dbCustomerCredits, setDbCustomerCredits] = useState([]);
  const [loadingCredits, setLoadingCredits] = useState(false);

  const fetchPurchaseCreditsData = async () => {
    try {
      setLoadingCredits(true);
      const data = await getPurchaseCredits(shopId);
      setDbPurchaseCredits(data || []);
    } catch (err) {
      console.error('Failed to fetch purchase credits:', err);
    } finally {
      setLoadingCredits(false);
    }
  };

  const fetchCustomerCreditsData = async () => {
    try {
      const data = await getCustomerCredits(shopId);
      setDbCustomerCredits(data || []);
    } catch (err) {
      console.error('Failed to fetch customer credits:', err);
    }
  };

  useEffect(() => {
    fetchPurchaseCreditsData();
    fetchCustomerCreditsData();
  }, [shopId]);

  // Use database data instead of dynamic calculation
  const purchaseCreditList = useMemo(() => {
    return dbPurchaseCredits.map(item => {
      return {
        ...item,
        calculatedTotalCost: Number(item.totalCost) || 0,
        calculatedPaid: Number(item.paidToDate) || 0,
        calculatedDue: Number(item.pendingDue) || 0,
        status: item.status || (Number(item.pendingDue) === 0 ? 'SETTLED' : (Number(item.paidToDate) > 0 ? 'PARTIAL' : 'UNPAID'))
      };
    });
  }, [dbPurchaseCredits]);

  // Calculate dynamic Customer Credit List (DB table primary with fallback)
  const customerCreditList = useMemo(() => {
    if (dbCustomerCredits && dbCustomerCredits.length > 0) {
      return dbCustomerCredits.map(item => {
        const total = Number(item.totalAmount || 0);
        const paid = Number(item.paidAmount || 0);
        const due = Number(item.dueAmount || 0);
        return {
          ...item,
          customerName: item.customerName || 'Credit Customer',
          customerPhone: item.customerPhone || '',
          invoiceNumber: item.notes || item.invoiceNumber || (item.saleId ? `INV-${String(item.saleId).padStart(5, '0')}` : ''),
          calculatedTotal: total,
          calculatedPaid: paid,
          calculatedDue: due,
          status: item.status || (due === 0 ? 'SETTLED' : (paid > 0 ? 'PARTIAL' : 'UNPAID'))
        };
      });
    }

    return (shopSalesList || []).filter(sale => {
      const isCredit = sale.isCredit || sale.paymentMethod === 'CREDIT' || sale.paymentMethod === 'DUE' || Number(sale.dueAmount) > 0;
      const due = Number(sale.dueAmount !== undefined ? sale.dueAmount : (isCredit ? sale.totalAmount : 0));
      return isCredit || due > 0;
    }).map(sale => {
      const total = Number(sale.totalAmount || 0);
      const due = Number(sale.dueAmount !== undefined ? sale.dueAmount : (sale.isCredit ? total : 0));
      const cashPaid = Number(sale.cashPaid || 0);
      const bankPaid = Number(sale.bankPaid || 0);
      const totalPaid = (cashPaid + bankPaid) > 0 ? (cashPaid + bankPaid) : Math.max(0, total - due);
      
      return {
        ...sale,
        calculatedTotal: total,
        calculatedPaid: totalPaid,
        calculatedDue: due,
        status: due === 0 ? 'SETTLED' : (totalPaid > 0 ? 'PARTIAL' : 'UNPAID')
      };
    });
  }, [dbCustomerCredits, shopSalesList]);

  // Summary KPI calculations
  const totalPurchaseDue = useMemo(() => {
    return purchaseCreditList.reduce((sum, item) => sum + (Number(item.calculatedDue) || 0), 0);
  }, [purchaseCreditList]);

  const totalPurchasePaid = useMemo(() => {
    return purchaseCreditList.reduce((sum, item) => sum + (Number(item.calculatedPaid) || 0), 0);
  }, [purchaseCreditList]);

  const totalCustomerDue = useMemo(() => {
    return customerCreditList.reduce((sum, sale) => sum + (Number(sale.calculatedDue) || 0), 0);
  }, [customerCreditList]);

  const totalCustomerPaid = useMemo(() => {
    return customerCreditList.reduce((sum, sale) => sum + (Number(sale.calculatedPaid) || 0), 0);
  }, [customerCreditList]);

  // Dynamic Today's Credit Metrics (Supplier + Customer)
  const todayCreditStats = useMemo(() => {
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

    let todayPurchaseDue = 0;
    let todayPurchasePaid = 0;
    let todayPurchaseCount = 0;

    (purchaseCreditList || []).forEach(p => {
      if (isMatchToday(p.createdAt || p.purchaseDate || p.date)) {
        todayPurchaseDue += Number(p.calculatedDue || 0);
        todayPurchasePaid += Number(p.calculatedPaid || 0);
        todayPurchaseCount += 1;
      }
    });

    let todayCustomerDue = 0;
    let todayCustomerPaid = 0;
    let todayCustomerCount = 0;

    (customerCreditList || []).forEach(c => {
      if (isMatchToday(c.createdAt || c.saleDate || c.date)) {
        todayCustomerDue += Number(c.calculatedDue || 0);
        todayCustomerPaid += Number(c.calculatedPaid || 0);
        todayCustomerCount += 1;
      }
    });

    return {
      todayPurchaseDue,
      todayPurchasePaid,
      todayPurchaseCount,
      todayCustomerDue,
      todayCustomerPaid,
      todayCustomerCount,
      todayNet: todayCustomerDue - todayPurchaseDue,
      todayTotalAccounts: todayPurchaseCount + todayCustomerCount
    };
  }, [purchaseCreditList, customerCreditList]);

  // Dynamic Today's Real-Time Performance & Inflow (Cash, Bank, Credit, Total)
  const todayInflow = useMemo(() => {
    if (todayMasterMetrics) {
      return {
        cash: Number(todayMasterMetrics.todaySalesCash || 0),
        bank: Number(todayMasterMetrics.todaySalesBank || 0),
        credit: Number(todayMasterMetrics.todaySalesCredit || 0),
        total: Number(todayMasterMetrics.todaySalesRevenue || 0),
        count: Number(todayMasterMetrics.todaySalesCount || 0),
        petis: Number(todayMasterMetrics.todaySalesPetis || 0)
      };
    }
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
    let cash = 0, bank = 0, credit = 0, total = 0, count = 0, petis = 0;
    (shopSalesList || []).forEach(s => {
      if (isMatchToday(s.saleDate || s.createdAt || s.date)) {
        total += Number(s.totalAmount || 0);
        cash += Number(s.cashPaid !== undefined ? s.cashPaid : (s.paymentMethod === 'CASH' ? s.totalAmount : 0)) || 0;
        bank += Number(s.bankPaid !== undefined ? s.bankPaid : (s.paymentMethod === 'BANK' || s.paymentMethod === 'ONLINE' ? s.totalAmount : 0)) || 0;
        credit += Number(s.creditDue || s.dueAmount || (s.paymentMethod === 'CREDIT' ? s.totalAmount : 0)) || 0;
        count += 1;
        if (Number(s.petisBought) > 0) petis += Number(s.petisBought);
      }
    });
    return { cash, bank, credit, total, count, petis };
  }, [todayMasterMetrics, shopSalesList]);

  // Filtered lists based on search & filter status
  const filteredPurchases = useMemo(() => {
    return purchaseCreditList.filter(item => {
      if (appliedStartDate || appliedEndDate) {
        if (!isDateInSelectedRange(item.createdAt || item.purchaseDate || item.date)) return false;
      }
      const matchSearch = (
        (item.name || item.productName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.supplierName || item.supplier || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (!matchSearch) return false;
      if (filterStatus === 'UNPAID') return item.calculatedDue > 0 && item.calculatedPaid === 0;
      if (filterStatus === 'PARTIAL') return item.calculatedDue > 0 && item.calculatedPaid > 0;
      return true;
    });
  }, [purchaseCreditList, searchTerm, filterStatus, appliedStartDate, appliedEndDate]);

  const filteredCustomerSales = useMemo(() => {
    return customerCreditList.filter(sale => {
      if (appliedStartDate || appliedEndDate) {
        if (!isDateInSelectedRange(sale.createdAt || sale.saleDate || sale.date)) return false;
      }
      const matchSearch = (
        (sale.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sale.customerPhone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sale.invoiceNumber || sale.orderNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (!matchSearch) return false;
      if (filterStatus === 'UNPAID') return sale.calculatedDue > 0 && sale.calculatedPaid === 0;
      if (filterStatus === 'PARTIAL') return sale.calculatedDue > 0 && sale.calculatedPaid > 0;
      return true;
    });
  }, [customerCreditList, searchTerm, filterStatus, appliedStartDate, appliedEndDate]);

  // Open Settle Supplier Credit Modal
  const handleOpenSettleSupplier = (item) => {
    const due = Number(item.calculatedDue || item.dueAmountToSupplier || 0);
    const half = Math.round(due / 2);
    setSettleSupplierModal({
      isOpen: true,
      item,
      paymentMethod: 'Cash',
      amountPaid: String(due || ''),
      cashAmount: String(half),
      bankAmount: String(due - half),
      receiptFile: null,
      receiptPreview: null,
      isSubmitting: false,
      error: null,
      successMsg: null,
    });
  };

  const handleSupplierReceiptChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSettleSupplierModal(prev => ({
        ...prev,
        receiptFile: file,
        receiptPreview: URL.createObjectURL(file),
      }));
    }
  };

  const handleConfirmSupplierSettle = async (e) => {
    if (e) e.preventDefault();
    if (!settleSupplierModal.item) return;

    const itemId = settleSupplierModal.item.itemId || settleSupplierModal.item._id || settleSupplierModal.item.id;
    const isSplit = settleSupplierModal.paymentMethod === 'Split';
    const cashVal = isSplit ? (Number(settleSupplierModal.cashAmount) || 0) : (settleSupplierModal.paymentMethod === 'Cash' ? (Number(settleSupplierModal.amountPaid) || 0) : 0);
    const bankVal = isSplit ? (Number(settleSupplierModal.bankAmount) || 0) : (settleSupplierModal.paymentMethod === 'Bank Transfer' ? (Number(settleSupplierModal.amountPaid) || 0) : 0);
    const payAmt = isSplit ? (cashVal + bankVal) : Number(settleSupplierModal.amountPaid);

    if (isNaN(payAmt) || payAmt <= 0) {
      setSettleSupplierModal(prev => ({ ...prev, error: 'Please enter a valid amount greater than 0' }));
      return;
    }

    setSettleSupplierModal(prev => ({ ...prev, isSubmitting: true, error: null }));

    try {
      let receiptUrl = '';
      if (settleSupplierModal.receiptFile) {
        const uploaded = await uploadImages([settleSupplierModal.receiptFile]);
        if (uploaded && uploaded.length > 0) {
          receiptUrl = uploaded[0];
        }
      }

      await settleSupplierCredit(itemId, {
        paymentMethod: settleSupplierModal.paymentMethod,
        amountPaid: payAmt,
        cashAmount: cashVal,
        bankAmount: bankVal,
        paymentReceipt: receiptUrl || undefined,
      });

      setSettleSupplierModal(prev => ({
        ...prev,
        isSubmitting: false,
        successMsg: isSplit
          ? `Rs. ${payAmt.toLocaleString('en-PK')} paid (Cash: Rs. ${cashVal.toLocaleString('en-PK')}, Bank: Rs. ${bankVal.toLocaleString('en-PK')}) successfully!`
          : `Rs. ${payAmt.toLocaleString('en-PK')} successfully paid to supplier!`,
      }));

      await fetchPurchaseCreditsData();
      if (onRefresh) {
        await onRefresh();
      }

      setTimeout(() => {
        setSettleSupplierModal({
          isOpen: false,
          item: null,
          paymentMethod: 'Cash',
          amountPaid: '',
          cashAmount: '',
          bankAmount: '',
          receiptFile: null,
          receiptPreview: null,
          isSubmitting: false,
          error: null,
          successMsg: null,
        });
      }, 1500);
    } catch (err) {
      setSettleSupplierModal(prev => ({
        ...prev,
        isSubmitting: false,
        error: err?.response?.data?.message || err.message || 'Payment settlement failed',
      }));
    }
  };

  // Delete Purchase Credit Record from Database
  const handleDeletePurchaseCredit = async (item) => {
    if (!item) return;
    const itemId = item._id || item.id;
    const itemName = item.name || item.productName || 'Purchase Credit Record';
    if (!window.confirm(`Are you sure you want to delete purchase credit record for "${itemName}" from database?`)) {
      return;
    }

    try {
      if (itemId) {
        try {
          await deletePurchaseCredit(itemId);
        } catch (err) {
          await deleteItem(itemId, '', 'shop_admin');
        }
      }
      setDbPurchaseCredits(prev => prev.filter(pc => String(pc._id || pc.id) !== String(itemId)));
      await fetchPurchaseCreditsData();
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      console.error('Delete purchase credit error:', err);
      alert('Failed to delete purchase credit: ' + (err?.response?.data?.message || err.message));
    }
  };

  // Open Settle Customer Credit Modal
  const handleOpenSettleCustomer = (sale) => {
    if (onOpenSettleCustomerCredit) {
      onOpenSettleCustomerCredit(sale);
    }
    const due = Number(sale.calculatedDue !== undefined ? sale.calculatedDue : (sale.dueAmount !== undefined ? sale.dueAmount : sale.totalAmount || 0));
    setSettleCustomerModal({
      isOpen: true,
      sale,
      paymentMethod: 'CASH',
      amountPaid: String(due || ''),
      transactionId: '',
      receiptFile: null,
      receiptPreview: null,
      isSubmitting: false,
      error: null,
      successMsg: null,
    });
  };

  const handleCustomerReceiptChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSettleCustomerModal(prev => ({
        ...prev,
        receiptFile: file,
        receiptPreview: URL.createObjectURL(file),
      }));
    }
  };

  const handleConfirmCustomerSettle = async (e) => {
    if (e) e.preventDefault();
    if (!settleCustomerModal.sale) return;

    const saleId = settleCustomerModal.sale._id || settleCustomerModal.sale.id || settleCustomerModal.sale.orderId;
    const payAmt = Number(settleCustomerModal.amountPaid);
    if (isNaN(payAmt) || payAmt <= 0) {
      setSettleCustomerModal(prev => ({ ...prev, error: 'Please enter a valid payment amount greater than 0' }));
      return;
    }

    setSettleCustomerModal(prev => ({ ...prev, isSubmitting: true, error: null }));

    try {
      let receiptUrl = '';
      if (settleCustomerModal.receiptFile) {
        const uploaded = await uploadImages([settleCustomerModal.receiptFile]);
        if (uploaded && uploaded.length > 0) {
          receiptUrl = uploaded[0];
        }
      }

      await settleCreditSale(saleId, {
        paymentMethod: settleCustomerModal.paymentMethod,
        amountPaid: payAmt,
        transactionId: settleCustomerModal.transactionId,
        paymentProof: receiptUrl || undefined,
        paymentReceipt: receiptUrl || undefined,
      });

      setSettleCustomerModal(prev => ({
        ...prev,
        isSubmitting: false,
        successMsg: `Credit payment of Rs. ${payAmt.toLocaleString('en-PK')} received successfully!`,
      }));

      if (onRefresh) {
        await onRefresh();
      }

      setTimeout(() => {
        setSettleCustomerModal({
          isOpen: false,
          sale: null,
          paymentMethod: 'CASH',
          amountPaid: '',
          transactionId: '',
          receiptFile: null,
          receiptPreview: null,
          isSubmitting: false,
          error: null,
          successMsg: null,
        });
      }, 1500);
    } catch (err) {
      setSettleCustomerModal(prev => ({
        ...prev,
        isSubmitting: false,
        error: err?.response?.data?.message || err.message || 'Customer credit settlement failed',
      }));
    }
  };

  // PDF Export for Purchases Credit
  const handleExportPurchasesPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`${shop?.name || 'POS Store'} - Purchases Credit Ledger`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-PK')} | Total Owed: Rs. ${totalPurchaseDue.toLocaleString('en-PK')}`, 14, 22);

    const headers = [['#', 'Item Name', 'Supplier', 'Quantity', 'Total Cost (Rs)', 'Paid (Rs)', 'Pending Due (Rs)']];
    const data = filteredPurchases.map((p, idx) => [
      idx + 1,
      p.name || p.productName || 'Egg Stock',
      p.supplierName || 'Farm Supplier',
      `${p.petiQuantity || p.totalPetis || 0} Petis`,
      (p.calculatedTotalCost || 0).toLocaleString('en-PK'),
      (p.calculatedPaid || 0).toLocaleString('en-PK'),
      (p.calculatedDue || 0).toLocaleString('en-PK')
    ]);

    autoTable(doc, {
      head: headers,
      body: data,
      startY: 28,
      theme: 'grid',
      headStyles: { fillColor: [245, 158, 11] }
    });

    doc.save(`Purchases_Credit_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // PDF Export for Customer Credit
  const handleExportCustomersPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`${shop?.name || 'POS Store'} - Customer Credit & Receivables`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-PK')} | Total Receivables: Rs. ${totalCustomerDue.toLocaleString('en-PK')}`, 14, 22);

    const headers = [['#', 'Customer Name', 'Phone', 'Invoice #', 'Total (Rs)', 'Paid (Rs)', 'Due Credit (Rs)']];
    const data = filteredCustomerSales.map((s, idx) => [
      idx + 1,
      s.customerName || 'Walk-in Customer',
      s.customerPhone || '—',
      s.invoiceNumber || s.orderNumber || '—',
      (s.calculatedTotal || 0).toLocaleString('en-PK'),
      (s.calculatedPaid || 0).toLocaleString('en-PK'),
      (s.calculatedDue || 0).toLocaleString('en-PK')
    ]);

    autoTable(doc, {
      head: headers,
      body: data,
      startY: 28,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] }
    });

    doc.save(`Customer_Credit_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ─── Top Header Card ─── */}
      <div className="bg-white border border-zinc-200 rounded-3xl p-5 sm:p-7 shadow-sm text-zinc-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-600 text-xs font-black uppercase tracking-widest mb-1">
            <CreditCard className="w-4 h-4" />
            <span>Credit &amp; Debt Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900">
            Credit Management
          </h1>
          <p className="text-zinc-500 text-xs sm:text-sm font-medium mt-1">
            Track and settle supplier purchase debts and customer receivables dynamically.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => onRefresh && onRefresh()}
            className="flex-1 md:flex-none px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-zinc-300 cursor-pointer shadow-sm active:scale-95"
          >
            <RefreshCw className="w-4 h-4 text-zinc-600" />
            <span>Refresh</span>
          </button>
          
          <button
            onClick={activeTab === 'purchases' ? handleExportPurchasesPDF : handleExportCustomersPDF}
            className="flex-1 md:flex-none px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black rounded-2xl text-xs transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Ledger</span>
          </button>
        </div>
      </div>

      {/* ─── Overview KPI Metric Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Purchases Credit Owed */}
        <div className="bg-white border border-rose-200/80 rounded-3xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                SUPPLIER DEBT
              </span>
              <div className="w-9 h-9 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-rose-600 tracking-tight">
              {currency} <CountUpNumber value={totalPurchaseDue} />
            </div>
            <div className="flex items-center justify-between text-[11px] text-zinc-500 font-bold mt-2 pt-2 border-t border-zinc-100">
              <span>Paid: {currency} {totalPurchasePaid.toLocaleString('en-PK')}</span>
              <span className="text-rose-500">{purchaseCreditList.filter(p => p.calculatedDue > 0).length} Unsettled</span>
            </div>
          </div>
        </div>

        {/* Total Customer Credit Due */}
        <div className="bg-white border border-emerald-200/80 rounded-3xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                CUSTOMER RECEIVABLES
              </span>
              <div className="w-9 h-9 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight">
              {currency} <CountUpNumber value={totalCustomerDue} />
            </div>
            <div className="flex items-center justify-between text-[11px] text-zinc-500 font-bold mt-2 pt-2 border-t border-zinc-100">
              <span>Collected: {currency} {totalCustomerPaid.toLocaleString('en-PK')}</span>
              <span className="text-emerald-600">{customerCreditList.filter(c => c.calculatedDue > 0).length} Invoices</span>
            </div>
          </div>
        </div>

        {/* Net Credit Status */}
        <div className="bg-white border border-zinc-200 rounded-3xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-600 bg-zinc-100 px-2.5 py-1 rounded-full border border-zinc-200">
                NET BALANCE
              </span>
              <div className="w-9 h-9 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-700">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className={`text-2xl sm:text-3xl font-black tracking-tight ${
              (totalCustomerDue - totalPurchaseDue) >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}>
              {currency} <CountUpNumber value={Math.abs(totalCustomerDue - totalPurchaseDue)} />
            </div>
            <div className="text-[11px] text-zinc-500 font-bold mt-2 pt-2 border-t border-zinc-100 truncate">
              {(totalCustomerDue - totalPurchaseDue) >= 0 ? '🟢 Receivables exceed debts' : '🔴 Debts exceed receivables'}
            </div>
          </div>
        </div>

        {/* Total Active Credit Cases */}
        <div className="bg-white border border-zinc-200 rounded-3xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                TOTAL ACTIVE ACCOUNTS
              </span>
              <div className="w-9 h-9 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">
              {purchaseCreditList.filter(p => p.calculatedDue > 0).length + customerCreditList.filter(c => c.calculatedDue > 0).length}
            </div>
            <div className="flex items-center justify-between text-[11px] text-zinc-500 font-bold mt-2 pt-2 border-t border-zinc-100">
              <span>Suppliers: {purchaseCreditList.filter(p => p.calculatedDue > 0).length}</span>
              <span>Customers: {customerCreditList.filter(c => c.calculatedDue > 0).length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── DEDICATED TODAY'S PERFORMANCE & INFLOW (CASH, BANK, CREDIT, TOTAL) ─── */}
      <div className="bg-slate-100 border-2 border-slate-300 rounded-3xl p-5 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-slate-700 animate-pulse" />
            Today's Sales &amp; Inflow Activity (Daily Breakdown)
          </span>
          <span className="text-xs bg-white text-slate-800 border-2 border-slate-300 px-3 py-1 rounded-xl font-bold shadow-xs">
            {todayInflow.count} Invoices &bull; {todayInflow.petis} Boxes Sold
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Card 1: Today Cash Inflow */}
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">1. Today Cash Inflow</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-2">{currency} {todayInflow.cash.toLocaleString('en-PK')}</div>
            <span className="text-[10px] font-bold text-slate-600 truncate mt-1">Direct Cash Received</span>
          </div>

          {/* Card 2: Today Bank Inflow */}
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-800">2. Today Bank Inflow</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-2">{currency} {todayInflow.bank.toLocaleString('en-PK')}</div>
            <span className="text-[10px] font-bold text-slate-600 truncate mt-1">Transferred to Bank</span>
          </div>

          {/* Card 3: Today Credit Given */}
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">3. Today Credit Given</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-2">{currency} {todayInflow.credit.toLocaleString('en-PK')}</div>
            <span className="text-[10px] font-bold text-slate-600 truncate mt-1">Receivables Due</span>
          </div>

          {/* Card 4: Total Today Revenue */}
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-900">4. Total Today Revenue</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-2">{currency} {todayInflow.total.toLocaleString('en-PK')}</div>
            <span className="text-[10px] font-bold text-slate-600 truncate mt-1">All Sales Combined</span>
          </div>
        </div>
      </div>

      {/* ─── 2 Main Branches / Tab Selection Bar ─── */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-2 sm:p-2.5 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
        <div className="flex items-center bg-zinc-100 p-1 rounded-xl gap-1.5 w-full sm:w-auto">
          {/* Branch 1: Purchase Credit */}
          <button
            onClick={() => { setActiveTab('purchases'); setSearchTerm(''); }}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-lg font-black text-xs tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'purchases'
                ? 'bg-amber-500 text-zinc-950 shadow-sm scale-[1.01]'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>1. Purchase Credit</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[9.5px] font-black ${
              activeTab === 'purchases' ? 'bg-zinc-950 text-amber-400' : 'bg-zinc-200 text-zinc-700'
            }`}>
              {purchaseCreditList.filter(p => p.calculatedDue > 0).length}
            </span>
          </button>

          {/* Branch 2: Customer Credit */}
          <button
            onClick={() => { setActiveTab('customers'); setSearchTerm(''); }}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-lg font-black text-xs tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'customers'
                ? 'bg-amber-500 text-zinc-950 shadow-sm scale-[1.01]'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>2. Customer Credit</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[9.5px] font-black ${
              activeTab === 'customers' ? 'bg-zinc-950 text-amber-400' : 'bg-zinc-200 text-zinc-700'
            }`}>
              {customerCreditList.filter(c => c.calculatedDue > 0).length}
            </span>
          </button>
        </div>

        {/* Calendar Date Range Filter */}
        <div className="flex items-center flex-wrap gap-1 p-0.5 sm:p-1 rounded-xl border border-zinc-200 bg-zinc-50 shadow-xs text-zinc-800 shrink-0">
          <div className="flex items-center gap-1 pl-1">
            <Calendar className="w-3 h-3 text-emerald-600 shrink-0" />
            <span className="text-[9.5px] font-black uppercase tracking-wider text-zinc-500">Start:</span>
            <input
              type="date"
              value={creditStartDate}
              onChange={(e) => {
                const val = e.target.value;
                setCreditStartDate(val);
                handleApplyDateFilter(val, creditEndDate);
              }}
              className="w-[108px] sm:w-[114px] px-1.5 py-0.5 rounded-md text-[11px] font-bold outline-none border border-zinc-300 bg-white text-zinc-900 focus:border-emerald-500 cursor-pointer"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9.5px] font-black uppercase tracking-wider text-zinc-500">End:</span>
            <input
              type="date"
              value={creditEndDate}
              onChange={(e) => {
                const val = e.target.value;
                setCreditEndDate(val);
                handleApplyDateFilter(creditStartDate, val);
              }}
              className="w-[108px] sm:w-[114px] px-1.5 py-0.5 rounded-md text-[11px] font-bold outline-none border border-zinc-300 bg-white text-zinc-900 focus:border-emerald-500 cursor-pointer"
            />
          </div>
          <button
            onClick={() => handleApplyDateFilter()}
            className="px-2 py-0.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white rounded-md text-[11px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs transition-all cursor-pointer shrink-0"
            title="Filter credit records by date range"
          >
            <Filter className="w-3 h-3" />
            <span>Filter</span>
          </button>
          {(appliedStartDate || appliedEndDate || creditStartDate || creditEndDate) && (
            <button
              onClick={handleClearDateFilter}
              className="px-1.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer flex items-center gap-0.5 active:scale-95 shrink-0"
              title="Clear date filter"
            >
              <X className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
          {(appliedStartDate || appliedEndDate) && (
            <span className="px-1.5 py-0.2 rounded-full text-[8.5px] font-black tracking-wider uppercase bg-emerald-50 text-emerald-700 border border-emerald-300 whitespace-nowrap">
              Active: {appliedStartDate && appliedEndDate ? `${appliedStartDate} to ${appliedEndDate}` : (appliedStartDate ? `From ${appliedStartDate}` : `Up to ${appliedEndDate}`)}
            </span>
          )}
        </div>

        {/* Filter / Search Bar */}
        <div className="flex items-center gap-2 flex-1 lg:max-w-xs xl:max-w-sm">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={activeTab === 'purchases' ? "Search item/supplier..." : "Search customer/phone..."}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-semibold text-zinc-900 outline-none focus:border-amber-500 focus:bg-white transition-all shadow-inner"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-zinc-50 border border-zinc-200 rounded-xl px-2 py-1.5 text-xs font-bold text-zinc-700 outline-none focus:border-amber-500 cursor-pointer shadow-inner shrink-0"
          >
            <option value="ALL">All Status</option>
            <option value="UNPAID">Unpaid Only</option>
            <option value="PARTIAL">Partially Paid</option>
          </select>
        </div>
      </div>

      {/* ─── BRANCH 1: PURCHASES CREDIT TABLE / CARDS ─── */}
      {activeTab === 'purchases' && (
        <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-4 sm:p-5 bg-zinc-50/80 border-b border-zinc-200 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs sm:text-sm font-black text-zinc-900 uppercase tracking-wider">
                Purchases &amp; Supplier Credit Ledger ({filteredPurchases.length})
              </h3>
            </div>
            <div className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full">
              Total Pending Debt: {currency} {totalPurchaseDue.toLocaleString('en-PK')}
            </div>
          </div>

          {filteredPurchases.length === 0 ? (
            <div className="p-12 text-center text-zinc-400 text-xs font-bold uppercase tracking-widest">
              No purchase credit records found matching your filters.
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-100/70 border-b border-zinc-200 text-zinc-500 font-black uppercase tracking-wider text-[10.5px]">
                      <th className="py-3.5 px-4">#</th>
                      <th className="py-3.5 px-4">Product / Item</th>
                      <th className="py-3.5 px-4">Supplier</th>
                      <th className="py-3.5 px-4">Quantity</th>
                      <th className="py-3.5 px-4">Total Cost</th>
                      <th className="py-3.5 px-4">Paid to Date</th>
                      <th className="py-3.5 px-4">Pending Due</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredPurchases.map((item, idx) => {
                      const isDue = item.calculatedDue > 0;
                      return (
                        <tr key={item._id || item.id || idx} className="hover:bg-zinc-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-black text-zinc-400">#{idx + 1}</td>
                          <td className="py-3.5 px-4">
                            <span className="font-black text-zinc-900 text-sm block">{item.name || item.productName || 'Egg Stock'}</span>
                            <span className="text-[10px] font-bold text-zinc-400">
                              {new Date(item.createdAt || Date.now()).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-zinc-800 bg-zinc-100 px-2.5 py-1 rounded-lg border border-zinc-200 text-[11px]">
                              {item.supplierName || 'Farm Supplier'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-zinc-700">
                            {item.quantityText 
                              ? String(item.quantityText)
                                  .replace(/petis?/gi, 'Boxes')
                                  .replace(/trays?/gi, 'Packs')
                                  .replace(/eggs?/gi, 'Pieces')
                              : `${item.petiQuantity || item.totalPetis || 0} Boxes`}
                          </td>
                          <td className="py-3.5 px-4 font-black text-zinc-900">
                            {currency} {(item.calculatedTotalCost || 0).toLocaleString('en-PK')}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-emerald-600">
                            {currency} {(item.calculatedPaid || 0).toLocaleString('en-PK')}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2.5 py-1 rounded-lg font-black text-xs ${
                              isDue ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-50 text-emerald-600'
                            }`}>
                              {currency} {(item.calculatedDue || 0).toLocaleString('en-PK')}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              item.status === 'SETTLED' ? 'bg-emerald-100 text-emerald-800' : (item.status === 'PARTIAL' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800')
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {isDue ? (
                                <button
                                  onClick={() => handleOpenSettleSupplier(item)}
                                  className="px-2.5 py-1 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-black rounded-lg text-[11px] transition-all shadow-xs active:scale-95 cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                                >
                                  <CreditCard className="w-3 h-3 shrink-0" />
                                  <span>Pay Credit</span>
                                </button>
                              ) : (
                                <span className="text-emerald-600 font-bold text-[11px] inline-flex items-center gap-1 whitespace-nowrap">
                                  <CheckCircle2 className="w-3 h-3" /> Cleared
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => handleDeletePurchaseCredit(item)}
                                className="p-1 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition-all cursor-pointer"
                                title="Delete Record from Database"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="block md:hidden p-3 space-y-3">
                {filteredPurchases.map((item, idx) => {
                  const isDue = item.calculatedDue > 0;
                  return (
                    <div key={`mob_p_${item._id || idx}`} className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-zinc-400 font-black text-xs">#{idx + 1}</span>
                            <span className="font-black text-zinc-900 text-sm">{item.name || item.productName || 'Egg Stock'}</span>
                          </div>
                          <span className="text-[11px] font-bold text-zinc-500 block mt-0.5">
                            Supplier: <strong className="text-zinc-800">{item.supplierName || 'Farm Supplier'}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            item.status === 'SETTLED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {item.status}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeletePurchaseCredit(item)}
                            className="p-1 rounded-md text-rose-600 hover:bg-rose-100 transition-all cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-xl border border-zinc-200 text-center">
                        <div>
                          <span className="text-[9px] font-bold text-zinc-400 uppercase block">Total Cost</span>
                          <span className="text-xs font-black text-zinc-900">{currency} {(item.calculatedTotalCost || 0).toLocaleString('en-PK')}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-zinc-400 uppercase block">Paid</span>
                          <span className="text-xs font-black text-emerald-600">{currency} {(item.calculatedPaid || 0).toLocaleString('en-PK')}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-zinc-400 uppercase block">Pending Due</span>
                          <span className="text-xs font-black text-rose-600">{currency} {(item.calculatedDue || 0).toLocaleString('en-PK')}</span>
                        </div>
                      </div>

                      {isDue && (
                        <button
                          onClick={() => handleOpenSettleSupplier(item)}
                          className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                        >
                          <CreditCard className="w-4 h-4" />
                          <span>Pay Remaining Credit ({currency} {item.calculatedDue.toLocaleString('en-PK')})</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── BRANCH 2: CUSTOMER CREDIT TABLE / CARDS ─── */}
      {activeTab === 'customers' && (
        <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-4 sm:p-5 bg-zinc-50/80 border-b border-zinc-200 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs sm:text-sm font-black text-zinc-900 uppercase tracking-wider">
                Customer Receivables &amp; Due Balances ({filteredCustomerSales.length})
              </h3>
            </div>
            <div className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
              Total Customer Due: {currency} {totalCustomerDue.toLocaleString('en-PK')}
            </div>
          </div>

          {filteredCustomerSales.length === 0 ? (
            <div className="p-12 text-center text-zinc-400 text-xs font-bold uppercase tracking-widest">
              No customer credit records found matching your filters.
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-100/70 border-b border-zinc-200 text-zinc-500 font-black uppercase tracking-wider text-[10.5px]">
                      <th className="py-3.5 px-4">#</th>
                      <th className="py-3.5 px-4">Customer</th>
                      <th className="py-3.5 px-4">Invoice #</th>
                      <th className="py-3.5 px-4">Sale Date</th>
                      <th className="py-3.5 px-4">Total Bill</th>
                      <th className="py-3.5 px-4">Amount Paid</th>
                      <th className="py-3.5 px-4">Remaining Credit Due</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredCustomerSales.map((sale, idx) => {
                      const isDue = sale.calculatedDue > 0;
                      return (
                        <tr key={sale._id || sale.id || idx} className="hover:bg-zinc-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-black text-zinc-400">#{idx + 1}</td>
                          <td className="py-3.5 px-4">
                            <span className="font-black text-zinc-900 text-sm block">{sale.customerName || 'Walk-in Customer'}</span>
                            {sale.customerPhone && (
                              <span className="text-[11px] font-bold text-teal-700 flex items-center gap-1">
                                <Phone className="w-2.5 h-2.5" /> {sale.customerPhone}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded text-[11px]">
                              {sale.invoiceNumber || sale.orderNumber || `BILL-${idx + 1}`}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-zinc-600">
                            {new Date(sale.createdAt || Date.now()).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-3.5 px-4 font-black text-zinc-900">
                            {currency} {(sale.calculatedTotal || 0).toLocaleString('en-PK')}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-emerald-600">
                            {currency} {(sale.calculatedPaid || 0).toLocaleString('en-PK')}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2.5 py-1 rounded-lg font-black text-xs ${
                              isDue ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-600'
                            }`}>
                              {currency} {(sale.calculatedDue || 0).toLocaleString('en-PK')}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              sale.status === 'SETTLED' ? 'bg-emerald-100 text-emerald-800' : (sale.status === 'PARTIAL' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800')
                            }`}>
                              {sale.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            {isDue ? (
                              <button
                                onClick={() => handleOpenSettleCustomer(sale)}
                                className="px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black rounded-lg text-[11px] transition-all shadow-xs active:scale-95 cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                              >
                                <DollarSign className="w-3 h-3 shrink-0" />
                                <span>Receive Payment</span>
                              </button>
                            ) : (
                              <span className="text-emerald-600 font-bold text-[11px] inline-flex items-center gap-1 whitespace-nowrap">
                                <CheckCircle2 className="w-3 h-3" /> Settled
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="block md:hidden p-3 space-y-3">
                {filteredCustomerSales.map((sale, idx) => {
                  const isDue = sale.calculatedDue > 0;
                  return (
                    <div key={`mob_c_${sale._id || idx}`} className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-zinc-400 font-black text-xs">#{idx + 1}</span>
                            <span className="font-black text-zinc-900 text-sm">{sale.customerName || 'Walk-in Customer'}</span>
                          </div>
                          {sale.customerPhone && (
                            <span className="text-[11px] font-bold text-teal-700 block mt-0.5">
                              📞 {sale.customerPhone}
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-zinc-400 block mt-0.5">
                            {sale.invoiceNumber || sale.orderNumber || 'Invoice'}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                          sale.status === 'SETTLED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {sale.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-xl border border-zinc-200 text-center">
                        <div>
                          <span className="text-[9px] font-bold text-zinc-400 uppercase block">Total Bill</span>
                          <span className="text-xs font-black text-zinc-900">{currency} {(sale.calculatedTotal || 0).toLocaleString('en-PK')}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-zinc-400 uppercase block">Paid</span>
                          <span className="text-xs font-black text-emerald-600">{currency} {(sale.calculatedPaid || 0).toLocaleString('en-PK')}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-zinc-400 uppercase block">Remaining Due</span>
                          <span className="text-xs font-black text-amber-600">{currency} {(sale.calculatedDue || 0).toLocaleString('en-PK')}</span>
                        </div>
                      </div>

                      {isDue && (
                        <button
                          onClick={() => handleOpenSettleCustomer(sale)}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                        >
                          <DollarSign className="w-4 h-4" />
                          <span>Receive Payment ({currency} {sale.calculatedDue.toLocaleString('en-PK')})</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── SUPPLIER SETTLEMENT MODAL ─── */}
      {settleSupplierModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white border border-zinc-200 rounded-3xl p-6 max-w-md w-full shadow-2xl text-zinc-900 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight text-zinc-900">Pay Supplier Credit</h3>
                  <p className="text-[11px] font-bold text-zinc-400">
                    {settleSupplierModal.item?.name || 'Egg Stock'} • {settleSupplierModal.item?.supplierName || 'Supplier'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSettleSupplierModal(prev => ({ ...prev, isOpen: false }))}
                className="p-1.5 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {settleSupplierModal.error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{settleSupplierModal.error}</span>
              </div>
            )}

            {settleSupplierModal.successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{settleSupplierModal.successMsg}</span>
              </div>
            )}

            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500 font-bold uppercase text-[10px]">Supplier:</span>
                <span className="font-black text-zinc-900">{settleSupplierModal.item?.supplierName || 'Farm Supplier'}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500 font-bold uppercase text-[10px]">Pending Owed:</span>
                <span className="font-black text-rose-600 text-base">
                  {currency} {(Number(settleSupplierModal.item?.calculatedDue || settleSupplierModal.item?.dueAmountToSupplier || 0)).toLocaleString('en-PK')}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmSupplierSettle} className="space-y-4">
              <div>
                <label className="text-[11px] font-black text-zinc-700 uppercase tracking-wider block mb-1.5">
                  Payment Method:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSettleSupplierModal(prev => {
                      const due = Number(prev.item?.calculatedDue || prev.item?.dueAmountToSupplier || 0);
                      return {
                        ...prev,
                        paymentMethod: 'Cash',
                        amountPaid: prev.amountPaid || String(due)
                      };
                    })}
                    className={`py-2.5 px-2 rounded-xl border text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      settleSupplierModal.paymentMethod === 'Cash'
                        ? 'bg-amber-500 text-zinc-950 border-amber-500 shadow-sm'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" /> Cash
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettleSupplierModal(prev => {
                      const due = Number(prev.item?.calculatedDue || prev.item?.dueAmountToSupplier || 0);
                      return {
                        ...prev,
                        paymentMethod: 'Bank Transfer',
                        amountPaid: prev.amountPaid || String(due)
                      };
                    })}
                    className={`py-2.5 px-2 rounded-xl border text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      settleSupplierModal.paymentMethod === 'Bank Transfer'
                        ? 'bg-amber-500 text-zinc-950 border-amber-500 shadow-sm'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" /> Bank
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettleSupplierModal(prev => {
                      const due = Number(prev.item?.calculatedDue || prev.item?.dueAmountToSupplier || 0);
                      const half = Math.round(due / 2);
                      const c = prev.cashAmount && Number(prev.cashAmount) > 0 ? prev.cashAmount : String(half);
                      const b = prev.bankAmount && Number(prev.bankAmount) > 0 ? prev.bankAmount : String(due - half);
                      return {
                        ...prev,
                        paymentMethod: 'Split',
                        cashAmount: c,
                        bankAmount: b,
                        amountPaid: String(Number(c) + Number(b))
                      };
                    })}
                    className={`py-2.5 px-2 rounded-xl border text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      settleSupplierModal.paymentMethod === 'Split'
                        ? 'bg-amber-500 text-zinc-950 border-amber-500 shadow-sm'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" /> Split
                  </button>
                </div>
              </div>

              {settleSupplierModal.paymentMethod === 'Split' ? (
                <div className="space-y-3 bg-zinc-50 border border-zinc-200 rounded-2xl p-3.5 animate-in fade-in duration-200">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-black text-zinc-700 uppercase tracking-wider block mb-1">
                        💵 Cash Payment ({currency}):
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={settleSupplierModal.cashAmount ?? ''}
                        onChange={e => {
                          const val = e.target.value;
                          setSettleSupplierModal(prev => {
                            const c = Math.max(0, Number(val) || 0);
                            const b = Math.max(0, Number(prev.bankAmount) || 0);
                            return {
                              ...prev,
                              cashAmount: val,
                              amountPaid: String(c + b)
                            };
                          });
                        }}
                        className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs font-black text-zinc-900 outline-none focus:border-amber-500 shadow-sm"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-zinc-700 uppercase tracking-wider block mb-1">
                        🏦 Bank Transfer ({currency}):
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={settleSupplierModal.bankAmount ?? ''}
                        onChange={e => {
                          const val = e.target.value;
                          setSettleSupplierModal(prev => {
                            const c = Math.max(0, Number(prev.cashAmount) || 0);
                            const b = Math.max(0, Number(val) || 0);
                            return {
                              ...prev,
                              bankAmount: val,
                              amountPaid: String(c + b)
                            };
                          });
                        }}
                        className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs font-black text-zinc-900 outline-none focus:border-amber-500 shadow-sm"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="bg-amber-50/90 border border-amber-200/90 rounded-xl p-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[9.5px] font-black uppercase text-amber-800 tracking-wider block">📋 Remaining Credit (Due):</span>
                      <span className="font-black text-rose-600 text-sm">
                        {currency} {Math.max(0, (Number(settleSupplierModal.item?.calculatedDue || settleSupplierModal.item?.dueAmountToSupplier || 0)) - ((Number(settleSupplierModal.cashAmount) || 0) + (Number(settleSupplierModal.bankAmount) || 0))).toLocaleString('en-PK')}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9.5px] font-black uppercase text-zinc-500 tracking-wider block">Total Paid Now:</span>
                      <span className="font-black text-emerald-700 text-sm">
                        {currency} {((Number(settleSupplierModal.cashAmount) || 0) + (Number(settleSupplierModal.bankAmount) || 0)).toLocaleString('en-PK')}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[11px] font-black text-zinc-700 uppercase tracking-wider">
                      Amount Paying ({currency}):
                    </label>
                    <span className="text-[10px] font-bold text-zinc-500">
                      Remaining Credit: {currency} {Math.max(0, (Number(settleSupplierModal.item?.calculatedDue || settleSupplierModal.item?.dueAmountToSupplier || 0)) - (Number(settleSupplierModal.amountPaid) || 0)).toLocaleString('en-PK')}
                    </span>
                  </div>
                  <input
                    type="number"
                    required
                    min="1"
                    max={Number(settleSupplierModal.item?.calculatedDue || settleSupplierModal.item?.dueAmountToSupplier || 999999999)}
                    value={settleSupplierModal.amountPaid}
                    onChange={e => setSettleSupplierModal(prev => ({ ...prev, amountPaid: e.target.value }))}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm font-black text-zinc-900 outline-none focus:border-amber-500 shadow-inner"
                    placeholder="Enter amount to pay"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-black text-zinc-700 uppercase tracking-wider block mb-1.5">
                  Payment Proof / Receipt (Optional):
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleSupplierReceiptChange}
                  className="w-full text-xs text-zinc-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 cursor-pointer"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSettleSupplierModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settleSupplierModal.isSubmitting}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-zinc-950 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  {settleSupplierModal.isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm Payment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── CUSTOMER SETTLEMENT MODAL (RECEIVE PAYMENT) ─── */}
      {settleCustomerModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white border border-zinc-200 rounded-3xl p-6 max-w-md w-full shadow-2xl text-zinc-900 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight text-zinc-900">Receive Customer Payment</h3>
                  <p className="text-[11px] font-bold text-zinc-400">
                    {settleCustomerModal.sale?.customerName || 'Customer'} • {settleCustomerModal.sale?.invoiceNumber || settleCustomerModal.sale?.orderNumber || 'Invoice'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSettleCustomerModal(prev => ({ ...prev, isOpen: false }))}
                className="p-1.5 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {settleCustomerModal.error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{settleCustomerModal.error}</span>
              </div>
            )}

            {settleCustomerModal.successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{settleCustomerModal.successMsg}</span>
              </div>
            )}

            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500 font-bold uppercase text-[10px]">Customer:</span>
                <span className="font-black text-zinc-900">{settleCustomerModal.sale?.customerName || 'Walk-in Customer'}</span>
              </div>
              {settleCustomerModal.sale?.customerPhone && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500 font-bold uppercase text-[10px]">Phone:</span>
                  <span className="font-bold text-teal-700">{settleCustomerModal.sale?.customerPhone}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500 font-bold uppercase text-[10px]">Total Bill:</span>
                <span className="font-bold text-zinc-700">{currency} {(Number(settleCustomerModal.sale?.calculatedTotal || settleCustomerModal.sale?.totalAmount || 0)).toLocaleString('en-PK')}</span>
              </div>
              <div className="flex justify-between items-center text-xs pt-1 border-t border-zinc-200">
                <span className="text-zinc-500 font-bold uppercase text-[10px]">Outstanding Due:</span>
                <span className="font-black text-rose-600 text-base">
                  {currency} {(Number(settleCustomerModal.sale?.calculatedDue !== undefined ? settleCustomerModal.sale?.calculatedDue : settleCustomerModal.sale?.dueAmount || 0)).toLocaleString('en-PK')}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmCustomerSettle} className="space-y-4">
              <div>
                <label className="text-[11px] font-black text-zinc-700 uppercase tracking-wider block mb-1.5">
                  Receiving Payment Method:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSettleCustomerModal(prev => ({ ...prev, paymentMethod: 'CASH' }))}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      settleCustomerModal.paymentMethod === 'CASH'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" /> Cash (Counter)
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettleCustomerModal(prev => ({ ...prev, paymentMethod: 'BANK_TRANSFER' }))}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      settleCustomerModal.paymentMethod === 'BANK_TRANSFER'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" /> Bank Transfer
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black text-zinc-700 uppercase tracking-wider block mb-1.5">
                  Amount Received ({currency}):
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={Number(settleCustomerModal.sale?.calculatedDue !== undefined ? settleCustomerModal.sale?.calculatedDue : settleCustomerModal.sale?.dueAmount || 999999999)}
                  value={settleCustomerModal.amountPaid}
                  onChange={e => setSettleCustomerModal(prev => ({ ...prev, amountPaid: e.target.value }))}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm font-black text-zinc-900 outline-none focus:border-emerald-500 shadow-inner"
                  placeholder="Enter amount received"
                />
              </div>

              {settleCustomerModal.paymentMethod === 'BANK_TRANSFER' && (
                <div>
                  <label className="text-[11px] font-black text-zinc-700 uppercase tracking-wider block mb-1.5">
                    Transaction ID / Reference (Optional):
                  </label>
                  <input
                    type="text"
                    value={settleCustomerModal.transactionId}
                    onChange={e => setSettleCustomerModal(prev => ({ ...prev, transactionId: e.target.value }))}
                    placeholder="e.g. TRX-982183"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-xs font-bold text-zinc-900 outline-none focus:border-emerald-500 shadow-inner"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-black text-zinc-700 uppercase tracking-wider block mb-1.5">
                  Payment Proof / Screenshot (Optional):
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCustomerReceiptChange}
                  className="w-full text-xs text-zinc-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 cursor-pointer"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSettleCustomerModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settleCustomerModal.isSubmitting}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  {settleCustomerModal.isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm Received</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
