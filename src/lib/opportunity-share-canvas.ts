import type {
  SharePayload,
  ShareFormat,
  OpportunityShareData,
  OpportunityRenderOptions,
  OpportunityVariant,
  OpportunityTheme,
  OpportunityImageTransform,
} from '@/types/share'
import { GF, rr, wrapText, getLogoEl, getWhiteLogoEl } from './share-canvas'

// ── Brand palette ───────────────────────────────────────────────────────────
const BLACK = '#000000'
const WHITE = '#ffffff'
const RED = '#E24B4A'

// Opportunity cards use Instagram-native ratios: story 9:16, post 4:5.
// (The generic share path keeps its own 1:1 post — these are independent.)
const FORMATS = {
  story: { w: 1080, h: 1920 },
  post: { w: 1080, h: 1350 },
} as const

const NO_TRANSFORM: OpportunityImageTransform = { zoom: 1, ox: 0, oy: 0 }

/** Minimum shorter-edge resolution for an image to auto-qualify for Variant B. */
const IMAGE_MIN_EDGE = 500

/** Auto-selected variant when the user hasn't picked one. */
export function selectVariant(opp: OpportunityShareData, imgEl: HTMLImageElement | null): OpportunityVariant {
  const imageOk = !!imgEl && Math.min(imgEl.naturalWidth, imgEl.naturalHeight) >= IMAGE_MIN_EDGE
  if (imageOk) return 'B'
  if (opp.commissionAmount) return 'C'
  return 'A'
}

/** Which variants the user is allowed to pick given available data. */
export function availableVariants(
  opp: OpportunityShareData, imgEl: HTMLImageElement | null,
): Record<OpportunityVariant, boolean> {
  return { A: true, B: !!imgEl, C: !!opp.commissionAmount }
}

/** Default theme for a variant — A/B read as dark, C as light. */
export function defaultThemeFor(variant: OpportunityVariant): OpportunityTheme {
  return variant === 'C' ? 'light' : 'dark'
}

/** Resolves a requested variant against the data, degrading gracefully. */
function resolveVariant(
  opp: OpportunityShareData, imgEl: HTMLImageElement | null, requested?: OpportunityVariant,
): OpportunityVariant {
  if (requested === 'B') return imgEl ? 'B' : opp.commissionAmount ? 'C' : 'A'
  if (requested === 'C') return opp.commissionAmount ? 'C' : 'A'
  if (requested === 'A') return 'A'
  return selectVariant(opp, imgEl)
}

// ── Shared primitives ─────────────────────────────────────────────────────────

/** Outlined (stroked) pill. Returns its width. Labels are upper-cased. */
function drawOutlinePill(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  rawLabel: string, stroke: string, fg: string, W: number,
): number {
  const label = rawLabel.toUpperCase()
  const ts = Math.round(W * 0.0225)
  ctx.font = `600 ${ts}px ${GF}`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  const textW = ctx.measureText(label).width
  const padX = W * 0.022
  const pillW = textW + padX * 2
  const pillH = Math.round(ts * 2.2)

  ctx.lineWidth = Math.max(1.5, W * 0.0018)
  ctx.strokeStyle = stroke
  rr(ctx, x, y, pillW, pillH, pillH / 2)
  ctx.stroke()

  ctx.fillStyle = fg
  ctx.fillText(label, x + padX, y + pillH / 2 + 1)
  return pillW
}

/** Draws a row of outlined pills, wrapping to new lines. Returns the bottom Y. */
function drawPillRow(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, maxRight: number,
  opp: OpportunityShareData, isLight: boolean, W: number,
): number {
  const ts = Math.round(W * 0.0225)
  const pillH = Math.round(ts * 2.2)
  const gap = W * 0.014
  const lineGap = W * 0.014
  const stroke = isLight ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.32)'
  const fg = isLight ? 'rgba(0,0,0,0.62)' : 'rgba(255,255,255,0.72)'

  let cx = x
  let cy = y

  const pills: { label: string; stroke: string; fg: string }[] = opp.tags
    .filter((t) => t.trim())
    .map((label) => ({ label, stroke, fg }))
  if (opp.isFree) pills.push({ label: 'Free', stroke: RED, fg: RED })

  for (const p of pills) {
    ctx.font = `600 ${ts}px ${GF}`
    const w = ctx.measureText(p.label.toUpperCase()).width + W * 0.022 * 2
    if (cx + w > maxRight && cx > x) {
      cx = x
      cy += pillH + lineGap
    }
    drawOutlinePill(ctx, cx, cy, p.label, p.stroke, p.fg, W)
    cx += w + gap
  }
  return cy + pillH
}

