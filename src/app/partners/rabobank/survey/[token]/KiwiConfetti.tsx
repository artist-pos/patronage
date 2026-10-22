"use client";

import { useEffect, useRef } from "react";

/* A one-off burst of kiwifruit from both bottom corners when the survey is sent. */

const COUNT = 54;
const LIFE_MS = 4200;
const GRAVITY = 0.32; // px per frame², at 60fps

/** A kiwifruit cut in half: brown rim, green flesh, pale core, a ring of seeds. */
function drawSlice(r: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  const s = Math.ceil(r * 2 + 4);
  c.width = c.height = s * 2; // 2x for crisp edges
  const g = c.getContext("2d")!;
  g.scale(2, 2);
  g.translate(s / 2, s / 2);
  g.fillStyle = "#7a5a34";
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
  const flesh = g.createRadialGradient(0, 0, r * 0.15, 0, 0, r * 0.92);
  flesh.addColorStop(0, "#d9ef8a");
  flesh.addColorStop(0.45, "#8cc63f");
  flesh.addColorStop(1, "#5e9e2c");
  g.fillStyle = flesh;
  g.beginPath(); g.arc(0, 0, r * 0.88, 0, Math.PI * 2); g.fill();
  // fine rays from the core
  g.strokeStyle = "rgba(240, 250, 200, 0.35)";
  g.lineWidth = 0.6;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    g.beginPath(); g.moveTo(Math.cos(a) * r * 0.22, Math.sin(a) * r * 0.22); g.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); g.stroke();
  }
  g.fillStyle = "#1c1917";
  const seeds = Math.max(12, Math.round(r * 1.4));
  for (let i = 0; i < seeds; i++) {
    const a = (i / seeds) * Math.PI * 2 + (i % 2) * 0.12;
    const d = r * (0.38 + (i % 3) * 0.05);
    g.save(); g.translate(Math.cos(a) * d, Math.sin(a) * d); g.rotate(a);
    g.beginPath(); g.ellipse(0, 0, Math.max(1, r * 0.09), Math.max(0.6, r * 0.045), 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  g.fillStyle = "#f4f6d8";
  g.beginPath(); g.ellipse(0, 0, r * 0.2, r * 0.15, 0, 0, Math.PI * 2); g.fill();
  return c;
}

/** A whole kiwifruit: a fuzzy brown oval. */
function drawWhole(r: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  const w = Math.ceil(r * 2.6 + 4), h = Math.ceil(r * 2 + 4);
  c.width = w * 2; c.height = h * 2;
  const g = c.getContext("2d")!;
  g.scale(2, 2);
  g.translate(w / 2, h / 2);
  const skin = g.createRadialGradient(-r * 0.4, -r * 0.4, r * 0.2, 0, 0, r * 1.3);
  skin.addColorStop(0, "#a98455");
  skin.addColorStop(1, "#6b4b28");
  g.fillStyle = skin;
  g.beginPath(); g.ellipse(0, 0, r * 1.3, r, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgba(60, 40, 20, 0.35)";
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random());
    g.fillRect(Math.cos(a) * d * r * 1.2, Math.sin(a) * d * r * 0.9, 0.8, 0.8);
  }
  return c;
}

interface Bit { img: HTMLCanvasElement; w: number; h: number; x: number; y: number; vx: number; vy: number; rot: number; vr: number; flip: number; vf: number; size: number }

let sprites: HTMLCanvasElement[] | null = null;

/**
 * Draws the fruit once and keeps it. Call it while the answers are sending so
 * the work is done before the burst, not during its first frames.
 */
export function prepareKiwiConfetti() {
  if (typeof document === "undefined" || sprites) return;
  sprites = [8, 11, 14, 17].map(drawSlice).concat([9, 12].map(drawWhole));
}

export function KiwiConfetti() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { desynchronized: true })!;
    // 1.5x is plenty for small moving shapes, and much cheaper to clear and fill than 2x or 3x.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr);
    };
    resize();
    addEventListener("resize", resize);

    prepareKiwiConfetti();
    const art = sprites!;
    const scale = Math.min(1, innerWidth / 900) * 0.4 + 0.6; // a little smaller on phones
    const bits: Bit[] = Array.from({ length: COUNT }, (_, i) => {
      const left = i % 2 === 0;
      // Aim each piece to peak somewhere between half and nearly all the way up the screen.
      const peak = innerHeight * (0.5 + Math.random() * 0.45);
      const vy = -Math.sqrt(2 * GRAVITY * peak) * 1.12; // a touch extra to make up for drag
      const vx = (left ? 1 : -1) * (1.5 + Math.random() * (innerWidth / 110));
      const img = art[Math.random() < 0.15 ? 4 + (i % 2) : i % 4];
      return {
        img,
        w: img.width / 2,
        h: img.height / 2,
        x: left ? -10 : innerWidth + 10,
        y: innerHeight + 10,
        vx,
        vy,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.25,
        flip: Math.random() * Math.PI * 2,
        vf: 0.05 + Math.random() * 0.08,
        size: scale * (0.85 + Math.random() * 0.3),
      };
    });

    const start = performance.now();
    let raf = 0;
    let prev = start;
    const tick = (now: number) => {
      const dt = Math.min(2, (now - prev) / 16.67); // frames at 60fps, capped after a stall
      prev = now;
      const t = now - start;
      const drag = 0.99 ** dt;
      const floor = innerHeight + 40;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = t > LIFE_MS - 900 ? Math.max(0, (LIFE_MS - t) / 900) : 1;
      let onScreen = 0;
      for (const b of bits) {
        b.vy = (b.vy + GRAVITY * dt) * drag;
        b.vx *= drag;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.y > floor && b.vy > 0) continue; // fallen out of view
        onScreen++;
        b.rot += b.vr * dt;
        b.flip += b.vf * dt;
        // One transform per piece: position, spin, and a squash that reads as tumbling.
        const sx = b.size * (0.35 + 0.65 * Math.abs(Math.cos(b.flip))) * dpr;
        const sy = b.size * dpr;
        const c = Math.cos(b.rot), s = Math.sin(b.rot);
        ctx.setTransform(c * sx, s * sx, -s * sy, c * sy, b.x * dpr, b.y * dpr);
        ctx.drawImage(b.img, -b.w / 2, -b.h / 2, b.w, b.h);
      }
      if (t < LIFE_MS && onScreen > 0) raf = requestAnimationFrame(tick);
      else { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); }
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={ref} className="rb-confetti" aria-hidden="true" />;
}
