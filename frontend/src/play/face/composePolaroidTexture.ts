import type { BagPolaroidPhase } from './bagPolaroid'

const CANVAS_W = 512
const CANVAS_H = Math.round(512 * 1.22)

/** Classic Polaroid margins (normalized to outer canvas). */
const MARGIN_X = 0.07
const MARGIN_TOP = 0.07
const MARGIN_BOTTOM = 0.2

function drawJaggedLine(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  segs: number,
  amp: number
) {
  ctx.moveTo(x0, y0)
  for (let i = 1; i <= segs; i++) {
    const t = i / segs
    const x = x0 + (x1 - x0) * t
    const y = y0 + (y1 - y0) * t
    const nx = -(y1 - y0)
    const ny = x1 - x0
    const len = Math.hypot(nx, ny) || 1
    const side = i % 2 === 0 ? 1 : -1
    const jig = side * amp * (0.45 + (i % 3) * 0.2)
    ctx.lineTo(x + (nx / len) * jig, y + (ny / len) * jig)
  }
}

/** Convert source pixels to high-contrast B&W into the photo well. */
function drawBlackAndWhitePhoto(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const tmp = document.createElement('canvas')
  tmp.width = Math.max(1, Math.round(w))
  tmp.height = Math.max(1, Math.round(h))
  const tctx = tmp.getContext('2d')
  if (!tctx) return

  // Cover-fit the dual portrait into the square-ish well.
  const scale = Math.max(tmp.width / img.naturalWidth, tmp.height / img.naturalHeight)
  const dw = img.naturalWidth * scale
  const dh = img.naturalHeight * scale
  tctx.drawImage(img, (tmp.width - dw) / 2, (tmp.height - dh) / 2, dw, dh)

  const imageData = tctx.getImageData(0, 0, tmp.width, tmp.height)
  const d = imageData.data
  for (let i = 0; i < d.length; i += 4) {
    // Warm-ish B&W with a little contrast punch (Polaroid feel).
    let g = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]
    g = (g - 128) * 1.15 + 128
    g = Math.max(0, Math.min(255, g))
    d[i] = g
    d[i + 1] = g * 0.98
    d[i + 2] = g * 0.92
  }
  tctx.putImageData(imageData, 0, 0)

  // Soft vignette.
  const vig = tctx.createRadialGradient(
    tmp.width / 2,
    tmp.height / 2,
    tmp.width * 0.25,
    tmp.width / 2,
    tmp.height / 2,
    tmp.width * 0.72
  )
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, 'rgba(20,16,10,0.35)')
  tctx.fillStyle = vig
  tctx.fillRect(0, 0, tmp.width, tmp.height)

  ctx.drawImage(tmp, x, y, w, h)
}

function eraseBottomLeftCorner(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w * 0.02
  const cy = h * 0.98
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  drawJaggedLine(ctx, cx, cy, w * 0.34, h * 0.99, 10, 10)
  drawJaggedLine(ctx, w * 0.34, h * 0.99, w * 0.02, h * 0.66, 12, 12)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  // Torn paper edge tint.
  ctx.save()
  ctx.strokeStyle = 'rgba(210, 200, 185, 0.85)'
  ctx.lineWidth = 3
  ctx.beginPath()
  drawJaggedLine(ctx, w * 0.34, h * 0.99, w * 0.02, h * 0.66, 12, 12)
  ctx.stroke()
  ctx.restore()
}

function eraseBottomRightCorner(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath()
  ctx.moveTo(w * 0.98, h * 0.98)
  drawJaggedLine(ctx, w * 0.98, h * 0.98, w * 0.66, h * 0.99, 10, 10)
  drawJaggedLine(ctx, w * 0.66, h * 0.99, w * 0.98, h * 0.66, 12, 12)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = 'rgba(210, 200, 185, 0.85)'
  ctx.lineWidth = 3
  ctx.beginPath()
  drawJaggedLine(ctx, w * 0.66, h * 0.99, w * 0.98, h * 0.66, 12, 12)
  ctx.stroke()
  ctx.restore()
}

/** Tear away roughly the lower-left half along a jagged diagonal. */
function eraseHalf(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath()
  ctx.moveTo(0, h * 0.28)
  drawJaggedLine(ctx, 0, h * 0.28, w * 0.55, h, 18, 14)
  ctx.lineTo(0, h)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = 'rgba(215, 205, 190, 0.9)'
  ctx.lineWidth = 3.5
  ctx.beginPath()
  drawJaggedLine(ctx, 0, h * 0.28, w * 0.55, h, 18, 14)
  ctx.stroke()
  ctx.restore()
}

/**
 * Paint a B&W Polaroid of the source photo, with cumulative tear damage.
 * Canvas is transparent outside the remaining paper.
 */
export function drawPolaroidOnCanvas(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  phase: BagPolaroidPhase
) {
  const w = CANVAS_W
  const h = CANVAS_H
  ctx.clearRect(0, 0, w, h)

  if (phase === 'fallen') {
    // Still draw the remaining scrap — fall animation handles position.
  }

  // Aged Polaroid body.
  ctx.fillStyle = '#f3efe4'
  ctx.fillRect(0, 0, w, h)

  // Inner shadow around photo well.
  const ix = w * MARGIN_X
  const iy = h * MARGIN_TOP
  const iw = w * (1 - 2 * MARGIN_X)
  const ih = h * (1 - MARGIN_TOP - MARGIN_BOTTOM)
  ctx.fillStyle = '#1a1814'
  ctx.fillRect(ix - 2, iy - 2, iw + 4, ih + 4)

  drawBlackAndWhitePhoto(ctx, img, ix, iy, iw, ih)

  // Soft footer shade.
  const foot = ctx.createLinearGradient(0, h * 0.78, 0, h)
  foot.addColorStop(0, 'rgba(0,0,0,0)')
  foot.addColorStop(1, 'rgba(40, 32, 20, 0.08)')
  ctx.fillStyle = foot
  ctx.fillRect(0, h * 0.78, w, h * 0.22)

  // Outer edge.
  ctx.strokeStyle = 'rgba(60, 50, 40, 0.25)'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, w - 2, h - 2)

  if (
    phase === 'cornerTear' ||
    phase === 'onePin' ||
    phase === 'bothCorners' ||
    phase === 'halfTear' ||
    phase === 'fallen'
  ) {
    eraseBottomLeftCorner(ctx, w, h)
  }
  if (phase === 'bothCorners' || phase === 'halfTear' || phase === 'fallen') {
    eraseBottomRightCorner(ctx, w, h)
  }
  if (phase === 'halfTear' || phase === 'fallen') {
    eraseHalf(ctx, w, h)
  }
}

export const POLAROID_CANVAS_SIZE = { width: CANVAS_W, height: CANVAS_H } as const
