import type { SharePayload, ShareTemplate, ShareFormat } from '@/types/share'

const TEMPLATES = {
  dark:  { bg: '#0f0f0f', text: '#ffffff', accent: '#ffffff', sub: 'rgba(255,255,255,0.42)', light: false },
  light: { bg: '#fafaf9', text: '#1a1a1a', accent: '#1a1a1a', sub: 'rgba(0,0,0,0.38)',       light: true  },
  warm:  { bg: '#1a1208', text: '#f5e6c8', accent: '#d4a853', sub: 'rgba(245,230,200,0.48)', light: false },
  slate: { bg: '#1c2333', text: '#e8edf5', accent: '#7b9ccc', sub: 'rgba(232,237,245,0.48)', light: false },
} as const

const FORMATS = {
  story: { w: 1080, h: 1920 },
  post:  { w: 1080, h: 1080 },
} as const

const GF = "'Geist', 'Inter', system-ui, sans-serif"

// Cached logo elements — loaded once, reused across draws
let _logoEl: HTMLImageElement | null = null
let _logoLoading = false
function getLogoEl(): Promise<HTMLImageElement | null> {
  if (_logoEl) return Promise.resolve(_logoEl)
  if (_logoLoading) return new Promise(resolve => {
    const check = setInterval(() => {
      if (_logoEl !== null || !_logoLoading) { clearInterval(check); resolve(_logoEl) }
    }, 50)
  })
  _logoLoading = true
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => { _logoEl = img; _logoLoading = false; resolve(img) }
    img.onerror = () => { _logoLoading = false; resolve(null) }
    img.src = '/Favicon_Bleed_512.png'
  })
}

