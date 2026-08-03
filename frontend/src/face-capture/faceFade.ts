/**
 * Fade the bottom edge of a cutout so the neck blends into the body.
 * Fades the bottom tenth of the *opaque content* (not empty canvas padding):
 * transparent at the bottom → solid at the top of that band.
 */

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load face for bottom fade'));
    img.src = src;
  });
}

/**
 * Soft ease so the blend reads clearly on the body.
 */
function easeInQuad(t: number) {
  return t * t;
}

/**
 * Fade alpha in the bottom `frac` of opaque content.
 * Bottom edge of the head/neck → nothing; top of that band → solid.
 */
export async function applyBottomFade(
  dataUrl: string,
  frac = 0.1,
): Promise<string> {
  const img = await loadImage(dataUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (w < 2 || h < 2) return dataUrl;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: true });
  if (!ctx) return dataUrl;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, w, h);
  const { data } = imageData;

  // Opaque content bounds — cutouts are often padded; fade the real neck edge.
  let minY = h;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      if ((data[row + x * 4 + 3] ?? 0) > 12) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        break;
      }
    }
  }
  if (maxY < 0 || maxY <= minY) return dataUrl;

  const contentH = maxY - minY + 1;
  const fadeH = Math.max(12, Math.round(contentH * Math.min(0.35, Math.max(0.06, frac))));
  const fadeStart = Math.max(minY, maxY - fadeH + 1);

  for (let y = fadeStart; y <= maxY; y++) {
    const t = (y - fadeStart) / Math.max(1, maxY - fadeStart);
    // 1 at fadeStart (solid) → 0 at content bottom (nothing)
    const mul = 1 - easeInQuad(t);
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      const ai = row + x * 4 + 3;
      data[ai] = Math.round((data[ai] ?? 0) * mul);
    }
  }
  // Clear any fringe below the content bottom
  for (let y = maxY + 1; y < h; y++) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      data[row + x * 4 + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

/** Apply the same bottom fade to clean / ooh / knockout. */
export async function applyBottomFadeToFaceSet(faces: {
  clean: string;
  ooh: string;
  knockout: string;
}): Promise<{ clean: string; ooh: string; knockout: string }> {
  const [clean, ooh, knockout] = await Promise.all([
    applyBottomFade(faces.clean),
    applyBottomFade(faces.ooh),
    applyBottomFade(faces.knockout),
  ]);
  return { clean, ooh, knockout };
}
