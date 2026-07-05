export interface CaricatureStyle {
  id: string;
  name: string;
  description: string;
  preview_color: string;
}

export interface HealthStatus {
  status: string;
  replicate_configured: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL || '';

export async function fetchStyles(): Promise<CaricatureStyle[]> {
  const res = await fetch(`${API_BASE}/api/styles`);
  if (!res.ok) throw new Error('Failed to load styles');
  const data = await res.json();
  return data.styles;
}

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error('API unavailable');
  return res.json();
}

export async function transformPhoto(
  file: File,
  styleId: string,
  onProgress?: (message: string) => void
): Promise<Blob> {
  onProgress?.('Uploading photo...');

  const formData = new FormData();
  formData.append('photo', file);
  formData.append('style_id', styleId);

  onProgress?.('Generating caricature... This may take 10–30 seconds.');

  const res = await fetch(`${API_BASE}/api/transform`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Transformation failed' }));
    throw new Error(err.detail || 'Transformation failed');
  }

  onProgress?.('Done!');
  return res.blob();
}
