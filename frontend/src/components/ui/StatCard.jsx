import React from 'react';
import { motion } from 'framer-motion';
import { CountUpNumber } from '../CountUpNumber';

export function StatCard({ title, value, icon: Icon, color = "blue", trend, trendValue }) {
  const colorMap = {
    blue: 'var(--color-info)',
    green: 'var(--color-success)',
    yellow: 'var(--color-warning)',
    red: 'var(--color-danger)',
    purple: 'var(--color-primary)',
  };

  const cssColor = colorMap[color] || colorMap.blue;

  return (
    <motion.div
      className="rich-card p-6 relative cursor-default"
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
    >
      <div className="flex justify-between items-start mb-6">
        <div
          className="p-4 rounded-2xl transition-all duration-300 border"
          style={{ backgroundColor: `color-mix(in srgb, ${cssColor} 10%, transparent)`, color: cssColor, borderColor: `color-mix(in srgb, ${cssColor} 20%, transparent)` }}
        >
          {Icon && <Icon className="w-6 h-6" />}
        </div>
        {trendValue && (
          <span
            className="text-[10px] font-black px-2.5 py-1.5 rounded-full uppercase tracking-widest border"
            style={{
              backgroundColor: trend === 'up' ? 'color-mix(in srgb, var(--color-success) 10%, transparent)' : 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
              color: trend === 'up' ? 'var(--color-success)' : 'var(--color-danger)',
              borderColor: trend === 'up' ? 'color-mix(in srgb, var(--color-success) 20%, transparent)' : 'color-mix(in srgb, var(--color-danger) 20%, transparent)'
            }}
          >
            {trend === 'up' ? '↑' : '↓'} {trendValue}%
          </span>
        )}
      </div>
      <div>
        <p className="text-[var(--color-text-secondary)] text-[10px] font-black uppercase tracking-[0.2em] mb-2">{title}</p>
        <h2 className="text-lg sm:text-xl font-black text-[var(--color-text-primary)] tracking-tighter whitespace-nowrap overflow-hidden text-ellipsis">
          <CountUpNumber value={value} />
        </h2>
      </div>
    </motion.div>
  );
}
