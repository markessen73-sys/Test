import { assetUrl } from '../assetUrl';

export type HairStyle = {
  id: string;
  name: string;
  /** Public path without base prefix, e.g. assets/build-face/hair/01-bald.png */
  file: string;
};

export type HairColor = {
  id: string;
  name: string;
  hex: string;
};

const HAIR_FILES: HairStyle[] = [
  { id: '01-swept-crown', name: 'Swept crown', file: 'assets/build-face/hair/01-swept-crown.png' },
  { id: '02-receding-buzz', name: 'Receding buzz', file: 'assets/build-face/hair/02-receding-buzz.png' },
  { id: '03-buzz', name: 'Buzz cut', file: 'assets/build-face/hair/03-buzz.png' },
  { id: '04-short-spiky', name: 'Short spiky', file: 'assets/build-face/hair/04-short-spiky.png' },
  { id: '05-messy-fringe', name: 'Messy fringe', file: 'assets/build-face/hair/05-messy-fringe.png' },
  { id: '06-high-spikes', name: 'High spikes', file: 'assets/build-face/hair/06-high-spikes.png' },
  { id: '07-wavy-pompadour', name: 'Wavy pompadour', file: 'assets/build-face/hair/07-wavy-pompadour.png' },
  { id: '08-slick-side-part', name: 'Slick side-part', file: 'assets/build-face/hair/08-slick-side-part.png' },
  { id: '09-large-quiff', name: 'Large quiff', file: 'assets/build-face/hair/09-large-quiff.png' },
  { id: '10-shaggy', name: 'Shaggy', file: 'assets/build-face/hair/10-shaggy.png' },
  { id: '11-layered-shag', name: 'Layered shag', file: 'assets/build-face/hair/11-layered-shag.png' },
  { id: '12-tight-afro', name: 'Tight afro', file: 'assets/build-face/hair/12-tight-afro.png' },
  { id: '13-wavy-mid', name: 'Wavy mid', file: 'assets/build-face/hair/13-wavy-mid.png' },
  { id: '14-smooth-mid', name: 'Smooth mid', file: 'assets/build-face/hair/14-smooth-mid.png' },
  { id: '15-slicked-back', name: 'Slicked back', file: 'assets/build-face/hair/15-slicked-back.png' },
  { id: '16-top-bun', name: 'Top bun', file: 'assets/build-face/hair/16-top-bun.png' },
  { id: '17-undercut-slick', name: 'Undercut slick', file: 'assets/build-face/hair/17-undercut-slick.png' },
  { id: '18-classic-side-part', name: 'Classic side-part', file: 'assets/build-face/hair/18-classic-side-part.png' },
  { id: '19-curly-top', name: 'Curly top', file: 'assets/build-face/hair/19-curly-top.png' },
  { id: '20-textured-spikes', name: 'Textured spikes', file: 'assets/build-face/hair/20-textured-spikes.png' },
  { id: '21-side-swept-fringe', name: 'Side-swept fringe', file: 'assets/build-face/hair/21-side-swept-fringe.png' },
  { id: '22-medium-afro', name: 'Medium afro', file: 'assets/build-face/hair/22-medium-afro.png' },
  { id: '23-mullet', name: 'Mullet', file: 'assets/build-face/hair/23-mullet.png' },
  { id: '24-wavy-curtains', name: 'Wavy curtains', file: 'assets/build-face/hair/24-wavy-curtains.png' },
  { id: '25-short-locs', name: 'Short locs', file: 'assets/build-face/hair/25-short-locs.png' },
  { id: '26-large-afro', name: 'Large afro', file: 'assets/build-face/hair/26-large-afro.png' },
  { id: '27-emo-fringe', name: 'Emo fringe', file: 'assets/build-face/hair/27-emo-fringe.png' },
  { id: '28-punk-spikes', name: 'Punk spikes', file: 'assets/build-face/hair/28-punk-spikes.png' },
  { id: '29-mohawk', name: 'Mohawk', file: 'assets/build-face/hair/29-mohawk.png' },
  { id: '30-high-fade', name: 'High fade', file: 'assets/build-face/hair/30-high-fade.png' },
];

export const BUILD_FACE_HAIR_COLORS: HairColor[] = [
  { id: 'light-blonde', name: 'Light blonde', hex: '#E8D59A' },
  { id: 'blonde', name: 'Blonde', hex: '#C6A45A' },
  { id: 'light-brown', name: 'Light brown', hex: '#8B5E3C' },
  { id: 'brown', name: 'Brown', hex: '#5C3A24' },
  { id: 'dark-brown', name: 'Dark brown', hex: '#2A1C16' },
  { id: 'black', name: 'Black', hex: '#121014' },
  { id: 'grey', name: 'Grey', hex: '#8A8680' },
  { id: 'auburn', name: 'Auburn', hex: '#7A2F1A' },
];

/** @deprecated Use BUILD_FACE_HAIR_COLORS; kept for any old imports */
export const BUILD_FACE_HAIR_COLOR = BUILD_FACE_HAIR_COLORS[4].hex;

export const BUILD_FACE_BLANK_FILE = 'assets/build-face/blank-no-features.png';

export function buildFaceBlankUrl(): string {
  return assetUrl(BUILD_FACE_BLANK_FILE);
}

export function buildFaceHair(): Array<HairStyle & { src: string }> {
  return HAIR_FILES.map((h) => ({ ...h, src: assetUrl(h.file) }));
}

export function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/**
 * Recolor a hair overlay in-place: keep alpha + relative shading, map to target colour.
 */
export function colorizeHairImageData(
  imageData: ImageData,
  targetHex: string
): ImageData {
  const { r: tr, g: tg, b: tb } = parseHexColor(targetHex);
  const data = imageData.data;
  // First pass: mean luminance of opaque pixels (source brown baseline)
  let sum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue;
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    count += 1;
  }
  const meanL = count > 0 ? sum / count : 60;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 8) continue;
    const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    // Preserve relative light/dark vs source mean, then tint toward target
    const factor = Math.max(0.35, Math.min(1.55, l / meanL));
    data[i] = Math.max(0, Math.min(255, Math.round(tr * factor)));
    data[i + 1] = Math.max(0, Math.min(255, Math.round(tg * factor)));
    data[i + 2] = Math.max(0, Math.min(255, Math.round(tb * factor)));
  }
  return imageData;
}
