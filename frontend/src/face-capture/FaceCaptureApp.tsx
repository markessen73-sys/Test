import { FaceCaptureView } from './FaceCaptureView';

/** Full-page face fit flow (`?builder=face`). Selfie or upload into the boxer outline. */
export function FaceCaptureApp() {
  const backToGym = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('builder');
    window.location.href = url.pathname + url.search + url.hash;
  };

  return <FaceCaptureView onClose={backToGym} />;
}
