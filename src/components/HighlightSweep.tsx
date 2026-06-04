'use client';

import { useState, useEffect } from 'react';

interface HighlightSweepProps {
  text: string;
  gradient?: string;
  className?: string;
}

export default function HighlightSweep({ text, gradient, className }: HighlightSweepProps) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <span
      className={`${className} ${animate ? 'shimmer-text' : ''}`}
      style={gradient ? { '--gradient-hero': gradient } as React.CSSProperties : undefined}
    >
      {text}
    </span>
  );
}
