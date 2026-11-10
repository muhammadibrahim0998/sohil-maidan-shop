import React from 'react';

export function Badge({ children, variant = "info", className = "", style, ...props }) {
  const variableMap = {
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    danger: 'var(--color-danger)',
    info: 'var(--color-info)',
    neutral: 'var(--color-text-muted)',
  };

  const cssVar = variableMap[variant] || variableMap.info;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${className}`}
      style={{
        backgroundColor: `color-mix(in srgb, ${cssVar} 10%, transparent)`,
        color: cssVar,
        borderColor: `color-mix(in srgb, ${cssVar} 20%, transparent)`,
        ...style
      }}
      {...props}
    >
      {children}
    </span>
  );
}
