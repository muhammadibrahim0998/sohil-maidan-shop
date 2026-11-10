import { useState, useEffect, useMemo } from 'react';
import { Truck, Plus, Search, Filter, Box, Banknote, CreditCard, AlertCircle, Image as ImageIcon, ExternalLink, ShieldCheck, X, FileSpreadsheet, ChevronDown, Printer, Share2, Eye, Edit2, Trash2, CheckCircle2, Building2, UploadCloud, Loader2, MoreVertical, Send, FileText, Calendar } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useProducts } from '../contexts/ProductContext';
import { useUser } from '../contexts/UserContext';
import { getItems, updateItem, deleteItem, settleSupplierCredit, uploadImages, updateVendor, deleteVendor } from '../services/api';
import { CountUpNumber } from './CountUpNumber.jsx';
import { motion, AnimatePresence } from 'framer-motion';

const getReceiptImg = (p) => {
  if (!p) return null;
  if (p.paymentReceipt && typeof p.paymentReceipt === 'string' && p.paymentReceipt.trim()) return p.paymentReceipt;
  if (p.receipt && typeof p.receipt === 'string' && p.receipt.trim()) return p.receipt;
  if (p.paymentProof && typeof p.paymentProof === 'string' && p.paymentProof.trim()) return p.paymentProof;
  return null;
};

