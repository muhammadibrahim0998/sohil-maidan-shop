import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, X, CheckCircle2, Shield, Zap, Box, Activity } from 'lucide-react';
import { getSystemUpdates } from '../services/api';

export function UpdateBanner() {
    const [showDetails, setShowDetails] = useState(false);
    const [updates, setUpdates] = useState([]);
    const [loading, setLoading] = useState(true);

    const iconMap = {
        zap: <Zap className="w-4 h-4 text-green-500" />,
        sparkles: <Sparkles className="w-4 h-4 text-amber-500" />,
        shield: <Shield className="w-4 h-4 text-emerald-500" />,
        box: <Box className="w-4 h-4 text-purple-500" />,
        activity: <Activity className="w-4 h-4 text-rose-500" />
    };

    useEffect(() => {
        const fetchUpdates = async () => {
            try {
                const data = await getSystemUpdates();
                setUpdates(data);
            } catch (err) {
                console.error("Failed to fetch system updates:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchUpdates();
    }, []);

    // Flatten items for the ticker animation
    const tickerItems = updates.flatMap(group => group.items);

    if (loading || updates.length === 0) {
        return null; // Or a subtle loading skeleton
    }

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="w-full mb-8 relative overflow-hidden group"
            >
                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--color-primary)]/30 to-transparent"></div>

                <div className="flex items-center justify-center gap-4 py-3 bg-[var(--color-surface-base)]/50 backdrop-blur-sm border border-[var(--color-border-subtle)] rounded-2xl relative z-10">
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-600/10 text-green-600 rounded-lg border border-green-600/20 shadow-sm shadow-green-600/5 animate-pulse shrink-0">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">System Update</span>
                    </div>

                    <div className="h-4 w-px bg-[var(--color-border-subtle)] mx-2"></div>

                    <div className="overflow-hidden flex-1 relative max-w-xl">
                        <motion.div
                            animate={{
                                y: tickerItems.map((_, i) => -i * 24).concat([0]),
                            }}
                            transition={{
                                duration: tickerItems.length * 3,
                                repeat: Infinity,
                                ease: "easeInOut",
                                repeatDelay: 2
                            }}
                            className="flex flex-col h-6"
                        >
                            {tickerItems.map((item, idx) => (
                                <div key={idx} className="h-6 flex items-center justify-center text-[10px] sm:text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-tight">
                                    {item}
                                </div>
                            ))}
                        </motion.div>
                    </div>

                    <div
                        onClick={() => setShowDetails(true)}
                        className="hidden sm:flex items-center gap-2 text-green-600 hover:text-green-700 transition-colors ml-4 cursor-pointer shrink-0"
                    >
                        <span className="text-[9px] font-black uppercase tracking-widest">Learn More</span>
                        <ArrowRight className="w-3 h-3" />
                    </div>
                </div>
            </motion.div>

            <AnimatePresence>
                {showDetails && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowDetails(false)}
                            className="absolute inset-0 bg-zinc-900/60 backdrop-blur-md"
                        />

                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="w-full max-w-lg bg-[var(--color-surface-card)] rounded-[2.5rem] shadow-2xl border border-[var(--color-border-subtle)] overflow-hidden relative z-10"
                        >
                            <div className="p-8 border-b border-[var(--color-border-subtle)] flex items-center justify-between bg-zinc-50/50">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-600/20">
                                        <Zap className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-[var(--color-text-primary)] tracking-tighter uppercase italic">NextGen Update</h2>
                                        <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Version 2.0.1 Stable</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowDetails(false)}
                                    className="p-3 hover:bg-rose-50 text-zinc-400 hover:text-rose-500 rounded-2xl transition-all"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto premium-scrollbar">
                                {updates.map((group, idx) => (
                                    <div key={idx} className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            {iconMap[group.iconType] || <Zap className="w-4 h-4 text-green-500" />}
                                            <h3 className="text-xs font-black text-[var(--color-text-primary)] uppercase tracking-wider">{group.category}</h3>
                                        </div>
                                        <div className="grid gap-3 pl-6">
                                            {group.items.map((item, i) => (
                                                <div key={i} className="flex items-start gap-3 group">
                                                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-green-500 shrink-0" />
                                                    <p className="text-xs font-bold text-[var(--color-text-secondary)] leading-relaxed">{item}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-8 bg-zinc-50/50 border-t border-[var(--color-border-subtle)] flex items-center justify-between">
                                <div className="flex -space-x-2">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="w-6 h-6 rounded-full border-2 border-[var(--color-surface-card)] bg-zinc-200"></div>
                                    ))}
                                    <div className="w-6 h-6 rounded-full border-2 border-[var(--color-surface-card)] bg-green-600 flex items-center justify-center text-[8px] font-black text-white">+5</div>
                                </div>
                                <button
                                    onClick={() => setShowDetails(false)}
                                    className="px-8 py-3 bg-[var(--color-text-primary)] text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.05] transition-all"
                                >
                                    Acknowledge
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
