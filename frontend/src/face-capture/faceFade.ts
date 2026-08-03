/**
 * Fade the bottom edge of a cutout so the neck blends into the body.
 * Bottom tenth: transparent at the bottom → solid at the top of that band.
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
 * Multiply alpha in the bottom `frac` of the image by a linear ramp
 * (0 at the bottom edge → 1 at the top of the fade band).
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
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, w, h);
  const { data } = imageData;
  const fadeStart = Math.floor(h * (1 - Math.min(0.45, Math.max(0.02, frac))));
  const fadeH = Math.max(1, h - fadeStart);

  for (let y = fadeStart; y < h; y++) {
    // 1 at fadeStart (solid), 0 at bottom (nothing)
    const t = (y - fadeStart) / fadeH;
    const mul = 1 - t;
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      const ai = row + x * 4 + 3;
      data[ai] = Math.round((data[ai] ?? 0) * mul);
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
