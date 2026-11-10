import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';

import {
    HelpCircle,
    BookOpen,
    Package,
    ShoppingCart,
    TrendingUp,
    Users,
    ShieldCheck,
    ChevronDown,
    Search,
    MessageSquare,
    LifeBuoy
} from 'lucide-react';

export function HelpView() {
    const { isShopAdmin, isSuperAdmin } = useUser();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFaq, setActiveFaq] = useState(null);


    const sections = [
        {
            id: 'quickstart',
            title: 'Quick Start',
            icon: BookOpen,
            items: [
                { q: 'How do I add a product?', a: 'Go to the Inventory dashboard and click "Add Product". Fill in the name, category, price, and stock levels.' },
                { q: 'How do I process a sale?', a: 'Click on the "All Products" section in the sidebar. Select products to add to your cart, then click the Cart button to finalize the checkout.' },
                { q: 'Can I return a sale?', a: 'Yes. In the Inventory dashboard, find the transaction in "Recent Sales" and use the "Return" action.' }
            ]
        },
        {
            id: 'shifts',
            title: 'Shift Management',
            icon: TrendingUp,
            items: [
                { q: 'What is the "Day/Night" shift?', a: 'This allows you to track revenue separately for different staff rotations. You must "Start" a shift before processing sales.' },
                { q: 'How do I close a shift?', a: 'Click the "Shift Active" button in the Navbar. Provide the actual cash in the drawer to calculate any discrepancies.' }
            ]
        },
        {
            id: 'inventory',
            title: 'Inventory Controls',
            icon: Package,
            items: [
                { q: 'What is the "Low Stock" list?', a: 'This view automatically highlights products that are below their specified minimum stock level.' },
                { q: 'What is the "Out of Stock" list?', a: 'This shows products that have zero units remaining in inventory and requires immediate restock.' }
            ]
        },
        {
            id: 'roles',
            title: 'Roles & Access',
            icon: ShieldCheck,
            items: [
                { q: 'Who can manage the team?', a: 'Only Shop Admins and Super Admins can add or remove personnel in "Team Management".' },
                { q: 'How do I change my password?', a: 'Navigate to "Settings". Note that changing the master owner password requires administrative authorization.' }
            ]
        }
    ];

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-[var(--color-border-subtle)]">
                <div>
                    <h1 className="text-4xl font-black text-[var(--color-text-primary)] tracking-tighter uppercase leading-none italic">
                        Help Center
                    </h1>
                    <div className="text-[var(--color-text-muted)] font-bold uppercase text-[10px] tracking-[0.4em] mt-3 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                        NexFlow Operational Guidance
                    </div>
                </div>

                <div className="relative group min-w-[300px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors" />
                    <input
                        type="text"
                        placeholder="Search documentation..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-2xl py-4 pl-12 pr-6 text-sm font-bold text-[var(--color-text-primary)] outline-none focus:border-green-500/40 transition-all placeholder:text-slate-700"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {sections.map((section) => (
                    <div key={section.id} className="bg-surface-card rounded-[2.5rem] p-8 border border-[var(--color-border-subtle)] shadow-2xl space-y-8">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-green-500/10 rounded-2xl border border-green-500/20 text-[var(--color-primary)] shadow-inner">
                                <section.icon className="w-6 h-6" />
                            </div>
                            <h3 className="text-2xl font-black text-[var(--color-text-primary)] uppercase tracking-tighter leading-none">{section.title}</h3>
                        </div>

                        <div className="space-y-4">
                            {section.items.map((item, idx) => {
                                const isOpen = activeFaq === `${section.id}-${idx}`;
                                return (
                                    <div key={idx} className="border border-[var(--color-border-subtle)] rounded-2xl overflow-hidden group">
                                        <button
                                            onClick={() => setActiveFaq(isOpen ? null : `${section.id}-${idx}`)}
                                            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-[var(--color-surface-base)] transition-colors"
                                        >
                                            <span className="text-sm font-bold text-[var(--color-text-primary)] pr-4">{item.q}</span>
                                            <ChevronDown className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform ${isOpen ? 'rotate-180 text-[var(--color-primary)]' : ''}`} />
                                        </button>
                                        {isOpen && (
                                            <div className="px-6 pb-5 text-[11px] font-medium text-[var(--color-text-secondary)] leading-relaxed animate-in slide-in-from-top-2 duration-300">
                                                {item.a}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {(isShopAdmin() || isSuperAdmin()) && (
                <div className="bg-surface-base rounded-[2.5rem] p-8 sm:p-12 border border-[var(--color-border-subtle)] flex flex-col md:flex-row items-center justify-between gap-10 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 blur-[100px] rounded-full group-hover:bg-green-500/10 transition-colors"></div>

                    <div className="space-y-4 relative z-10 flex-1">
                        <h3 className="text-3xl font-black text-[var(--color-text-primary)] uppercase tracking-tighter italic leading-tight">Still Need Assistance?</h3>
                        <p className="text-[var(--color-text-muted)] text-sm font-medium w-full leading-relaxed max-w-2xl">
                            Our technical support team is available 24/7 to help you with any custom configurations, role assignments, or system troubleshooting.
                        </p>
                    </div>

                    <div className="flex items-center gap-4 relative z-10 shrink-0">
                        <button className="px-8 py-4 bg-white border border-[var(--color-border-subtle)] rounded-2xl text-[var(--color-text-primary)] font-black text-xs uppercase tracking-widest hover:bg-[var(--color-surface-base)] transition-all flex items-center gap-3 shadow-sm">
                            <MessageSquare className="w-4 h-4" />
                            Live Chat
                        </button>
                        <button className="px-8 py-4 bg-green-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-green-500/10 flex items-center gap-3">
                            <LifeBuoy className="w-4 h-4" />
                            Submit Ticket
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}
