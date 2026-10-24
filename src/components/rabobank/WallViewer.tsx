"use client";

/**
 * Artist-facing wall viewer for the Rabobank Te Puke commission, ported from
 * wall-viewer.html. The drawing logic and the constants below are unchanged and
 * are the single source of truth for dimensions; there are deliberately no
 * controls for position or size. A chosen or dropped image becomes an object
 * URL in this browser only: it is never uploaded, stored or logged.
 */

import { useEffect, useRef } from "react";
import "./wall-viewer.css";

const NS = "http://www.w3.org/2000/svg";
const WALL = 3600, PAINT = 2400, CEIL = 2750, LEAN = 1050, FLOOR = 3000, TW = 2040, BOT = 1250, FR = 40;
const SIZES = { big: { w: 1800, h: 900 }, small: { w: 1600, h: 800 } } as const;
type Size = keyof typeof SIZES;
type Attrs = Record<string, string | number>;

const Y = (mm: number) => FLOOR - mm;

function mount(root: HTMLElement): () => void {
  const svg = root.querySelector("svg") as SVGSVGElement;
  const file = root.querySelector(".wv-file") as HTMLInputElement;
  const add = root.querySelector(".wv-paint") as HTMLButtonElement;
  const clr = root.querySelector(".wv-clear") as HTMLButtonElement;
  const msg = root.querySelector(".wv-msg") as HTMLElement;
  const cap = root.querySelector(".wv-cap") as HTMLElement;
  const table = root.querySelector(".wv-table") as HTMLInputElement;
  const person = root.querySelector(".wv-person") as HTMLInputElement;
  let size: Size = "big";
  let imgUrl: string | null = null;
  const uid = "wvclip" + Math.floor(Math.random() * 1e6);

  const el = (t: string, a: Attrs, p?: Element) => {
    const e = document.createElementNS(NS, t);
    for (const k in a) e.setAttribute(k, String(a[k]));
    (p ?? svg).appendChild(e);
    return e;
  };
  const E = el;

  /* drawn on the table: flowers, bottles, glasses, nibbles, olive bowl */
  function props(tx: number, tw: number) {
    const g = el("g", { "pointer-events": "none" }), B = Y(LEAN), cx = (f: number) => tx + tw * f;
    const fx = cx(0.5);
    const ex = [-190, -120, -50, 10, 80, 150, 210], eh = [430, 520, 590, 640, 600, 540, 450];
    const bc = ["#e58aa0", "#f4e6c8", "#e0647f", "#f2b36a", "#f4e6c8", "#e0647f", "#e58aa0"];
    for (let i = 0; i < 7; i++) {
      el("line", { x1: fx + (i - 3) * 8, y1: B - 270, x2: fx + ex[i], y2: B - eh[i], stroke: "#3d6b3a", "stroke-width": 7, "stroke-linecap": "round" }, g);
      const lx = fx + ex[i] * 0.55, ly = B - (270 + (eh[i] - 270) * 0.55);
      el("ellipse", { cx: lx, cy: ly, rx: 46, ry: 16, fill: "#4f8a4a", transform: `rotate(${i % 2 ? -28 : 28} ${lx} ${ly})` }, g);
    }
    for (let j = 0; j < 7; j++) {
      el("circle", { cx: fx + ex[j], cy: B - eh[j], r: 40, fill: bc[j] }, g);
      el("circle", { cx: fx + ex[j], cy: B - eh[j], r: 14, fill: "#b8506a", opacity: 0.5 }, g);
    }
    el("path", { d: `M${fx - 55} ${B} Q${fx - 100} ${B - 110} ${fx - 35} ${B - 250} L${fx - 30} ${B - 270} L${fx + 30} ${B - 270} L${fx + 35} ${B - 250} Q${fx + 100} ${B - 110} ${fx + 55} ${B} Z`, fill: "#5b3a8a", stroke: "#3a2358", "stroke-width": 4 }, g);
    // wine bottles
    ([[0.15, "#1f3a28", "#7a1020"], [0.19, "#2a1017", "#b08d57"]] as const).forEach(([f, body, cap2]) => {
      const x = cx(f);
      el("path", { d: `M${x - 37} ${B} L${x - 37} ${B - 175} Q${x - 37} ${B - 205} ${x - 13} ${B - 225} L${x - 13} ${B - 295} L${x + 13} ${B - 295} L${x + 13} ${B - 225} Q${x + 37} ${B - 205} ${x + 37} ${B - 175} L${x + 37} ${B} Z`, fill: body }, g);
      el("rect", { x: x - 14, y: B - 300, width: 28, height: 34, rx: 4, fill: cap2 }, g);
      el("rect", { x: x - 37, y: B - 130, width: 74, height: 70, fill: "#f1ead8" }, g);
      el("rect", { x: x - 24, y: B - 112, width: 48, height: 6, fill: "#9a8f78" }, g);
      el("rect", { x: x - 18, y: B - 96, width: 36, height: 5, fill: "#9a8f78" }, g);
    });
    // wine glasses
    ([[0.26, "#8b1a2b"], [0.3, "#e8d58a"]] as const).forEach(([f, wine]) => {
      const x = cx(f);
      el("rect", { x: x - 35, y: B - 6, width: 70, height: 6, rx: 3, fill: "#dfe7ee", opacity: 0.85 }, g);
      el("rect", { x: x - 3, y: B - 100, width: 6, height: 95, fill: "#dfe7ee", opacity: 0.85 }, g);
      el("path", { d: `M${x - 38} ${B - 200} Q${x - 42} ${B - 110} ${x} ${B - 100} Q${x + 42} ${B - 110} ${x + 38} ${B - 200} Z`, fill: "#ffffff", "fill-opacity": 0.22, stroke: "#dfe7ee", "stroke-width": 3 }, g);
      el("path", { d: `M${x - 40} ${B - 150} Q${x - 41} ${B - 108} ${x} ${B - 100} Q${x + 41} ${B - 108} ${x + 40} ${B - 150} Z`, fill: wine }, g);
    });
    // nibbles board
    const nx = cx(0.74);
    el("rect", { x: nx - 190, y: B - 24, width: 380, height: 24, rx: 6, fill: "#9a6b3a", stroke: "#5e3d1d", "stroke-width": 3 }, g);
    el("polygon", { points: `${nx - 160},${B - 24} ${nx - 70},${B - 24} ${nx - 70},${B - 66}`, fill: "#f0cf6b", stroke: "#b9953a", "stroke-width": 3 }, g);
    el("rect", { x: nx - 55, y: B - 60, width: 90, height: 36, rx: 18, fill: "#f4efe0", stroke: "#c9bfa5", "stroke-width": 3 }, g);
    [0, 1, 2, 3].forEach((k) => el("rect", { x: nx + 55 + k * 8, y: B - 24 - (k + 1) * 10, width: 70, height: 10, rx: 3, fill: "#d9b57a", stroke: "#a9824a", "stroke-width": 2 }, g));
    [[nx + 150, B - 42], [nx + 166, B - 42], [nx + 158, B - 58], [nx + 142, B - 58], [nx + 174, B - 58]].forEach(([x, y]) => el("circle", { cx: x, cy: y, r: 15, fill: "#5b3a8a", stroke: "#3a2358", "stroke-width": 2 }, g));
    // olive bowl
    const ox = cx(0.9);
    el("path", { d: `M${ox - 75} ${B - 55} Q${ox - 70} ${B} ${ox} ${B} Q${ox + 70} ${B} ${ox + 75} ${B - 55} Z`, fill: "#e8e4dc", stroke: "#b9b3a6", "stroke-width": 3 }, g);
    [[ox - 35, B - 62], [ox, B - 68], [ox + 35, B - 62], [ox - 18, B - 80], [ox + 18, B - 80]].forEach(([x, y]) => el("ellipse", { cx: x, cy: y, rx: 17, ry: 13, fill: "#6b7a2a", stroke: "#444f18", "stroke-width": 2 }, g));
  }

  function draw() {
    svg.innerHTML = "";
    const s = SIZES[size], ow = s.w + 2 * FR, oh = s.h + 2 * FR, x = (WALL - ow) / 2;
    const ink = "var(--wv-ink)", font = "var(--wv-font)";
    E("rect", { x: 0, y: Y(CEIL), width: WALL, height: CEIL - PAINT, fill: "var(--wv-top)" });
    E("rect", { x: 0, y: Y(PAINT), width: WALL, height: PAINT, fill: "var(--wv-wall)" });
    for (let gx = 500; gx < WALL; gx += 500) E("line", { x1: gx, x2: gx, y1: Y(PAINT), y2: FLOOR, stroke: "#fff", "stroke-opacity": 0.07, "stroke-width": 4 });
    for (let gy = 500; gy < PAINT; gy += 500) E("line", { x1: 0, x2: WALL, y1: Y(gy), y2: Y(gy), stroke: "#fff", "stroke-opacity": 0.07, "stroke-width": 4 });
    E("line", { x1: -250, x2: WALL + 250, y1: FLOOR, y2: FLOOR, stroke: ink, "stroke-width": 10 });
    /* table, with its styling, when "Show Table" is on */
    const tx = (WALL - TW) / 2;
    if (table.checked) {
      E("rect", { x: tx, y: Y(LEAN), width: TW, height: 40, fill: "var(--wv-timber)" });
      [tx + 120, tx + TW - 160].forEach((lx) => E("rect", { x: lx, y: Y(LEAN) + 40, width: 40, height: LEAN - 40, fill: ink, opacity: 0.75 }));
    }
    /* painting */
    const by = Y(BOT + oh);
    E("rect", { x, y: by, width: ow, height: oh, fill: "#15181b", stroke: "#000", "stroke-width": 4 });
    const px = x + FR, py = by + FR;
    // The "Try your own artwork" button sits on the painting itself: place it over the
    // canvas area in viewBox units (viewBox is -900 -200 5500 3500).
    Object.assign(add.style, {
      left: `${((px + 900) / 5500) * 100}%`,
      top: `${((py + 200) / 3500) * 100}%`,
      width: `${(s.w / 5500) * 100}%`,
      height: `${(s.h / 3500) * 100}%`,
    });
    add.dataset.filled = imgUrl ? "true" : "false";
    add.querySelector("span")!.textContent = imgUrl ? "Change artwork" : "Try your own artwork";
    if (imgUrl) {
      const d = E("defs", {}), cp = E("clipPath", { id: uid }, d);
      E("rect", { x: px, y: py, width: s.w, height: s.h }, cp);
      const im = E("image", { x: px, y: py, width: s.w, height: s.h, preserveAspectRatio: "xMidYMid slice", "clip-path": `url(#${uid})` });
      im.setAttribute("href", imgUrl);
      im.addEventListener("error", () => { clearImage(); msg.textContent = "That image could not be shown. Try a JPG or PNG."; });
    } else {
      E("rect", { x: px, y: py, width: s.w, height: s.h, fill: "var(--wv-art)", stroke: "var(--wv-art-line)", "stroke-width": 3 });
      E("path", { d: `M${px} ${py + s.h * 0.7} Q ${px + s.w * 0.35} ${py + s.h * 0.25} ${px + s.w} ${py + s.h * 0.55}`, fill: "none", stroke: "var(--wv-art-line)", "stroke-width": 10, opacity: 0.35 });
    }
    if (table.checked) props(tx, TW);
    /* dimensions */
    const lx = -170;
    E("line", { x1: lx, x2: lx, y1: Y(PAINT), y2: FLOOR, stroke: ink, "stroke-width": 5 });
    ([[0, "0"], [LEAN, "1050 table"], [PAINT, "2400 wall height"]] as const).forEach(([mm, label]) => {
      E("line", { x1: lx - 35, x2: lx + 35, y1: Y(mm), y2: Y(mm), stroke: ink, "stroke-width": 5 });
      E("text", { x: lx - 60, y: Y(mm) - 14, "text-anchor": "end", "font-size": 64, fill: ink, "font-family": font }).textContent = label;
    });
    E("line", { x1: -250, x2: WALL + 250, y1: Y(CEIL), y2: Y(CEIL), stroke: ink, "stroke-width": 4, "stroke-dasharray": "30 20" });
    E("text", { x: WALL + 90, y: Y(CEIL) - 14, "font-size": 64, fill: "var(--wv-muted)", "font-family": font }).textContent = "ceiling 2750";
    E("line", { x1: 0, x2: WALL, y1: Y(CEIL) - 80, y2: Y(CEIL) - 80, stroke: ink, "stroke-width": 5 });
    E("line", { x1: 0, x2: 0, y1: Y(CEIL) - 115, y2: Y(CEIL) - 45, stroke: ink, "stroke-width": 5 });
    E("line", { x1: WALL, x2: WALL, y1: Y(CEIL) - 115, y2: Y(CEIL) - 45, stroke: ink, "stroke-width": 5 });
    E("text", { x: WALL / 2, y: Y(CEIL) - 110, "text-anchor": "middle", "font-size": 70, fill: ink, "font-family": font }).textContent = "3600 wall length";
    /* person */
    if (person.checked) {
      const ppx = WALL + 520, ph = 1700, pg = E("g", { opacity: 0.9 }), pc = "var(--wv-person)";
      el("circle", { cx: ppx, cy: Y(ph) + 110, r: 100, fill: pc }, pg);
      el("rect", { x: ppx - 130, y: Y(ph) + 230, width: 260, height: 760, rx: 90, fill: pc }, pg);
      el("rect", { x: ppx - 120, y: Y(ph) + 960, width: 100, height: ph - 960, fill: pc }, pg);
      el("rect", { x: ppx + 20, y: Y(ph) + 960, width: 100, height: ph - 960, fill: pc }, pg);
      E("text", { x: ppx, y: FLOOR + 90, "text-anchor": "middle", "font-size": 56, fill: "var(--wv-muted)", "font-family": font }).textContent = "1700";
    }
    cap.innerHTML = `<strong>${s.w} x ${s.h} mm painting</strong>, with an indicative ${FR} mm frame (${ow} x ${oh} mm overall), bottom edge ${BOT} mm above the floor, centred on the wall.`;
  }

  function clearImage() {
    if (imgUrl) { URL.revokeObjectURL(imgUrl); imgUrl = null; }
    clr.hidden = true;
    draw();
  }
  function setFile(f: File | null | undefined) {
    if (!f) return;
    if (!/^image\//.test(f.type)) { msg.textContent = "Please choose an image file."; return; }
    if (imgUrl) URL.revokeObjectURL(imgUrl);
    imgUrl = URL.createObjectURL(f);
    clr.hidden = false;
    msg.textContent = "Showing your image, cropped to fill the painting area. It stays on your device.";
    draw();
  }

  const offs: (() => void)[] = [];
  const on = (t: EventTarget, ev: string, fn: (e: Event) => void) => { t.addEventListener(ev, fn); offs.push(() => t.removeEventListener(ev, fn)); };
  root.querySelectorAll<HTMLInputElement>("input[name=wvsize]").forEach((r) => on(r, "change", () => { size = r.value as Size; draw(); }));
  on(table, "change", draw);
  on(person, "change", draw);
  on(add, "click", () => file.click());
  on(file, "change", () => { setFile(file.files?.[0]); file.value = ""; });
  on(clr, "click", () => { clearImage(); msg.textContent = ""; });
  ["dragenter", "dragover"].forEach((ev) => on(root, ev, (e) => { e.preventDefault(); root.classList.add("wv-drop"); }));
  ["dragleave", "drop"].forEach((ev) => on(root, ev, (e) => { e.preventDefault(); root.classList.remove("wv-drop"); }));
  on(root, "drop", (e) => setFile((e as DragEvent).dataTransfer?.files[0]));
  draw();

  return () => {
    offs.forEach((off) => off());
    if (imgUrl) URL.revokeObjectURL(imgUrl);
  };
}

export function WallViewer() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => (ref.current ? mount(ref.current) : undefined), []);
  return (
    <section className="wv" ref={ref} aria-label="Wall viewer">
      <div className="wv-head">
        <h3>See the work on the wall</h3>
        <p>
          The wall is dark blue, 3600mm long and 2400mm high, above a 1050mm high table. Switch between the two sizes, or add one
          of your own images to see how it sits.
        </p>
      </div>
      <div className="wv-bar">
        <div className="wv-seg" role="radiogroup" aria-label="Painting size">
          <label><input type="radio" name="wvsize" value="big" defaultChecked /><span>1800 x 900</span></label>
          <label><input type="radio" name="wvsize" value="small" /><span>1600 x 800</span></label>
        </div>
        <label className="wv-chk"><input type="checkbox" className="wv-table" defaultChecked /> Show Table</label>
        <label className="wv-chk"><input type="checkbox" className="wv-person" defaultChecked /> 1700mm person</label>
        <button type="button" className="wv-btn wv-clear" hidden>Remove image</button>
        <input className="wv-file" type="file" accept="image/*" aria-label="Choose an image of your work" />
      </div>
      <div className="wv-canvas">
        <svg viewBox="-900 -200 5500 3500" role="img" aria-label="Scaled drawing of the wall with the painting at the chosen size" />
        <button type="button" className="wv-paint" data-filled="false">
          <span>Try your own artwork</span>
        </button>
      </div>
      <p className="wv-cap" />
      <p className="wv-msg" aria-live="polite" />
    </section>
  );
}
