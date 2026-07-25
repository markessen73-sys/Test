import { FACE_CONTAIN_PAD } from './composeFaceTexture'
import type { BagPolaroidPhase, PolaroidScrapKind } from './bagPolaroid'

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

/** Path for a scrap region (closed). Used for erase + scrap extraction. */
function scrapPath(ctx: CanvasRenderingContext2D, kind: PolaroidScrapKind, w: number, h: number) {
  ctx.beginPath()
  if (kind === 'cornerL') {
    ctx.moveTo(0, h)
    drawJaggedLine(ctx, 0, h, w * 0.48, h, 8, 8)
    drawJaggedLine(ctx, w * 0.48, h, 0, h * 0.48, 16, 16)
    ctx.closePath()
    return
  }
  if (kind === 'cornerR') {
    ctx.moveTo(w, h)
    drawJaggedLine(ctx, w, h, w * 0.52, h, 8, 8)
    drawJaggedLine(ctx, w * 0.52, h, w, h * 0.48, 16, 16)
    ctx.closePath()
    return
  }
  // half
  ctx.moveTo(0, h * 0.12)
  drawJaggedLine(ctx, 0, h * 0.12, w * 0.72, h, 22, 18)
  ctx.lineTo(0, h)
  ctx.closePath()
}

function strokeTearEdge(ctx: CanvasRenderingContext2D, kind: PolaroidScrapKind, w: number, h: number) {
  ctx.save()
  ctx.strokeStyle = 'rgba(235, 225, 205, 0.98)'
  ctx.lineWidth = kind === 'half' ? 5 : 4
  ctx.beginPath()
  if (kind === 'cornerL') {
    drawJaggedLine(ctx, w * 0.48, h, 0, h * 0.48, 16, 16)
  } else if (kind === 'cornerR') {
    drawJaggedLine(ctx, w * 0.52, h, w, h * 0.48, 16, 16)
  } else {
    drawJaggedLine(ctx, 0, h * 0.12, w * 0.72, h, 22, 18)
  }
  ctx.stroke()
  ctx.restore()
}

function eraseScrap(ctx: CanvasRenderingContext2D, kind: PolaroidScrapKind, w: number, h: number) {
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  scrapPath(ctx, kind, w, h)
  ctx.fill()
  ctx.restore()
  strokeTearEdge(ctx, kind, w, h)
}

/** Selected-face caricature → warm B&W contain-fit into the photo well. */
function drawBlackAndWhiteFace(
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

  // Soft warm well behind the transparent face cutout.
  tctx.fillStyle = '#d8d2c4'
  tctx.fillRect(0, 0, tmp.width, tmp.height)

  const iw = img.naturalWidth
  const ih = img.naturalHeight
  const contain = Math.min(tmp.width / iw, tmp.height / ih) * FACE_CONTAIN_PAD
  const dw = iw * contain
  const dh = ih * contain
  tctx.drawImage(img, 0, 0, iw, ih, (tmp.width - dw) / 2, (tmp.height - dh) / 2, dw, dh)

  const imageData = tctx.getImageData(0, 0, tmp.width, tmp.height)
  const d = imageData.data
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue
    let g = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]
    g = (g - 128) * 1.18 + 128
    g = Math.max(0, Math.min(255, g))
    d[i] = g
    d[i + 1] = g * 0.98
    d[i + 2] = g * 0.92
  }
  tctx.putImageData(imageData, 0, 0)

  const vig = tctx.createRadialGradient(
    tmp.width / 2,
    tmp.height / 2,
    tmp.width * 0.28,
    tmp.width / 2,
    tmp.height / 2,
    tmp.width * 0.75
  )
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, 'rgba(20,16,10,0.32)')
  tctx.fillStyle = vig
  tctx.fillRect(0, 0, tmp.width, tmp.height)

  ctx.drawImage(tmp, x, y, w, h)
}

/** Draw a complete intact Polaroid (no tears). */
function paintIntactPolaroid(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  const w = CANVAS_W
  const h = CANVAS_H
  ctx.clearRect(0, 0, w, h)

  ctx.fillStyle = '#f3efe4'
  ctx.fillRect(0, 0, w, h)

  const ix = w * MARGIN_X
  const iy = h * MARGIN_TOP
  const iw = w * (1 - 2 * MARGIN_X)
  const ih = h * (1 - MARGIN_TOP - MARGIN_BOTTOM)
  ctx.fillStyle = '#1a1814'
  ctx.fillRect(ix - 2, iy - 2, iw + 4, ih + 4)

  drawBlackAndWhiteFace(ctx, img, ix, iy, iw, ih)

  const foot = ctx.createLinearGradient(0, h * 0.78, 0, h)
  foot.addColorStop(0, 'rgba(0,0,0,0)')
  foot.addColorStop(1, 'rgba(40, 32, 20, 0.08)')
  ctx.fillStyle = foot
  ctx.fillRect(0, h * 0.78, w, h * 0.22)

  ctx.strokeStyle = 'rgba(60, 50, 40, 0.25)'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, w - 2, h - 2)
}

/**
 * Paint a B&W Polaroid of the selected face, with cumulative tear damage.
 */
export function drawPolaroidOnCanvas(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  phase: BagPolaroidPhase
) {
  const w = CANVAS_W
  const h = CANVAS_H
  paintIntactPolaroid(ctx, img)

  if (
    phase === 'cornerTear' ||
    phase === 'onePin' ||
    phase === 'bothCorners' ||
    phase === 'halfTear' ||
    phase === 'fallen'
  ) {
    eraseScrap(ctx, 'cornerL', w, h)
  }
  if (phase === 'bothCorners' || phase === 'halfTear' || phase === 'fallen') {
    eraseScrap(ctx, 'cornerR', w, h)
  }
  if (phase === 'halfTear' || phase === 'fallen') {
    eraseScrap(ctx, 'half', w, h)
  }
}

/**
 * Render the torn-off scrap as a full-size Polaroid canvas (only the scrap
 * pixels opaque). Same dimensions as the main photo so it can peel off in place.
 */
export function renderPolaroidScrapCanvas(
  img: HTMLImageElement,
  kind: PolaroidScrapKind
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  paintIntactPolaroid(ctx, img)

  // Keep only the scrap region.
  ctx.save()
  ctx.globalCompositeOperation = 'destination-in'
  scrapPath(ctx, kind, CANVAS_W, CANVAS_H)
  ctx.fill()
  ctx.restore()

  // Torn edge on the scrap itself.
  strokeTearEdge(ctx, kind, CANVAS_W, CANVAS_H)
  return canvas
}

export const POLAROID_CANVAS_SIZE = { width: CANVAS_W, height: CANVAS_H } as const
