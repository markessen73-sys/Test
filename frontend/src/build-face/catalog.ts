import { assetUrl } from '../assetUrl';

export type HairStyle = {
  id: string;
  name: string;
  /** Public path without base prefix, e.g. assets/build-face/hair/01-short-crop.png */
  file: string;
};

const HAIR_FILES: HairStyle[] = [
  { id: '01-short-crop', name: 'Short crop', file: 'assets/build-face/hair/01-short-crop.png' },
  { id: '02-crew', name: 'Crew cut', file: 'assets/build-face/hair/02-crew.png' },
  { id: '03-side-part', name: 'Side part', file: 'assets/build-face/hair/03-side-part.png' },
  { id: '04-quiff', name: 'Quiff', file: 'assets/build-face/hair/04-quiff.png' },
  { id: '05-curtains', name: 'Curtains', file: 'assets/build-face/hair/05-curtains.png' },
  { id: '06-bowl', name: 'Bowl cut', file: 'assets/build-face/hair/06-bowl.png' },
  { id: '07-afro', name: 'Afro', file: 'assets/build-face/hair/07-afro.png' },
  { id: '08-long', name: 'Long', file: 'assets/build-face/hair/08-long.png' },
  { id: '09-mullet', name: 'Mullet', file: 'assets/build-face/hair/09-mullet.png' },
  { id: '10-spiky', name: 'Spiky', file: 'assets/build-face/hair/10-spiky.png' },
  { id: '11-messy', name: 'Messy fringe', file: 'assets/build-face/hair/11-messy.png' },
  { id: '12-pompadour', name: 'Pompadour', file: 'assets/build-face/hair/12-pompadour.png' },
];

export const BUILD_FACE_HAIR_COLOR = '#2a1c16';
export const BUILD_FACE_BLANK_FILE = 'assets/build-face/blank.png';

export function buildFaceBlankUrl(): string {
  return assetUrl(BUILD_FACE_BLANK_FILE);
}

export function buildFaceHair(): Array<HairStyle & { src: string }> {
  return HAIR_FILES.map((h) => ({ ...h, src: assetUrl(h.file) }));
}
