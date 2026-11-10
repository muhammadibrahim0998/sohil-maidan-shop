import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { shopSchema } from '../schemas/shopSchema';
import api from '../services/api';
import {
    Store, Plus, Building2, Edit2, Trash2, X, Check,
    LayoutDashboard, Users, Activity, Eye, EyeOff,
    Package, ShoppingBag, DollarSign, TrendingUp, Calendar, BarChart3, Truck,
    ShieldCheck, ShieldAlert, Lock, Unlock, CheckCircle2, AlertTriangle, KeyRound
} from 'lucide-react';
import { toast } from 'sonner';
import { useProducts } from '../contexts/ProductContext';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';
import { CountUpNumber } from '../components/CountUpNumber';

const PAKISTANI_BANKS = [
    'Meezan Bank',
    'Habib Bank Limited (HBL)',
    'Bank Alfalah',
    'United Bank Limited (UBL)',
    'MCB Bank',
    'Allied Bank (ABL)',
    'Bank of Khyber (BOK)',
    'Bank of Punjab (BOP)',
    'Askari Bank',
    'Faysal Bank',
    'Standard Chartered',
    'Soneri Bank',
    'JS Bank',
    'Dubai Islamic Bank',
    'Bank Islami',
    'Al Baraka Bank'
];

export function SuperAdminDashboard() {
    const [shops, setShops] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setTab] = useState(() => {
        const saved = sessionStorage.getItem('superAdminTab');
        return (saved && saved !== 'approvals') ? saved : 'overview';
    });
  const setActiveTab = (tab) => {
    setTab(tab);
    sessionStorage.setItem('superAdminTab', tab);
  };
    const [editingShop, setEditingShop] = useState(null);
    const [editData, setEditData] = useState({ 
        name: '', 
        address: '', 
        contactNumber: '', 
        status: 'active',
        ownerEmail: '',
        easypaisaNumber: '',
        bankName: '',
        bankAccountNumber: '',
        bankAccountTitle: '',
        banks: []
    });
    const [newShopBanks, setNewShopBanks] = useState([
        { bankName: '', bankAccountNumber: '', bankAccountTitle: '' }
    ]);

    const handleAddNewShopBank = () => {
        setNewShopBanks(prev => [...prev, { bankName: '', bankAccountNumber: '', bankAccountTitle: '' }]);
    };

    const handleRemoveNewShopBank = (index) => {
        setNewShopBanks(prev => {
            if (prev.length <= 1) {
                return [{ bankName: '', bankAccountNumber: '', bankAccountTitle: '' }];
            }
            return prev.filter((_, i) => i !== index);
        });
    };

    const handleNewShopBankChange = (index, field, value) => {
        setNewShopBanks(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const handleAddEditBank = () => {
        setEditData(prev => ({
            ...prev,
            banks: [...(prev.banks || []), { bankName: '', bankAccountNumber: '', bankAccountTitle: '' }]
        }));
    };

    const handleRemoveEditBank = (index) => {
        setEditData(prev => {
            const current = prev.banks || [];
            const next = current.filter((_, i) => i !== index);
            return {
                ...prev,
                banks: next.length > 0 ? next : [{ bankName: '', bankAccountNumber: '', bankAccountTitle: '' }]
            };
        });
    };

    const handleEditBankChange = (index, field, value) => {
        setEditData(prev => {
            const current = [...(prev.banks || [])];
            current[index] = { ...current[index], [field]: value };
            return {
                ...prev,
                banks: current
            };
        });
    };
    const [viewingShop, setViewingShop] = useState(null);
    const [selectedApprovalBranchId, setSelectedApprovalBranchId] = useState(null);
    const [approvalUpdating, setApprovalUpdating] = useState(false);
    const [approvalNotesState, setApprovalNotesState] = useState({});
    const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, id: null, name: '' });
    const [isDeleting, setIsDeleting] = useState(false);
    const [showAdminPassword, setShowAdminPassword] = useState(false);
    const { searchTerm } = useProducts();


    const [totalCustomers, setTotalCustomers] = useState(0);
    const [totalStockUnits, setTotalStockUnits] = useState(0);
    const [totalSalesCount, setTotalSalesCount] = useState(0);
    const [totalRevenue, setTotalRevenue] = useState(0);
    const [dailySalesVal, setDailySalesVal] = useState(0);
    const [monthlySalesVal, setMonthlySalesVal] = useState(0);
    const [yearlySalesVal, setYearlySalesVal] = useState(0);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting }
    } = useForm({
        resolver: zodResolver(shopSchema),
        defaultValues: {
            name: '',
            address: '',
            contactNumber: '',
            adminFullName: '',
            adminUsername: '',
            adminPassword: '',
            easypaisaNumber: '',
            bankName: '',
            bankAccountNumber: '',
            bankAccountTitle: ''
        }
    });

    const [orders, setOrders] = useState([]);
    const [ordersLoading, setOrdersLoading] = useState(false);
    const [selectedShopFilter, setSelectedShopFilter] = useState('ALL');
    const [selectedProofImage, setSelectedProofImage] = useState(null);
    const [deleteOrderModal, setDeleteOrderModal] = useState({
        isOpen: false,
        orderId: null,
        type: 'proof',
        title: '',
        message: ''
    });
    const [isDeletingOrder, setIsDeletingOrder] = useState(false);

    useEffect(() => {
        fetchShops();
        fetchOrders();
        fetchGlobalStats();
        const timer = setInterval(() => {
            fetchOrders();
            fetchGlobalStats();
        }, 8000);
        return () => clearInterval(timer);
    }, []);

    const fetchGlobalStats = async () => {
        try {
            const [custRes, itemsRes, salesRes, ordersRes] = await Promise.all([
                api.get('/customers/all').catch(() => ({ data: { count: 0 } })),
                api.get('/items').catch(() => ({ data: [] })),
                api.get('/sales/all').catch(() => ({ data: [] })),  // super admin sees all shops' POS sales
                api.get('/checkout/orders').catch(() => ({ data: { orders: [] } }))
            ]);

            if (custRes.data?.count !== undefined) setTotalCustomers(custRes.data.count);
            
            const items = Array.isArray(itemsRes.data) ? itemsRes.data : [];
            const stockCount = items.filter(i => (i.stock || 0) > 0).length;
            setTotalStockUnits(stockCount);

            // POS Sales
            const salesList = Array.isArray(salesRes.data) ? salesRes.data : [];
            // EasyPaisa/Checkout orders (PAID only)
            const checkoutOrders = Array.isArray(ordersRes.data?.orders) ? ordersRes.data.orders : [];
            const paidOrders = checkoutOrders.filter(o => o.paymentStatus === 'PAID');

            setTotalSalesCount(salesList.length + paidOrders.length);

            const today = new Date(); today.setHours(0,0,0,0);
            const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const thisYear = new Date(today.getFullYear(), 0, 1);

            // Valid POS sales (not returned/cancelled)
            const validSales = salesList.filter(s => s.status !== 'returned' && s.status !== 'cancelled');
            const posTotal = validSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
            const orderTotal = paidOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
            setTotalRevenue(posTotal + orderTotal);

            // Daily
            const dayRev = validSales.filter(s => new Date(s.saleDate) >= today).reduce((sum, s) => sum + (s.totalAmount || 0), 0)
                + paidOrders.filter(o => new Date(o.createdAt) >= today).reduce((sum, o) => sum + (o.totalAmount || 0), 0);
            // Monthly
            const monthRev = validSales.filter(s => new Date(s.saleDate) >= thisMonth).reduce((sum, s) => sum + (s.totalAmount || 0), 0)
                + paidOrders.filter(o => new Date(o.createdAt) >= thisMonth).reduce((sum, o) => sum + (o.totalAmount || 0), 0);
            // Yearly
            const yearRev = validSales.filter(s => new Date(s.saleDate) >= thisYear).reduce((sum, s) => sum + (s.totalAmount || 0), 0)
                + paidOrders.filter(o => new Date(o.createdAt) >= thisYear).reduce((sum, o) => sum + (o.totalAmount || 0), 0);

            setDailySalesVal(dayRev);
            setMonthlySalesVal(monthRev);
            setYearlySalesVal(yearRev);
        } catch (err) {
            console.error('Failed to load global stats:', err);
        }
    };

    const fetchOrders = async () => {
        setOrdersLoading(true);
        try {
            const res = await api.get('/checkout/orders');
            if (res.data.success) {
                setOrders(res.data.orders);
            }
        } catch (err) {
            console.error('Failed to load orders:', err);
        } finally {
            setOrdersLoading(false);
        }
    };

    const handleUpdateOrderStatus = async (orderId, paymentStatus) => {
        try {
            await api.patch(`/checkout/order/${orderId}/status`, { paymentStatus });
            toast.success(`Payment status updated to ${paymentStatus}`);
            fetchOrders();
            fetchGlobalStats();
        } catch (err) {
            toast.error('Failed to update status');
        }
    };

    const handleUpdateBranchApproval = async (shopId, updatePayload) => {
        setApprovalUpdating(true);
        try {
            const res = await api.patch(`/shops/${shopId}/approval`, updatePayload);
            if (res.data?.success || res.status === 200) {
                toast.success('Branch approval status updated successfully');
                setShops(prev => prev.map(s => {
                    if (String(s._id || s.id) === String(shopId)) {
                        return {
                            ...s,
                            ...updatePayload,
                            isEditApproved: updatePayload.isEditApproved !== undefined ? (updatePayload.isEditApproved ? 1 : 0) : s.isEditApproved,
                            isDeleteApproved: updatePayload.isDeleteApproved !== undefined ? (updatePayload.isDeleteApproved ? 1 : 0) : s.isDeleteApproved,
                            approvalStatus: updatePayload.approvalStatus || s.approvalStatus,
                            approvalNotes: updatePayload.approvalNotes !== undefined ? updatePayload.approvalNotes : s.approvalNotes
                        };
                    }
                    return s;
                }));
            }
        } catch (err) {
            console.error('Failed to update branch approval:', err);
            toast.error(err.response?.data?.message || 'Failed to update branch approval');
        } finally {
            setApprovalUpdating(false);
        }
    };

    const handleDeleteProof = (orderId) => {
        setDeleteOrderModal({
            isOpen: true,
            orderId,
            type: 'proof',
            title: 'Delete Screenshot Proof',
            message: 'Are you sure you want to delete this payment screenshot proof?'
        });
    };

    const handleDeleteOrder = (orderId) => {
        setDeleteOrderModal({
            isOpen: true,
            orderId,
            type: 'order',
            title: 'Delete Entire Order',
            message: 'Are you sure you want to permanently delete this customer order?'
        });
    };

    const confirmDeleteOrderAction = async () => {
        const { orderId, type } = deleteOrderModal;
        if (!orderId) return;
        setIsDeletingOrder(true);
        try {
            if (type === 'proof') {
                await api.delete(`/checkout/order/${orderId}/proof`);
                toast.success('Payment screenshot proof deleted successfully');
                if (selectedProofImage?.orderId === orderId) {
                    setSelectedProofImage(null);
                }
            } else {
                await api.delete(`/checkout/order/${orderId}`);
                toast.success('Order deleted successfully');
                if (selectedProofImage?.orderId === orderId) {
                    setSelectedProofImage(null);
                }
            }
            setDeleteOrderModal({ isOpen: false, orderId: null, type: 'proof', title: '', message: '' });
            fetchOrders();
        } catch (err) {
            toast.error(type === 'proof' ? 'Failed to delete screenshot proof' : 'Failed to delete order');
        } finally {
            setIsDeletingOrder(false);
        }
    };

    const fetchShops = async () => {
        try {
            const res = await api.get('/shops');
            const branchList = (Array.isArray(res.data) ? res.data : []).filter(s => !s.name?.toLowerCase().includes('super admin') && s.id !== 4);
            setShops(branchList);
        } catch (error) {
            toast.error('Failed to load shops');
        } finally {
            setLoading(false);
        }
    };

    const onAddShop = async (data) => {
        try {
            const validBanks = newShopBanks.filter(b => (b.bankName && b.bankName.trim()) || (b.bankAccountNumber && b.bankAccountNumber.trim()) || (b.bankAccountTitle && b.bankAccountTitle.trim()));
            const payload = {
                ...data,
                banks: validBanks,
                bankName: validBanks[0]?.bankName || data.bankName || '',
                bankAccountNumber: validBanks[0]?.bankAccountNumber || data.bankAccountNumber || '',
                bankAccountTitle: validBanks[0]?.bankAccountTitle || data.bankAccountTitle || ''
            };
            await api.post('/shops', payload);
            toast.success('Shop created!');
            reset();
            setNewShopBanks([{ bankName: '', bankAccountNumber: '', bankAccountTitle: '' }]);
            fetchShops();
        } catch (err) {
            const serverError = err.response?.data?.message || 'Failed to create shop';
            toast.error(serverError);
        }
    };

    const handleDeleteShop = (shop) => {
        setDeleteDialog({
            isOpen: true,
            id: shop._id || shop.id,
            name: shop.name
        });
    };

    const confirmDeleteShop = async () => {
        const { id } = deleteDialog;
        setIsDeleting(true);
        try {
            try {
                await api.delete(`/shops/${id}`);
            } catch (dErr) {
                if (dErr.response?.status === 405 || dErr.response?.status === 404 || !dErr.response) {
                    await api.post(`/shops/${id}/delete`);
                } else {
                    throw dErr;
                }
            }
            toast.success("Shop deleted successfully");
            setDeleteDialog({ isOpen: false, id: null, name: '' });
            fetchShops();
        } catch (err) {
            const msg = err.response?.data?.message || "Failed to delete shop";
            toast.error(msg);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleUpdateShop = async (id) => {
        try {
            const targetId = id || editingShop;
            if (!targetId) {
                toast.error("No shop selected to update");
                return;
            }
            const validBanks = (editData.banks || []).filter(b => (b.bankName && b.bankName.trim()) || (b.bankAccountNumber && b.bankAccountNumber.trim()) || (b.bankAccountTitle && b.bankAccountTitle.trim()));
            const payload = {
                ...editData,
                banks: validBanks,
                bankName: validBanks[0]?.bankName || '',
                bankAccountNumber: validBanks[0]?.bankAccountNumber || '',
                bankAccountTitle: validBanks[0]?.bankAccountTitle || ''
            };
            try {
                await api.put(`/shops/${targetId}`, payload);
            } catch (uErr) {
                if (uErr.response?.status === 405 || uErr.response?.status === 404 || !uErr.response) {
                    await api.post(`/shops/${targetId}/update`, payload);
                } else {
                    throw uErr;
                }
            }
            toast.success("Shop and Bank details updated successfully");
            setEditingShop(null);
            fetchShops();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to update shop");
        }
    };

    const startEdit = (shop) => {
        setActiveTab('management'); // Switch to management tab if not there
        setEditingShop(String(shop._id || shop.id));
        
        let initialBanks = [];
        if (Array.isArray(shop.banks) && shop.banks.length > 0) {
            initialBanks = shop.banks.map(b => ({
                bankName: b.bankName || '',
                bankAccountNumber: b.bankAccountNumber || '',
                bankAccountTitle: b.bankAccountTitle || ''
            }));
        } else if (Array.isArray(shop.banksJson) && shop.banksJson.length > 0) {
            initialBanks = shop.banksJson.map(b => ({
                bankName: b.bankName || '',
                bankAccountNumber: b.bankAccountNumber || '',
                bankAccountTitle: b.bankAccountTitle || ''
            }));
        } else if (shop.bankName || shop.bankAccountNumber) {
            initialBanks = [{
                bankName: shop.bankName || '',
                bankAccountNumber: shop.bankAccountNumber || '',
                bankAccountTitle: shop.bankAccountTitle || ''
            }];
        } else {
            initialBanks = [{ bankName: '', bankAccountNumber: '', bankAccountTitle: '' }];
        }

        setEditData({
            name: shop.name || '',
            address: shop.address || '',
            contactNumber: shop.contactNumber || '',
            ownerEmail: shop.ownerDetails?.email || shop.ownerEmail || '',
            status: shop.status || 'active',
            easypaisaNumber: shop.easypaisaNumber || '',
            bankName: shop.bankName || '',
            bankAccountNumber: shop.bankAccountNumber || '',
            bankAccountTitle: shop.bankAccountTitle || '',
            banks: initialBanks
        });
        // Scroll to management section if needed - added a slight delay to ensure tab is rendered
        setTimeout(() => {
            const el = document.getElementById(`shop-manage-${shop._id || shop.id}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    };


    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 shadow-[0_0_15px_rgba(22,163,74,0.3)]"></div>
            </div>
        );
    }

    const activeShops = shops.filter(shop => shop.status === 'active').length;
    const inactiveShops = shops.length - activeShops;

    const filteredShops = shops.filter(shop =>
        shop.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shop.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shop.contactNumber?.includes(searchTerm)
    );

    return (
        <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-green-500/10 rounded-[1.5rem] border border-green-500/20">
                        <Building2 className="w-8 h-8 text-[var(--color-primary)]" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-[var(--color-text-primary)] tracking-tighter leading-none uppercase">
                            Global Dashboard
                        </h1>
                        <p className="text-[var(--color-text-secondary)] font-bold uppercase text-[10px] tracking-[0.4em] mt-2">
                            General Management
                        </p>
                    </div>
                </div>

                {/* Tab Switcher */}
                <div className="flex items-center gap-2 bg-[var(--color-surface-card)] p-1.5 rounded-[1.5rem] border border-[var(--color-border-subtle)] shadow-sm overflow-x-auto w-full md:w-auto no-scrollbar">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'overview'
                            ? 'bg-green-600 text-white shadow-lg'
                            : 'text-zinc-500 hover:text-zinc-900'
                            }`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('management')}
                        className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'management'
                            ? 'bg-green-600 text-white shadow-lg'
                            : 'text-zinc-500 hover:text-zinc-900'
                            }`}
                    >
                        Manage Shops
                    </button>
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'orders'
                            ? 'bg-green-600 text-white shadow-lg'
                            : 'text-zinc-500 hover:text-zinc-900'
                            }`}
                    >
                        EasyPaisa Receipts & Orders
                    </button>
                </div>
            </div>

            {activeTab === 'overview' ? (
                /* Overview Content (Integrated from SuperAdminOverview) */
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
                    {/* Primary Network Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="bg-white border border-zinc-100 rounded-2xl p-6 shadow-rich flex items-center gap-5 group">
                            <div className="p-4 bg-green-500/10 rounded-2xl border border-green-500/20 group-hover:scale-110 transition-transform">
                                <Building2 className="w-7 h-7 text-green-600" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Network Shops</p>
                                <h3 className="text-3xl font-black text-zinc-900 mt-1 tracking-tighter">
                                    <CountUpNumber value={shops.length} />
                                </h3>
                                <p className="text-[9px] font-bold text-emerald-600 uppercase mt-0.5">{activeShops} Active Stores</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-zinc-100 rounded-[2.5rem] p-8 sm:p-10 shadow-rich">
                        <h3 className="text-2xl font-black text-zinc-900 uppercase tracking-[0.2em] mb-10">Registered Store Network</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {filteredShops.map(shop => (
                                <div key={shop._id} className="p-8 rounded-xl border border-zinc-100 bg-zinc-50/50 hover:bg-white hover:border-green-500/30 transition-all shadow-sm hover:shadow-rich group/card">
                                    <div className="flex items-center justify-between mb-6 relative">
                                        <div className="p-1 bg-white rounded-2xl border border-zinc-100 group-hover/card:scale-110 transition-transform shadow-inner w-16 h-12 flex items-center justify-center overflow-hidden">
                                            {shop.logoUrl ? (
                                                <img src={shop.logoUrl} alt={shop.name} className="w-full h-full object-contain" />
                                            ) : (
                                                <Store className="w-7 h-7 text-zinc-400 group-hover/card:text-green-500 transition-colors" />
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border transition-all group-hover/card:opacity-0 group-hover/card:scale-0 ${shop.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                                                {shop.status}
                                            </span>
                                            {/* Card Action Overlay */}
                                            <div className="absolute top-0 right-0 flex items-center gap-1.5 opacity-0 group-hover/card:opacity-100 transition-all scale-75 group-hover/card:scale-100 origin-right">
                                                <button onClick={() => window.open(`/shop/${shop._id}`, '_blank')} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-1 cursor-pointer" title="Open Branch Admin Portal">
                                                    <Store className="w-3.5 h-3.5" /> Open Store Portal
                                                </button>
                                                <button onClick={() => { setSelectedShopFilter(shop._id); setActiveTab('orders'); }} className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-1" title="Inspect & Approve EasyPaisa Orders">
                                                    <Truck className="w-3.5 h-3.5" /> Approve Orders
                                                </button>
                                                <button onClick={() => setViewingShop(shop)} className="p-2.5 bg-white text-zinc-400 hover:text-green-600 rounded-xl border border-zinc-100 shadow-sm transition-all" title="View Details"><Eye className="w-4 h-4" /></button>
                                                <button onClick={() => startEdit(shop)} className="p-2.5 bg-white text-zinc-400 hover:text-amber-600 rounded-xl border border-zinc-100 shadow-sm transition-all" title="Edit Shop"><Edit2 className="w-4 h-4" /></button>
                                                <button onClick={() => handleDeleteShop(shop)} className="p-2.5 bg-white text-zinc-400 hover:text-rose-600 rounded-xl border border-zinc-100 shadow-sm transition-all" title="Delete Shop"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    </div>
                                    <h4
                                        onClick={() => window.open(`/shop/${shop._id}`, '_blank')}
                                        className="text-xl font-black text-zinc-900 mb-2 truncate tracking-tight uppercase group-hover/card:text-green-600 transition-colors cursor-pointer flex items-center justify-between"
                                        title="Click to Open Store Portal"
                                    >
                                        <span>{shop.name}</span>
                                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Open Portal ↗</span>
                                    </h4>
                                    <p className="text-[11px] font-black text-zinc-400 truncate tracking-[0.1em] uppercase">{shop.address || "Global Access"}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : activeTab === 'management' ? (
                /* Management Content (Integrated from SuperAdminDashboard) */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Create Shop Form */}
                    <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-rich h-fit">
                        <h2 className="text-xl font-black mb-6 text-zinc-900 flex items-center gap-3 uppercase tracking-tight">
                            <Plus className="w-6 h-6 text-green-600" />
                            Register New Shop
                        </h2>
                        <form onSubmit={handleSubmit(onAddShop)} className="space-y-4">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 pl-1">Shop Name</label>
                                    <input
                                        {...register('name')}
                                        className={`w-full px-5 py-3 rounded-xl border ${errors.name ? 'border-rose-500/50 bg-rose-50/50' : 'border-zinc-100 bg-zinc-50'} text-zinc-900 text-sm font-bold placeholder:text-zinc-300 outline-none focus:bg-white focus:border-green-500/40 transition-all`}
                                        placeholder="Ex: Premium Supermarket"
                                    />
                                    {errors.name && <p className="text-[9px] font-bold text-rose-500 mt-1 pl-1 uppercase tracking-tighter">{errors.name.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 pl-1">Address</label>
                                    <input
                                        {...register('address')}
                                        className={`w-full px-5 py-3 rounded-xl border ${errors.address ? 'border-rose-500/50 bg-rose-50/50' : 'border-zinc-100 bg-zinc-50'} text-zinc-900 text-sm font-bold placeholder:text-zinc-300 outline-none focus:bg-white focus:border-green-500/40 transition-all`}
                                        placeholder="123 Business Avenue"
                                    />
                                    {errors.address && <p className="text-[9px] font-bold text-rose-500 mt-1 pl-1 uppercase tracking-tighter">{errors.address.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 pl-1">Phone</label>
                                    <input
                                        {...register('contactNumber')}
                                        type="tel"
                                        className={`w-full px-5 py-3 rounded-xl border ${errors.contactNumber ? 'border-rose-500/50 bg-rose-50/50' : 'border-zinc-100 bg-zinc-50'} text-zinc-900 text-sm font-bold placeholder:text-zinc-300 outline-none focus:bg-white focus:border-green-500/40 transition-all`}
                                        placeholder="+92 300 1234567"
                                    />
                                    {errors.contactNumber && <p className="text-[9px] font-bold text-rose-500 mt-1 pl-1 uppercase tracking-tighter">{errors.contactNumber.message}</p>}
                                </div>
                            </div>
                            <div className="pt-6 border-t border-zinc-50">
                                <h3 className="text-[10px] font-black text-green-600 uppercase tracking-[0.2em] mb-4">Admin Credentials</h3>
                                <div className="space-y-4">
                                    <div>
                                        <input
                                            {...register('adminFullName')}
                                            className={`w-full px-5 py-3 rounded-xl border ${errors.adminFullName ? 'border-rose-500/50 bg-rose-50/50' : 'border-zinc-100 bg-zinc-50'} text-zinc-900 text-sm font-bold outline-none focus:bg-white focus:border-green-500/40 transition-all`}
                                            placeholder="Full Name"
                                        />
                                        {errors.adminFullName && <p className="text-[9px] font-bold text-rose-500 mt-1 pl-1 uppercase tracking-tighter">{errors.adminFullName.message}</p>}
                                    </div>
                                    <input
                                        {...register('adminUsername')}
                                        type="email"
                                        autoComplete="off"
                                        className={`w-full px-5 py-3 rounded-xl border ${errors.adminUsername ? 'border-rose-500/50 bg-rose-50/50' : 'border-zinc-100 bg-zinc-50'} text-zinc-900 text-sm font-bold outline-none focus:bg-white focus:border-green-500/40 transition-all`}
                                        placeholder="email@example.com"
                                    />
                                    <input
                                        {...register('adminPassword')}
                                        type="password"
                                        autoComplete="new-password"
                                        className={`w-full px-5 py-3 rounded-xl border ${errors.adminPassword ? 'border-rose-500/50 bg-rose-50/50' : 'border-zinc-100 bg-zinc-50'} text-zinc-900 text-sm font-bold outline-none focus:bg-white focus:border-blue-500/40 transition-all`}
                                        placeholder="password"
                                    />
                                </div>
                            </div>
                            <div className="pt-4 border-t border-zinc-50">
                                <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                                    EasyPaisa Payment
                                </h3>
                                <div>
                                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 pl-1">EasyPaisa Number</label>
                                    <input
                                        {...register('easypaisaNumber')}
                                        type="tel"
                                        className={`w-full px-5 py-3 rounded-xl border ${errors.easypaisaNumber ? 'border-rose-500/50 bg-rose-50/50' : 'border-zinc-100 bg-zinc-50'} text-zinc-900 text-sm font-bold placeholder:text-zinc-300 outline-none focus:bg-white focus:border-emerald-500/40 transition-all`}
                                        placeholder="03001234567"
                                    />
                                    {errors.easypaisaNumber && <p className="text-[9px] font-bold text-rose-500 mt-1 pl-1 uppercase tracking-tighter">{errors.easypaisaNumber.message}</p>}
                                    <p className="text-[9px] text-zinc-400 font-bold mt-1 pl-1">Customers will send EasyPaisa payments to this number.</p>
                                </div>
                            </div>

                            {/* Bank Details Section */}
                            <div className="pt-4 border-t border-zinc-50 space-y-3">
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Building2 className="w-3.5 h-3.5 text-blue-500" />
                                        Bank Account Details ({newShopBanks.length})
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={handleAddNewShopBank}
                                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer border border-blue-200 active:scale-95"
                                    >
                                        <Plus className="w-3 h-3" /> Add Bank
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {newShopBanks.map((bank, index) => (
                                        <div key={index} className="p-3 bg-blue-50/20 rounded-2xl border border-blue-100/80 space-y-2.5 relative">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-black text-blue-700 uppercase tracking-wider">
                                                    🏛️ Bank Account #{index + 1}
                                                </span>
                                                {newShopBanks.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveNewShopBank(index)}
                                                        className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                                        title="Remove Bank"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 pl-1">Select Bank</label>
                                                <select
                                                    value={PAKISTANI_BANKS.includes(bank.bankName) ? bank.bankName : (bank.bankName ? 'Other Bank' : '')}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val === 'Other Bank') {
                                                            handleNewShopBankChange(index, 'bankName', bank.bankName || 'Other Bank');
                                                        } else {
                                                            handleNewShopBankChange(index, 'bankName', val);
                                                        }
                                                    }}
                                                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-900 text-xs font-bold outline-none focus:border-blue-500/40 transition-all cursor-pointer"
                                                >
                                                    <option value="">-- Choose Official Bank --</option>
                                                    {PAKISTANI_BANKS.map((b) => (
                                                        <option key={b} value={b}>{b}</option>
                                                    ))}
                                                    <option value="Other Bank">Other Bank / Custom</option>
                                                </select>
                                                {(!PAKISTANI_BANKS.includes(bank.bankName) && bank.bankName) && (
                                                    <input
                                                        value={bank.bankName === 'Other Bank' ? '' : bank.bankName}
                                                        onChange={(e) => handleNewShopBankChange(index, 'bankName', e.target.value)}
                                                        placeholder="Type Custom Bank Name"
                                                        className="w-full mt-1.5 px-3.5 py-2 rounded-xl border border-blue-200 bg-white text-zinc-900 text-xs font-bold outline-none"
                                                    />
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 pl-1">Bank Account / IBAN</label>
                                                <input
                                                    value={bank.bankAccountNumber}
                                                    onChange={(e) => handleNewShopBankChange(index, 'bankAccountNumber', e.target.value)}
                                                    placeholder="01020304050607 or IBAN"
                                                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-900 text-xs font-bold placeholder:text-zinc-300 outline-none focus:border-blue-500/40 transition-all"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 pl-1">Account Title / Beneficiary</label>
                                                <input
                                                    value={bank.bankAccountTitle}
                                                    onChange={(e) => handleNewShopBankChange(index, 'bankAccountTitle', e.target.value)}
                                                    placeholder="Account Title (e.g. Online POS Software)"
                                                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-900 text-xs font-bold placeholder:text-zinc-300 outline-none focus:border-blue-500/40 transition-all"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>


                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-4 bg-green-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-green-700 shadow-lg shadow-green-500/20 active:scale-95 transition-all mt-4 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {isSubmitting ? 'Registering...' : 'Create Shop'}
                            </button>
                        </form>
                    </div>

                    {/* Shops List for Management */}
                    <div className="lg:col-span-2 space-y-4">
                        <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-4 pl-2">Modify Existing Access</h3>
                        {filteredShops.map(shop => {
                            const shopId = shop._id || shop.id;
                            const isEditing = String(editingShop) === String(shopId);
                            return (
                                <div key={shopId} id={`shop-manage-${shopId}`} className="bg-white p-5 rounded-2xl border border-zinc-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm hover:shadow-rich hover:border-green-500/20 transition-all group/shop relative">
                                    <div className="flex items-start md:items-center gap-4 flex-1 min-w-0 w-full">
                                        <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-100 transition-colors group-hover/shop:bg-green-50/50 flex-shrink-0 mt-1 md:mt-0">
                                            <Store className="w-6 h-6 text-zinc-400 group-hover/shop:text-green-500 transition-colors" />
                                        </div>
                                        {isEditing ? (
                                            <div className="flex-1 space-y-3 py-1 w-full animate-in fade-in duration-200">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                                                    <div>
                                                        <label className="block text-[8.5px] font-black uppercase text-zinc-400 pl-1 mb-1">Shop Name</label>
                                                        <input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-900 text-xs font-bold focus:bg-white outline-none" placeholder="Shop Name" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[8.5px] font-black uppercase text-zinc-400 pl-1 mb-1">Admin Email</label>
                                                        <input value={editData.ownerEmail} onChange={(e) => setEditData({ ...editData, ownerEmail: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-900 text-xs font-bold focus:bg-white outline-none" placeholder="Email Address" type="email" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[8.5px] font-black uppercase text-zinc-400 pl-1 mb-1">Contact Phone</label>
                                                        <input value={editData.contactNumber} onChange={(e) => setEditData({ ...editData, contactNumber: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-900 text-xs font-bold focus:bg-white outline-none" placeholder="Phone" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[8.5px] font-black uppercase text-zinc-400 pl-1 mb-1">Status</label>
                                                        <select value={editData.status} onChange={(e) => setEditData({ ...editData, status: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-900 text-xs font-bold focus:bg-white outline-none">
                                                            <option value="active">Active</option>
                                                            <option value="inactive">Inactive</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-[8.5px] font-black uppercase text-zinc-400 pl-1 mb-1">Address</label>
                                                    <input value={editData.address} onChange={(e) => setEditData({ ...editData, address: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-900 text-xs font-bold focus:bg-white outline-none" placeholder="Address" />
                                                </div>
                                                <div className="pt-2 border-t border-zinc-100 space-y-2.5">

                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                        <div className="w-full sm:max-w-xs">
                                                            <label className="block text-[8.5px] font-black uppercase text-emerald-600 pl-1 mb-1">EasyPaisa Number</label>
                                                            <input value={editData.easypaisaNumber} onChange={(e) => setEditData({ ...editData, easypaisaNumber: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50/30 text-zinc-900 text-xs font-bold focus:bg-white outline-none" placeholder="03001234567" />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={handleAddEditBank}
                                                            className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer border border-blue-200 shadow-sm active:scale-95 self-start sm:self-end"
                                                        >
                                                            <Plus className="w-3.5 h-3.5" /> Add Another Bank
                                                        </button>
                                                    </div>

                                                    {/* Dynamic Banks List */}
                                                    <div className="space-y-2.5">
                                                        {(editData.banks || []).map((b, idx) => (
                                                            <div key={idx} className="p-3 bg-blue-50/20 rounded-xl border border-blue-100 space-y-2 relative">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[8.5px] font-black text-blue-700 uppercase tracking-wider flex items-center gap-1">
                                                                        🏛️ Bank #{idx + 1}
                                                                    </span>
                                                                    {(editData.banks || []).length > 1 && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleRemoveEditBank(idx)}
                                                                            className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                                                            title="Remove Bank"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                                    <div>
                                                                        <label className="block text-[8px] font-black uppercase text-blue-600 pl-1 mb-0.5">Bank Name</label>
                                                                        <select 
                                                                            value={PAKISTANI_BANKS.includes(b.bankName) ? b.bankName : (b.bankName ? 'Other Bank' : '')} 
                                                                            onChange={(e) => {
                                                                                const val = e.target.value;
                                                                                if (val === 'Other Bank') {
                                                                                    handleEditBankChange(idx, 'bankName', b.bankName || 'Other Bank');
                                                                                } else {
                                                                                    handleEditBankChange(idx, 'bankName', val);
                                                                                }
                                                                            }} 
                                                                            className="w-full px-2.5 py-1.5 rounded-lg border border-blue-200 bg-white text-zinc-900 text-xs font-bold focus:bg-white outline-none cursor-pointer"
                                                                        >
                                                                            <option value="">-- Choose Bank --</option>
                                                                            {PAKISTANI_BANKS.map(bankOpt => <option key={bankOpt} value={bankOpt}>{bankOpt}</option>)}
                                                                            <option value="Other Bank">Other Bank</option>
                                                                        </select>
                                                                        {(!PAKISTANI_BANKS.includes(b.bankName) && b.bankName) && (
                                                                            <input 
                                                                                value={b.bankName === 'Other Bank' ? '' : b.bankName} 
                                                                                onChange={(e) => handleEditBankChange(idx, 'bankName', e.target.value)} 
                                                                                className="w-full mt-1 px-2.5 py-1 rounded-lg border border-blue-200 bg-white text-xs font-bold outline-none" 
                                                                                placeholder="Type Custom Bank Name" 
                                                                            />
                                                                        )}
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-[8px] font-black uppercase text-blue-600 pl-1 mb-0.5">Account / IBAN</label>
                                                                        <input 
                                                                            value={b.bankAccountNumber || ''} 
                                                                            onChange={(e) => handleEditBankChange(idx, 'bankAccountNumber', e.target.value)} 
                                                                            className="w-full px-2.5 py-1.5 rounded-lg border border-blue-200 bg-white text-zinc-900 text-xs font-bold focus:bg-white outline-none" 
                                                                            placeholder="Account # or IBAN" 
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-[8px] font-black uppercase text-blue-600 pl-1 mb-0.5">Account Title</label>
                                                                        <input 
                                                                            value={b.bankAccountTitle || ''} 
                                                                            onChange={(e) => handleEditBankChange(idx, 'bankAccountTitle', e.target.value)} 
                                                                            className="w-full px-2.5 py-1.5 rounded-lg border border-blue-200 bg-white text-zinc-900 text-xs font-bold focus:bg-white outline-none" 
                                                                            placeholder="Beneficiary Title" 
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="font-bold text-zinc-900 text-sm uppercase tracking-tight truncate">{shop.name}</h3>
                                                    {(shop.banks && shop.banks.length > 0 ? shop.banks : (shop.bankName ? [{ bankName: shop.bankName }] : [])).map((b, bIdx) => (
                                                        b.bankName ? (
                                                            <span key={bIdx} className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-[9px] font-black uppercase">
                                                                🏛️ {b.bankName}
                                                            </span>
                                                        ) : null
                                                    ))}
                                                </div>
                                                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mt-0.5 truncate">
                                                    {shop.address || 'Global'} {shop.contactNumber && `• ${shop.contactNumber}`} 
                                                    {(shop.banks && shop.banks.length > 0 ? shop.banks : [{ bankAccountNumber: shop.bankAccountNumber }])
                                                        .filter(b => b.bankAccountNumber)
                                                        .map(b => `• A/C: ${b.bankAccountNumber}`)
                                                        .join(' ')}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap ml-auto md:ml-4 flex-shrink-0">
                                        {isEditing ? (
                                            <>
                                                <button type="button" onClick={() => handleUpdateShop(shopId)} className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl transition-all shadow-sm font-black text-xs flex items-center gap-1.5 cursor-pointer active:scale-95"><Check className="w-4 h-4" /> Save</button>
                                                <button type="button" onClick={() => setEditingShop(null)} className="p-2.5 bg-zinc-100 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200 rounded-xl transition-all border border-zinc-200 cursor-pointer"><X className="w-4 h-4" /></button>
                                            </>
                                        ) : (
                                            <>
                                                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${shop.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                                    {shop.status || 'active'}
                                                </span>
                                                <button type="button" onClick={() => window.open(`/shop/${shopId}`, '_blank')} className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-1 cursor-pointer active:scale-95" title="Open Store Portal">
                                                    <Store className="w-3.5 h-3.5" /> Portal
                                                </button>
                                                <button type="button" onClick={() => { setSelectedApprovalBranchId(shopId); setActiveTab('approvals'); }} className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-1 cursor-pointer active:scale-95" title="Branch Approvals">
                                                    <ShieldCheck className="w-3.5 h-3.5" /> Approvals
                                                </button>
                                                <button type="button" onClick={() => setViewingShop(shop)} className="p-2 bg-zinc-50 text-zinc-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all border border-zinc-200 cursor-pointer" title="View Details"><Eye className="w-3.5 h-3.5" /></button>
                                                <button type="button" onClick={() => startEdit(shop)} className="p-2 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg transition-all border border-amber-200 cursor-pointer" title="Edit Shop"><Edit2 className="w-3.5 h-3.5" /></button>
                                                <button type="button" onClick={() => handleDeleteShop(shop)} className="p-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg transition-all border border-rose-200 cursor-pointer" title="Delete Shop"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {/* Global Delete Confirmation Modal */}
                    <DeleteConfirmationModal
                        isOpen={deleteDialog.isOpen}
                        onClose={() => setDeleteDialog({ ...deleteDialog, isOpen: false })}
                        onConfirm={confirmDeleteShop}
                        title="Confirm Shop Deletion"
                        message="Are you sure you want to delete this shop and all its users? This cannot be undone."
                        itemName={deleteDialog.name}
                        isDeleting={isDeleting}
                    />

                    {/* Shop View Modal */}
                    {viewingShop && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-zinc-900/60 backdrop-blur-md animate-in fade-in duration-200">
                            <div className="bg-white w-full max-w-[440px] rounded-3xl shadow-2xl overflow-hidden border border-zinc-200 animate-in zoom-in-95 duration-200">
                                <div className="relative p-5 space-y-4">
                                    <button
                                        onClick={() => setViewingShop(null)}
                                        className="absolute top-4 right-4 p-1.5 bg-zinc-100 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 rounded-xl transition-all active:scale-95 cursor-pointer"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>

                                    <div className="flex items-center gap-3.5 pt-1 pr-6">
                                        <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 shrink-0">
                                            <Store className="w-6 h-6 text-emerald-600" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <h2 className="text-xl font-black text-zinc-900 uppercase tracking-tight truncate">{viewingShop.name}</h2>
                                                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shrink-0 ${viewingShop.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border-rose-500/20'}`}>
                                                    {viewingShop.status}
                                                </span>
                                            </div>
                                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest truncate">{viewingShop.address || "Attock, Pakistan"}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-zinc-100">
                                        <div className="space-y-2">
                                            <h4 className="text-[9px] font-black text-emerald-600 uppercase tracking-widest pl-1">Store Identity</h4>
                                            <div className="bg-zinc-50 p-2.5 rounded-xl border border-zinc-100 space-y-0.5">
                                                <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Reference ID</p>
                                                <p className="text-[11px] font-bold text-zinc-700 truncate">#{String(viewingShop._id || viewingShop.id || '').toUpperCase()}</p>
                                            </div>
                                            <div className="bg-zinc-50 p-2.5 rounded-xl border border-zinc-100 space-y-0.5">
                                                <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Contact</p>
                                                <p className="text-[11px] font-bold text-zinc-700">{viewingShop.contactNumber || "Not Provided"}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="text-[9px] font-black text-emerald-600 uppercase tracking-widest pl-1">Administrator</h4>
                                            <div className="bg-zinc-50 p-2.5 rounded-xl border border-zinc-100 space-y-0.5">
                                                <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Authorized</p>
                                                <p className="text-[11px] font-bold text-zinc-800 truncate">{viewingShop.ownerDetails?.fullName || viewingShop.adminFullName || "Attock Shop Admin"}</p>
                                            </div>
                                            <div className="bg-zinc-50 p-2.5 rounded-xl border border-zinc-100 space-y-0.5">
                                                <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Email Username</p>
                                                <p className="text-[10px] font-bold text-emerald-600 truncate">{viewingShop.ownerDetails?.email || "attock@gmail.com"}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bank & Payment Accounts in Detail Modal */}
                                    <div className="pt-2 border-t border-zinc-100 space-y-2">
                                        <h4 className="text-[9px] font-black text-blue-600 uppercase tracking-widest pl-1 flex items-center justify-between">
                                            <span className="flex items-center gap-1.5">
                                                <Building2 className="w-3 h-3 text-blue-500" />
                                                Bank & Payment Accounts ({viewingShop.banks?.length || (viewingShop.bankName ? 1 : 0)})
                                            </span>
                                        </h4>
                                        <div className="bg-emerald-50/40 p-2.5 rounded-xl border border-emerald-100 space-y-0.5">
                                            <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">EasyPaisa Number</p>
                                            <p className="text-[11px] font-bold text-emerald-800 truncate font-mono">{viewingShop.easypaisaNumber || "Not Configured"}</p>
                                        </div>
                                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                            {(viewingShop.banks && viewingShop.banks.length > 0
                                                ? viewingShop.banks
                                                : (viewingShop.bankName ? [{ bankName: viewingShop.bankName, bankAccountNumber: viewingShop.bankAccountNumber, bankAccountTitle: viewingShop.bankAccountTitle }] : [])
                                            ).map((b, idx) => (
                                                <div key={idx} className="bg-blue-50/40 p-2.5 rounded-xl border border-blue-100 space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[9px] font-black text-blue-700 uppercase flex items-center gap-1">
                                                            🏛️ Bank #{idx + 1}: {b.bankName || "Not Configured"}
                                                        </span>
                                                        {b.bankAccountTitle && (
                                                            <span className="text-[9px] font-bold text-zinc-600 bg-white px-2 py-0.5 rounded border border-blue-100">
                                                                {b.bankAccountTitle}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] font-bold text-zinc-800 truncate font-mono">
                                                        A/C: {b.bankAccountNumber || "Not Configured"}
                                                    </p>
                                                </div>
                                            ))}
                                            {(!viewingShop.banks || viewingShop.banks.length === 0) && !viewingShop.bankName && (
                                                <p className="text-[10px] text-zinc-400 font-bold italic pl-1">No bank accounts configured.</p>
                                            )}
                                        </div>
                                    </div>


                                    <button
                                        onClick={() => {
                                            startEdit(viewingShop);
                                            setViewingShop(null);
                                        }}
                                        className="w-full mt-2 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                        Enter Administrative Bridge (Edit Details)
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : activeTab === 'orders' ? (
                /* EasyPaisa Receipts & Orders Tab Content */
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-card p-6 rounded-3xl border border-[var(--color-border-subtle)] shadow-xl">
                        <div>
                            <h2 className="text-2xl font-black uppercase text-zinc-900 tracking-tight">EasyPaisa Orders — Monitor View</h2>
                            <p className="text-xs text-zinc-500 font-bold mt-1 uppercase tracking-wider">🔒 Read-Only • Shop Admins Approve Orders for Their Own Shops</p>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <select
                                value={selectedShopFilter}
                                onChange={(e) => setSelectedShopFilter(e.target.value)}
                                className="px-4 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-black uppercase tracking-wider text-zinc-900 shadow-sm outline-none cursor-pointer"
                            >
                                <option value="ALL">All Shops</option>
                                {shops.map(s => (
                                    <option key={s._id} value={s._id}>{s.name}</option>
                                ))}
                            </select>
                            <button onClick={fetchOrders} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95">
                                Refresh Orders
                            </button>
                        </div>
                    </div>

                    {ordersLoading ? (
                        <div className="py-20 text-center text-slate-400 font-bold">Loading orders and payment receipts...</div>
                    ) : orders.filter(o => selectedShopFilter === 'ALL' || String(o.shopId?._id || o.shopId) === String(selectedShopFilter)).length === 0 ? (
                        <div className="py-20 text-center bg-surface-card border border-[var(--color-border-subtle)] rounded-3xl text-slate-400 font-bold">
                            No customer orders placed for this selection yet.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {orders.filter(o => selectedShopFilter === 'ALL' || String(o.shopId?._id || o.shopId) === String(selectedShopFilter)).map(ord => (
                                <div key={ord._id} className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                                    <div className="space-y-2 flex-1">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <span className="text-xs font-black px-3 py-1 bg-zinc-900 text-white rounded-lg">#{String(ord._id || ord.id || '').slice(-6).toUpperCase()}</span>
                                            <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${ord.paymentMethod === 'EASYPAISA' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
                                                {ord.paymentMethod}
                                            </span>
                                            {/* Payment Status Badge - READ ONLY for SuperAdmin */}
                                            <span className={`text-[10px] font-black uppercase px-4 py-1.5 rounded-full flex items-center gap-1.5 ${
                                                ord.paymentStatus === 'PAID'
                                                    ? 'bg-emerald-600 text-white'
                                                    : ord.paymentStatus === 'FAILED'
                                                    ? 'bg-rose-600 text-white'
                                                    : 'bg-amber-100 text-amber-700 border border-amber-200'
                                            }`}>
                                                {ord.paymentStatus === 'PAID' ? '✅ PAID — Approved by Shop Admin' :
                                                 ord.paymentStatus === 'FAILED' ? '❌ REJECTED by Shop Admin' :
                                                 '⏳ PENDING — Awaiting Shop Admin Approval'}
                                            </span>
                                            <span className="text-xs font-bold text-zinc-400">{new Date(ord.createdAt).toLocaleString()}</span>
                                        </div>

                                        {/* Shop Name */}
                                        <div className="text-xs font-black text-zinc-500 uppercase tracking-widest">
                                            🏪 Shop: <span className="text-emerald-700">{ord.shopId?.name || 'Unknown Shop'}</span>
                                        </div>

                                        <div className="text-sm font-bold text-zinc-800">
                                            Customer: <span className="text-emerald-700">{ord.customerId?.fullName || ord.shippingDetails?.fullName || 'Customer'}</span>
                                            {' '}
                                            <span className="text-zinc-500 text-xs">({ord.shippingDetails?.phone || ord.customerId?.phone || 'No phone'})</span>
                                        </div>

                                        {ord.transactionId && (
                                            <div className="text-xs font-bold text-zinc-600">
                                                Transaction ID / Sender: <span className="text-amber-600 font-black">{ord.transactionId}</span>
                                            </div>
                                        )}

                                        <div className="text-xs text-zinc-400">
                                            Items: {ord.items?.map(i => `${i.name} x${i.quantity}`).join(', ')} | Total: <span className="font-black text-emerald-600 text-sm">RS {ord.totalAmount?.toLocaleString()}</span>
                                        </div>
                                    </div>

                                    {/* Proof Screenshot - VIEW ONLY, No Delete for SuperAdmin */}
                                    <div className="flex items-center gap-4">
                                        {ord.paymentProof ? (
                                            <div
                                                onClick={() => setSelectedProofImage({ url: ord.paymentProof, orderId: ord._id })}
                                                className="cursor-pointer group relative border-2 border-emerald-400/60 rounded-2xl overflow-hidden shadow-lg hover:scale-105 transition-all"
                                                title="Click to view screenshot"
                                            >
                                                <img src={ord.paymentProof} alt="Payment Proof" className="w-24 h-24 object-cover" />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-black uppercase tracking-wider transition-all">
                                                    👁 View
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-24 h-24 rounded-2xl border border-dashed border-zinc-300 flex flex-col items-center justify-center p-2 text-center text-zinc-400 text-[10px] font-bold">
                                                No Screenshot Yet
                                            </div>
                                        )}

                                        {/* SuperAdmin READ-ONLY note — No action buttons */}
                                        <div className="flex flex-col items-center justify-center text-center gap-1.5 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl min-w-[130px]">
                                            <span className="text-xl">🔒</span>
                                            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest leading-tight">Shop Admin<br />Approval Only</p>
                                            <p className="text-[8px] text-zinc-400 font-bold">SuperAdmin is Monitor</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : null}



            {/* Lightbox Screenshot Modal - VIEW ONLY for SuperAdmin */}
            {selectedProofImage && (
                <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setSelectedProofImage(null)}>
                    <div className="relative max-w-4xl max-h-[90vh] bg-white border border-zinc-200 rounded-3xl p-4 shadow-2xl flex flex-col items-center" onClick={e => e.stopPropagation()}>
                        <div className="w-full flex justify-between items-center pb-3 mb-3 border-b border-zinc-100 gap-4">
                            <div>
                                <h3 className="text-sm font-black text-emerald-700 uppercase tracking-wider">Transaction Payment Screenshot</h3>
                                <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">🔒 View-Only — SuperAdmin Monitor</p>
                            </div>
                            <button onClick={() => setSelectedProofImage(null)} className="p-2 hover:bg-zinc-100 rounded-full text-zinc-700 transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <img src={selectedProofImage.url || selectedProofImage} alt="Full Payment Proof" className="max-h-[75vh] w-auto object-contain rounded-2xl border border-zinc-200" />
                    </div>
                </div>
            )}


            {/* Order / Screenshot Delete Confirmation Modal */}
            <DeleteConfirmationModal
                isOpen={deleteOrderModal.isOpen}
                onClose={() => setDeleteOrderModal({ ...deleteOrderModal, isOpen: false })}
                onConfirm={confirmDeleteOrderAction}
                title={deleteOrderModal.title}
                message={deleteOrderModal.message}
                itemName={deleteOrderModal.orderId ? `#${String(deleteOrderModal.orderId).slice(-6).toUpperCase()}` : ''}
                isDeleting={isDeletingOrder}
            />
        </div>
    );
}
