import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { memberSchema } from '../schemas/memberSchema';
import {
    User,
    Key,
    Shield,
    Users,
    Phone,
    Sun,
    Moon,
    RefreshCw,
    AlertCircle,
    Save,
    X,
    Eye,
    EyeOff
} from 'lucide-react';
import { useState } from 'react';

export function MemberForm({ onSubmit, initialData, onCancel, isSubmitting, isViewMode }) {
    const {
        register,
        handleSubmit,
        formState: { errors, touchedFields },
        reset
    } = useForm({
        resolver: zodResolver(memberSchema),
        mode: 'onBlur',
        defaultValues: initialData || {
            fullName: '',
            username: '',
            password: '',
            role: 'cashier',
            preferredShift: 'day',
            phoneNumber: ''
        }
    });

    const [showPassword, setShowPassword] = useState(false);

    const InputWrapper = ({ label, icon: Icon, error, touched, children }) => (
        <div className="space-y-2 group animate-in slide-in-from-left-4 duration-500">
            <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] pl-1 flex justify-between items-center group-focus-within:text-[var(--color-primary)] transition-colors">
                {label}
                {touched && !error && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-sm shadow-emerald-500/50"></span>}
            </label>
            <div className={`relative transition-all duration-500 rounded-2xl ${error ? 'border-rose-500/50 shadow-inner shadow-rose-500/10' : 'group-focus-within:shadow-2xl group-focus-within:shadow-[var(--color-primary)]/10'}`}>
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors">
                    <Icon className="w-5 h-5" />
                </div>
                {children}
            </div>
            {error && (
                <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest pl-1 flex items-center gap-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <AlertCircle className="w-3 h-3" /> {error.message}
                </p>
            )}
        </div>
    );

    return (
        <div className="glass-morphism rounded-[2.5rem] p-10 border border-[var(--color-border-subtle)] shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-700">
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-primary)]/5 blur-[100px] -z-10 rounded-full"></div>

            <div className="flex justify-between items-center mb-10">
                <div className="space-y-2">
                    <h3 className="text-3xl font-black text-[var(--color-text-primary)] tracking-tighter uppercase leading-none italic">
                        Personnel Registration
                    </h3>
                    <p className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.4em] opacity-60">NexusOS Core Protocol</p>
                </div>
                <button
                    onClick={onCancel}
                    className="p-3 bg-[var(--color-surface-base)] text-[var(--color-text-muted)] hover:text-rose-500 hover:scale-110 active:scale-95 transition-all rounded-xl border border-[var(--color-border-subtle)]"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                    <InputWrapper
                        label="Full Legal Identity"
                        icon={User}
                        error={errors.fullName}
                        touched={touchedFields.fullName}
                    >
                        <input
                            {...register('fullName')}
                            disabled={isViewMode}
                            className="w-full bg-[var(--color-surface-base)]/50 border border-[var(--color-border-subtle)] focus:border-[var(--color-primary)]/50 rounded-2xl py-4.5 px-12 text-sm font-bold text-[var(--color-text-primary)] outline-none transition-all placeholder:text-slate-700 backdrop-blur-md disabled:opacity-50"
                            placeholder="Ex: Alexander Pierce"
                        />
                    </InputWrapper>

                    <InputWrapper
                        label="System Access Index"
                        icon={Users}
                        error={errors.username}
                        touched={touchedFields.username}
                    >
                        <input
                            {...register('username')}
                            disabled={isViewMode}
                            className="w-full bg-[var(--color-surface-base)]/50 border border-[var(--color-border-subtle)] focus:border-[var(--color-primary)]/50 rounded-2xl py-4.5 px-12 text-sm font-bold text-[var(--color-text-primary)] outline-none transition-all placeholder:text-slate-700 backdrop-blur-md disabled:opacity-50"
                            placeholder="alex_nexus"
                        />
                    </InputWrapper>

                    <InputWrapper
                        label="Security Pass Code"
                        icon={Key}
                        error={errors.password}
                        touched={touchedFields.password}
                    >
                        <input
                            type={showPassword ? "text" : "password"}
                            {...register('password')}
                            disabled={isViewMode}
                            className="w-full bg-[var(--color-surface-base)]/50 border border-[var(--color-border-subtle)] focus:border-[var(--color-primary)]/50 rounded-2xl py-4.5 px-12 text-sm font-bold text-[var(--color-text-primary)] outline-none transition-all placeholder:text-slate-700 backdrop-blur-md disabled:opacity-50"
                            placeholder="••••••••"
                        />
                        {!isViewMode && (
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        )}
                    </InputWrapper>

                    <InputWrapper
                        label="Signal Frequency (Phone)"
                        icon={Phone}
                        error={errors.phoneNumber}
                        touched={touchedFields.phoneNumber}
                    >
                        <input
                            {...register('phoneNumber')}
                            disabled={isViewMode}
                            className="w-full bg-[var(--color-surface-base)]/50 border border-[var(--color-border-subtle)] focus:border-[var(--color-primary)]/50 rounded-2xl py-4.5 px-12 text-sm font-bold text-[var(--color-text-primary)] outline-none transition-all placeholder:text-slate-700 backdrop-blur-md disabled:opacity-50"
                            placeholder="+92 3XX XXXXXXX"
                        />
                    </InputWrapper>

                    <InputWrapper
                        label="Authorization Tier"
                        icon={Shield}
                        error={errors.role}
                        touched={touchedFields.role}
                    >
                        <select
                            {...register('role')}
                            disabled={isViewMode}
                            className="w-full bg-[var(--color-surface-base)]/50 border border-[var(--color-border-subtle)] focus:border-[var(--color-primary)]/50 rounded-2xl py-4.5 px-12 text-sm font-bold text-[var(--color-text-primary)] outline-none transition-all cursor-pointer backdrop-blur-md appearance-none disabled:opacity-50"
                        >
                            <option value="cashier" className="bg-slate-900 text-white font-bold">Cashier Station</option>
                            <option value="salesman" className="bg-slate-900 text-white font-bold">Sales Agent</option>
                            <option value="admin" className="bg-slate-900 text-white font-bold">Sub-Admin Terminal</option>
                        </select>
                    </InputWrapper>

                    <InputWrapper
                        label="Operational Rotation"
                        icon={RefreshCw}
                        error={errors.preferredShift}
                        touched={touchedFields.preferredShift}
                    >
                        <div className="grid grid-cols-3 gap-3 p-1 bg-[var(--color-surface-base)]/30 rounded-2xl border border-[var(--color-border-subtle)]">
                            {['day', 'night', 'both'].map((shift) => (
                                <label key={shift} className="cursor-pointer">
                                    <input
                                        type="radio"
                                        value={shift}
                                        {...register('preferredShift')}
                                        disabled={isViewMode}
                                        className="sr-only peer"
                                    />
                                    <div className={`flex flex-col items-center justify-center py-3 rounded-xl transition-all peer-checked:bg-[var(--color-primary)] peer-checked:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-base)]/50 text-[var(--color-text-muted)] group ${isViewMode ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        {shift === 'day' && <Sun className="w-4 h-4 mb-1 group-hover:scale-110 transition-transform" />}
                                        {shift === 'night' && <Moon className="w-4 h-4 mb-1 group-hover:scale-110 transition-transform" />}
                                        {shift === 'both' && <RefreshCw className="w-4 h-4 mb-1 group-hover:scale-110 transition-transform" />}
                                        <span className="text-[9px] font-black uppercase tracking-widest">{shift}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </InputWrapper>

                </div>

                <div className="flex items-center justify-end gap-6 pt-6 border-t border-[var(--color-border-subtle)]/50">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] hover:text-[var(--color-text-primary)] transition-colors"
                    >
                        Abort Protocol
                    </button>
                    {!isViewMode && (
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-12 py-5 bg-gradient-to-r from-[var(--color-primary)] to-rose-500 text-[var(--color-text-primary)] rounded-full font-black text-[11px] uppercase tracking-[0.3em] shadow-2xl shadow-[var(--color-primary)]/20 hover:scale-[1.05] active:scale-95 transition-all flex items-center gap-4 disabled:opacity-50 disabled:scale-100"
                        >
                            {isSubmitting ? (
                                <RefreshCw className="w-5 h-5 animate-spin" />
                            ) : (
                                <Save className="w-5 h-5" />
                            )}
                            Execute Entry
                        </button>
                    )}
                </div>
            </form>

            {/* Global CSS for Glassmorphism */}
            <style jsx="true">{`
        .glass-morphism {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus {
          -webkit-text-fill-color: var(--color-text-primary);
          -webkit-box-shadow: 0 0 0px 1000px rgba(15, 23, 42, 0.5) inset;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>
        </div>
    );
}