/** Favicon logomark + handle, matching the footer on the other share cards. */
async function drawBrandMark(
  ctx: CanvasRenderingContext2D,
  x: number, midY: number, isLight: boolean, W: number, handle: string,
): Promise<void> {
  // Light bg → black favicon; dark bg → white favicon.
  const logo = await (isLight ? getLogoEl() : getWhiteLogoEl())
  const iconSize = Math.round(W * 0.032)
  const fs = Math.round(W * 0.026)
  ctx.font = `500 ${fs}px ${GF}`
  ctx.fillStyle = isLight ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.45)'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'

  if (logo) {
    ctx.save()
    if (isLight) {
      ctx.globalCompositeOperation = 'multiply'
    } else {
      ctx.globalAlpha = 0.45
    }
    ctx.drawImage(logo, x, midY - iconSize / 2, iconSize, iconSize)
    ctx.restore()
    ctx.fillText(handle, x + iconSize + W * 0.013, midY)
  } else {
    ctx.fillText(handle, x, midY)
  }
}

interface DataRow { label: string; value: string; accent?: boolean }

/** Stacked label-left / value-right rows separated by hairlines. Returns height. */
function drawDataRows(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, width: number,
  rows: DataRow[], isLight: boolean, W: number,
): number {
  const labelSize = Math.round(W * 0.022)
  const valueSize = Math.round(W * 0.03)
  const rowH = Math.round(W * 0.085)
  const ruleColor = isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.16)'
  const labelColor = isLight ? 'rgba(0,0,0,0.42)' : 'rgba(255,255,255,0.46)'
  const valueColor = isLight ? BLACK : WHITE

  let cy = y
  for (const row of rows) {
    ctx.strokeStyle = ruleColor
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, cy)
    ctx.lineTo(x + width, cy)
    ctx.stroke()

    const mid = cy + rowH / 2

    ctx.font = `600 ${labelSize}px ${GF}`
    ctx.fillStyle = labelColor
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(row.label.toUpperCase(), x, mid + 1)

    ctx.font = `600 ${valueSize}px ${GF}`
    ctx.fillStyle = row.accent ? RED : valueColor
    ctx.textAlign = 'right'
    ctx.fillText(row.value, x + width, mid + 1)

    cy += rowH
  }
  ctx.textAlign = 'left'
  return cy - y
}

/** Image drawn to fill the destination box (object-fit: cover) with pan/zoom + clip. */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number, dy: number, dw: number, dh: number,
  t: OpportunityImageTransform,
): void {
  const base = Math.max(dw / img.naturalWidth, dh / img.naturalHeight)
  const scale = base * Math.max(1, t.zoom)
  const sw = img.naturalWidth * scale
  const sh = img.naturalHeight * scale
  let x = dx + (dw - sw) / 2 + t.ox
  let y = dy + (dh - sh) / 2 + t.oy
  // Keep the box fully covered — no empty edges.
  x = Math.min(dx, Math.max(dx + dw - sw, x))
  y = Math.min(dy, Math.max(dy + dh - sh, y))
  ctx.save()
  ctx.beginPath()
  ctx.rect(dx, dy, dw, dh)
  ctx.clip()
  ctx.drawImage(img, x, y, sw, sh)
  ctx.restore()
}

function drawTitle(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, maxW: number,
  title: string, color: string, size: number, maxLines: number,
): number {
  ctx.font = `700 ${size}px ${GF}`
  ctx.fillStyle = color
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const lines = wrapText(ctx, title, maxW, maxLines)
  let cy = y
  const lh = size * 1.12
  for (const l of lines) {
    ctx.fillText(l, x, cy)
    cy += lh
  }
  return cy - y
}

function drawOrg(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, org: string, isLight: boolean, W: number,
): number {
  const size = Math.round(W * 0.025)
  ctx.font = `600 ${size}px ${GF}`
  ctx.fillStyle = isLight ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.5)'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(org.toUpperCase(), x, y)
  return size * 1.4
}

// ── Variant A — pure typographic ──────────────────────────────────────────────