let _logoWhiteEl: HTMLImageElement | null = null
let _logoWhiteLoading = false
function getWhiteLogoEl(): Promise<HTMLImageElement | null> {
  if (_logoWhiteEl) return Promise.resolve(_logoWhiteEl)
  if (_logoWhiteLoading) return new Promise(resolve => {
    const check = setInterval(() => {
      if (_logoWhiteEl !== null || !_logoWhiteLoading) { clearInterval(check); resolve(_logoWhiteEl) }
    }, 50)
  })
  _logoWhiteLoading = true
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => { _logoWhiteEl = img; _logoWhiteLoading = false; resolve(img) }
    img.onerror = () => { _logoWhiteLoading = false; resolve(null) }
    img.src = '/favicon_white_512.png'
  })
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line)
      line = word
      if (lines.length >= maxLines) { lines[lines.length - 1] += '…'; break }
    } else {
      line = test
    }
  }
  if (line && lines.length < maxLines) lines.push(line)
  return lines
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawPill(
  ctx: CanvasRenderingContext2D,
  x: number, ty: number,
  label: string, tag: string, isLight: boolean, W: number
): number {
  const hasDot = tag === 'FOR SALE'
  const fg = isLight ? 'rgba(0,0,0,0.58)' : 'rgba(255,255,255,0.58)'
  const bg = isLight ? '#f4f4f3' : 'rgba(255,255,255,0.13)'
  const dot = hasDot ? '#10b981' : null

  const ts = Math.round(W * 0.021)
  ctx.font = `600 ${ts}px ${GF}`
  const textW = ctx.measureText(label).width
  const lp = W * 0.015, rp = W * 0.018
  const dotR = dot ? ts * 0.36 : 0
  const dotGap = dot ? W * 0.009 : 0
  const pillW = lp + (dot ? dotR * 2 + dotGap : 0) + textW + rp
  const pillH = Math.round(ts * 2.1)

  ctx.fillStyle = bg
  rr(ctx, x, ty, pillW, pillH, pillH / 2)
  ctx.fill()

  if (dot) {
    ctx.fillStyle = dot
    ctx.beginPath()
    ctx.arc(x + lp + dotR, ty + pillH / 2, dotR, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.fillStyle = fg
  ctx.textBaseline = 'middle'
  ctx.fillText(label, x + lp + (dot ? dotR * 2 + dotGap : 0), ty + pillH / 2)
  return pillW
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  leftX: number, midY: number,
  handle: string, isLight: boolean, W: number,
  logoEl: HTMLImageElement | null
) {
  const iconSize = Math.round(W * 0.032)
  const fs = Math.round(W * 0.026)
  ctx.font = `500 ${fs}px ${GF}`
  ctx.fillStyle = isLight ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.45)'
  ctx.textBaseline = 'middle'

  if (logoEl) {
    ctx.save()
    if (isLight) {
      ctx.globalCompositeOperation = 'multiply'
    } else {
      ctx.globalAlpha = 0.45
    }
    ctx.drawImage(logoEl, leftX, midY - iconSize / 2, iconSize, iconSize)
    ctx.restore()
    ctx.fillText(handle, leftX + iconSize + W * 0.013, midY)
  } else {
    ctx.fillText(handle, leftX, midY)
  }
}

export async function drawShareCanvas(
  canvas: HTMLCanvasElement,
  payload: SharePayload,
  template: ShareTemplate,
  format: ShareFormat,
  imgEl: HTMLImageElement | null,
  showPrice: boolean,
  caption = ''
): Promise<void> {
  await document.fonts.load(`600 24px ${GF}`)

  const t = TEMPLATES[template]
  const f = FORMATS[format]
  const W = f.w, H = f.h
  const isStory = format === 'story'
  const m = W * 0.08

  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Background
  ctx.fillStyle = t.bg
  ctx.fillRect(0, 0, W, H)

  // Image
  let imgEndY = isStory ? 150 : 0
  if (imgEl) {
    const ia = imgEl.naturalWidth / imgEl.naturalHeight
    let iw: number, ih: number, ix: number, iy: number

    if (isStory) {
      const shH_est = Math.round(W * 0.078)
      const shYPref_est = H - 100 - shH_est
      const maxIH = shYPref_est - 380 - 46 - 200
      iw = W - m * 2; ih = iw / ia
      if (ih > maxIH) { ih = maxIH; iw = ih * ia }
      ix = (W - iw) / 2; iy = 200
      imgEndY = 200 + ih
    } else {
      iw = W * 0.86; ih = iw / ia
      if (ih > H * 0.58) { ih = H * 0.58; iw = ih * ia }
      ix = (W - iw) / 2; iy = H * 0.07
      imgEndY = iy + ih
    }

    ctx.drawImage(imgEl, ix, iy, iw, ih)
  }

  // Content block
  let ty = isStory
    ? (imgEl ? imgEndY + 46 : 280)
    : (imgEl ? imgEndY + 40 : H * 0.19)

  // Pills
  let pw = drawPill(ctx, m, ty, payload.tag, payload.tag, t.light, W)
  if (payload.editionCount && payload.editionCount > 1) {
    drawPill(ctx, m + pw + W * 0.012, ty, `${payload.editionCount} Editions`, 'EDITION', t.light, W)
  }
  const pillH = Math.round(Math.round(W * 0.021) * 2.1)
  ty += pillH + W * 0.022

  // Title — italic Georgia
  const tsize = Math.round(W * (isStory ? 0.052 : 0.046))
  ctx.font = `italic 500 ${tsize}px Georgia, serif`
  ctx.fillStyle = t.text
  ctx.textBaseline = 'top'
  const titleLines = wrapText(ctx, payload.title, W - m * 2, 2)
  titleLines.forEach(l => { ctx.fillText(l, m, ty); ty += tsize * 1.3 })
  ty += tsize * 0.1

  // Sub
  const ss = Math.round(W * 0.026)
  ctx.font = `${ss}px ${GF}`
  ctx.fillStyle = t.sub
  ctx.textBaseline = 'top'
  const subLines = wrapText(ctx, payload.sub, W - m * 2, 3)
  subLines.forEach(l => { ctx.fillText(l, m, ty); ty += ss * 1.42 })
  ty += ss * 0.5

  // Caption
  const cap = caption.trim()
  if (cap) {
    const cs = Math.round(W * 0.028)
    ctx.font = `${cs}px ${GF}`
    ctx.fillStyle = t.text
    ctx.globalAlpha = 0.5
    ctx.textBaseline = 'top'
    const capLines = wrapText(ctx, cap, W - m * 2, 3)
    capLines.forEach(l => { ctx.fillText(l, m, ty); ty += cs * 1.42 })
    ctx.globalAlpha = 1
    ty += cs * 0.25
  }

  // Price
  if (showPrice && payload.price) {
    const ps = Math.round(W * 0.032)
    ctx.font = `500 ${ps}px ${GF}`
    ctx.fillStyle = t.text
    ctx.globalAlpha = 1
    ctx.textBaseline = 'top'
    ctx.fillText(payload.price, m, ty)
    ty += ps * 1.5
  }

  // Sticker + footer (story only)
  if (isStory) {
    const [logoEl, logoWhiteEl] = await Promise.all([getLogoEl(), getWhiteLogoEl()])
    const footerLogo = t.light ? logoEl : logoWhiteEl

    const shW = Math.round(W * 0.27)
    const shH = Math.round(W * 0.078)
    const shR = 8
    const shY = H - 100 - shH
    const shX = (W - shW) / 2

    ctx.globalAlpha = 1
    ctx.fillStyle = t.light ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.07)'
    rr(ctx, shX, shY, shW, shH, shR)
    ctx.fill()
    ctx.setLineDash([6, 4])
    ctx.strokeStyle = t.light ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.2)'
    ctx.lineWidth = 1.5
    rr(ctx, shX, shY, shW, shH, shR)
    ctx.stroke()
    ctx.setLineDash([])

    const fY = shY + shH / 2
    drawFooter(ctx, m, fY, payload.handle, t.light, W, footerLogo)
  }
}

export function formatSharePrice(
  priceCents: number | null,
  currency: 'NZD' | 'AUD',
  isPoa: boolean,
  acquisitionMode?: string
): string | null {
  if (isPoa) return 'Price on application'
  if (acquisitionMode === 'enquire_first') return null
  if (!priceCents) return null
  return `${currency} ${(priceCents / 100).toLocaleString()}`
}
