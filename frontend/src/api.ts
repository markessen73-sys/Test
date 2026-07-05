export interface CaricatureStyle {
  id: string;
  name: string;
  description: string;
  preview_color: string;
}

export type Provider = 'auto' | 'replicate' | 'openai' | 'local';

export interface HealthStatus {
  status: string;
  providers: string[];
  replicate_configured: boolean;
  openai_configured: boolean;
  local_available: boolean;
  default_provider: string;
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
  provider: Provider = 'auto',
  onProgress?: (message: string) => void
): Promise<{ blob: Blob; providerUsed: string }> {
  onProgress?.('Uploading photo...');

  const formData = new FormData();
  formData.append('photo', file);
  formData.append('style_id', styleId);
  formData.append('provider', provider);

  onProgress?.(
    provider === 'local'
      ? 'Applying cartoon style...'
      : 'Generating caricature... This may take 10–30 seconds.'
  );

  const res = await fetch(`${API_BASE}/api/transform`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Transformation failed' }));
    throw new Error(err.detail || 'Transformation failed');
  }

  onProgress?.('Done!');
  const providerUsed = res.headers.get('X-Provider') || provider;
  const blob = await res.blob();
  return { blob, providerUsed };
}
