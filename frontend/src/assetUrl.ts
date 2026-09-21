/** Prefix a public/ asset path with Vite's base (works for `/` and `./` deploys). */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const clean = path.replace(/^\//, '');
  return `${base}${clean}`;
}
