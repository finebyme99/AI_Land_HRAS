'use client';

import { useEffect, useRef } from 'react';

export default function CursorBot() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let mouseX = 0, mouseY = 0;
    let curX = 0, curY = 0;

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const animate = () => {
      curX += (mouseX - curX) * 0.15;
      curY += (mouseY - curY) * 0.15;
      el.style.transform = `translate(${curX + 18}px, ${curY + 18}px)`;
      requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', onMove);
    const raf = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="hidden md:block pointer-events-none fixed top-0 left-0 z-[9999]"
      style={{ willChange: 'transform' }}
    >
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        {/* Body */}
        <rect x="4" y="8" width="20" height="16" rx="4" fill="#1a3a8a" />
        {/* Screen face */}
        <rect x="7" y="11" width="14" height="9" rx="2" fill="#e8f0fe" />
        {/* Eyes */}
        <circle cx="11" cy="15.5" r="1.5" fill="#1a3a8a">
          <animate attributeName="ry" values="1.5;0.5;1.5" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="17" cy="15.5" r="1.5" fill="#F27F22">
          <animate attributeName="ry" values="1.5;0.5;1.5" dur="3s" repeatCount="indefinite" />
        </circle>
        {/* Antenna */}
        <line x1="14" y1="8" x2="14" y2="4" stroke="#1a3a8a" strokeWidth="2" strokeLinecap="round" />
        <circle cx="14" cy="3" r="2" fill="#F27F22">
          <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
        </circle>
        {/* Arms */}
        <rect x="1" y="12" width="3" height="2" rx="1" fill="#1a3a8a">
          <animateTransform attributeName="transform" type="rotate" values="-10 2.5 13;10 2.5 13;-10 2.5 13" dur="2s" repeatCount="indefinite" />
        </rect>
        <rect x="24" y="12" width="3" height="2" rx="1" fill="#1a3a8a">
          <animateTransform attributeName="transform" type="rotate" values="10 25.5 13;-10 25.5 13;10 25.5 13" dur="2s" repeatCount="indefinite" />
        </rect>
      </svg>
    </div>
  );
}
