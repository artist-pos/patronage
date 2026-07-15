"use client";

import { useRef, useState } from "react";

interface Props {
  src: string;
  alt: string;
  /** Extra classes for the outer surface (sizing / background). */
  className?: string;
  /** Inline styles for the outer surface. */
  style?: React.CSSProperties;
  /** Maximum zoom factor. */
  maxScale?: number;
}

/**
 * Pinch / double-tap zoomable artwork viewer.
 *
 * This surface owns its touch gestures (`.zoom-surface` sets
 * `touch-action: none`) so the page-level pinch-zoom lock in globals.css does
 * not swallow them — the page stays locked while individual artworks stay
 * zoomable. Uses Pointer Events so the same code drives touch pinch/pan and
 * desktop double-click + drag. Zoom + pan reset when the scale returns to 1.
 */
export function ZoomableImage({ src, alt, className = "", style, maxScale = 4 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [active, setActive] = useState(false);

  // Live pointer positions keyed by pointerId — drives pinch + pan maths.
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const lastTap = useRef(0);

  const clampScale = (s: number) => Math.min(maxScale, Math.max(1, s));

  /** Keep the image from being panned entirely out of view. */
  function clampPan(nx: number, ny: number, s: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: nx, y: ny };
    const maxX = ((s - 1) * rect.width) / 2;
    const maxY = ((s - 1) * rect.height) / 2;
    return {
      x: Math.min(maxX, Math.max(-maxX, nx)),
      y: Math.min(maxY, Math.max(-maxY, ny)),
    };
  }

  function reset() {
    setScale(1);
    setTx(0);
    setTy(0);
  }

  function zoomTo(next: number) {
    const s = clampScale(next);
    setScale(s);
    if (s === 1) {
      setTx(0);
      setTy(0);
    } else {
      const c = clampPan(tx, ty, s);
      setTx(c.x);
      setTy(c.y);
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setActive(true);

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale };
      panStart.current = null;
      return;
    }

    // Single pointer — detect double-tap / double-click to toggle zoom.
    const now = Date.now();
    if (now - lastTap.current < 300) {
      zoomTo(scale > 1 ? 1 : 2.5);
      lastTap.current = 0;
      panStart.current = null;
      return;
    }
    lastTap.current = now;

    if (scale > 1) {
      panStart.current = { x: e.clientX, y: e.clientY, tx, ty };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      zoomTo(pinchStart.current.scale * (dist / pinchStart.current.dist));
    } else if (pointers.current.size === 1 && panStart.current && scale > 1) {
      const c = clampPan(
        panStart.current.tx + (e.clientX - panStart.current.x),
        panStart.current.ty + (e.clientY - panStart.current.y),
        scale,
      );
      setTx(c.x);
      setTy(c.y);
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) {
      panStart.current = null;
      setActive(false);
      if (scale <= 1) reset();
    }
  }

  return (
    <div
      ref={containerRef}
      className={`zoom-surface relative overflow-hidden flex items-center justify-center select-none ${className}`}
      style={{ cursor: scale > 1 ? "grab" : "zoom-in", ...style }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
          display: "block",
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          transformOrigin: "center center",
          transition: active ? "none" : "transform 0.2s ease-out",
          willChange: "transform",
        }}
      />
    </div>
  );
}
