import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { settingsSchema } from '../schemas/settingsSchema';
import { useSettings } from '../contexts/SettingsContext';
import { useUser } from '../contexts/UserContext';
import { Save, Shield, Store, Phone, Mail, MapPin, Calculator, Key, Eye, EyeOff, ChevronDown, AlertCircle, UserCircle, ImagePlus, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

const Section = ({ id, title, icon: Icon, colorClass, bgClass, children, isOpen, onToggle }) => (
  <div className={`bg-surface-card p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] shadow-2xl border border-[var(--color-border-subtle)] transition-all duration-300`}>
    <button
      onClick={() => onToggle(id)}
      className="w-full flex items-center justify-between group"
    >
      <div className="flex items-center gap-4">
        <div className={`p-4 bg-[var(--color-surface-base)] rounded-2xl border border-[var(--color-border-subtle)] group-hover:scale-110 transition-transform shadow-inner`}>
          <Icon className={`w-6 h-6 ${colorClass.includes('indigo') ? 'text-[var(--color-primary)]' : colorClass.includes('amber') ? 'text-emerald-500' : 'text-rose-500'}`} />
        </div>
        <h3 className="text-2xl font-black text-[var(--color-text-primary)] tracking-tighter text-left uppercase">{title}</h3>
      </div>
      <ChevronDown className={`w-6 h-6 text-[var(--color-text-muted)] transition-transform duration-500 ${isOpen ? 'rotate-180 text-[var(--color-primary)]' : ''}`} />
    </button>

    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          <div className="pt-10 border-t border-[var(--color-border-subtle)] mt-8">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

export function SettingsView() {
  const { settings, updateSettings, getSecureSettings } = useSettings();
  const { user } = useUser();

  const role = user?.role?.toLowerCase();
  const isSystemAdmin = role === 'super_admin';
  const isShopAdminRole = role === 'shop_admin';
  const isAdmin = isShopAdminRole || isSystemAdmin;

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [collapsed, setCollapsed] = useState({
    shop: true,
    finances: true,
    profile: true,
    security: true
  });
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      shopName: '',
      address: '',
      phone: '',
      email: '',
      currency: '$',
      taxRate: 0,
      ownerPassword: '',
      logoUrl: '',
      ownerFullName: '',
      ownerEmail: '',
      ownerPhone: '',
      easypaisaNumber: '',
      easypaisaEnabled: false
    }
  });

  const toggleSection = (section) => {
    setCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleLogoUpload = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('images', file);
    setLogoUploading(true);
    try {
      const res = await api.post('/upload', formData);
      const url = res.data.images?.[0];
      if (url) {
        console.log('Logo uploaded successfully. URL:', url);
        setValue('logoUrl', url, { shouldDirty: true });
        toast.success('Logo uploaded successfully!');
      }
    } catch (err) {
      console.error('Logo upload error:', err);
      toast.error(err.response?.data?.message || 'Logo upload failed. Please try again.');
    } finally {
      setLogoUploading(false);
    }
  };

  const initialResetDone = useRef(false);

  useEffect(() => {
    if (settings && !initialResetDone.current) {
      reset({
        ...settings,
        // fallback to logged-in user identity if owner fields are not yet saved
        ownerFullName: settings.ownerFullName || user?.fullName || '',
        ownerEmail: settings.ownerEmail || user?.email || '',
        ownerPhone: settings.ownerPhone || '',
        easypaisaNumber: settings.easypaisaNumber || '',
        easypaisaEnabled: settings.easypaisaEnabled || false,
      });
      initialResetDone.current = true;
    }
  }, [settings, reset, user]);

  // Auto-authorize Admins (Shop & Super)
  useEffect(() => {
    if ((isShopAdminRole || isSystemAdmin) && !isAuthorized) {
      getSecureSettings('', user?.role)
        .then(data => {
          if (!initialResetDone.current || isAuthorized) { // Only reset if we haven't or if we just authorized
            reset({
              ...data,
              ownerFullName: data.ownerFullName || user?.fullName || '',
              ownerEmail: data.ownerEmail || user?.email || '',
              ownerPhone: data.ownerPhone || '',
              easypaisaNumber: data.easypaisaNumber || '',
              easypaisaEnabled: data.easypaisaEnabled || false,
            });
            initialResetDone.current = true;
          }
          if (data.ownerPassword) {
            setNewPwd(data.ownerPassword);
            setConfirmPwd(data.ownerPassword);
          }
          setIsAuthorized(true);
        })
        .catch(err => console.error("Auto-auth failed:", err));
    }
  }, [user, isAuthorized, reset, getSecureSettings, isShopAdminRole, isSystemAdmin]);

  const handleAuthorize = async (e) => {
    e.preventDefault();
    try {
      const secureData = await getSecureSettings(currentPwd, user?.role);
      reset(secureData);
      setIsAuthorized(true);
      toast.success("Authorized successfully!");
    } catch (err) {
      toast.error(err.message || "Invalid password");
    }
  };

  const onSubmit = async (data) => {
    try {
      const updates = { ...data };
      if (newPwd) {
        if (newPwd !== confirmPwd) {
          toast.error("New passwords do not match");
          return;
        }
        updates.ownerPassword = newPwd;
      }

      await updateSettings(updates, currentPwd, user?.role);
      toast.success("Settings updated successfully!");
      setNewPwd('');
      setConfirmPwd('');
      // Refresh secure data if password changed
      if (newPwd) {
        setIsAuthorized(false);
        setCurrentPwd('');
      }
    } catch (err) {
      toast.error(err.message || "Failed to update settings");
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20 shadow-inner">
          <Shield className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-3xl font-black text-[var(--color-text-primary)] uppercase tracking-tighter italic">Access Restricted</h2>
        <p className="text-[var(--color-text-muted)] font-bold uppercase text-[10px] tracking-[0.4em] mt-4 max-w-sm">
          System settings are only accessible via Admin-level Identity Protocols.
        </p>
      </div>
    );
  }

  const isBypassed = isSystemAdmin || isShopAdminRole;

  if (!isAuthorized && !isBypassed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50svh] px-4 animate-in fade-in zoom-in duration-500">
        <div className="w-[95%] sm:w-[380px] bg-surface-card rounded-xl shadow-2xl border border-[var(--color-border-subtle)] relative overflow-hidden p-6 sm:p-8 mx-auto">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-[var(--color-primary)] to-rose-500"></div>
          <div className="text-center mb-8">
            <div className="inline-flex p-3.5 bg-green-500/10 text-[var(--color-primary)] rounded-full mb-4 border border-green-500/20 shadow-inner">
              <Shield className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-[var(--color-text-primary)] uppercase tracking-tighter italic leading-none">Owner Access</h2>
            <p className="text-[var(--color-text-muted)] text-[8px] font-black uppercase tracking-[0.2em] mt-3">Identity Protocol Required</p>
          </div>

          <form onSubmit={handleAuthorize} className="space-y-4">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                <div className="p-1.5 bg-[var(--color-surface-base)] text-[var(--color-text-muted)] rounded-lg group-focus-within:text-[var(--color-primary)] transition-colors border border-[var(--color-border-subtle)]">
                  <Key className="w-4 h-4" />
                </div>
              </div>
              <input
                type={showPwd ? "text" : "password"}
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                className="block w-full pl-11 pr-10 py-3 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:ring-1 focus:ring-green-500/40 outline-none transition-all font-bold text-sm placeholder:text-slate-800"
                placeholder="Access Code"
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-600 hover:text-[var(--color-primary)] transition-colors"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-[var(--color-text-primary)] rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-[var(--color-primary)]/10 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 mt-2"
            >
              Authorize Archive
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 space-y-6 sm:space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-8 border-b border-[var(--color-border-subtle)]">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-[var(--color-text-primary)] tracking-tighter uppercase leading-none">
            System Settings
          </h1>
          <div className="text-[var(--color-text-secondary)] font-bold uppercase text-[9px] sm:text-[10px] tracking-[0.3em] sm:tracking-[0.4em] mt-3 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
            Master Configuration Panel
          </div>
        </div>
        <button
          onClick={handleSubmit(onSubmit)}
          disabled={isSubmitting}
          className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-[var(--color-text-primary)] rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] shadow-2xl shadow-[var(--color-primary)]/20 hover:scale-[1.05] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {isSubmitting ? 'Saving...' : 'Save Protocol'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Shop Details */}
        <div className="lg:col-span-2 space-y-6">
          <Section
            id="shop"
            title="Shop Information"
            icon={Store}
            colorClass="bg-indigo-50 text-indigo-600"
            bgClass="bg-white"
            isOpen={collapsed.shop}
            onToggle={toggleSection}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

              {/* Logo Upload Widget */}
              <div className="md:col-span-2 space-y-3">
                <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest pl-1">Shop Logo</label>
                <div className="flex flex-col sm:flex-row items-center gap-5">
                  {/* Preview */}
                  <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-base)] flex items-center justify-center overflow-hidden shrink-0">
                    {watch('logoUrl') ? (
                      <img src={watch('logoUrl')} alt="Shop Logo" className="w-full h-full object-contain" />
                    ) : (
                      <Store className="w-8 h-8 text-[var(--color-text-muted)]" />
                    )}
                  </div>
                  {/* Upload & URL inputs */}
                  <div className="flex-1 space-y-3">
                    <label
                      className={`w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-[var(--color-border-subtle)] rounded-2xl text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] hover:border-green-500 hover:text-green-600 hover:bg-green-50/50 transition-all cursor-pointer ${logoUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <UploadCloud className="w-4 h-4" />
                      {logoUploading ? 'Uploading...' : 'Click to Upload Logo'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => !logoUploading && handleLogoUpload(e.target.files?.[0])}
                        disabled={logoUploading}
                      />
                    </label>
                    <input
                      {...register('logoUrl')}
                      className="block w-full px-4 py-3 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-2xl text-[var(--color-text-primary)] focus:border-green-500/40 focus:ring-1 focus:ring-green-500/40 transition-all font-bold placeholder:text-slate-400 outline-none text-xs"
                      placeholder="Or paste an image URL directly..."
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest pl-1">Legal Shop Identity</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors">
                    <Store className="w-5 h-5" />
                  </div>
                  <input
                    {...register('shopName')}
                    className={`block w-full pl-12 pr-5 py-4 bg-[var(--color-surface-base)] border ${errors.shopName ? 'border-rose-500/50 bg-rose-50/50' : 'border-[var(--color-border-subtle)]'} rounded-2xl text-[var(--color-text-primary)] focus:border-green-500/40 focus:ring-1 focus:ring-green-500/40 transition-all font-bold placeholder:text-slate-700 outline-none`}
                    placeholder="Enter Shop Name"
                  />
                  {errors.shopName && <p className="text-[9px] font-bold text-rose-500 mt-1 pl-1 uppercase tracking-tighter">{errors.shopName.message}</p>}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest pl-1">Official Email</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    {...register('email')}
                    type="email"
                    className={`block w-full pl-12 pr-5 py-4 bg-[var(--color-surface-base)] border ${errors.email ? 'border-rose-500/50 bg-rose-50/50' : 'border-[var(--color-border-subtle)]'} rounded-2xl text-[var(--color-text-primary)] focus:border-green-500/40 focus:ring-1 focus:ring-green-500/40 transition-all font-bold placeholder:text-slate-700 outline-none`}
                    placeholder="shop@premium.com"
                  />
                  {errors.email && <p className="text-[9px] font-bold text-rose-500 mt-1 pl-1 uppercase tracking-tighter">{errors.email.message}</p>}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest pl-1">Contact Line</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors">
                    <Phone className="w-5 h-5" />
                  </div>
                  <input
                    {...register('phone')}
                    className={`block w-full pl-12 pr-5 py-4 bg-[var(--color-surface-base)] border ${errors.phone ? 'border-rose-500/50 bg-rose-50/50' : 'border-[var(--color-border-subtle)]'} rounded-2xl text-[var(--color-text-primary)] focus:border-green-500/40 focus:ring-1 focus:ring-green-500/40 transition-all font-bold placeholder:text-slate-700 outline-none`}
                    placeholder="+1 234 567 890"
                  />
                  {errors.phone && <p className="text-[9px] font-bold text-rose-500 mt-1 pl-1 uppercase tracking-tighter">{errors.phone.message}</p>}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest pl-1">Currency Format</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-[var(--color-primary)] font-black">
                    {watch('currency') || 'Rs.'}
                  </div>
                  <input
                    {...register('currency')}
                    maxLength={5}
                    className={`block w-full pl-16 pr-5 py-4 bg-[var(--color-surface-base)] border ${errors.currency ? 'border-rose-500/50 bg-rose-50/50' : 'border-[var(--color-border-subtle)]'} rounded-2xl text-[var(--color-text-primary)] focus:border-green-500/40 focus:ring-1 focus:ring-green-500/40 transition-all font-bold placeholder:text-slate-700 outline-none`}
                    placeholder="Rs."
                  />
                  {errors.currency && <p className="text-[9px] font-bold text-rose-500 mt-1 pl-1 uppercase tracking-tighter">{errors.currency.message}</p>}
                </div>
              </div>

              <div className="space-y-3 md:col-span-2">
                <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest pl-1">Global Address</label>
                <div className="relative group">
                  <div className="absolute top-5 left-4 flex items-start pointer-events-none text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <textarea
                    rows={3}
                    {...register('address')}
                    className={`block w-full pl-12 pr-5 py-4 bg-[var(--color-surface-base)] border ${errors.address ? 'border-rose-500/50 bg-rose-50/50' : 'border-[var(--color-border-subtle)]'} rounded-2xl text-[var(--color-text-primary)] focus:border-green-500/40 focus:ring-1 focus:ring-green-500/40 transition-all font-bold placeholder:text-slate-700 outline-none resize-none`}
                    placeholder="Enter complete store location for billing documentation..."
                  />
                  {errors.address && <p className="text-[9px] font-bold text-rose-500 mt-1 pl-1 uppercase tracking-tighter">{errors.address.message}</p>}
                </div>
              </div>
            </div>
          </Section>

          <Section
            id="finances"
            title="Finances & Taxes"
            icon={Calculator}
            colorClass="bg-amber-50 text-amber-600"
            bgClass="bg-white"
            isOpen={collapsed.finances}
            onToggle={toggleSection}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest pl-1">Applied Tax Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  {...register('taxRate')}
                  className={`block w-full px-5 py-4 bg-[var(--color-surface-base)] border ${errors.taxRate ? 'border-rose-500/50 bg-rose-50/50' : 'border-[var(--color-border-subtle)]'} rounded-2xl text-[var(--color-text-primary)] focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/40 transition-all font-bold outline-none`}
                  placeholder="0.00"
                />
                {errors.taxRate && <p className="text-[9px] font-bold text-rose-500 mt-1 pl-1 uppercase tracking-tighter">{errors.taxRate.message}</p>}
              </div>
            </div>
          </Section>
        </div>

        {/* Profile & Security column */}
        <div className="space-y-6">
          <Section
            id="profile"
            title="Owner Profile"
            icon={UserCircle}
            colorClass="bg-green-50 text-green-600"
            bgClass="bg-white"
            isOpen={collapsed.profile}
            onToggle={toggleSection}
          >
            <div className="flex items-center gap-4 border-b border-[var(--color-border-subtle)] pb-6 mb-6">
              <div className="p-4 bg-[var(--color-surface-base)] rounded-2xl border border-[var(--color-border-subtle)]">
                <UserCircle className="w-8 h-8 text-green-500" />
              </div>
              <div>
                <h4 className="text-lg font-black text-[var(--color-text-primary)] uppercase leading-none">{user?.fullName || 'System Admin'}</h4>
                <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest">{user?.role?.replace('_', ' ') || 'Admin'}</span>
              </div>
            </div>

            {/* Read-only auth info */}
            <div className="grid grid-cols-1 gap-2 mb-6 p-4 bg-[var(--color-surface-base)] rounded-2xl border border-[var(--color-border-subtle)]">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">Username</span>
                <span className="text-xs font-bold text-[var(--color-text-primary)]">{user?.username || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-[var(--color-border-subtle)]">
                <span className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">System ID</span>
                <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{(user?.id || user?._id || '').toString().slice(-8).toUpperCase()}</span>
              </div>
            </div>

            {/* Editable owner details */}
            <div className="space-y-5">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest pl-1">Owner Full Name</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors">
                    <UserCircle className="w-5 h-5" />
                  </div>
                  <input
                    {...register('ownerFullName')}
                    className="block w-full pl-12 pr-5 py-4 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-2xl text-[var(--color-text-primary)] focus:border-green-500/40 focus:ring-1 focus:ring-green-500/40 transition-all font-bold placeholder:text-slate-400 outline-none"
                    placeholder="Owner Display Name"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest pl-1">Owner Email</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    {...register('ownerEmail')}
                    type="email"
                    className="block w-full pl-12 pr-5 py-4 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-2xl text-[var(--color-text-primary)] focus:border-green-500/40 focus:ring-1 focus:ring-green-500/40 transition-all font-bold placeholder:text-slate-400 outline-none"
                    placeholder="owner@shop.com"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest pl-1">Owner Phone</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors">
                    <Phone className="w-5 h-5" />
                  </div>
                  <input
                    {...register('ownerPhone')}
                    className="block w-full pl-12 pr-5 py-4 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-2xl text-[var(--color-text-primary)] focus:border-green-500/40 focus:ring-1 focus:ring-green-500/40 transition-all font-bold placeholder:text-slate-400 outline-none"
                    placeholder="+1 234 567 890"
                  />
                </div>
              </div>
              {/* EasyPaisa Section */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest pl-1">EasyPaisa Number</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--color-text-muted)] group-focus-within:text-emerald-500 transition-colors">
                    <Phone className="w-5 h-5" />
                  </div>
                  <input
                    {...register('easypaisaNumber')}
                    type="tel"
                    className="block w-full pl-12 pr-5 py-4 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-2xl text-[var(--color-text-primary)] focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/40 transition-all font-bold placeholder:text-slate-400 outline-none"
                    placeholder="03001234567"
                  />
                  {errors.easypaisaNumber && <p className="text-[9px] font-bold text-rose-500 mt-1 pl-1 uppercase tracking-tighter">{errors.easypaisaNumber.message}</p>}
                </div>
                <div className="flex items-center gap-3 pl-1 mt-2">
                  <input
                    type="checkbox"
                    id="easypaisaEnabled"
                    {...register('easypaisaEnabled')}
                    className="w-4 h-4 accent-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="easypaisaEnabled" className="text-[11px] font-bold text-[var(--color-text-secondary)] cursor-pointer">
                    Enable EasyPaisa payments for customers
                  </label>
                </div>
              </div>
            </div>
          </Section>

          <Section
            id="security"
            title="Security"
            icon={Shield}
            colorClass="bg-red-500/20 text-red-500"
            bgClass="bg-slate-900 text-[var(--color-text-primary)]"
            isOpen={collapsed.security}
            onToggle={toggleSection}
          >
            <div className="space-y-6">
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed italic">
                Change the master password used to authorize sensitive actions like price edits, stock adjustments, and sale deletions.
              </p>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest px-1">New Password</label>
                  <div className="relative">
                    <input
                      type={showPwd ? "text" : "password"}
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                      className="block w-full px-4 py-3 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-medium pr-12"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-[var(--color-text-secondary)] hover:text-red-500 transition-colors focus:outline-none group/pass"
                    >
                      {showPwd ? (
                        <EyeOff className="w-4 h-4 group-hover/pass:scale-110 transition-transform" />
                      ) : (
                        <Eye className="w-4 h-4 group-hover/pass:scale-110 transition-transform" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest px-1">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showPwd ? "text" : "password"}
                      value={confirmPwd}
                      onChange={(e) => setConfirmPwd(e.target.value)}
                      className="block w-full px-4 py-3 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-medium pr-14"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-[var(--color-text-secondary)] hover:text-red-500 transition-colors focus:outline-none group/pass"
                    >
                      {showPwd ? (
                        <EyeOff className="w-4 h-4 group-hover/pass:scale-110 transition-transform" />
                      ) : (
                        <Eye className="w-4 h-4 group-hover/pass:scale-110 transition-transform" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-red-500/10 rounded-2xl border border-red-500/20">
                <p className="text-[10px] text-red-400 font-bold leading-tight">
                  <span className="text-red-500 uppercase block mb-1">Warning:</span>
                  Changing the owner password will invalidate any currently active authorization. You will need to re-log with the new password.
                </p>
              </div>
            </div>
          </Section>
        </div>

      </div>
    </div>
  );
}
