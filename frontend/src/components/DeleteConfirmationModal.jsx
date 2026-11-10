import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

export function DeleteConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title = "Confirm Deletion",
    message = "Are you sure you want to remove this entry?",
    itemName = "",
    isDeleting = false
}) {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="w-full max-w-[400px] bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl border border-zinc-200 dark:border-zinc-800 relative z-10 overflow-hidden"
                    >
                        {/* Header / Banner */}
                        <div className="h-2 bg-gradient-to-r from-rose-500 via-orange-500 to-rose-500 animate-gradient-x" />

                        <div className="p-8 sm:p-10">
                            <div className="flex flex-col items-center text-center space-y-6">
                                {/* Warning Icon */}
                                <div className="w-20 h-20 bg-rose-500/10 rounded-[2rem] flex items-center justify-center relative group">
                                    <div className="absolute inset-0 bg-rose-500/20 rounded-[2rem] animate-ping opacity-20" />
                                    <AlertTriangle className="w-10 h-10 text-rose-500 group-hover:scale-110 transition-transform" />
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-2xl font-black uppercase tracking-tighter text-zinc-900 dark:text-white leading-tight">
                                        {title}
                                    </h3>
                                    <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest leading-relaxed">
                                        {message}
                                    </p>
                                    {itemName && (
                                        <div className="mt-4 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                                            <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">{itemName}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex flex-col w-full gap-3 pt-4">
                                    <button
                                        onClick={onConfirm}
                                        disabled={isDeleting}
                                        className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-rose-600/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        {isDeleting ? (
                                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            "Confirm Deletion"
                                        )}
                                    </button>
                                    <button
                                        onClick={onClose}
                                        disabled={isDeleting}
                                        className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-6 right-6 p-2 text-zinc-400 hover:text-rose-500 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
