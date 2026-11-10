import React, { useState, useEffect, useRef } from 'react';

export function CountUpNumber({ value, duration = 1200, className = '' }) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(0);

  useEffect(() => {
    // Parse numeric value, prefix, suffix
    let rawStr = String(value ?? 0);
    
    // Extract prefix, main digits, and suffix
    // Match e.g. "Rs. 60,400", "2 Sales", "99", "Rs. 30,448,700"
    const match = rawStr.match(/^([^\d-]*)([\d,.]+)(.*)$/);

    if (!match) {
      setDisplayValue(value);
      return;
    }

    const prefix = match[1] || '';
    const numStr = match[2].replace(/,/g, '');
    const suffix = match[3] || '';

    const targetNum = parseFloat(numStr);
    if (isNaN(targetNum)) {
      setDisplayValue(value);
      return;
    }

    const startNum = prevValueRef.current;
    prevValueRef.current = targetNum;

    if (startNum === targetNum) {
      const formatted = targetNum.toLocaleString('en-PK');
      setDisplayValue(`${prefix}${formatted}${suffix}`);
      return;
    }

    let startTime = null;
    let animationFrameId = null;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // Ease out quad formula
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentNum = Math.floor(startNum + (targetNum - startNum) * easeProgress);

      const formatted = currentNum.toLocaleString('en-PK');
      setDisplayValue(`${prefix}${formatted}${suffix}`);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        const finalFormatted = targetNum.toLocaleString('en-PK');
        setDisplayValue(`${prefix}${finalFormatted}${suffix}`);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [value, duration]);

  return <span className={className}>{displayValue}</span>;
}
