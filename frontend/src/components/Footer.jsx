import React from 'react';
import { Egg, Heart, Zap } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-surface-card border-t border-[var(--color-border-subtle)] shrink-0 relative overflow-hidden">
      {/* Subtle bottom glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-orange-500/20 to-transparent"></div>

      <div className="max-w-7xl mx-auto px-8 py-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">

          {/* Brand/Logo Section - Miniatured */}
          <div className="flex items-center gap-3 group cursor-default">
            <div className="p-1.5 bg-green-600 rounded-lg group-hover:scale-110 transition-transform duration-500 shadow-[0_0_15px_rgba(37,99,235,0.3)]">
              <Egg className="w-3.5 h-3.5 text-[var(--color-text-primary)]" />
            </div>
            <div>
              <h2 className="text-xs font-black text-[var(--color-text-primary)] tracking-widest leading-none uppercase">NEXFLOW</h2>
              <div className="flex items-center gap-1.5 mt-1">
                <Zap className="w-2.5 h-2.5 text-[var(--color-primary)] fill-orange-500" />
                <p className="text-[8px] text-[var(--color-text-muted)] font-black uppercase tracking-[0.3em] leading-none">Enterprise OS</p>
              </div>
            </div>
          </div>

          {/* Copyright Section - Minimalist */}
          <div className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.4em]">
            &copy; {currentYear} <span className="text-[var(--color-text-primary)]">NexusOS</span>. Precision Engineered.
          </div>

          {/* Credits Section - Thin Badge */}
          <div className="flex items-center gap-3 px-4 py-2 bg-[var(--color-surface-base)] rounded-full border border-[var(--color-border-subtle)] shadow-inner">
            <span className="text-[8px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">Built for High Traffic</span>
            <div className="w-1.5 h-1.5 rounded-full bg-green-600/20 shadow-[0_0_8px_rgba(37,99,235,0.2)]"></div>
            <Heart className="w-3 h-3 text-rose-500 fill-rose-500 animate-pulse" />
          </div>

        </div>
      </div>
    </footer>
  );
}