export function PurchasesManagement({ products: propProducts, shopId: propShopId, onAddProduct, onEditProduct, onDeleteProduct, onViewProduct, onRefresh }) {
  const { user } = useUser?.() || {};
  const activeShopId = propShopId || (user?.shopId ? (typeof user.shopId === 'object' ? (user.shopId._id || user.shopId.id) : String(user.shopId)) : null);
  const productCtx = useProducts() || {};
  const contextProducts = productCtx.products || [];
  const [apiProducts, setApiProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [timeframe, setTimeframe] = useState('ALL');
  const [purchaseStartDate, setPurchaseStartDate] = useState('');
  const [purchaseEndDate, setPurchaseEndDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');

  const handleApplyPurchaseDate = () => {
    setAppliedStartDate(purchaseStartDate);
    setAppliedEndDate(purchaseEndDate);
    if (purchaseStartDate || purchaseEndDate) setTimeframe('CUSTOM');
  };

  const handleClearPurchaseDate = () => {
    setPurchaseStartDate('');
    setPurchaseEndDate('');
    setAppliedStartDate('');
    setAppliedEndDate('');
    setTimeframe('ALL');
  };

  const isPurchaseDateInRange = (rawDate) => {
    if (!rawDate) return true;
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return true;

    if (appliedStartDate || appliedEndDate) {
      if (appliedStartDate) {
        const s = new Date(appliedStartDate + 'T00:00:00');
        if (d < s) return false;
      }
      if (appliedEndDate) {
        const e = new Date(appliedEndDate + 'T23:59:59.999');
        if (d > e) return false;
      }
      return true;
    }

    if (timeframe === 'DAY') {
      const now = new Date();
      return d.toDateString() === now.toDateString() || d.toISOString().split('T')[0] === now.toISOString().split('T')[0];
    }
    if (timeframe === 'MONTH') {
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (timeframe === 'YEAR') {
      const now = new Date();
      return d.getFullYear() === now.getFullYear();
    }
    return true;
  };

  const getPurchasePeriodLabel = () => {
    if (appliedStartDate && appliedEndDate) {
      if (appliedStartDate === appliedEndDate) return `Date: ${appliedStartDate}`;
      return `${appliedStartDate} to ${appliedEndDate}`;
    }
    if (appliedStartDate) return `From ${appliedStartDate}`;
    if (appliedEndDate) return `Up to ${appliedEndDate}`;
    if (timeframe === 'DAY') return 'Today';
    if (timeframe === 'MONTH') return 'This Month';
    if (timeframe === 'YEAR') return 'This Year';
    return 'All-Time';
  };
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [reportMenuOpen, setReportMenuOpen] = useState(false);
  const [localDeleteDialog, setLocalDeleteDialog] = useState({ isOpen: false, item: null, isDeleting: false });
  const [deletedIds, setDeletedIds] = useState(new Set());
  const [editedItemsMap, setEditedItemsMap] = useState(new Map());

  const [openVendorMenu, setOpenVendorMenu] = useState(null);
  const [openPurchaseMenu, setOpenPurchaseMenu] = useState(null);

  // Dedicated Vendor Invoices List Modal State ("zanla list")
  const [selectedVendorName, setSelectedVendorName] = useState(null);

  // Quick Edit Single Purchase Entry State
  const [quickEditPurchase, setQuickEditPurchase] = useState({
    isOpen: false,
    item: null,
    name: '',
    category: 'Eggs',
    petiQuantity: '',
    trayQuantity: '',
    eggQuantity: '',
    costPrice: '',
    totalPurchaseCost: '',
    amountPaidToSupplier: '',
    dueAmountToSupplier: '',
    paymentMethod: 'Cash',
    supplierName: '',
    supplierPhone: '',
    supplierLocation: '',
    notes: '',
    isSaving: false,
    error: null,
    successMsg: null,
  });

  // Supplier Credit Settlement State
  const [settleModal, setSettleModal] = useState({
    isOpen: false,
    item: null,
    paymentMethod: 'Cash', // 'Cash' | 'Bank Transfer'
    amountPaid: '',
    receiptFile: null,
    receiptPreview: null,
    isSubmitting: false,
    error: null,
    successMsg: null,
  });

  // Edit Vendor / Supplier State
  const [editVendorModal, setEditVendorModal] = useState({
    isOpen: false,
    oldName: '',
    name: '',
    phone: '',
    location: '',
    isSubmitting: false,
    error: null,
  });

  const handleOpenEditVendor = (v) => {
    setEditVendorModal({
      isOpen: true,
      oldName: v?.name || '',
      name: v?.name || '',
      phone: v?.phone || '',
      location: v?.location || '',
      isSubmitting: false,
      error: null,
    });
  };

  const handleSaveEditVendor = async (e) => {
    if (e) e.preventDefault();
    if (!editVendorModal.name.trim()) {
      setEditVendorModal(prev => ({ ...prev, error: 'Vendor name is required' }));
      return;
    }
    setEditVendorModal(prev => ({ ...prev, isSubmitting: true, error: null }));
    try {
      await updateVendor({
        oldName: editVendorModal.oldName,
        name: editVendorModal.name.trim(),
        phone: editVendorModal.phone.trim(),
        location: editVendorModal.location.trim(),
        shopId: activeShopId
      });

      // Update local products state immediately
      setApiProducts(prev => prev.map(p => {
        const pSupplier = (p.supplierName && p.supplierName.trim()) ? p.supplierName.trim() : 'Direct Farm / Unassigned';
        if (pSupplier.toLowerCase() === editVendorModal.oldName.toLowerCase() || pSupplier.toLowerCase() === editVendorModal.name.toLowerCase()) {
          return {
            ...p,
            supplierName: editVendorModal.name.trim(),
            supplierPhone: editVendorModal.phone.trim(),
            supplierLocation: editVendorModal.location.trim(),
            farmLocation: editVendorModal.location.trim()
          };
        }
        return p;
      }));

      await reloadItems();
      setEditVendorModal({ isOpen: false, oldName: '', name: '', phone: '', location: '', isSubmitting: false, error: null });
    } catch (err) {
      console.error('Update vendor error:', err);
      setEditVendorModal(prev => ({
        ...prev,
        isSubmitting: false,
        error: err.response?.data?.message || err.message
      }));
    }
  };

  const handleDeleteVendor = async (v) => {
    if (!v || !v.name) return;
    const vendorName = v.name;
    if (!window.confirm(`Are you sure you want to delete vendor "${vendorName}" and all associated purchase records from MySQL database?`)) {
      return;
    }

    try {
      await deleteVendor({
        name: vendorName,
        shopId: activeShopId
      });

      const vKey = vendorName.toLowerCase();
      setApiProducts(prev => prev.filter(p => {
        const pSupplier = (p.supplierName && p.supplierName.trim()) ? p.supplierName.trim().toLowerCase() : 'direct farm / unassigned';
        return pSupplier !== vKey;
      }));

      await reloadItems();
    } catch (err) {
      console.error('Delete vendor error:', err);
      alert('Failed to delete vendor: ' + (err.response?.data?.message || err.message));
    }
  };

  const reloadItems = async () => {
    try {
      const res = await getItems(activeShopId);
      const itemsList = Array.isArray(res) ? res : res?.items || res?.data || [];
      if (itemsList.length > 0) {
        setApiProducts(itemsList);
      }
      if (onRefresh) {
        try { await onRefresh(); } catch (_) {}
      }
    } catch (err) {
      console.error('Failed to reload items:', err);
    }
  };

  // Fetch items directly if prop or context is empty
  useEffect(() => {
    reloadItems();
  }, [activeShopId]);

  const handleOpenSettleModal = (item, dueAmt) => {
    const due = dueAmt !== undefined ? Number(dueAmt) : Number(item.dueAmountToSupplier || 0);
    const half = Math.floor(due / 2);
    setSettleModal({
      isOpen: true,
      item,
      paymentMethod: 'Cash',
      amountPaid: due ? String(due) : '',
      cashAmount: half > 0 ? String(half) : '',
      bankAmount: (due - half) > 0 ? String(due - half) : '',
      receiptFile: null,
      receiptPreview: null,
      isSubmitting: false,
      error: null,
      successMsg: null,
    });
  };

  const handleReceiptFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSettleModal(prev => ({
        ...prev,
        receiptFile: file,
        receiptPreview: URL.createObjectURL(file),
      }));
    }
  };

  const handleConfirmSettle = async (e) => {
    if (e) e.preventDefault();
    if (!settleModal.item) return;

    const itemId = settleModal.item._id || settleModal.item.id;
    const isSplit = settleModal.paymentMethod === 'Split';
    const cashVal = isSplit ? (Number(settleModal.cashAmount) || 0) : (settleModal.paymentMethod === 'Cash' ? (Number(settleModal.amountPaid) || 0) : 0);
    const bankVal = isSplit ? (Number(settleModal.bankAmount) || 0) : (settleModal.paymentMethod === 'Bank Transfer' ? (Number(settleModal.amountPaid) || 0) : 0);
    const payAmt = isSplit ? (cashVal + bankVal) : Number(settleModal.amountPaid);

    if (isNaN(payAmt) || payAmt <= 0) {
      setSettleModal(prev => ({ ...prev, error: 'Please enter a valid amount greater than 0' }));
      return;
    }

    setSettleModal(prev => ({ ...prev, isSubmitting: true, error: null }));

    try {
      let receiptUrl = '';
      if (settleModal.receiptFile) {
        const uploaded = await uploadImages([settleModal.receiptFile]);
        if (uploaded && uploaded.length > 0) {
          receiptUrl = uploaded[0];
        }
      }

      const res = await settleSupplierCredit(itemId, {
        paymentMethod: settleModal.paymentMethod,
        amountPaid: payAmt,
        cashAmount: cashVal,
        bankAmount: bankVal,
        paymentReceipt: receiptUrl || undefined,
      });

      const updatedItem = res?.item;

      // Update apiProducts locally
      setApiProducts(prev => prev.map(p => {
        if (p._id === itemId) {
          const currentDue = Number(p.dueAmountToSupplier) || 0;
          const currentPaid = Number(p.amountPaidToSupplier) || 0;
          return {
            ...p,
            ...(updatedItem || {}),
            dueAmountToSupplier: Math.max(0, currentDue - payAmt),
            amountPaidToSupplier: currentPaid + payAmt,
            isOnlinePayment: settleModal.paymentMethod !== 'Cash' ? true : p.isOnlinePayment,
            paymentReceipt: receiptUrl || p.paymentReceipt,
          };
        }
        return p;
      }));

      if (productCtx?.fetchProducts) {
        try { await productCtx.fetchProducts(); } catch (_) {}
      }
      if (onRefresh) {
        try { await onRefresh(); } catch (_) {}
      }

      setSettleModal(prev => ({
        ...prev,
        isSubmitting: false,
        successMsg: `Rs. ${payAmt.toLocaleString('en-PK')} successfully paid via ${settleModal.paymentMethod === 'Cash' ? 'Cash' : 'Bank Transfer'}!`,
      }));

      setTimeout(() => {
        setSettleModal({
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
        reloadItems();
        if (onRefresh) {
          try { onRefresh(); } catch (_) {}
        }
      }, 1200);
    } catch (err) {
      console.error('Error settling supplier credit:', err);
      setSettleModal(prev => ({
        ...prev,
        isSubmitting: false,
        error: err.response?.data?.message || err.message || 'Failed to pay credit',
      }));
    }
  };


  const handleDeleteClick = async (item) => {
    if (!item) return;
    const itemId = item._id || item.id || item.itemId || (typeof item === 'string' ? item : null);
    const itemName = item.name || 'this purchase';
    if (!itemId || itemId === 'undefined') return;
    if (!window.confirm(`Are you sure you want to delete purchase "${itemName}"?`)) return;
    
    // 1. Instantly remove from local UI state
    const strId = String(itemId);
    const numId = Number(itemId);
    setDeletedIds(prev => {
      const next = new Set(prev);
      next.add(itemId);
      next.add(strId);
      if (!isNaN(numId)) next.add(numId);
      if (item._id) { next.add(item._id); next.add(String(item._id)); }
      if (item.id) { next.add(item.id); next.add(String(item.id)); }
      if (item.itemId) { next.add(item.itemId); next.add(String(item.itemId)); }
      return next;
    });
    setApiProducts(prev => prev.filter(p => String(p._id) !== strId && String(p.id) !== strId && String(p.itemId) !== strId));

    // 2. Call backend API
    try {
      await deleteItem(itemId, '', user?.role || 'super_admin');
    } catch (err) {
      console.error('[Direct Delete Item API]:', err);
    }

    // 3. Notify parent and product context
    if (productCtx?.deleteProduct) {
      try { await productCtx.deleteProduct(itemId); } catch (_) {}
    }
    if (onRefresh) {
      try { await onRefresh(); } catch (_) {}
    }
    await reloadItems();
  };

  const products = useMemo(() => {
    const raw = (propProducts && propProducts.length > 0)
      ? propProducts
      : ((contextProducts && contextProducts.length > 0) ? contextProducts : apiProducts);
    return raw
      .filter(p => {
        const id1 = p._id !== undefined && p._id !== null ? String(p._id) : null;
        const id2 = p.id !== undefined && p.id !== null ? String(p.id) : null;
        const id3 = p.itemId !== undefined && p.itemId !== null ? String(p.itemId) : null;

        if (id1 && (deletedIds.has(id1) || deletedIds.has(Number(id1)))) return false;
        if (id2 && (deletedIds.has(id2) || deletedIds.has(Number(id2)))) return false;
        if (id3 && (deletedIds.has(id3) || deletedIds.has(Number(id3)))) return false;
        return true;
      })
      .map(p => {
        const idKey = String(p._id || p.id || p.itemId);
        if (editedItemsMap.has(idKey)) {
          return { ...p, ...editedItemsMap.get(idKey) };
        }
        return p;
      })
      .filter(p => !activeShopId || !p.shopId || String(p.shopId?._id || p.shopId) === String(activeShopId));
  }, [propProducts, contextProducts, apiProducts, deletedIds, editedItemsMap, activeShopId]);

  // Timeframe date filtering logic
  const filteredByTimeframeProducts = useMemo(() => {
    return products.filter((p) => {
      const dateVal = p.purchaseDate || p.createdAt || p.updatedAt;
      return isPurchaseDateInRange(dateVal);
    });
  }, [products, timeframe, appliedStartDate, appliedEndDate]);

  const purchaseItems = useMemo(() => {
    return filteredByTimeframeProducts.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.supplierName && p.supplierName.toLowerCase().includes(searchTerm.toLowerCase()));

      return matchesSearch;
    });
  }, [filteredByTimeframeProducts, searchTerm]);

  // Aggregate vendors from purchase items
  const aggregatedVendors = useMemo(() => {
    const map = new Map();
    filteredByTimeframeProducts.forEach(item => {
      const vName = (item.supplierName && item.supplierName.trim()) ? item.supplierName.trim() : 'Direct Farm / Unassigned';
      const vKey = vName.toLowerCase();
      if (!map.has(vKey)) {
        map.set(vKey, {
          name: vName,
          phone: item.supplierPhone || item.supplierContact || '',
          location: item.supplierLocation || item.farmLocation || '',
          products: [],
          totalCost: 0,
          totalPaid: 0,
          totalDue: 0,
          totalPetis: 0,
          totalTrays: 0,
          totalEggs: 0,
        });
      }
      const v = map.get(vKey);
      if (!v.phone && item.supplierPhone) v.phone = item.supplierPhone;
      if (!v.location && item.supplierLocation) v.location = item.supplierLocation;

      const itemPetis = Number(item.petiQuantity) || 0;
      const itemTrays = Number(item.trayQuantity) || 0;
      const itemEggs = Number(item.eggQuantity) || Number(item.stock) || 0;
      const unitCost = Number(item.costPrice) > 0 ? Number(item.costPrice) : Number(item.price || 0);
      const unitDivisor = item.unitType === 'egg' ? 1 : item.unitType === 'tray' ? 30 : 360;
      const costVal = Number(item.totalPurchaseCost) > 0
        ? Number(item.totalPurchaseCost)
        : (itemPetis > 0 ? itemPetis * unitCost : (itemEggs * (unitCost / unitDivisor)));

      const pMethod = String(item.paymentMethod || 'Cash').trim().toLowerCase();
      const isCreditMethod = pMethod.includes('credit') || pMethod.includes('due') || pMethod.includes('partial');
      const hasExplicitDue = item.dueAmountToSupplier !== undefined && item.dueAmountToSupplier !== null && Number(item.dueAmountToSupplier) > 0;

      let dueVal = 0;
      let paidVal = 0;
      if (hasExplicitDue || isCreditMethod) {
        dueVal = Math.min(costVal, Math.max(0, hasExplicitDue ? Number(item.dueAmountToSupplier) : costVal));
        paidVal = Math.max(0, costVal - dueVal);
      } else {
        paidVal = costVal;
        dueVal = 0;
      }

      v.products.push({ ...item, costVal, paidVal, dueVal });
      v.totalCost += costVal;
      v.totalPaid += paidVal;
      v.totalDue += dueVal;
      if (itemPetis > 0 || itemTrays > 0 || itemEggs > 0) {
        v.totalPetis += itemPetis + (itemTrays / 12) + (itemEggs / 360);
        v.totalTrays += (itemPetis * 12) + itemTrays + (itemEggs / 30);
      } else {
        v.totalPetis += itemEggs / 360;
        v.totalTrays += itemEggs / 30;
      }
      v.totalEggs += itemEggs;
    });

    return Array.from(map.values()).map(v => ({
      ...v,
      totalCost: Math.round(v.totalCost),
      totalPaid: Math.round(v.totalPaid),
      totalDue: Math.round(v.totalDue),
      totalPetis: Number(v.totalPetis.toFixed(1)),
      totalTrays: Math.round(v.totalTrays),
    }));
  }, [filteredByTimeframeProducts]);

  const selectedVendor = useMemo(() => {
    if (!selectedVendorName) return null;
    return aggregatedVendors.find(v => v.name.toLowerCase() === selectedVendorName.toLowerCase()) || null;
  }, [aggregatedVendors, selectedVendorName]);

  const stats = useMemo(() => {
    let totalPurchasesCost = 0;
    let cashPaid = 0;
    let bankPaid = 0;
    let totalDue = 0;
    let totalPetisPurchased = 0;
    let totalEggsPurchased = 0;
    let totalEggsRemaining = 0;

    filteredByTimeframeProducts.forEach((p) => {
      const stockEggs = Number(p.stock !== undefined ? p.stock : (p.eggQuantity || 0));
      totalEggsRemaining += stockEggs;

      const petiQty = Number(p.petiQuantity) || 0;
      const trayQty = Number(p.trayQuantity) || 0;
      const eggQty = Number(p.eggQuantity) || 0;

      let itemPurchasedEggs = 0;
      if (petiQty > 0 || trayQty > 0 || eggQty > 0) {
        itemPurchasedEggs = Math.max(stockEggs, (petiQty * 360) + (trayQty * 30) + (eggQty > 0 && petiQty === 0 && trayQty === 0 ? eggQty : 0));
      } else {
        itemPurchasedEggs = stockEggs;
      }
      totalEggsPurchased += itemPurchasedEggs;
      totalPetisPurchased += itemPurchasedEggs / 360;

      const unitCost = Number(p.costPrice) > 0 ? Number(p.costPrice) : Number(p.price || 0);
      const unitDivisor = p.unitType === 'egg' ? 1 : p.unitType === 'tray' ? 30 : 360;

      const cost = Number(p.totalPurchaseCost) > 0
        ? Number(p.totalPurchaseCost)
        : (petiQty > 0 ? petiQty * unitCost : (stockEggs > 0 ? stockEggs * (unitCost / unitDivisor) : 0));

      const receiptImg = getReceiptImg(p);
      const pMethod = String(p.paymentMethod || 'Cash').trim().toLowerCase();

      // 1. Determine payment channel
      const isOnline = p.isOnlinePayment === true || !!receiptImg || (
        pMethod.includes('bank') || 
        pMethod.includes('easy') || 
        pMethod.includes('jazz') || 
        pMethod.includes('online') || 
        pMethod.includes('cheque') || 
        pMethod.includes('transfer') ||
        pMethod.includes('card')
      );

      const isCredit = !isOnline && (
        pMethod.includes('credit') || 
        pMethod.includes('due')
      );

      // 2. Strict Routed Paid vs Due (Credit) calculation (No overlap)
      const hasExplicitDue = p.dueAmountToSupplier !== undefined && p.dueAmountToSupplier !== null && Number(p.dueAmountToSupplier) >= 0;
      let due = 0;
      let paid = 0;

      if (hasExplicitDue || isCredit) {
        const rawDue = hasExplicitDue ? Number(p.dueAmountToSupplier) : cost;
        due = Math.min(cost, Math.max(0, rawDue));
        paid = Math.max(0, cost - due);
      } else {
        // 100% Paid (No Credit)
        paid = cost;
        due = 0;
      }

      if (p.amountPaidToSupplier !== undefined && p.amountPaidToSupplier !== null && Number(p.amountPaidToSupplier) > 0) {
        paid = Number(p.amountPaidToSupplier);
      }

      // 3. Aggregate totals
      totalPurchasesCost += isNaN(cost) ? 0 : cost;
      totalDue += isNaN(due) ? 0 : due;

      let itemCashPaid = 0;
      let itemBankPaid = 0;

      if (p.cashPaidToSupplier !== undefined && p.cashPaidToSupplier !== null && Number(p.cashPaidToSupplier) > 0) {
        itemCashPaid = Number(p.cashPaidToSupplier);
      }
      if (p.bankPaidToSupplier !== undefined && p.bankPaidToSupplier !== null && Number(p.bankPaidToSupplier) > 0) {
        itemBankPaid = Number(p.bankPaidToSupplier);
      }

      if (itemCashPaid === 0 && itemBankPaid === 0 && paid > 0) {
        const isStrictBank = (
          pMethod.includes('bank') || 
          pMethod.includes('easy') || 
          pMethod.includes('jazz') || 
          pMethod.includes('transfer') || 
          pMethod.includes('online') ||
          p.isOnlinePayment === true
        );
        if (isStrictBank) {
          itemBankPaid = paid;
        } else {
          itemCashPaid = paid;
        }
      }

      cashPaid += isNaN(itemCashPaid) ? 0 : itemCashPaid;
      bankPaid += isNaN(itemBankPaid) ? 0 : itemBankPaid;
    });

    const totalEggsSold = Math.max(0, totalEggsPurchased - totalEggsRemaining);
    const totalPetisSold = Number((totalEggsSold / 360).toFixed(1));
    const totalPetisRemaining = Number((totalEggsRemaining / 360).toFixed(1));
    const totalTraysRemaining = Math.round(totalEggsRemaining / 30);

    return {
      totalPurchasesCost: isNaN(totalPurchasesCost) ? 0 : Math.round(totalPurchasesCost),
      cashPaid: isNaN(cashPaid) ? 0 : Math.round(cashPaid),
      bankPaid: isNaN(bankPaid) ? 0 : Math.round(bankPaid),
      totalDue: isNaN(totalDue) ? 0 : Math.round(totalDue),
      totalPetis: isNaN(totalPetisPurchased) ? 0 : Number(totalPetisPurchased.toFixed(1)),
      totalTrays: isNaN(totalPetisPurchased) ? 0 : Math.round(totalPetisPurchased * 12),
      totalEggs: isNaN(totalEggsPurchased) ? 0 : Math.round(totalEggsPurchased),
      remainingPetis: isNaN(totalPetisRemaining) ? 0 : totalPetisRemaining,
      remainingTrays: isNaN(totalTraysRemaining) ? 0 : totalTraysRemaining,
      remainingEggs: isNaN(totalEggsRemaining) ? 0 : Math.round(totalEggsRemaining),
      soldPetis: isNaN(totalPetisSold) ? 0 : totalPetisSold,
      soldEggs: isNaN(totalEggsSold) ? 0 : Math.round(totalEggsSold)
    };
  }, [filteredByTimeframeProducts]);

  // ─── Master Today Purchases Stats ───
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

    const todayProducts = (products || []).filter(p => isMatchToday(p.purchaseDate || p.createdAt || p.date));

    let totalPurchasesCost = 0;
    let cashPaid = 0;
    let bankPaid = 0;
    let totalDue = 0;
    let totalPetisPurchased = 0;
    let totalEggsPurchased = 0;
    let totalEggsRemaining = 0;

    todayProducts.forEach((p) => {
      const stockEggs = Number(p.stock !== undefined ? p.stock : (p.eggQuantity || 0));
      totalEggsRemaining += stockEggs;

      const petiQty = Number(p.petiQuantity) || 0;
      const trayQty = Number(p.trayQuantity) || 0;
      const eggQty = Number(p.eggQuantity) || 0;

      let itemPurchasedEggs = 0;
      if (petiQty > 0 || trayQty > 0 || eggQty > 0) {
        itemPurchasedEggs = Math.max(stockEggs, (petiQty * 360) + (trayQty * 30) + (eggQty > 0 && petiQty === 0 && trayQty === 0 ? eggQty : 0));
      } else {
        itemPurchasedEggs = stockEggs;
      }
      totalEggsPurchased += itemPurchasedEggs;
      totalPetisPurchased += itemPurchasedEggs / 360;

      const unitCost = Number(p.costPrice) > 0 ? Number(p.costPrice) : Number(p.price || 0);
      const unitDivisor = p.unitType === 'egg' ? 1 : p.unitType === 'tray' ? 30 : 360;

      const cost = Number(p.totalPurchaseCost) > 0
        ? Number(p.totalPurchaseCost)
        : (petiQty > 0 ? petiQty * unitCost : (stockEggs > 0 ? stockEggs * (unitCost / unitDivisor) : 0));

      const receiptImg = getReceiptImg(p);
      const pMethod = String(p.paymentMethod || 'Cash').trim().toLowerCase();

      const isOnline = p.isOnlinePayment === true || !!receiptImg || (
        pMethod.includes('bank') || 
        pMethod.includes('easy') || 
        pMethod.includes('jazz') || 
        pMethod.includes('online') || 
        pMethod.includes('cheque') || 
        pMethod.includes('transfer') ||
        pMethod.includes('card')
      );

      const isCredit = !isOnline && (
        pMethod.includes('credit') || 
        pMethod.includes('due')
      );

      const hasExplicitDue = p.dueAmountToSupplier !== undefined && p.dueAmountToSupplier !== null && Number(p.dueAmountToSupplier) >= 0;
      let due = 0;
      let paid = 0;

      if (hasExplicitDue || isCredit) {
        const rawDue = hasExplicitDue ? Number(p.dueAmountToSupplier) : cost;
        due = Math.min(cost, Math.max(0, rawDue));
        paid = Math.max(0, cost - due);
      } else {
        paid = cost;
      }

      totalPurchasesCost += isNaN(cost) ? 0 : cost;
      totalDue += isNaN(due) ? 0 : due;

      let itemCashPaid = 0;
      let itemBankPaid = 0;

      if (p.cashPaidToSupplier !== undefined && p.cashPaidToSupplier !== null && Number(p.cashPaidToSupplier) > 0) {
        itemCashPaid = Number(p.cashPaidToSupplier);
      }
      if (p.bankPaidToSupplier !== undefined && p.bankPaidToSupplier !== null && Number(p.bankPaidToSupplier) > 0) {
        itemBankPaid = Number(p.bankPaidToSupplier);
      }

      if (itemCashPaid === 0 && itemBankPaid === 0 && paid > 0) {
        const isStrictBank = (
          pMethod.includes('bank') || 
          pMethod.includes('easy') || 
          pMethod.includes('jazz') || 
          pMethod.includes('transfer') || 
          pMethod.includes('online') ||
          p.isOnlinePayment === true
        );
        if (isStrictBank) {
          itemBankPaid = paid;
        } else {
          itemCashPaid = paid;
        }
      }

      cashPaid += isNaN(itemCashPaid) ? 0 : itemCashPaid;
      bankPaid += isNaN(itemBankPaid) ? 0 : itemBankPaid;
    });

    const totalEggsSold = Math.max(0, totalEggsPurchased - totalEggsRemaining);
    const totalPetisSold = Number((totalEggsSold / 360).toFixed(1));
    const totalPetisRemaining = Number((totalEggsRemaining / 360).toFixed(1));
    const totalTraysRemaining = Math.round(totalEggsRemaining / 30);

    return {
      count: todayProducts.length,
      totalPurchasesCost: isNaN(totalPurchasesCost) ? 0 : Math.round(totalPurchasesCost),
      cashPaid: isNaN(cashPaid) ? 0 : Math.round(cashPaid),
      bankPaid: isNaN(bankPaid) ? 0 : Math.round(bankPaid),
      totalDue: isNaN(totalDue) ? 0 : Math.round(totalDue),
      totalPetis: isNaN(totalPetisPurchased) ? 0 : Number(totalPetisPurchased.toFixed(1)),
      totalTrays: isNaN(totalPetisPurchased) ? 0 : Math.round(totalPetisPurchased * 12),
      totalEggs: isNaN(totalEggsPurchased) ? 0 : Math.round(totalEggsPurchased),
      remainingPetis: isNaN(totalPetisRemaining) ? 0 : totalPetisRemaining,
      remainingTrays: isNaN(totalTraysRemaining) ? 0 : totalTraysRemaining,
      remainingEggs: isNaN(totalEggsRemaining) ? 0 : Math.round(totalEggsRemaining),
      soldPetis: isNaN(totalPetisSold) ? 0 : totalPetisSold,
      soldEggs: isNaN(totalEggsSold) ? 0 : Math.round(totalEggsSold)
    };
  }, [products]);

  const attachedReceipts = useMemo(() => {
    return filteredByTimeframeProducts.filter(p => !!getReceiptImg(p));
  }, [filteredByTimeframeProducts]);

  const totalReceiptsAmount = useMemo(() => {
    return attachedReceipts.reduce((sum, p) => {
      const stockEggs = Number(p.stock) || 0;
      const cost = Number(p.totalPurchaseCost) || (Number(p.costPrice) > 0 ? (stockEggs * (Number(p.costPrice) / (p.unitType === 'egg' ? 1 : p.unitType === 'tray' ? 30 : 360))) : 0);
      const receiptImg = getReceiptImg(p);
      const paid = Number(p.amountPaidToSupplier) || (receiptImg ? cost : 0);
      return sum + (isNaN(paid) ? 0 : paid);
    }, 0);
  }, [attachedReceipts]);

  const fmt = (n) => Number(n || 0).toLocaleString('en-PK');

  // ── Print Single Purchase Receipt Voucher ("single single am print kegi") ──
  const handlePrintSinglePurchase = (pItem) => {
    if (!pItem) return;
    const printWin = window.open('', '_blank', 'width=900,height=800');
    if (!printWin) {
      alert('Please allow browser popups to print purchase receipt');
      return;
    }

    const itemPetis = pItem.petiQuantity || (pItem.stock ? (pItem.stock / 360).toFixed(1) : 0);
    const itemTrays = pItem.trayQuantity || (pItem.stock ? Math.round(pItem.stock / 30) : 0);
    const itemEggs = pItem.eggQuantity || pItem.stock || 0;
    const pMethod = String(pItem.paymentMethod || 'Cash').trim();
    const unitCost = Number(pItem.costPrice) > 0 ? Number(pItem.costPrice) : Number(pItem.price || 0);
    const unitDivisor = pItem.unitType === 'egg' ? 1 : pItem.unitType === 'tray' ? 30 : 360;
    const costVal = Number(pItem.costVal) > 0
      ? Number(pItem.costVal)
      : (Number(pItem.totalPurchaseCost) > 0
          ? Number(pItem.totalPurchaseCost)
          : (Number(itemPetis) > 0 ? Number(itemPetis) * unitCost : (Number(itemEggs) * (unitCost / unitDivisor))));

    const isCreditMethod = pMethod.toLowerCase().includes('credit') || pMethod.toLowerCase().includes('due') || pMethod.toLowerCase().includes('partial');
    const hasExplicitDue = pItem.dueAmountToSupplier !== undefined && pItem.dueAmountToSupplier !== null && Number(pItem.dueAmountToSupplier) > 0;

    let dueBalanceAmount = 0;
    let paidAmount = 0;

    if (pItem.dueVal !== undefined && pItem.paidVal !== undefined) {
      dueBalanceAmount = Number(pItem.dueVal) || 0;
      paidAmount = Number(pItem.paidVal) || 0;
    } else if (hasExplicitDue || isCreditMethod) {
      const rawDue = hasExplicitDue ? Number(pItem.dueAmountToSupplier) : costVal;
      dueBalanceAmount = Math.min(costVal, Math.max(0, rawDue));
      paidAmount = Math.max(0, costVal - dueBalanceAmount);
    } else {
      paidAmount = costVal;
      dueBalanceAmount = 0;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Purchase Receipt - ${pItem.name || 'Stock Inward'}</title>
          <meta charset="utf-8" />
          <style>
            @page { size: portrait; margin: 8mm 10mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; color: #0f172a; font-size: 12px; margin: 0; }
            .no-print { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; }
            .btn-print { padding: 8px 18px; background: #0f766e; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 12px; }
            .btn-close { padding: 8px 18px; background: #64748b; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 12px; }
            .header { text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 10px; margin-bottom: 15px; }
            .header h1 { margin: 0; color: #0f766e; font-size: 20px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; }
            .header p { margin: 4px 0 0; color: #64748b; font-weight: bold; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; }
            .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; margin-bottom: 12px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11.5px; }
            .row:last-child { margin-bottom: 0; }
            .label { color: #64748b; font-weight: bold; }
            .val { font-weight: 900; color: #0f172a; }
            .total-box { background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 10px; padding: 12px; margin-top: 15px; }
            .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; color: #64748b; }
            .sign { border-top: 1.5px solid #94a3b8; width: 150px; text-align: center; padding-top: 6px; }
            @media print {
              .no-print { display: none !important; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button class="btn-print" onclick="window.print()">🖨️ Direct Print</button>
            <button class="btn-close" onclick="window.close()">✕ Close</button>
          </div>
          <div class="header">
            <h1>PURCHASE VOUCHER</h1>
            <p>Purchase Invoice &amp; Stock Inward Voucher</p>
          </div>
          <div class="box">
            <div class="row"><span class="label">Product Name:</span><span class="val">${pItem.name || 'N/A'}</span></div>
            <div class="row"><span class="label">Category:</span><span class="val">${pItem.category || 'Product'}</span></div>
            <div class="row"><span class="label">Vendor / Supplier:</span><span class="val">${pItem.supplierName || 'Supplier'}</span></div>
            ${pItem.supplierPhone ? `<div class="row"><span class="label">Vendor Contact:</span><span class="val">${pItem.supplierPhone}</span></div>` : ''}
            ${pItem.supplierLocation ? `<div class="row"><span class="label">Vendor Location:</span><span class="val">${pItem.supplierLocation}</span></div>` : ''}
            <div class="row"><span class="label">Purchase Date:</span><span class="val">${new Date(pItem.createdAt || pItem.purchaseDate || Date.now()).toLocaleDateString('en-PK')}</span></div>
          </div>
          <div class="box">
            <div class="row"><span class="label">Stock Volume:</span><span class="val">${Number(itemEggs).toLocaleString()} Products</span></div>
            <div class="row"><span class="label">Unit Buy Cost:</span><span class="val">Rs. ${fmt(unitCost)}</span></div>
            <div class="row"><span class="label">Payment Method:</span><span class="val">${pMethod}</span></div>
          </div>
          <div class="total-box">
            <div class="row" style="font-size: 13px;"><span class="label" style="color: #166534;">Total Purchase Value:</span><span class="val" style="color: #166534;">Rs. ${fmt(costVal)}</span></div>
            <div class="row" style="font-size: 12px;"><span class="label" style="color: #059669;">Amount Paid:</span><span class="val" style="color: #059669;">Rs. ${fmt(paidAmount)}</span></div>
            <div class="row" style="font-size: 12px;"><span class="label" style="color: ${dueBalanceAmount > 0 ? '#e11d48' : '#64748b'};">Credit (Due) Balance:</span><span class="val" style="color: ${dueBalanceAmount > 0 ? '#e11d48' : '#64748b'};">Rs. ${fmt(dueBalanceAmount)}</span></div>
          </div>
          <div class="footer">
            <div class="sign">Supplier Signature</div>
            <div class="sign">Authorized Signature</div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); }, 150);
            };
          </script>
        </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      try { printWin.print(); } catch (e) { console.error(e); }
    }, 250);
  };

  // ── Print Total Consolidated Vendor Statement & Ledger ("total am print kegi") ──
  const handleDirectPrintVendor = (vendor) => {
    if (!vendor) return;
    const printWin = window.open('', '_blank', 'width=900,height=800');
    if (!printWin) {
      alert('Please allow popups to print vendor statement');
      return;
    }

    const tableRows = (vendor.products || []).map((p, idx) => {
      const petis = p.petiQuantity || (p.stock ? (p.stock / 360).toFixed(1) : 0);
      const trays = p.trayQuantity || (p.stock ? Math.round(p.stock / 30) : 0);
      const eggs = p.eggQuantity || p.stock || 0;
      const rate = Number(p.costPrice) > 0 ? Number(p.costPrice) : Number(p.price || 0);
      const cost = Number(p.costVal) || Number(p.totalPurchaseCost) || 0;
      const paid = Number(p.paidVal) !== undefined ? Number(p.paidVal) : (Number(p.amountPaidToSupplier) || 0);
      const due = Number(p.dueVal) !== undefined ? Number(p.dueVal) : (Number(p.dueAmountToSupplier) || 0);
      const pDate = new Date(p.createdAt || p.purchaseDate || Date.now()).toLocaleDateString('en-PK');
      return `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td><strong>${p.name || 'Unnamed Product'}</strong><br/><small style="color:#64748b;">${pDate}</small></td>
          <td>${p.category || 'Product'}</td>
          <td style="text-align:center;">${Number(eggs).toLocaleString()} Products</td>
          <td style="text-align:right;">Rs. ${fmt(rate)}</td>
          <td style="text-align:right; font-weight:bold;">Rs. ${fmt(cost)}</td>
          <td style="text-align:right; color:#059669; font-weight:bold;">Rs. ${fmt(paid)}</td>
          <td style="text-align:right; color:${due > 0 ? '#e11d48' : '#64748b'}; font-weight:bold;">Rs. ${fmt(due)}</td>
          <td style="text-align:center;"><span class="badge ${due > 0 ? 'badge-due' : 'badge-paid'}">${due > 0 ? 'Credit Due' : 'Paid'}</span></td>
        </tr>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Vendor Statement - ${vendor.name}</title>
          <meta charset="utf-8" />
          <style>
            @page { size: portrait; margin: 8mm 10mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 15px; color: #0f172a; background: #fff; font-size: 11px; margin: 0; }
            .no-print { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; }
            .btn-print { padding: 8px 18px; background: #0f766e; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 12px; }
            .btn-close { padding: 8px 18px; background: #64748b; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 12px; }
            .header { text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 8px; margin-bottom: 12px; }
            .header h1 { margin: 0; color: #0f766e; text-transform: uppercase; font-size: 18px; font-weight: 900; letter-spacing: 1px; }
            .header p { margin: 3px 0 0; color: #64748b; font-weight: 800; font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; }
            .meta { display: flex; justify-content: space-between; font-size: 9.5px; font-weight: 800; margin-bottom: 10px; background: #f8fafc; padding: 8px 12px; border-radius: 8px; border: 1px solid #e2e8f0; }
            .stats-grid { display: flex; gap: 8px; margin-bottom: 12px; }
            .stat-card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px; border-radius: 8px; text-align: center; }
            .stat-card label { font-size: 8px; font-weight: 900; color: #64748b; text-transform: uppercase; display: block; }
            .stat-card .val { font-size: 14px; font-weight: 900; color: #0f172a; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; }
            th, td { border: 1px solid #cbd5e1; padding: 5px 6px; font-size: 9.5px; text-align: left; }
            th { background: #f1f5f9; text-transform: uppercase; font-weight: 900; font-size: 8px; color: #475569; }
            .badge { padding: 2px 6px; border-radius: 4px; font-size: 7.5px; font-weight: 900; text-transform: uppercase; }
            .badge-paid { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
            .badge-due { background: #fff1f2; color: #e11d48; border: 1px solid #fecdd3; }
            .footer { margin-top: 30px; display: flex; justify-content: space-between; font-size: 8.5px; font-weight: 800; color: #64748b; }
            .sign { border-top: 1.5px solid #94a3b8; width: 150px; text-align: center; padding-top: 5px; }
            @media print {
              .no-print { display: none !important; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button class="btn-print" onclick="window.print()">🖨️ Direct Print</button>
            <button class="btn-close" onclick="window.close()">✕ Close</button>
          </div>
          <div class="header">
            <h1>VENDOR STATEMENT</h1>
            <p>Vendor Purchase Statement &amp; Ledger (${vendor.products?.length || 0} Total Purchases)</p>
          </div>
          <div class="meta">
            <div>
              <strong>Vendor / Supplier:</strong> ${vendor.name} ${vendor.phone ? `| 📞 ${vendor.phone}` : ''} ${vendor.location ? `| 📍 ${vendor.location}` : ''}
            </div>
            <div>
              <strong>Date:</strong> ${new Date().toLocaleDateString('en-PK')}
            </div>
          </div>
          <div class="stats-grid">
            <div class="stat-card">
              <label>Total Purchased</label>
              <div class="val">Rs. ${fmt(vendor.totalCost)}</div>
            </div>
            <div class="stat-card">
              <label style="color:#059669;">Total Paid</label>
              <div class="val" style="color:#059669;">Rs. ${fmt(vendor.totalPaid)}</div>
            </div>
            <div class="stat-card">
              <label style="color:${vendor.totalDue > 0 ? '#e11d48' : '#64748b'};">Due Balance</label>
              <div class="val" style="color:${vendor.totalDue > 0 ? '#e11d48' : '#64748b'};">Rs. ${fmt(vendor.totalDue)}</div>
            </div>
            <div class="stat-card">
              <label>Total Volume</label>
              <div class="val" style="font-size:12px;">${fmt(vendor.totalEggs)} Products</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width:25px; text-align:center;">#</th>
                <th>Product / Date</th>
                <th>Category</th>
                <th style="text-align:center;">Volume (Products)</th>
                <th style="text-align:right;">Rate</th>
                <th style="text-align:right;">Total Cost</th>
                <th style="text-align:right;">Paid</th>
                <th style="text-align:right;">Due</th>
                <th style="text-align:center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <div class="footer">
            <div class="sign">Vendor Signature</div>
            <div class="sign">Authorized Signature</div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); }, 150);
            };
          </script>
        </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      try { printWin.print(); } catch (e) { console.error(e); }
    }, 250);
  };

  const handlePrintVendor = (vendor) => {
    if (!vendor) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(15, 118, 110);
    doc.text(user?.shopName || 'POS STORE', 14, 15);
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text(`VENDOR STATEMENT: ${vendor.name.toUpperCase()}`, 14, 23);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Contact: ${vendor.phone || 'N/A'} | Location: ${vendor.location || 'N/A'} | Date: ${new Date().toLocaleDateString()}`, 14, 29);
    doc.text(`Total Spend: Rs. ${Number(vendor.totalCost || 0).toLocaleString()} | Paid: Rs. ${Number(vendor.totalPaid || 0).toLocaleString()} | Due Balance: Rs. ${Number(vendor.totalDue || 0).toLocaleString()}`, 14, 35);

    const tableBody = (vendor.products || []).map(p => [
      p.name || 'Unnamed',
      p.category || 'Product',
      `${p.eggQuantity || p.stock || 0} Products`,
      `Rs. ${(p.costPrice || p.price || 0).toLocaleString()}`,
      `Rs. ${(p.costVal || p.totalPurchaseCost || 0).toLocaleString()}`,
      `Rs. ${(p.paidVal !== undefined ? p.paidVal : (p.amountPaidToSupplier || 0)).toLocaleString()}`,
      `Rs. ${(p.dueVal !== undefined ? p.dueVal : (p.dueAmountToSupplier || 0)).toLocaleString()}`,
      p.paymentMethod || 'Cash'
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Product', 'Category', 'Stock Volume', 'Unit Rate', 'Total Cost', 'Paid', 'Due Balance', 'Method']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8.5 }
    });

    doc.save(`Vendor_${vendor.name.replace(/\s+/g, '_')}_Statement.pdf`);
  };

  const handleWhatsAppVendor = (vendor) => {
    if (!vendor) return;
    const phoneClean = (vendor.phone || '').replace(/[^0-9]/g, '');
    const targetPhone = phoneClean.startsWith('0') ? `92${phoneClean.slice(1)}` : phoneClean.startsWith('92') ? phoneClean : phoneClean;
    
    let msg = `*${user?.shopName || 'POS STORE'} - VENDOR STATEMENT*\n`;
    msg += `*Vendor:* ${vendor.name}\n`;
    if (vendor.location) msg += `*Location:* ${vendor.location}\n`;
    msg += `*Date:* ${new Date().toLocaleDateString()}\n`;
    msg += `--------------------------------\n`;
    msg += `*Total Purchased Value:* Rs. ${Number(vendor.totalCost || 0).toLocaleString()}\n`;
    msg += `*Total Paid Amount:* Rs. ${Number(vendor.totalPaid || 0).toLocaleString()}\n`;
    msg += `*Current Due Balance:* Rs. ${Number(vendor.totalDue || 0).toLocaleString()}\n`;
    msg += `--------------------------------\n`;
    msg += `*Supplied Products:*\n`;
    (vendor.products || []).forEach((p, idx) => {
      msg += `${idx + 1}. ${p.name} - ${p.eggQuantity || p.stock || 0} Products - Rs. ${(p.costVal || p.totalPurchaseCost || 0).toLocaleString()} (Due: Rs. ${(p.dueVal !== undefined ? p.dueVal : (p.dueAmountToSupplier || 0)).toLocaleString()})\n`;
    });
    msg += `\nThank you for your business!`;

    const url = targetPhone 
      ? `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handleExportVendorCsv = (vendor) => {
    if (!vendor) return;
    const headers = ['Vendor Name', 'Phone', 'Location', 'Product Name', 'Category', 'Petis', 'Trays', 'Eggs', 'Unit Rate (Rs.)', 'Total Cost (Rs.)', 'Paid Amount (Rs.)', 'Due Amount (Rs.)', 'Payment Method'];
    const rows = (vendor.products || []).map(p => [
      `"${vendor.name.replace(/"/g, '""')}"`,
      `"${(vendor.phone || '').replace(/"/g, '""')}"`,
      `"${(vendor.location || '').replace(/"/g, '""')}"`,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${(p.category || '').replace(/"/g, '""')}"`,
      p.petiQuantity || 0,
      p.trayQuantity || 0,
      p.eggQuantity || p.stock || 0,
      p.costPrice || p.price || 0,
      p.costVal || p.totalPurchaseCost || 0,
      p.paidVal !== undefined ? p.paidVal : (p.amountPaidToSupplier || 0),
      p.dueVal !== undefined ? p.dueVal : (p.dueAmountToSupplier || 0),
      `"${(p.paymentMethod || 'Cash').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Vendor_${vendor.name.replace(/\s+/g, '_')}_Ledger.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Quick Edit Single Purchase Modal Handlers ("che update kegi edit kegi am") ──
  const handleStartQuickEditPurchase = (item) => {
    if (!item) return;
    const petis = Number(item.petiQuantity) || (item.stock ? Math.floor(Number(item.stock) / 360) : 0);
    const trays = Number(item.trayQuantity) || (item.stock ? Math.floor((Number(item.stock) % 360) / 30) : 0);
    const eggs = Number(item.eggQuantity) || (item.stock ? (Number(item.stock) % 30) : 0);
    const unitCost = Number(item.costPrice) > 0 ? Number(item.costPrice) : Number(item.price || 0);
    const cost = Number(item.costVal) > 0
      ? Number(item.costVal)
      : (Number(item.totalPurchaseCost) > 0 ? Number(item.totalPurchaseCost) : (petis > 0 ? petis * unitCost : (petis * 360 + trays * 30 + eggs) * (unitCost / 360)));
    const paid = item.paidVal !== undefined ? Number(item.paidVal) : (Number(item.amountPaidToSupplier) || cost);
    const due = item.dueVal !== undefined ? Number(item.dueVal) : Math.max(0, cost - paid);

    setQuickEditPurchase({
      isOpen: true,
      item,
      name: item.name || '',
      category: item.category || 'Eggs',
      petiQuantity: petis,
      trayQuantity: trays,
      eggQuantity: eggs,
      costPrice: unitCost,
      totalPurchaseCost: cost,
      amountPaidToSupplier: paid,
      dueAmountToSupplier: due,
      paymentMethod: item.paymentMethod || 'Cash',
      supplierName: item.supplierName || '',
      supplierPhone: item.supplierPhone || '',
      supplierLocation: item.supplierLocation || '',
      notes: item.notes || '',
      isSaving: false,
      error: null,
      successMsg: null,
    });
  };

  const handleSaveQuickEditPurchase = async (e) => {
    if (e) e.preventDefault();
    if (!quickEditPurchase.item) return;

    const itemId = quickEditPurchase.item._id || quickEditPurchase.item.id;
    const petis = Number(quickEditPurchase.petiQuantity) || 0;
    const trays = Number(quickEditPurchase.trayQuantity) || 0;
    const eggs = Number(quickEditPurchase.eggQuantity) || 0;
    const totalEggs = (petis * 360) + (trays * 30) + eggs;
    const cost = Number(quickEditPurchase.totalPurchaseCost) || 0;
    const paid = Number(quickEditPurchase.amountPaidToSupplier) || 0;
    const due = Number(quickEditPurchase.dueAmountToSupplier) >= 0 ? Number(quickEditPurchase.dueAmountToSupplier) : Math.max(0, cost - paid);

    setQuickEditPurchase(prev => ({ ...prev, isSaving: true, error: null, successMsg: null }));

    try {
      const payload = {
        name: quickEditPurchase.name.trim(),
        category: quickEditPurchase.category || 'Eggs',
        petiQuantity: petis,
        trayQuantity: trays,
        eggQuantity: eggs,
        stock: totalEggs > 0 ? totalEggs : (Number(quickEditPurchase.item.stock) || 0),
        costPrice: Number(quickEditPurchase.costPrice) || 0,
        price: Number(quickEditPurchase.item.price) || Number(quickEditPurchase.costPrice) || 0,
        totalPurchaseCost: cost,
        amountPaidToSupplier: paid,
        dueAmountToSupplier: due,
        paymentMethod: quickEditPurchase.paymentMethod,
        supplierName: quickEditPurchase.supplierName.trim() || quickEditPurchase.item.supplierName,
        supplierPhone: quickEditPurchase.supplierPhone.trim(),
        supplierLocation: quickEditPurchase.supplierLocation.trim(),
        notes: quickEditPurchase.notes || '',
      };

      await updateItem(itemId, payload, '', user?.role || 'super_admin');

      // 1. Immediately store in local editedItemsMap so UI updates everywhere
      const idKey = String(itemId);
      setEditedItemsMap(prev => {
        const next = new Map(prev);
        const updatedEntry = { ...payload, costVal: cost, paidVal: paid, dueVal: due };
        next.set(idKey, updatedEntry);
        if (quickEditPurchase.item._id) next.set(String(quickEditPurchase.item._id), updatedEntry);
        if (quickEditPurchase.item.id) next.set(String(quickEditPurchase.item.id), updatedEntry);
        return next;
      });

      // 2. Update locally in apiProducts
      setApiProducts(prev => prev.map(p => {
        if (String(p._id) === idKey || String(p.id) === idKey || String(p.itemId) === idKey) {
          return {
            ...p,
            ...payload,
            costVal: cost,
            paidVal: paid,
            dueVal: due,
          };
        }
        return p;
      }));

      // 3. Notify product context and parent onRefresh
      if (productCtx?.fetchProducts) {
        try { await productCtx.fetchProducts(); } catch (_) {}
      }
      if (onRefresh) {
        try { await onRefresh(); } catch (_) {}
      }

      await reloadItems();
      setQuickEditPurchase(prev => ({
        ...prev,
        isSaving: false,
        successMsg: 'Purchase entry updated successfully in database!'
      }));

      setTimeout(() => {
        setQuickEditPurchase(prev => ({ ...prev, isOpen: false, item: null, successMsg: null }));
      }, 700);
    } catch (err) {
      console.error('Update purchase error:', err);
      setQuickEditPurchase(prev => ({
        ...prev,
        isSaving: false,
        error: err.response?.data?.message || err.message || 'Failed to update purchase entry'
      }));
    }
  };

  // Print Purchases Report Handler
  // ── PDF Generator via jsPDF & autoTable ──
  const generatePurchasesPDF = () => {
    const doc = new jsPDF('portrait', 'pt', 'a4');
    const timeTitle = timeframe === 'DAY' ? 'Today (Day)' : timeframe === 'MONTH' ? 'This Month' : timeframe === 'YEAR' ? 'This Year' : 'All-Time';
    const dateStr = new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    // Header
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 595, 60, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text(user?.shopName || 'POS STORE', 30, 26);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(`Official Purchases & Restock Ledger Report • Filter: ${timeTitle}`, 30, 44);
    doc.text(`Generated: ${dateStr}`, 430, 44);

    // Summary Stat Bar
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(30, 72, 535, 42, 6, 6, 'FD');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('STOCK PURCHASED', 40, 87);
    doc.text('TOTAL COST', 145, 87);
    doc.text('CASH PAID', 250, 87);
    doc.text('BANK PAID', 355, 87);
    doc.text('DUE (CREDIT)', 460, 87);

    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`${stats.totalEggs} Products`, 40, 104);
    doc.setTextColor(5, 150, 105);
    doc.text(`Rs. ${fmt(stats.totalPurchasesCost)}`, 145, 104);
    doc.setTextColor(16, 185, 129);
    doc.text(`Rs. ${fmt(stats.cashPaid)}`, 250, 104);
    doc.setTextColor(37, 99, 235);
    doc.text(`Rs. ${fmt(stats.bankPaid)}`, 355, 104);
    doc.setTextColor(stats.totalDue > 0 ? 225 : 100, stats.totalDue > 0 ? 29 : 116, stats.totalDue > 0 ? 72 : 139);
    doc.text(`Rs. ${fmt(stats.totalDue)}`, 460, 104);

    // Items Table
    const tableData = purchaseItems.map((item, idx) => {
      const petis = item.petiQuantity || (item.stock ? (item.stock / 360).toFixed(1) : 0);
      const trays = item.trayQuantity || (item.stock ? Math.round(item.stock / 30) : 0);
      const eggs = item.stock || 0;
      const cost = item.totalPurchaseCost || 0;
      const paid = item.amountPaidToSupplier || 0;
      const due = item.dueAmountToSupplier || 0;

      return [
        idx + 1,
        item.name,
        item.supplierName || 'Supplier',
        `${Number(eggs).toLocaleString()} Products`,
        `Rs. ${fmt(cost)}`,
        `Rs. ${fmt(paid)}`,
        `Rs. ${fmt(due)}`,
        due > 0 ? 'Credit' : 'Cash'
      ];
    });

    autoTable(doc, {
      startY: 125,
      head: [['#', 'Product Name', 'Supplier', 'Quantity', 'Cost', 'Cash Paid', 'Credit', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7.5, textColor: [15, 23, 42] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { cellPadding: 3.5, overflow: 'linebreak' },
      margin: { left: 30, right: 30 },
    });

    const fileName = `Purchases_Report_${timeTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    return fileName;
  };

  // ── Clean Compact HTML Print Preview ──
  const handlePrintPurchasesReport = () => {
    const dateStr = new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const timeTitle = timeframe === 'DAY' ? 'Today (Day)' : timeframe === 'MONTH' ? 'This Month' : timeframe === 'YEAR' ? 'This Year' : 'All-Time';

    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Please allow popups to print the purchases report');
      return;
    }

    const tableRows = purchaseItems.map((item, idx) => {
      const petis = item.petiQuantity || (item.stock ? (item.stock / 360).toFixed(1) : 0);
      const trays = item.trayQuantity || (item.stock ? Math.round(item.stock / 30) : 0);
      const eggs = item.stock || 0;
      const cost = item.totalPurchaseCost || 0;
      const paid = item.amountPaidToSupplier || 0;
      const due = item.dueAmountToSupplier || 0;

      return `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td><strong>${item.name}</strong></td>
        <td>${item.supplierName || 'Supplier'}</td>
        <td style="text-align:center;">${Number(eggs).toLocaleString()} Products</td>
        <td style="text-align:right; font-weight:bold;">Rs. ${fmt(cost)}</td>
        <td style="text-align:right; color:#059669; font-weight:bold;">Rs. ${fmt(paid)}</td>
        <td style="text-align:right; color:${due > 0 ? '#e11d48' : '#64748b'}; font-weight:bold;">Rs. ${fmt(due)}</td>
        <td style="text-align:center;"><span class="badge ${due > 0 ? 'badge-due' : 'badge-paid'}">${due > 0 ? 'Credit' : 'Cash'}</span></td>
      </tr>`;
    }).join('');

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Purchases Ledger Report - ${timeTitle}</title>
          <style>
            @page { size: portrait; margin: 8mm 10mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 15px; color: #0f172a; background: #ffffff; font-size: 11px; margin: 0; }
            .header { text-align: center; border-bottom: 2px solid #059669; padding-bottom: 8px; margin-bottom: 12px; }
            .header h1 { margin: 0; color: #047857; text-transform: uppercase; font-size: 18px; letter-spacing: 1px; font-weight: 900; }
            .header p { margin: 2px 0 0; color: #64748b; font-weight: 800; font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; }
            .meta { display: flex; justify-content: space-between; font-size: 9.5px; font-weight: 800; margin-bottom: 10px; background: #f8fafc; padding: 6px 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
            .stats-grid { display: flex; flex-direction: row; gap: 8px; margin-bottom: 12px; }
            .stat-card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 8px; border-radius: 8px; text-align: center; }
            .stat-card label { font-size: 8px; font-weight: 900; color: #64748b; text-transform: uppercase; display: block; }
            .stat-card .val { font-size: 13px; font-weight: 900; color: #0f172a; margin-top: 1px; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; }
            th, td { border: 1px solid #cbd5e1; padding: 4.5px 6px; font-size: 9.5px; text-align: left; }
            th { background: #f1f5f9; text-transform: uppercase; font-weight: 900; font-size: 8px; color: #475569; }
            .badge { padding: 1.5px 5px; border-radius: 4px; font-size: 7.5px; font-weight: 900; text-transform: uppercase; }
            .badge-paid { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
            .badge-due { background: #fff1f2; color: #e11d48; border: 1px solid #fecdd3; }
            .total-row { background: #f8fafc; font-weight: 900; font-size: 10px; }
            .footer { margin-top: 25px; display: flex; justify-content: space-between; font-size: 8.5px; font-weight: 800; color: #64748b; }
            .sign { border-top: 1.5px solid #94a3b8; width: 140px; text-align: center; padding-top: 4px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${user?.shopName || 'POS STORE'}</h1>
            <p>Purchases &amp; Restock Ledger Report</p>
          </div>
          <div class="meta">
            <span>Generated: ${dateStr}</span>
            <span>Filter: ${timeTitle}</span>
            <span>Items: ${purchaseItems.length} Products</span>
          </div>
          <div class="stats-grid">
            <div class="stat-card"><label>Stock Purchased</label><div class="val">${fmt(stats.totalEggs)} Products</div></div>
            <div class="stat-card"><label>Total Investment</label><div class="val" style="color:#059669;">Rs. ${fmt(stats.totalPurchasesCost)}</div></div>
            <div class="stat-card"><label>Cash Paid</label><div class="val" style="color:#10b981;">Rs. ${fmt(stats.cashPaid)}</div></div>
            <div class="stat-card"><label>Credit (Due)</label><div class="val" style="color:#e11d48;">Rs. ${fmt(stats.totalDue)}</div></div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width:20px; text-align:center;">#</th>
                <th>Product Name</th>
                <th>Supplier</th>
                <th style="text-align:center;">Quantity</th>
                <th style="text-align:right;">Cost</th>
                <th style="text-align:right;">Cash Paid</th>
                <th style="text-align:right;">Credit</th>
                <th style="text-align:center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows || '<tr><td colspan="8" style="text-align:center; padding:15px;">No purchases recorded for this period.</td></tr>'}
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td colspan="3" style="text-align:right;">TOTALS:</td>
                <td style="text-align:center;">${fmt(stats.totalEggs)} Products</td>
                <td style="text-align:right; color:#059669;">Rs. ${fmt(stats.totalPurchasesCost)}</td>
                <td style="text-align:right; color:#10b981;">Rs. ${fmt(stats.cashPaid)}</td>
                <td style="text-align:right; color:#e11d48;">Rs. ${fmt(stats.totalDue)}</td>
                <td style="text-align:center;"><span class="badge ${stats.totalDue > 0 ? 'badge-due' : 'badge-paid'}">${stats.totalDue > 0 ? 'Credit' : 'Cash'}</span></td>
              </tr>
            </tfoot>
          </table>
          <div class="footer">
            <div>Report Generated by POS Admin System</div>
            <div class="sign">Authorized Signature</div>
          </div>
        </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => printWin.print(), 300);
  };

  // ── WhatsApp PDF Generation & Share Handler ──
  const handleWhatsAppPurchasesShare = () => {
    // 1. Generate & auto-download official PDF document
    const pdfFileName = generatePurchasesPDF();

    // 2. Direct to WhatsApp with clean formatted statement
    const dateStr = new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeTitle = timeframe === 'DAY' ? 'Today (Day)' : timeframe === 'MONTH' ? 'This Month' : timeframe === 'YEAR' ? 'This Year' : 'All-Time';

    let message = `📄 *PURCHASES REPORT*\n`;
    message += `📅 *Timeframe:* ${timeTitle} (${dateStr})\n`;
    message += `===============================\n`;
    message += `📦 *Stock Restocked:* ${fmt(stats.totalEggs)} Products\n`;
    message += `💰 *Total Investment:* Rs. ${fmt(stats.totalPurchasesCost)}\n`;
    message += `💵 *Cash Paid:* Rs. ${fmt(stats.cashPaid)}\n`;
    if (stats.bankPaid > 0) {
      message += `🏦 *Bank Paid:* Rs. ${fmt(stats.bankPaid)}\n`;
    }
    message += `⚠️ *Credit (Due):* Rs. ${fmt(stats.totalDue)}\n`;
    message += `===============================\n`;
    message += `🛒 *PURCHASED PRODUCTS:* (${purchaseItems.length} items)\n`;

    purchaseItems.slice(0, 8).forEach((item, idx) => {
      const paid = item.amountPaidToSupplier || 0;
      const due = item.dueAmountToSupplier || 0;
      message += `${idx + 1}. *${item.name}* (${Number(item.stock || item.eggQuantity || 0)} Products)\n`;
      message += `   • Cost: Rs. ${fmt(item.totalPurchaseCost)} | Paid: Rs. ${fmt(paid)} | Due: Rs. ${fmt(due)}\n`;
    });

    if (purchaseItems.length > 8) {
      message += `... and ${purchaseItems.length - 8} more items (see PDF).\n`;
    }

    message += `===============================\n`;
    message += `📎 *Official PDF File (${pdfFileName}) downloaded to your device.*\n`;
    message += `_POS Management System_`;

    const encodedText = encodeURIComponent(message);
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
  };

  // Excel CSV Export Handler
  const handleExportPurchasesExcel = () => {
    const timeTitle = timeframe === 'DAY' ? 'Today' : timeframe === 'MONTH' ? 'ThisMonth' : timeframe === 'YEAR' ? 'ThisYear' : 'AllTime';

    let csvContent = `Product Name,Supplier Name,Peti Quantity,Tray Quantity,Egg Quantity,Total Purchase Cost (Rs),Amount Paid To Supplier (Rs),Due Balance (Rs),Payment Method\n`;

    purchaseItems.forEach((item) => {
      const petis = item.petiQuantity || (item.stock ? (item.stock / 360).toFixed(1) : 0);
      const trays = item.trayQuantity || (item.stock ? Math.round(item.stock / 30) : 0);
      const eggs = item.stock || 0;
      const name = `"${(item.name || '').replace(/"/g, '""')}"`;
      const supplier = `"${(item.supplierName || 'Farm Supplier').replace(/"/g, '""')}"`;
      const cost = item.totalPurchaseCost || 0;
      const paid = item.amountPaidToSupplier || 0;
      const due = item.dueAmountToSupplier || Math.max(0, cost - paid);
      const method = item.paymentMethod || 'Cash';

      csvContent += `${name},${supplier},${petis},${trays},${eggs},${cost},${paid},${due},${method}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Purchases_Report_${timeTitle}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header Banner (Clean Gray & White Theme) */}
      <div className="bg-white p-6 sm:p-7 rounded-[2rem] border-2 border-slate-200 shadow-xl text-slate-900 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-100 border border-teal-200 rounded-2xl text-teal-700 shadow-sm">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight uppercase italic text-slate-900">
                Purchases Page
              </h2>
              <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                Full Stock Purchase Records • Day, Month &amp; Year Cost History
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Actions: Print PDF, WhatsApp Share, Excel Export */}
          <button
            onClick={handlePrintPurchasesReport}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black uppercase tracking-wider border border-slate-300 transition-all cursor-pointer shadow-sm hover:border-teal-500"
            title="Print PDF Purchases Report"
          >
            <Printer className="w-3.5 h-3.5 text-teal-600" />
            <span>Print PDF</span>
          </button>

          <button
            onClick={handleWhatsAppPurchasesShare}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider border border-emerald-500 transition-all cursor-pointer shadow-sm"
            title="Share via WhatsApp"
          >
            <Share2 className="w-3.5 h-3.5 text-white" />
            <span>WhatsApp</span>
          </button>

          <button
            onClick={handleExportPurchasesExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-black uppercase tracking-wider border border-teal-600 transition-all cursor-pointer shadow-sm"
            title="Export Excel (.csv) Report"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-100" />
            <span>Excel</span>
          </button>

          {onAddProduct && (
            <button
              onClick={onAddProduct}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black uppercase tracking-wider transition-all shadow-md active:translate-y-0.5 cursor-pointer font-extrabold"
            >
              <Plus className="w-4 h-4 text-slate-950 stroke-[3]" />
              <span>+ Add Product</span>
            </button>
          )}

          {/* Calendar Date Range Filter */}
          <div className="flex items-center flex-wrap gap-2 p-1 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-800">
            <div className="flex items-center gap-1.5 pl-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Start:</span>
              <input
                type="date"
                value={purchaseStartDate}
                onChange={(e) => setPurchaseStartDate(e.target.value)}
                className="w-[118px] sm:w-[126px] px-1.5 py-1 rounded-lg text-xs font-bold outline-none border border-slate-300 bg-slate-50 text-slate-900 focus:border-emerald-500 cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">End:</span>
              <input
                type="date"
                value={purchaseEndDate}
                onChange={(e) => setPurchaseEndDate(e.target.value)}
                className="w-[118px] sm:w-[126px] px-1.5 py-1 rounded-lg text-xs font-bold outline-none border border-slate-300 bg-slate-50 text-slate-900 focus:border-emerald-500 cursor-pointer"
              />
            </div>
            <button
              onClick={handleApplyPurchaseDate}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-sm transition-all cursor-pointer"
              title="Filter purchases by date range"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filter</span>
            </button>
            {(appliedStartDate || appliedEndDate || purchaseStartDate || purchaseEndDate) && (
              <button
                onClick={handleClearPurchaseDate}
                className="px-2 py-1 rounded-lg text-xs font-black uppercase tracking-wider text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer flex items-center gap-0.5 active:scale-95"
                title="Clear date filter"
              >
                <X className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
            {(appliedStartDate || appliedEndDate) && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-300 whitespace-nowrap">
                Active: {getPurchasePeriodLabel()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Top 5 Dynamic Stat Cards (Cash & Bank Separated) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card 1: Stock In Hand / Net Stock */}
        <div className="bg-white border-2 border-amber-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">
                {timeframe === 'DAY' ? 'Today Stock In Hand' : timeframe === 'MONTH' ? 'Month Stock In Hand' : timeframe === 'YEAR' ? 'Year Stock In Hand' : 'Stock In Hand'}
              </span>
              <div className="p-1.5 bg-amber-100 rounded-lg">
                <Box className="w-3.5 h-3.5 text-amber-600" />
              </div>
            </div>
            <h4 className="text-xl sm:text-2xl font-black tracking-tight text-gray-900">{fmt(stats.remainingEggs)} <span className="text-base text-amber-600">Products</span></h4>
            <span className="text-[10px] font-bold text-gray-400 uppercase mt-1 block">
              {stats.soldEggs > 0
                ? `${fmt(stats.totalEggs)} Buy - ${fmt(stats.soldEggs)} Sold = ${fmt(stats.remainingEggs)} Products In Stock`
                : `${fmt(stats.totalEggs)} Products In Stock`}
            </span>
          </div>
        </div>

        {/* Card 2: Cash Paid (Separate) */}
        <div className="bg-white border-2 border-emerald-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Cash Paid</span>
              <div className="p-1.5 bg-emerald-100 rounded-lg">
                <Banknote className="w-3.5 h-3.5 text-emerald-600" />
              </div>
            </div>
            <h4 className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight">Rs. <CountUpNumber value={stats.cashPaid} /></h4>
            <span className="text-[10px] text-emerald-700 font-bold uppercase mt-1 block">💵 Total Cash Paid</span>
          </div>
        </div>

        {/* Card 3: Bank Transfer Paid (Separate) */}
        <div className="bg-white border-2 border-blue-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Bank Paid</span>
              <div className="p-1.5 bg-blue-100 rounded-lg">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
              </div>
            </div>
            <h4 className="text-xl sm:text-2xl font-black text-blue-600 tracking-tight">Rs. <CountUpNumber value={stats.bankPaid} /></h4>
            <span className="text-[10px] text-blue-700 font-bold uppercase mt-1 block">🏦 Bank &amp; Online Paid</span>
          </div>
        </div>

        {/* Card 4: Due Balance (Credit) */}
        <div className={`bg-white border-2 rounded-2xl p-4 shadow-sm flex flex-col justify-between ${stats.totalDue > 0 ? 'border-rose-300 bg-rose-50' : 'border-gray-200'}`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest">⚠️ Credit (Due)</span>
              <div className="p-1.5 bg-rose-100 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              </div>
            </div>
            <h4 className={`text-xl sm:text-2xl font-black tracking-tight ${stats.totalDue > 0 ? 'text-rose-600' : 'text-gray-400'}`}>Rs. <CountUpNumber value={stats.totalDue} /></h4>
            <span className={`text-[10px] font-bold uppercase mt-1 block ${stats.totalDue > 0 ? 'text-rose-500' : 'text-gray-400'}`}>
              {stats.totalDue > 0 ? '🔴 Pending Owed Debt' : '✅ No Pending Debt'}
            </span>
          </div>
        </div>

        {/* Card 5: Grand Total Purchase Cost */}
        <div className="bg-white border-2 border-purple-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between col-span-2 sm:col-span-1">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-black text-purple-600 uppercase tracking-widest">
                {timeframe === 'DAY' ? 'Today Cost' : timeframe === 'MONTH' ? 'Month Cost' : timeframe === 'YEAR' ? 'Year Cost' : 'Total Investment'}
              </span>
              <div className="p-1.5 bg-purple-100 rounded-lg">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
              </div>
            </div>
            <h4 className="text-xl sm:text-2xl font-black text-purple-700 tracking-tight">Rs. <CountUpNumber value={stats.totalPurchasesCost} /></h4>
            <span className="text-[10px] text-gray-400 font-bold uppercase mt-1 block">Total Purchase Value</span>
          </div>
        </div>
      </div>

      {/* Dedicated Today Purchases Summary (Separate Div Below) */}
      <div className="bg-slate-100 border-2 border-slate-300 rounded-3xl p-5 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <Box className="w-5 h-5 text-slate-700" />
            Today's Live Purchases &amp; Restocks Summary
          </span>
          <span className="text-xs bg-white text-slate-800 border-2 border-slate-300 px-3 py-1 rounded-xl font-bold shadow-xs">
            {todayStats.count} Purchase Batches Recorded Today
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">1. Today Stock In Hand</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-2">{todayStats.remainingEggs.toLocaleString('en-PK')} Products</div>
            <span className="text-[10px] font-bold text-slate-600 truncate mt-1">
              {todayStats.soldEggs > 0
                ? `Buy ${todayStats.totalEggs} - Sold ${todayStats.soldEggs} (${todayStats.remainingEggs.toLocaleString('en-PK')} In Stock)`
                : `(${todayStats.totalEggs.toLocaleString('en-PK')} Products)`}
            </span>
          </div>
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">2. Today Cash Paid</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-2">Rs. {todayStats.cashPaid.toLocaleString('en-PK')}</div>
            <span className="text-[10px] font-bold text-slate-600 truncate mt-1">Direct Cash Inflow</span>
          </div>
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-800">3. Today Bank Paid</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-2">Rs. {todayStats.bankPaid.toLocaleString('en-PK')}</div>
            <span className="text-[10px] font-bold text-slate-600 truncate mt-1">Bank / Online</span>
          </div>
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-800">4. Today Credit Due</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-2">Rs. {todayStats.totalDue.toLocaleString('en-PK')}</div>
            <span className="text-[10px] font-bold text-slate-600 truncate mt-1">Pending Owed Debt</span>
          </div>
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 flex flex-col justify-between shadow-xs col-span-2 sm:col-span-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-900">5. Today Investment</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-2">Rs. {todayStats.totalPurchasesCost.toLocaleString('en-PK')}</div>
            <span className="text-[10px] font-bold text-slate-600 truncate mt-1">Total Today Purchases</span>
          </div>
        </div>
      </div>


      {/* ─── LOW STOCK ALERT SECTION ─── */}
      {(() => {
        const lowStockItems = products.filter(p => (Number(p.stock) || 0) <= 50 && p.name);
        if (lowStockItems.length === 0) return null;
        return (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <h3 className="text-xs font-black text-rose-700 uppercase tracking-widest">Low Stock Alert — {lowStockItems.length} Product(s) Running Low</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {lowStockItems.map(p => (
                <div key={p._id} className="flex items-center gap-2 bg-white border border-rose-200 rounded-xl px-3 py-1.5 shadow-sm">
                  <span className="text-xs font-black text-gray-900 uppercase">{p.name}</span>
                  <span className="text-[10px] font-black text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded-lg">
                    Stock: {p.stock}
                  </span>
                  {p.supplierName && <span className="text-[10px] text-gray-400 font-bold">{p.supplierName}</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })()}


      {/* Search Control */}
      <div className="bg-white p-3.5 rounded-2xl border border-zinc-100 shadow-sm flex items-center gap-2">
        <div className="flex items-center gap-2 bg-zinc-100 px-3.5 py-2 rounded-xl w-full">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Supplier or Product name..."
            className="bg-transparent text-xs font-bold outline-none w-full text-zinc-800 placeholder:text-zinc-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-[10px] font-black text-zinc-400 hover:text-zinc-600 uppercase"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Purchases Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {purchaseItems.map((item) => {
          const itemEggs = Number(item.stock !== undefined ? item.stock : (item.eggQuantity || 0));
          const itemPetis = Number((itemEggs / 360).toFixed(1));
          const itemTrays = Math.round(itemEggs / 30);
          const initialEggs = Math.max(itemEggs, Number(item.initialStock || item.eggQuantity || 0), (Number(item.petiQuantity || 0) * 360));
          const initialPetis = Number((initialEggs / 360).toFixed(1));
          const soldEggs = Math.max(0, initialEggs - itemEggs);
          const soldPetis = Number((soldEggs / 360).toFixed(1));
          const pMethod = String(item.paymentMethod || 'Cash').trim();
          
          const unitCost = Number(item.costPrice) > 0 ? Number(item.costPrice) : Number(item.price || 0);
          const unitDivisor = item.unitType === 'egg' ? 1 : item.unitType === 'tray' ? 30 : 360;
          const costVal = Number(item.totalPurchaseCost) > 0
            ? Number(item.totalPurchaseCost)
            : (itemPetis > 0 ? itemPetis * unitCost : (Number(item.stock || 0) * (unitCost / unitDivisor)));
          
          const isCreditMethod = pMethod.toLowerCase().includes('credit') || pMethod.toLowerCase().includes('due') || pMethod.toLowerCase().includes('partial');
          const hasExplicitDue = item.dueAmountToSupplier !== undefined && item.dueAmountToSupplier !== null && Number(item.dueAmountToSupplier) > 0;
          
          let dueBalanceAmount = 0;
          let paidAmount = 0;

          if (hasExplicitDue || isCreditMethod) {
            const rawDue = hasExplicitDue ? Number(item.dueAmountToSupplier) : costVal;
            dueBalanceAmount = Math.min(costVal, Math.max(0, rawDue));
            paidAmount = Math.max(0, costVal - dueBalanceAmount);
          } else {
            paidAmount = costVal;
            dueBalanceAmount = 0;
          }

          const hasDue = dueBalanceAmount > 0;
          const isPurchaseMenuOpen = openPurchaseMenu === item._id;

          const handleDirectPrintPurchase = (pItem) => handlePrintSinglePurchase(pItem);

          const handleWhatsAppPurchase = (pItem) => {
            const phoneClean = (pItem.supplierPhone || '').replace(/[^0-9]/g, '');
            const targetPhone = phoneClean.startsWith('0') ? `92${phoneClean.slice(1)}` : phoneClean.startsWith('92') ? phoneClean : phoneClean;
            let msg = `*PURCHASE VOUCHER*\n`;
            msg += `*Product:* ${pItem.name}\n`;
            msg += `*Vendor:* ${pItem.supplierName || 'Supplier'}\n`;
            msg += `*Volume:* ${Number(itemEggs).toLocaleString()} Products\n`;
            msg += `*Rate:* Rs. ${fmt(unitCost)}\n`;
            msg += `*Total Value:* Rs. ${fmt(costVal)}\n`;
            msg += `*Paid Amount:* Rs. ${fmt(paidAmount)}\n`;
            msg += `*Due Balance:* Rs. ${fmt(dueBalanceAmount)}\n`;
            msg += `*Date:* ${new Date(pItem.createdAt || Date.now()).toLocaleDateString()}\n`;
            msg += `\nThank you!`;
            const url = targetPhone
              ? `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(msg)}`
              : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
            window.open(url, '_blank');
          };

          const handleDownloadPurchasePDF = (pItem) => {
            const doc = new jsPDF();
            doc.setFontSize(16);
            doc.setTextColor(15, 118, 110);
            doc.text(`PURCHASE VOUCHER`, 14, 15);
            doc.setFontSize(12);
            doc.setTextColor(30, 41, 59);
            doc.text(`PURCHASE VOUCHER: ${(pItem.name || 'PRODUCT').toUpperCase()}`, 14, 23);
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.text(`Vendor: ${pItem.supplierName || 'Supplier'} | Phone: ${pItem.supplierPhone || 'N/A'} | Location: ${pItem.supplierLocation || 'N/A'}`, 14, 29);
            doc.text(`Total Value: Rs. ${costVal.toLocaleString()} | Paid: Rs. ${paidAmount.toLocaleString()} | Due: Rs. ${dueBalanceAmount.toLocaleString()}`, 14, 35);

            autoTable(doc, {
              startY: 42,
              head: [['Item Field', 'Details']],
              body: [
                ['Product Name', pItem.name || 'N/A'],
                ['Category', pItem.category || 'Product'],
                ['Stock Volume', `${Number(itemEggs).toLocaleString()} Products`],
                ['Unit Rate', `Rs. ${fmt(unitCost)}`],
                ['Total Purchase Cost', `Rs. ${fmt(costVal)}`],
                ['Paid Amount', `Rs. ${fmt(paidAmount)}`],
                ['Credit Due Balance', `Rs. ${fmt(dueBalanceAmount)}`],
                ['Payment Method', pMethod],
                ['Purchase Date', new Date(pItem.createdAt || Date.now()).toLocaleDateString()],
              ],
              theme: 'grid',
              headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold' },
              styles: { fontSize: 9 }
            });

            doc.save(`Purchase_${(pItem.name || 'item').replace(/\s+/g, '_')}_Voucher.pdf`);
          };

          return (
            <div
              key={item._id}
              className="bg-white border-2 border-gray-200 hover:border-teal-500 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3 relative"
            >
              <div className="space-y-2.5">
                {/* Header: Product Name & Category & Status Badge & 3-Dots */}
                <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2.5">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-black text-gray-900 text-sm tracking-tight uppercase truncate">{item.name}</h4>
                    <p className="text-[10px] font-bold text-gray-500 uppercase mt-0.5">
                      Vendor: <span className="text-teal-800 font-black">{item.supplierName || 'Farm Vendor'}</span>
                      {item.supplierPhone && <span className="text-slate-600 font-bold ml-1.5">📞 {item.supplierPhone}</span>}
                      {item.supplierLocation && <span className="text-slate-500 font-bold ml-1">📍 {item.supplierLocation}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                      hasDue
                        ? 'bg-rose-100 text-rose-700 border border-rose-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}>
                      {hasDue ? '⚠️ Credit' : '✓ Cash'}
                    </span>

                    {/* 3-Dot Action Button on Purchase Card */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenPurchaseMenu(isPurchaseMenuOpen ? null : item._id);
                        }}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                          isPurchaseMenuOpen
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                        }`}
                        title="Purchase Print & Share Options"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {isPurchaseMenuOpen && (
                        <div
                          className="absolute right-0 top-8 w-52 bg-slate-900 border border-slate-700 text-white rounded-2xl p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 text-left"
                          onMouseLeave={() => setOpenPurchaseMenu(null)}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              handleDirectPrintPurchase(item);
                              setOpenPurchaseMenu(null);
                            }}
                            className="w-full px-3 py-2 rounded-xl text-[11px] font-black flex items-center gap-2 hover:bg-white/10 text-emerald-400 transition-all cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>🖨️ Direct Print Voucher</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              handleDownloadPurchasePDF(item);
                              setOpenPurchaseMenu(null);
                            }}
                            className="w-full px-3 py-2 rounded-xl text-[11px] font-black flex items-center gap-2 hover:bg-white/10 text-cyan-300 transition-all cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span>📄 Download PDF</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              handleWhatsAppPurchase(item);
                              setOpenPurchaseMenu(null);
                            }}
                            className="w-full px-3 py-2 rounded-xl text-[11px] font-black flex items-center gap-2 hover:bg-white/10 text-teal-300 transition-all cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                            <span>📱 Send on WhatsApp</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stock Quantity Badge */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-gray-400 uppercase">Available Stock:</span>
                    <span className="font-black text-amber-700">
                      📦 {Number(itemEggs).toLocaleString()} Products
                    </span>
                  </div>
                  {soldEggs > 0 && (
                    <div className="flex items-center justify-between text-[9px] font-black pt-1 border-t border-gray-200 text-gray-500">
                      <span>Purchased: {Number(initialEggs).toLocaleString()} Products</span>
                      <span className="text-rose-600 font-bold">Sold: -{Number(soldEggs).toLocaleString()} Products</span>
                      <span className="text-emerald-700 font-bold">In-Hand: {Number(itemEggs).toLocaleString()} Products</span>
                    </div>
                  )}
                </div>

                {/* Price & Cost Breakdown */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-2">
                    <span className="text-[9px] font-black text-gray-400 uppercase block">Buy Cost:</span>
                    <span className="font-black text-gray-900 text-xs">Rs. {fmt(item.costPrice || 0)}</span>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2">
                    <span className="text-[9px] font-black text-emerald-600 uppercase block">Sell Retail:</span>
                    <span className="font-black text-emerald-700 text-xs">Rs. {fmt(item.price || 0)}</span>
                  </div>
                </div>

                {/* Payment Breakdown (Paid vs Credit) */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2">
                    <span className="text-[9px] font-black text-emerald-700 uppercase block">
                      {(Number(item.bankPaidToSupplier) > 0 && Number(item.cashPaidToSupplier) > 0)
                        ? '💵 / 🏦 Paid:'
                        : (Number(item.bankPaidToSupplier) > 0 || (item.isOnlinePayment && (Number(item.cashPaidToSupplier) || 0) === 0))
                        ? '🏦 Bank Paid:'
                        : '💵 Cash Paid:'}
                    </span>
                    <span className="font-black text-emerald-700 text-xs">Rs. {fmt(paidAmount)}</span>
                  </div>
                  <div className={`rounded-xl p-2 border ${hasDue ? 'bg-rose-50 border-rose-200' : 'bg-gray-50 border-gray-200'}`}>
                    <span className={`text-[9px] font-black uppercase block ${hasDue ? 'text-rose-600' : 'text-gray-400'}`}>⚠️ Credit (Due):</span>
                    <span className={`font-black text-xs ${hasDue ? 'text-rose-600' : 'text-gray-400'}`}>Rs. {fmt(dueBalanceAmount)}</span>
                  </div>
                </div>

                {/* Prominent Pay Credit Button if credit remains */}
                {hasDue && (
                  <button
                    type="button"
                    onClick={() => handleOpenSettleModal(item, dueBalanceAmount)}
                    className="w-full py-2 px-3 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-98 cursor-pointer mt-1"
                  >
                    <CreditCard className="w-3.5 h-3.5 text-white" />
                    <span>💳 Pay Credit (Rs. {fmt(dueBalanceAmount)})</span>
                  </button>
                )}
              </div>

              {/* Actions Footer: Direct Print, View, Edit, Delete */}
              <div className="pt-2.5 border-t border-gray-100 grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleDirectPrintPurchase(item)}
                  className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1 transition-all cursor-pointer"
                  title="Direct Print Receipt"
                >
                  <Printer className="w-3 h-3 text-emerald-600" />
                  <span>Print</span>
                </button>

                <button
                  type="button"
                  onClick={() => onViewProduct ? onViewProduct(item) : (onEditProduct && onEditProduct(item))}
                  className="py-1.5 px-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1 transition-all cursor-pointer"
                  title="View Details"
                >
                  <Eye className="w-3 h-3 text-gray-600" />
                  <span>View</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleStartQuickEditPurchase(item)}
                  className="py-1.5 px-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1 transition-all cursor-pointer shadow-sm"
                  title="Edit Purchase Entry"
                >
                  <Edit2 className="w-3 h-3 text-white" />
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteClick(item)}
                  className="py-1.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1 transition-all cursor-pointer"
                  title="Delete Product"
                >
                  <Trash2 className="w-3 h-3 text-rose-600" />
                  <span>Del</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── VENDORS / SUPPLIERS DIRECTORY & SUMMARY LIST ─── */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 shadow-lg space-y-4 text-slate-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-50 border border-teal-200 rounded-2xl text-teal-700">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase text-slate-900 tracking-tight">
                Vendors &amp; Suppliers Summary List
              </h3>
              <p className="text-[10px] text-slate-500 font-bold">
                All {aggregatedVendors.length} vendors / suppliers who supplied products
              </p>
            </div>
          </div>
          <span className="text-[10px] font-black text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
            Total Vendors: {aggregatedVendors.length}
          </span>
        </div>

        {aggregatedVendors.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4 font-bold uppercase">No vendor records found for this timeframe.</p>
        ) : (
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <th className="p-3 text-center w-12">#</th>
                    <th className="p-3">Vendor / Supplier</th>
                    <th className="p-3">Contact &amp; Location</th>
                    <th className="p-3">Products Supplied</th>
                    <th className="p-3 text-center">Volume</th>
                    <th className="p-3 text-right">Total Spend</th>
                    <th className="p-3 text-right">Paid</th>
                    <th className="p-3 text-right">Credit (Due)</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                  {aggregatedVendors.map((v, vIdx) => {
                    const hasDue = v.totalDue > 0;
                    const isMenuOpen = openVendorMenu === vIdx;

                    return (
                      <tr key={vIdx} className="hover:bg-slate-50/90 transition-colors">
                        <td className="p-3 text-center">
                          <span className="w-6 h-6 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 font-mono font-black text-xs inline-flex items-center justify-center shadow-2xs">
                            {vIdx + 1}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-teal-50 border border-teal-200 rounded-xl flex items-center justify-center text-teal-700 font-black text-xs shrink-0 shadow-sm">
                              {v.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <button
                                type="button"
                                onClick={() => setSelectedVendorName(v.name)}
                                className="font-black text-slate-900 block leading-tight hover:text-teal-700 hover:underline text-left cursor-pointer transition-colors"
                                title="Click to view all purchase invoices from this vendor"
                              >
                                {v.name}
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedVendorName(v.name)}
                                className="text-[9.5px] text-teal-800 font-black bg-teal-50 hover:bg-teal-100 px-1.5 py-0.5 rounded-lg border border-teal-200 mt-0.5 inline-flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                                title="Click to view dedicated purchase list for this vendor"
                              >
                                <FileText className="w-2.5 h-2.5 text-teal-600" />
                                <span>{v.products.length} purchase{v.products.length > 1 ? 's' : ''} (View List)</span>
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-[11px]">
                          {v.phone && <span className="block text-slate-700 font-bold">📞 {v.phone}</span>}
                          {v.location && <span className="block text-slate-500 text-[10px]">📍 {v.location}</span>}
                          {!v.phone && !v.location && <span className="text-slate-400">—</span>}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {v.products.map((p, pIdx) => (
                              <span key={pIdx} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 text-[9px] font-black rounded border border-slate-200 truncate">
                                {p.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-center text-[11px]">
                          <span className="text-amber-700 font-black">{Number(v.totalEggs || 0).toLocaleString()}</span>{' '}
                          <span className="text-slate-500 font-bold text-[10px]">Products</span>
                        </td>
                        <td className="p-3 text-right font-black text-slate-900">
                          Rs. {fmt(v.totalCost)}
                        </td>
                        <td className="p-3 text-right font-black text-emerald-700">
                          Rs. {fmt(v.totalPaid)}
                        </td>
                        <td className="p-3 text-right font-black">
                          <span className={hasDue ? 'text-rose-600' : 'text-slate-400'}>
                            Rs. {fmt(v.totalDue)}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {hasDue ? (
                            <button
                              type="button"
                              onClick={() => {
                                const dueItem = v.products.find(p => p.dueVal > 0) || v.products[0];
                                if (dueItem) handleOpenSettleModal(dueItem, v.totalDue);
                              }}
                              className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[9.5px] font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer"
                            >
                              Pay Due
                            </button>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[9px] font-black uppercase">
                              ✓ Paid
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right relative">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Direct button to open dedicated vendor purchases list ("zanla list") */}
                            <button
                              type="button"
                              onClick={() => setSelectedVendorName(v.name)}
                              className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 hover:border-teal-300 rounded-xl text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                              title="Open Vendor Dedicated Purchases List"
                            >
                              <FileText className="w-3 h-3 text-teal-600" />
                              <span className="hidden sm:inline">Invoices ({v.products.length})</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setOpenVendorMenu(isMenuOpen ? null : vIdx)}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                isMenuOpen
                                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                              }`}
                              title="Vendor Options"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {isMenuOpen && (
                              <div
                                className="absolute right-3 top-10 w-56 bg-slate-900 border border-slate-700 text-white rounded-2xl p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 text-left"
                                onMouseLeave={() => setOpenVendorMenu(null)}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedVendorName(v.name);
                                    setOpenVendorMenu(null);
                                  }}
                                  className="w-full px-3 py-2 rounded-xl text-[11px] font-black flex items-center gap-2 hover:bg-white/10 text-teal-300 transition-all cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                                  <span>📋 View All Purchases ({v.products.length})</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    handleDirectPrintVendor(v);
                                    setOpenVendorMenu(null);
                                  }}
                                  className="w-full px-3 py-2 rounded-xl text-[11px] font-black flex items-center gap-2 hover:bg-white/10 text-emerald-400 transition-all cursor-pointer"
                                >
                                  <Printer className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  <span>🖨️ Direct Print Statement</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    handlePrintVendor(v);
                                    setOpenVendorMenu(null);
                                  }}
                                  className="w-full px-3 py-2 rounded-xl text-[11px] font-black flex items-center gap-2 hover:bg-white/10 text-cyan-300 transition-all cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                  <span>📄 Download PDF Statement</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    handleWhatsAppVendor(v);
                                    setOpenVendorMenu(null);
                                  }}
                                  className="w-full px-3 py-2 rounded-xl text-[11px] font-black flex items-center gap-2 hover:bg-white/10 text-teal-300 transition-all cursor-pointer"
                                >
                                  <Send className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                                  <span>📱 Send on WhatsApp</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    handleExportVendorCsv(v);
                                    setOpenVendorMenu(null);
                                  }}
                                  className="w-full px-3 py-2 rounded-xl text-[11px] font-black flex items-center gap-2 hover:bg-white/10 text-green-300 transition-all cursor-pointer"
                                >
                                  <FileSpreadsheet className="w-3.5 h-3.5 text-green-400 shrink-0" />
                                  <span>📊 Export Excel (.csv)</span>
                                </button>

                                <div className="my-1 border-t border-slate-700/60" />

                                <button
                                  type="button"
                                  onClick={() => {
                                    handleOpenEditVendor(v);
                                    setOpenVendorMenu(null);
                                  }}
                                  className="w-full px-3 py-2 rounded-xl text-[11px] font-black flex items-center gap-2 hover:bg-amber-500/20 text-amber-300 transition-all cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  <span>✏️ Edit Vendor</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    handleDeleteVendor(v);
                                    setOpenVendorMenu(null);
                                  }}
                                  className="w-full px-3 py-2 rounded-xl text-[11px] font-black flex items-center gap-2 hover:bg-rose-500/20 text-rose-400 transition-all cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                  <span>🗑️ Delete Vendor</span>
                                </button>
                              </div>
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

      {/* Bottom Right Action Bar: Single Export & Print Dropdown Menu */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 bg-white p-4 rounded-2xl shadow-sm">
        <div className="text-xs text-slate-500 font-bold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
          <span>Filter Active: <strong className="text-slate-800 uppercase">{timeframe}</strong> ({purchaseItems.length} Products)</span>
        </div>

        <div className="relative ml-auto">
          <button
            onClick={() => setReportMenuOpen(!reportMenuOpen)}
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-xl active:scale-95 transition-all flex items-center gap-2 cursor-pointer border border-emerald-500"
            title="Print, WhatsApp & Export Purchases"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export &amp; Print</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${reportMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {reportMenuOpen && (
            <div
              className="absolute right-0 bottom-full mb-2 w-64 bg-slate-900 border border-slate-700 text-white rounded-2xl p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150"
              onMouseLeave={() => setReportMenuOpen(false)}
            >
              <button
                onClick={() => { handlePrintPurchasesReport(); setReportMenuOpen(false); }}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-black text-left flex items-center gap-2 hover:bg-white/10 text-emerald-300 transition-all cursor-pointer"
              >
                <Truck className="w-4 h-4 text-emerald-400" /> Print Purchases Report
              </button>

              <button
                onClick={() => { handleWhatsAppPurchasesShare(); setReportMenuOpen(false); }}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-black text-left flex items-center gap-2 hover:bg-white/10 text-teal-300 transition-all cursor-pointer"
              >
                <Truck className="w-4 h-4 text-teal-400" /> WhatsApp PDF Report
              </button>

              <button
                onClick={() => { handleExportPurchasesExcel(); setReportMenuOpen(false); }}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-black text-left flex items-center gap-2 hover:bg-white/10 text-green-300 transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-green-400" /> Export Excel (.csv)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Receipt Modal Modal */}
      <AnimatePresence>
        {selectedReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <div className="relative max-w-lg w-full bg-zinc-900 border border-zinc-700 rounded-3xl p-4 text-white shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-xs font-black uppercase text-teal-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> Supplier Payment Screenshot / Receipt
                </span>
                <button
                  onClick={() => setSelectedReceipt(null)}
                  className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-[70vh] overflow-hidden rounded-2xl border border-zinc-800 bg-black flex items-center justify-center">
                <img src={selectedReceipt} alt="Supplier Receipt" className="w-full h-full object-contain max-h-[65vh]" />
              </div>

              <div className="flex justify-between items-center pt-2">
                <a
                  href={selectedReceipt}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-black text-teal-400 underline hover:text-teal-300"
                >
                  Open Original Image in New Tab
                </a>
                <button
                  onClick={() => setSelectedReceipt(null)}
                  className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-black uppercase"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Supplier Credit Settlement Modal */}
      <AnimatePresence>
        {settleModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative max-w-md w-full bg-white border border-zinc-200 rounded-3xl p-6 text-zinc-900 shadow-2xl space-y-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase tracking-tight text-zinc-900">
                      Pay Supplier Credit
                    </h3>
                    <p className="text-[11px] font-bold text-zinc-400 uppercase">
                      {settleModal.item?.name} • <span className="text-zinc-700 font-black">{settleModal.item?.supplierName || 'Supplier'}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSettleModal(prev => ({ ...prev, isOpen: false, item: null }))}
                  className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded-xl hover:bg-zinc-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Outstanding Due Banner */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-zinc-500 block tracking-wider">
                    Total Pending Credit (Due)
                  </span>
                  <span className="text-xl font-black text-rose-600 tracking-tight">
                    Rs. {fmt(settleModal.item?.dueAmountToSupplier || 0)}
                  </span>
                </div>
                <span className="px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-black rounded-lg uppercase tracking-wider">
                  ⚠️ Credit Due
                </span>
              </div>

              {/* Feedback messages */}
              {settleModal.error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{settleModal.error}</span>
                </div>
              )}
              {settleModal.successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{settleModal.successMsg}</span>
                </div>
              )}

              <form onSubmit={handleConfirmSettle} className="space-y-4">
                {/* Payment Method Selector (Cash vs Bank Transfer vs Split) */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-zinc-700 block">
                    Select Payment Method
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSettleModal(prev => ({ ...prev, paymentMethod: 'Cash' }))}
                      className={`p-3 rounded-2xl border text-xs font-black uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        settleModal.paymentMethod === 'Cash'
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                      }`}
                    >
                      <Banknote className="w-4 h-4" />
                      <span>💵 Cash</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSettleModal(prev => ({ ...prev, paymentMethod: 'Bank Transfer' }))}
                      className={`p-3 rounded-2xl border text-xs font-black uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        settleModal.paymentMethod === 'Bank Transfer'
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                      <span>🏦 Bank</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSettleModal(prev => {
                        const due = Number(prev.item?.dueAmountToSupplier || 0);
                        const half = Math.round(due / 2);
                        const c = prev.cashAmount && Number(prev.cashAmount) > 0 ? prev.cashAmount : String(half);
                        const b = prev.bankAmount && Number(prev.bankAmount) > 0 ? prev.bankAmount : String(due - half);
                        return {
                          ...prev,
                          paymentMethod: 'Split',
                          cashAmount: c,
                          bankAmount: b,
                          amountPaid: String(Number(c) + Number(b)),
                        };
                      })}
                      className={`p-3 rounded-2xl border text-xs font-black uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        settleModal.paymentMethod === 'Split'
                          ? 'bg-amber-500 border-amber-500 text-zinc-950 font-black shadow-sm'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>🔀 Split</span>
                    </button>
                  </div>
                </div>

                {/* Amount to Pay */}
                {settleModal.paymentMethod === 'Split' ? (
                  <div className="space-y-3 bg-zinc-50 border border-zinc-200 rounded-2xl p-3.5 animate-in fade-in duration-200">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] font-black text-zinc-700 uppercase tracking-wider block mb-1">
                          💵 Cash Paid (Rs.):
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={settleModal.cashAmount ?? ''}
                          onChange={e => {
                            const val = e.target.value;
                            setSettleModal(prev => {
                              const c = Math.max(0, Number(val) || 0);
                              const b = Math.max(0, Number(prev.bankAmount) || 0);
                              return {
                                ...prev,
                                cashAmount: val,
                                amountPaid: String(c + b),
                                error: null,
                              };
                            });
                          }}
                          className="w-full bg-white border border-zinc-300 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-black text-zinc-900 outline-none shadow-sm"
                          placeholder="0"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-zinc-700 uppercase tracking-wider block mb-1">
                          🏦 Bank Paid (Rs.):
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={settleModal.bankAmount ?? ''}
                          onChange={e => {
                            const val = e.target.value;
                            setSettleModal(prev => {
                              const c = Math.max(0, Number(prev.cashAmount) || 0);
                              const b = Math.max(0, Number(val) || 0);
                              return {
                                ...prev,
                                bankAmount: val,
                                amountPaid: String(c + b),
                                error: null,
                              };
                            });
                          }}
                          className="w-full bg-white border border-zinc-300 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-black text-zinc-900 outline-none shadow-sm"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="bg-amber-50/90 border border-amber-200/90 rounded-xl p-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[9.5px] font-black uppercase text-amber-800 tracking-wider block">
                          📋 Remaining Credit (Due):
                        </span>
                        <span className="font-black text-rose-600 text-sm">
                          Rs. {Math.max(0, (Number(settleModal.item?.dueAmountToSupplier || 0)) - ((Number(settleModal.cashAmount) || 0) + (Number(settleModal.bankAmount) || 0))).toLocaleString('en-PK')}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9.5px] font-black uppercase text-zinc-500 tracking-wider block">
                          Total Paid Now:
                        </span>
                        <span className="font-black text-emerald-700 text-sm">
                          Rs. {((Number(settleModal.cashAmount) || 0) + (Number(settleModal.bankAmount) || 0)).toLocaleString('en-PK')}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black uppercase tracking-wider text-zinc-700">
                        Payment Amount (Rs.)
                      </label>
                      <button
                        type="button"
                        onClick={() => setSettleModal(prev => ({ ...prev, amountPaid: String(prev.item?.dueAmountToSupplier || 0) }))}
                        className="text-[10px] font-black uppercase text-amber-600 hover:text-amber-700 underline"
                      >
                        Pay Full (Rs. {fmt(settleModal.item?.dueAmountToSupplier || 0)})
                      </button>
                    </div>
                    <input
                      type="number"
                      min="1"
                      max={settleModal.item?.dueAmountToSupplier || undefined}
                      value={settleModal.amountPaid}
                      onChange={(e) => setSettleModal(prev => ({ ...prev, amountPaid: e.target.value, error: null }))}
                      placeholder="Enter amount to pay..."
                      required
                      className="w-full bg-zinc-50 border border-zinc-200 focus:border-amber-500 rounded-xl px-4 py-2.5 text-zinc-900 font-black text-sm outline-none transition-all placeholder:text-zinc-400 shadow-inner"
                    />
                    <div className="text-[10px] text-right font-bold text-zinc-500">
                      Remaining Credit: Rs. {Math.max(0, (Number(settleModal.item?.dueAmountToSupplier || 0)) - (Number(settleModal.amountPaid) || 0)).toLocaleString('en-PK')}
                    </div>
                  </div>
                )}

                {/* Bank Transfer Receipt Attachment (Optional) */}
                {(settleModal.paymentMethod === 'Bank Transfer' || settleModal.paymentMethod === 'Split') && (
                  <div className="space-y-1.5 animate-in fade-in">
                    <label className="text-[11px] font-black uppercase tracking-wider text-zinc-700 block">
                      Bank Transfer Receipt / Screenshot (Optional)
                    </label>
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 hover:border-zinc-300 rounded-2xl p-3 cursor-pointer bg-zinc-50 hover:bg-zinc-100 transition-all">
                      {settleModal.receiptPreview ? (
                        <div className="flex items-center gap-2">
                          <img src={settleModal.receiptPreview} alt="Receipt preview" className="w-12 h-12 object-cover rounded-lg border border-zinc-300" />
                          <span className="text-xs font-bold text-emerald-700">Receipt Attached (Click to change)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold">
                          <UploadCloud className="w-5 h-5 text-zinc-500" />
                          <span>Upload Transfer Screenshot</span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleReceiptFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSettleModal(prev => ({ ...prev, isOpen: false, item: null }))}
                    disabled={settleModal.isSubmitting}
                    className="py-3 px-4 rounded-xl border border-zinc-200 bg-zinc-100 text-xs font-black uppercase text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={settleModal.isSubmitting}
                    className="py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider text-zinc-950 bg-amber-500 hover:bg-amber-400 flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {settleModal.isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirm Pay (Rs. {fmt(settleModal.amountPaid || 0)})</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Vendor / Supplier Modal */}
      <AnimatePresence>
        {editVendorModal.isOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full text-white shadow-2xl space-y-5"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                    <Edit2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase tracking-tight text-white">
                      Edit Vendor / Supplier
                    </h3>
                    <p className="text-xs text-slate-400 font-bold">
                      Update details across records &amp; database
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setEditVendorModal(prev => ({ ...prev, isOpen: false }))}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Feedback messages */}
              {editVendorModal.error && (
                <div className="p-3 bg-rose-900/50 border border-rose-700 rounded-xl text-rose-200 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{editVendorModal.error}</span>
                </div>
              )}

              <form onSubmit={handleSaveEditVendor} className="space-y-4">
                {/* Vendor Name */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-300 block">
                    Vendor / Supplier Name <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editVendorModal.name}
                    onChange={(e) => setEditVendorModal(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Metro Wholesale Suppliers"
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 font-bold transition-all"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-300 block">
                    Phone / Contact Number
                  </label>
                  <input
                    type="text"
                    value={editVendorModal.phone}
                    onChange={(e) => setEditVendorModal(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="e.g. 03069578493"
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 font-bold transition-all"
                  />
                </div>

                {/* Location */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-300 block">
                    Location / City / Address
                  </label>
                  <input
                    type="text"
                    value={editVendorModal.location}
                    onChange={(e) => setEditVendorModal(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="e.g. Peshawar, Lahore"
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 font-bold transition-all"
                  />
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditVendorModal(prev => ({ ...prev, isOpen: false }))}
                    disabled={editVendorModal.isSubmitting}
                    className="py-3 px-4 rounded-xl border border-slate-700 text-xs font-black uppercase text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={editVendorModal.isSubmitting}
                    className="py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider text-slate-900 bg-amber-400 hover:bg-amber-300 flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-amber-950/40 active:scale-95 cursor-pointer font-bold"
                  >
                    {editVendorModal.isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── VENDOR DEDICATED PURCHASES & INVOICES MODAL ("zanla list") ─── */}
      <AnimatePresence>
        {selectedVendor && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl sm:max-w-4xl text-slate-800 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden my-auto"
            >
              {/* Modal Header */}
              <div className="px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 bg-slate-50">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 border border-teal-200 flex items-center justify-center font-black text-sm shadow-2xs shrink-0">
                    {selectedVendor.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-black uppercase tracking-tight text-slate-900 truncate">
                        {selectedVendor.name}
                      </h3>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200">
                        {selectedVendor.products.length} Purchases
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-slate-500 font-bold mt-0.5">
                      {selectedVendor.phone && <span>📞 {selectedVendor.phone}</span>}
                      {selectedVendor.location && <span>📍 {selectedVendor.location}</span>}
                      <span>⏱️ Filter: {timeframe}</span>
                    </div>
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDirectPrintVendor(selectedVendor)}
                    className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[10.5px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                    title="Print Total Vendor Statement & Ledger"
                  >
                    <Printer className="w-3.5 h-3.5 text-white" />
                    <span>🖨️ Print Total</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePrintVendor(selectedVendor)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10.5px] font-black uppercase tracking-wider flex items-center gap-1 border border-slate-200 transition-all cursor-pointer"
                    title="Download PDF"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleWhatsAppVendor(selectedVendor)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10.5px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer"
                    title="Share via WhatsApp"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportVendorCsv(selectedVendor)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10.5px] font-black uppercase tracking-wider flex items-center gap-1 border border-slate-200 transition-all cursor-pointer"
                    title="Export CSV"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedVendorName(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer ml-0.5"
                    title="Close Modal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Vendor Summary Cards */}
              <div className="px-4 py-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50/70 border-b border-slate-200">
                <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">Total Purchased</span>
                  <div className="text-sm sm:text-base font-black text-slate-900 mt-0.5">Rs. {fmt(selectedVendor.totalCost)}</div>
                  <span className="text-[8.5px] text-slate-400 block mt-0.5">{selectedVendor.products.length} purchase record(s)</span>
                </div>

                <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-2.5 shadow-2xs">
                  <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 block">Total Paid</span>
                  <div className="text-sm sm:text-base font-black text-emerald-800 mt-0.5">Rs. {fmt(selectedVendor.totalPaid)}</div>
                  <span className="text-[8.5px] text-emerald-600 block mt-0.5">Cleared Payments</span>
                </div>

                <div className={`rounded-xl p-2.5 border shadow-2xs ${selectedVendor.totalDue > 0 ? 'bg-rose-50/80 border-rose-200' : 'bg-white border-slate-200'}`}>
                  <span className={`text-[9px] font-black uppercase tracking-wider block ${selectedVendor.totalDue > 0 ? 'text-rose-700' : 'text-slate-500'}`}>Due Balance</span>
                  <div className={`text-sm sm:text-base font-black mt-0.5 ${selectedVendor.totalDue > 0 ? 'text-rose-700' : 'text-slate-700'}`}>Rs. {fmt(selectedVendor.totalDue)}</div>
                  <span className="text-[8.5px] text-slate-400 block mt-0.5">{selectedVendor.totalDue > 0 ? 'Pending credit' : 'All cleared'}</span>
                </div>

                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-2.5 shadow-2xs">
                  <span className="text-[9px] font-black uppercase tracking-wider text-amber-700 block">Total Products</span>
                  <div className="text-sm sm:text-base font-black text-amber-900 mt-0.5">{fmt(selectedVendor.totalEggs)} <span className="text-[10px]">Products</span></div>
                  <span className="text-[8.5px] text-amber-700/80 block mt-0.5">{fmt(selectedVendor.totalEggs)} Total Products Supplied</span>
                </div>
              </div>

              {/* Invoices List Table */}
              <div className="p-3 sm:px-4 sm:py-3 flex-1 overflow-y-auto space-y-2">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800">
                    Purchases &amp; Invoices List ({selectedVendor.products.length})
                  </h4>
                  <span className="text-[10px] text-teal-700 font-bold">
                    💡 Click "Print" to print single purchase receipt, or "Edit" to update
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-[9px] font-black uppercase tracking-wider text-slate-600 border-b border-slate-200">
                          <th className="py-2 px-2 text-center w-9">#</th>
                          <th className="py-2 px-2.5 text-left">Supplier &amp; Product</th>
                          <th className="py-2 px-2 text-center">Volume (Products)</th>
                          <th className="py-2 px-2 text-right">Unit Rate</th>
                          <th className="py-2 px-2 text-right">Total Cost</th>
                          <th className="py-2 px-2 text-right">Paid</th>
                          <th className="py-2 px-2 text-right">Due</th>
                          <th className="py-2 px-2 text-center">Payment</th>
                          <th className="py-2 px-2 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                        {selectedVendor.products.map((p, idx) => {
                          const eggs = Number(p.stock !== undefined ? p.stock : (p.eggQuantity || 0));
                          const petis = Number((eggs / 360).toFixed(1));
                          const trays = Math.round(eggs / 30);
                          const initialEggs = Math.max(eggs, Number(p.initialStock || p.eggQuantity || 0), (Number(p.petiQuantity || 0) * 360));
                          const soldEggs = Math.max(0, initialEggs - eggs);
                          const soldPetis = Number((soldEggs / 360).toFixed(1));
                          const rate = Number(p.costPrice) > 0 ? Number(p.costPrice) : Number(p.price || 0);
                          const cost = Number(p.costVal) || Number(p.totalPurchaseCost) || 0;
                          const paid = Number(p.paidVal) !== undefined ? Number(p.paidVal) : (Number(p.amountPaidToSupplier) || 0);
                          const due = Number(p.dueVal) !== undefined ? Number(p.dueVal) : (Number(p.dueAmountToSupplier) || 0);
                          const pDate = new Date(p.createdAt || p.purchaseDate || Date.now()).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });

                          return (
                            <tr key={p._id || p.id || idx} className="hover:bg-slate-50/90 transition-colors">
                              <td className="py-2 px-2 text-center">
                                <span className="w-5 h-5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono font-black text-[10px] inline-flex items-center justify-center shadow-2xs">
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="py-2 px-2.5 text-left">
                                <div className="flex items-center gap-1 text-[11px] font-black text-teal-800">
                                  <Building2 className="w-3 h-3 text-teal-600 shrink-0" />
                                  <span className="truncate">{p.supplierName || selectedVendor.name || 'Direct Supplier'}</span>
                                </div>
                                <div className="font-bold text-slate-900 text-[11px] mt-0.5">{p.name || 'Stock Inward'}</div>
                                <div className="text-[9px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                  <span>📅 {pDate}</span>
                                  <span>•</span>
                                  <span className="text-teal-700 font-black">{p.category || 'Product'}</span>
                                </div>
                              </td>
                              <td className="py-2 px-2 text-center text-[10.5px]">
                                <div>
                                  <span className="text-amber-700 font-black">{fmt(eggs)}</span>{' '}
                                  <span className="text-slate-500 text-[10px]">Products</span>
                                </div>
                                {soldEggs > 0 && (
                                  <div className="text-[8.5px] font-bold text-rose-600 mt-0.5">
                                    (-{fmt(soldEggs)} Sold)
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-2 text-right font-black text-slate-700 text-xs">
                                Rs. {fmt(rate)}
                              </td>
                              <td className="py-2 px-2 text-right font-black text-slate-900 text-xs">
                                Rs. {fmt(cost)}
                              </td>
                              <td className="py-2 px-2 text-right font-black text-emerald-700 text-xs">
                                Rs. {fmt(paid)}
                              </td>
                              <td className="py-2 px-2 text-right font-black text-xs">
                                <span className={due > 0 ? 'text-rose-600' : 'text-slate-400'}>
                                  Rs. {fmt(due)}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-center">
                                <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-full text-[8.5px] font-black uppercase">
                                  {p.paymentMethod || 'Cash'}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {/* Single Print Receipt ("single single am print kegi") */}
                                  <button
                                    type="button"
                                    onClick={() => handlePrintSinglePurchase(p)}
                                    className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-lg text-[9.5px] font-black flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                                    title="Print Single Purchase Receipt"
                                  >
                                    <Printer className="w-3 h-3" />
                                    <span>Print</span>
                                  </button>

                                  {/* Quick Edit ("che update kegi edit kegi am") */}
                                  <button
                                    type="button"
                                    onClick={() => handleStartQuickEditPurchase(p)}
                                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[9.5px] font-black flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                                    title="Edit Purchase Entry"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    <span>Edit</span>
                                  </button>

                                  {/* Pay Due Credit */}
                                  {due > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenSettleModal(p, due)}
                                      className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[9.5px] font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer"
                                      title="Pay Due Balance"
                                    >
                                      Pay Due
                                    </button>
                                  )}

                                  {/* Del */}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteClick(p)}
                                    className="p-1 hover:bg-rose-50 text-rose-600 hover:text-rose-700 rounded-lg border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                                    title="Delete Purchase"
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
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="text-[11px] text-slate-600 font-bold">
                  Showing all <strong className="text-slate-900">{selectedVendor.products.length}</strong> purchase records for <strong className="text-teal-800">{selectedVendor.name}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedVendorName(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── QUICK EDIT SINGLE PURCHASE MODAL ("che update kegi edit kegi am") ─── */}
      <AnimatePresence>
        {quickEditPurchase.isOpen && (
          <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white border border-slate-200 rounded-3xl p-6 max-w-xl w-full text-slate-800 shadow-2xl space-y-4 my-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center">
                    <Edit2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase tracking-tight text-slate-900">
                      Edit Purchase Entry
                    </h3>
                    <p className="text-xs text-slate-500 font-bold">
                      Update stock volume, buy rates, paid amount &amp; credit
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setQuickEditPurchase(prev => ({ ...prev, isOpen: false, item: null }))}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {quickEditPurchase.error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{quickEditPurchase.error}</span>
                </div>
              )}

              {quickEditPurchase.successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{quickEditPurchase.successMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveQuickEditPurchase} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Product / Batch Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                      Product / Batch Name <span className="text-amber-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={quickEditPurchase.name}
                      onChange={e => setQuickEditPurchase(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-teal-500 font-bold"
                    />
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                      Payment Method
                    </label>
                    <select
                      value={quickEditPurchase.paymentMethod}
                      onChange={e => setQuickEditPurchase(prev => ({ ...prev, paymentMethod: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-teal-500 font-bold"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="JazzCash / EasyPaisa">JazzCash / EasyPaisa</option>
                      <option value="Credit / Due">Credit / Due</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>

                  {/* Petis Quantity */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-amber-700 block">
                      Product Quantity
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={quickEditPurchase.petiQuantity}
                      onChange={e => {
                        const pVal = e.target.value;
                        setQuickEditPurchase(prev => {
                          const newPetis = Number(pVal) || 0;
                          const rate = Number(prev.costPrice) || 0;
                          const autoCost = rate > 0 && newPetis > 0 ? Math.round(newPetis * rate) : prev.totalPurchaseCost;
                          const paid = Number(prev.amountPaidToSupplier) || 0;
                          return {
                            ...prev,
                            petiQuantity: pVal,
                            totalPurchaseCost: autoCost,
                            dueAmountToSupplier: Math.max(0, autoCost - paid),
                          };
                        });
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-amber-800 focus:outline-none focus:border-amber-500 font-bold"
                    />
                  </div>

                  {/* Trays Quantity */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-teal-700 block">
                      Trays Quantity
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={quickEditPurchase.trayQuantity}
                      onChange={e => setQuickEditPurchase(prev => ({ ...prev, trayQuantity: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-teal-800 focus:outline-none focus:border-teal-500 font-bold"
                    />
                  </div>

                  {/* Unit Buy Rate */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                      Unit Buy Rate (Rs. / Unit)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={quickEditPurchase.costPrice}
                      onChange={e => {
                        const rVal = e.target.value;
                        setQuickEditPurchase(prev => {
                          const rate = Number(rVal) || 0;
                          const petis = Number(prev.petiQuantity) || 0;
                          const autoCost = rate > 0 && petis > 0 ? Math.round(petis * rate) : prev.totalPurchaseCost;
                          const paid = Number(prev.amountPaidToSupplier) || 0;
                          return {
                            ...prev,
                            costPrice: rVal,
                            totalPurchaseCost: autoCost,
                            dueAmountToSupplier: Math.max(0, autoCost - paid),
                          };
                        });
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-teal-500 font-bold"
                    />
                  </div>

                  {/* Total Purchase Cost */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                      Total Purchase Cost (Rs.)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={quickEditPurchase.totalPurchaseCost}
                      onChange={e => {
                        const cVal = e.target.value;
                        setQuickEditPurchase(prev => {
                          const cost = Number(cVal) || 0;
                          const paid = Number(prev.amountPaidToSupplier) || 0;
                          return {
                            ...prev,
                            totalPurchaseCost: cVal,
                            dueAmountToSupplier: Math.max(0, cost - paid),
                          };
                        });
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-teal-500 font-bold"
                    />
                  </div>

                  {/* Amount Paid */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">
                      Amount Paid (Rs.)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={quickEditPurchase.amountPaidToSupplier}
                      onChange={e => {
                        const pVal = e.target.value;
                        setQuickEditPurchase(prev => {
                          const paid = Number(pVal) || 0;
                          const cost = Number(prev.totalPurchaseCost) || 0;
                          return {
                            ...prev,
                            amountPaidToSupplier: pVal,
                            dueAmountToSupplier: Math.max(0, cost - paid),
                          };
                        });
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-emerald-800 focus:outline-none focus:border-emerald-500 font-bold"
                    />
                  </div>

                  {/* Due Balance */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-rose-700 block">
                      Due (Credit) Balance (Rs.)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={quickEditPurchase.dueAmountToSupplier}
                      onChange={e => setQuickEditPurchase(prev => ({ ...prev, dueAmountToSupplier: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-rose-700 focus:outline-none focus:border-rose-500 font-bold"
                    />
                  </div>

                  {/* Supplier Phone */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                      Supplier Phone
                    </label>
                    <input
                      type="text"
                      value={quickEditPurchase.supplierPhone}
                      onChange={e => setQuickEditPurchase(prev => ({ ...prev, supplierPhone: e.target.value }))}
                      placeholder="e.g. 03069578493"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-teal-500 font-bold"
                    />
                  </div>

                  {/* Supplier Location */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                      Supplier Location
                    </label>
                    <input
                      type="text"
                      value={quickEditPurchase.supplierLocation}
                      onChange={e => setQuickEditPurchase(prev => ({ ...prev, supplierLocation: e.target.value }))}
                      placeholder="e.g. Lahore, Peshawar"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-teal-500 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setQuickEditPurchase(prev => ({ ...prev, isOpen: false, item: null }))}
                    disabled={quickEditPurchase.isSaving}
                    className="py-2.5 px-4 rounded-xl border border-slate-300 text-xs font-black uppercase text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={quickEditPurchase.isSaving}
                    className="py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-teal-600 hover:bg-teal-700 flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer font-bold"
                  >
                    {quickEditPurchase.isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Save Purchase</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Local Delete Confirmation Modal */}
      {localDeleteDialog.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-gray-100 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-gray-900 uppercase">Delete Product?</h3>
              <p className="text-xs text-gray-500 font-bold">
                Are you sure you want to delete <strong className="text-gray-900">{localDeleteDialog.item?.name}</strong> from stock?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setLocalDeleteDialog({ isOpen: false, item: null, isDeleting: false })}
                disabled={localDeleteDialog.isDeleting}
                className="py-2.5 px-4 rounded-xl border border-gray-200 text-xs font-black text-gray-700 hover:bg-gray-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLocalDelete}
                disabled={localDeleteDialog.isDeleting}
                className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-all shadow-md active:scale-95 cursor-pointer"
              >
                {localDeleteDialog.isDeleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

