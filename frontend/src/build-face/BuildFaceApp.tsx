import { BuildFaceView } from './BuildFaceView';

/** Full-page Build a Face flow (`?builder=face`). */
export function BuildFaceApp() {
  const backToGym = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('builder');
    window.location.href = url.pathname + url.search + url.hash;
  };

  return <BuildFaceView onClose={backToGym} />;
}
