import React from 'react';
import { AlertTriangle, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function IntelligenceFeed({ products }) {
    const navigate = useNavigate();

    const zeroStock = products.filter(p => p.stock === 0);
    const lowStock = products.filter(p => p.stock > 0 && p.stock <= (p.minStock || 5));

    if (zeroStock.length === 0 && lowStock.length === 0) return null;

    return (
        <div className="w-full bg-rose-50/50 border border-rose-100 rounded-[2rem] p-4 sm:p-6 mb-8 flex flex-col lg:flex-row items-center gap-6 animate-in fade-in slide-in-from-top-4 duration-700">

            {/* Left Label */}
            <div className="flex items-center gap-4 shrink-0 px-4 py-3 bg-white/60 rounded-2xl border border-rose-200 shadow-sm relative group">
                <div className="bg-rose-100 p-2 rounded-xl relative">
                    <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />
                    {/* The "Red Blinking Dot" */}
                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)] border-2 border-white"></div>
                </div>
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em] leading-none">Intelligence</span>
                    </div>
                    <span className="text-[9px] font-bold text-rose-400 uppercase tracking-widest mt-1">Critical Feed</span>
                </div>
            </div>

            {/* Middle Pills Container */}
            <div className="flex-1 flex flex-wrap items-center justify-center lg:justify-start gap-2.5">
                {zeroStock.map((p, idx) => (
                    <div
                        key={`zero-${idx}`}
                        onClick={() => navigate(`/product/${p._id}`)}
                        className="px-4 py-2 bg-rose-100 border border-rose-200 rounded-full cursor-pointer hover:scale-105 transition-transform shadow-sm flex items-center gap-2 group"
                    >
                        <span className="text-[9px] font-black text-rose-600 uppercase">Zero:</span>
                        <span className="text-[9px] font-bold text-rose-500 uppercase tracking-tight group-hover:underline truncate max-w-[120px]">{p.name}</span>
                    </div>
                ))}

                {lowStock.map((p, idx) => (
                    <div
                        key={`low-${idx}`}
                        onClick={() => navigate(`/product/${p._id}`)}
                        className="px-4 py-2 bg-orange-50 border border-orange-100 rounded-full cursor-pointer hover:scale-105 transition-transform shadow-sm flex items-center gap-2 group"
                    >
                        <span className="text-[9px] font-black text-orange-600 uppercase">Low:</span>
                        <span className="text-[9px] font-bold text-orange-500 uppercase tracking-tight group-hover:underline truncate max-w-[120px]">
                            {p.name} <span className="text-orange-400/80 ml-0.5">({p.stock})</span>
                        </span>
                    </div>
                ))}
            </div>

            {/* Right Action */}
            <button
                onClick={() => navigate('/team')}
                className="shrink-0 flex items-center gap-4 px-6 py-4 bg-green-600 hover:bg-green-600 text-white rounded-[1.5rem] shadow-xl shadow-green-600/20 hover:shadow-green-600/30 transition-all active:scale-95 group"
            >
                <div className="p-1 bgColor-[rgba(255,255,255,0.1)] rounded-lg">
                    <MessageSquare className="w-4 h-4" />
                </div>
                <div className="flex flex-col items-start pr-2">
                    <span className="text-[10px] font-black uppercase tracking-widest">Alert</span>
                    <span className="text-[10px] font-black uppercase tracking-widest leading-none">Admin</span>
                </div>
            </button>

        </div>
    );
}
