import React from 'react';
import { TrendingUp } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { CountUpNumber } from './CountUpNumber';

export function RevenueCards({ dailySales = 0, monthlySales = 0, yearlySales = 0, totalRevenue }) {
    const { settings } = useSettings();
    const currency = (!settings?.currency || settings.currency === '$') ? 'Rs.' : settings.currency;
    const cumulativeRevenue = totalRevenue !== undefined ? totalRevenue : yearlySales;

    return (
        <div className="bg-white border border-zinc-100 rounded-[2.5rem] p-6 sm:p-8 shadow-rich mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h3 className="text-lg sm:text-xl font-black text-zinc-900 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                <TrendingUp className="w-6 h-6 text-green-600" />
                Revenue Analytics (Day / Month / Year)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="p-6 bg-zinc-50/60 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md transition-all">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Today Sales (Day)</span>
                    <h4 className="text-2xl font-black text-green-600 tracking-tight">
                        <CountUpNumber value={`${currency} ${dailySales || 0}`} />
                    </h4>
                    <span className="text-[9px] text-zinc-400 font-bold uppercase">Daily Gross Sales</span>
                </div>

                <div className="p-6 bg-zinc-50/60 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md transition-all">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-1">This Month (Month)</span>
                    <h4 className="text-2xl font-black text-emerald-600 tracking-tight">
                        <CountUpNumber value={`${currency} ${monthlySales || 0}`} />
                    </h4>
                    <span className="text-[9px] text-zinc-400 font-bold uppercase">Monthly Gross Sales</span>
                </div>

                <div className="p-6 bg-zinc-50/60 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md transition-all">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-1">This Year (Year)</span>
                    <h4 className="text-2xl font-black text-blue-600 tracking-tight">
                        <CountUpNumber value={`${currency} ${yearlySales || 0}`} />
                    </h4>
                    <span className="text-[9px] text-zinc-400 font-bold uppercase">Yearly Gross Sales</span>
                </div>

                <div className="p-6 bg-zinc-900 text-white rounded-2xl border border-zinc-900 shadow-xl hover:scale-[1.02] transition-transform">
                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block mb-1">Total Revenue</span>
                    <h4 className="text-2xl font-black text-white tracking-tight">
                        <CountUpNumber value={`${currency} ${cumulativeRevenue || 0}`} />
                    </h4>
                    <span className="text-[9px] text-zinc-400 font-bold uppercase">All-Time Cumulative Sales</span>
                </div>
            </div>
        </div>
    );
}