async function drawVariantA(
  ctx: CanvasRenderingContext2D, opp: OpportunityShareData, payload: SharePayload,
  W: number, H: number, isStory: boolean, isLight: boolean,
): Promise<void> {
  const m = W * 0.08
  const bg = isLight ? WHITE : BLACK
  const fg = isLight ? BLACK : WHITE
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  const tagsBottom = drawPillRow(ctx, m, m, W - m, opp, isLight, W)

  const rows: DataRow[] = []
  if (opp.commission) rows.push({ label: 'Fee', value: opp.commission, accent: true })
  if (opp.deadline) rows.push({ label: 'Deadline', value: opp.deadline })
  if (opp.location) rows.push({ label: 'Location', value: opp.location })
  if (opp.entryFee && !opp.isFree) rows.push({ label: 'Entry', value: opp.entryFee })

  const rowH = Math.round(W * 0.085)
  const dataHeight = rows.length * rowH
  const brandBaseline = H - (isStory ? m * 1.3 : m)
  const dataTop = brandBaseline - m * 0.9 - dataHeight

  const titleSize = Math.round(W * (isStory ? 0.062 : 0.058))
  ctx.font = `700 ${titleSize}px ${GF}`
  const titleLines = wrapText(ctx, payload.title, W - m * 2, 4)
  const titleHeight = titleLines.length * titleSize * 1.12
  const orgHeight = Math.round(W * 0.025) * 1.4
  const blockHeight = titleHeight + W * 0.02 + orgHeight
  const regionTop = tagsBottom + m * 0.5
  const regionBottom = dataTop - m * 0.5
  let cy = regionTop + Math.max(0, (regionBottom - regionTop - blockHeight) / 2)

  cy += drawTitle(ctx, m, cy, W - m * 2, payload.title, fg, titleSize, 4)
  cy += W * 0.02
  drawOrg(ctx, m, cy, opp.organisation, isLight, W)

  if (rows.length) drawDataRows(ctx, m, dataTop, W - m * 2, rows, isLight, W)

  await drawBrandMark(ctx, m, brandBaseline, isLight, W, payload.handle)
}

// ── Variant B — image accent ──────────────────────────────────────────────────

async function drawVariantB(
  ctx: CanvasRenderingContext2D, opp: OpportunityShareData, payload: SharePayload,
  imgEl: HTMLImageElement, transform: OpportunityImageTransform,
  W: number, H: number, isStory: boolean, isLight: boolean,
): Promise<void> {
  const m = W * 0.08
  const bg = isLight ? WHITE : BLACK
  const fg = isLight ? BLACK : WHITE
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Top-half image (cover, pan/zoom) + fade to the background colour.
  const imgH = Math.round(H * (isStory ? 0.5 : 0.46))
  drawImageCover(ctx, imgEl, 0, 0, W, imgH, transform)
  const fadeStart = imgH * 0.45
  const grad = ctx.createLinearGradient(0, fadeStart, 0, imgH)
  grad.addColorStop(0, isLight ? 'rgba(255,255,255,0)' : 'rgba(0,0,0,0)')
  grad.addColorStop(1, bg)
  ctx.fillStyle = grad
  ctx.fillRect(0, fadeStart, W, imgH - fadeStart)

  let cy = imgH + m * 0.5
  cy = drawPillRow(ctx, m, cy, W - m, opp, isLight, W) + m * 0.45

  const titleSize = Math.round(W * (isStory ? 0.058 : 0.05))
  cy += drawTitle(ctx, m, cy, W - m * 2, payload.title, fg, titleSize, 3)
  cy += W * 0.018
  cy += drawOrg(ctx, m, cy, opp.organisation, isLight, W)
  cy += m * 0.5

  drawGrid2x2(ctx, m, cy, W - m * 2, opp, isLight, W)

  const brandBaseline = H - (isStory ? m * 1.3 : m)
  await drawBrandMark(ctx, m, brandBaseline, isLight, W, payload.handle)
}

function drawGrid2x2(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, width: number,
  opp: OpportunityShareData, isLight: boolean, W: number,
): number {
  const cells: DataRow[] = [
    { label: 'Fee', value: opp.commission ?? '—', accent: true },
    { label: 'Deadline', value: opp.deadline ?? '—' },
    { label: 'Location', value: opp.location ?? '—' },
    { label: 'Entry Fee', value: opp.entryFee ?? '—', accent: opp.isFree },
  ]
  const colW = width / 2
  const rowH = Math.round(W * 0.105)
  const labelSize = Math.round(W * 0.021)
  const valueSize = Math.round(W * 0.03)
  const labelColor = isLight ? 'rgba(0,0,0,0.42)' : 'rgba(255,255,255,0.46)'
  const valueColor = isLight ? BLACK : WHITE
  const ruleColor = isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.16)'

  cells.forEach((cell, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const cxp = x + col * colW
    const cyp = y + row * rowH

    ctx.strokeStyle = ruleColor
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cxp, cyp)
    ctx.lineTo(cxp + colW - W * 0.03, cyp)
    ctx.stroke()

    ctx.font = `600 ${labelSize}px ${GF}`
    ctx.fillStyle = labelColor
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(cell.label.toUpperCase(), cxp, cyp + W * 0.014)

    ctx.font = `600 ${valueSize}px ${GF}`
    ctx.fillStyle = cell.accent ? RED : valueColor
    ctx.fillText(cell.value, cxp, cyp + W * 0.014 + labelSize * 1.5)
  })
  return rowH * 2
}

