/** Solid mask from the transparent foreground template (alpha channel). */

export const ALPHA_MIN = 8;

export function buildSolidMask(data, width, height, channels) {
  const alphaIndex = channels - 1;
  const solid = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    if (data[i * channels + alphaIndex] >= ALPHA_MIN) solid[i] = 1;
  }
  return solid;
}

export function buildDebugCompositeRgba(data, width, height, channels) {
  const alphaIndex = channels - 1;
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const p = i * 4;
    const s = i * channels;
    if (data[s + alphaIndex] >= ALPHA_MIN) {
      out[p] = data[s];
      out[p + 1] = data[s + 1];
      out[p + 2] = data[s + 2];
      out[p + 3] = 255;
    } else {
      out[p] = 0;
      out[p + 1] = 255;
      out[p + 2] = 0;
      out[p + 3] = 255;
    }
  }
  return out;
}

export function solidToSegments(solid, width, height) {
  const segments = [];
  for (let y = 0; y < height; y++) {
    let start = null;
    for (let x = 0; x < width; x++) {
      if (solid[y * width + x]) {
        if (start === null) start = x;
      } else if (start !== null) {
        segments.push([y, start, x - 1]);
        start = null;
      }
    }
    if (start !== null) segments.push([y, start, width - 1]);
  }
  return segments;
}