// ── Variant C — commission-focal ──────────────────────────────────────────────

async function drawVariantC(
  ctx: CanvasRenderingContext2D, opp: OpportunityShareData, payload: SharePayload,
  W: number, H: number, isStory: boolean, isLight: boolean,
): Promise<void> {
  const m = W * 0.08
  const bg = isLight ? WHITE : BLACK
  const fg = isLight ? BLACK : WHITE
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Thin red bar at top.
  const barH = Math.round(W * 0.014)
  ctx.fillStyle = RED
  ctx.fillRect(0, 0, W, barH)

  const tagsTop = barH + m
  const tagsBottom = drawPillRow(ctx, m, tagsTop, W - m, opp, isLight, W)

  const rows: DataRow[] = []
  if (opp.deadline) rows.push({ label: 'Deadline', value: opp.deadline })
  if (opp.location) rows.push({ label: 'Location', value: opp.location })
  if (opp.entryFee && !opp.isFree) rows.push({ label: 'Entry', value: opp.entryFee })
  const rowH = Math.round(W * 0.085)
  const dataHeight = rows.length * rowH
  const brandBaseline = H - (isStory ? m * 1.3 : m)
  const dataTop = brandBaseline - m * 0.9 - dataHeight

  const titleSize = Math.round(W * (isStory ? 0.058 : 0.052))
  ctx.font = `700 ${titleSize}px ${GF}`
  const titleLines = wrapText(ctx, payload.title, W - m * 2, 3)
  const titleHeight = titleLines.length * titleSize * 1.12
  const orgH = Math.round(W * 0.025) * 1.4
  const blockH = Math.round(W * 0.2)
  const totalH = titleHeight + W * 0.02 + orgH + m * 0.6 + blockH

  const regionTop = tagsBottom + m * 0.5
  const regionBottom = dataTop - m * 0.5
  let cy = regionTop + Math.max(0, (regionBottom - regionTop - totalH) / 2)

  cy += drawTitle(ctx, m, cy, W - m * 2, payload.title, fg, titleSize, 3)
  cy += W * 0.02
  cy += drawOrg(ctx, m, cy, opp.organisation, isLight, W)
  cy += m * 0.6

  // Inverted block (opposite of the background) with the commission value.
  const blockW = W - m * 2
  ctx.fillStyle = fg
  rr(ctx, m, cy, blockW, blockH, Math.round(W * 0.012))
  ctx.fill()
  const padX = W * 0.05
  const labelSize = Math.round(W * 0.024)
  ctx.font = `600 ${labelSize}px ${GF}`
  ctx.fillStyle = isLight ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('FEE', m + padX, cy + blockH * 0.24)
  const valueSize = Math.round(W * 0.072)
  ctx.font = `700 ${valueSize}px ${GF}`
  ctx.fillStyle = RED
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(opp.commissionAmount ?? '', m + padX, cy + blockH * 0.82)

  if (rows.length) drawDataRows(ctx, m, dataTop, W - m * 2, rows, isLight, W)

  await drawBrandMark(ctx, m, brandBaseline, isLight, W, payload.handle)
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function drawOpportunityCanvas(
  canvas: HTMLCanvasElement,
  payload: SharePayload,
  format: ShareFormat,
  imgEl: HTMLImageElement | null,
  opts?: OpportunityRenderOptions,
): Promise<void> {
  await document.fonts.load(`700 64px ${GF}`)
  await document.fonts.load(`600 32px ${GF}`)

  const opp = payload.opportunity!
  const variant = resolveVariant(opp, imgEl, opts?.variant)
  const theme: OpportunityTheme = opts?.theme ?? defaultThemeFor(variant)
  const isLight = theme === 'light'
  const transform = opts?.imageTransform ?? NO_TRANSFORM

  const f = FORMATS[format]
  const W = f.w
  const H = f.h
  const isStory = format === 'story'

  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, W, H)

  if (variant === 'B' && imgEl) {
    await drawVariantB(ctx, opp, payload, imgEl, transform, W, H, isStory, isLight)
  } else if (variant === 'C') {
    await drawVariantC(ctx, opp, payload, W, H, isStory, isLight)
  } else {
    await drawVariantA(ctx, opp, payload, W, H, isStory, isLight)
  }
}
