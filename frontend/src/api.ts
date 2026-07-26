export interface CaricatureStyle {
  id: string;
  name: string;
  description: string;
  preview_color: string;
}

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  price_display: string;
  description: string;
}

export interface Pricing {
  credits_per_transform: number;
  free_trial_credits: number;
  packs: CreditPack[];
  stripe_enabled: boolean;
}

export interface Account {
  customer_id: string;
  credits: number;
  credits_per_transform: number;
  can_transform: boolean;
}

export interface HealthStatus {
  status: string;
  monetization_mode: boolean;
  ai_available: boolean;
  stripe_enabled: boolean;
  credits_per_transform: number;
}

const API_BASE = import.meta.env.VITE_API_URL || '';
const CUSTOMER_KEY = 'caricature_customer_id';

export function getStoredCustomerId(): string | null {
  return localStorage.getItem(CUSTOMER_KEY);
}

export function storeCustomerId(id: string): void {
  localStorage.setItem(CUSTOMER_KEY, id);
}

function customerHeaders(): HeadersInit {
  const id = getStoredCustomerId();
  return id ? { 'X-Customer-Id': id } : {};
}

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

export async function fetchPricing(): Promise<Pricing> {
  const res = await fetch(`${API_BASE}/api/pricing`);
  if (!res.ok) throw new Error('Failed to load pricing');
  return res.json();
}

export async function fetchAccount(): Promise<Account> {
  const res = await fetch(`${API_BASE}/api/account`, {
    headers: customerHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load account');
  const account: Account = await res.json();
  storeCustomerId(account.customer_id);
  return account;
}

export async function createCheckout(packId: string): Promise<string> {
  const form = new FormData();
  form.append('pack_id', packId);
  const res = await fetch(`${API_BASE}/api/billing/checkout`, {
    method: 'POST',
    headers: customerHeaders(),
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Checkout failed' }));
    throw new Error(err.detail || 'Checkout failed');
  }
  const data = await res.json();
  return data.checkout_url;
}

export async function transformPhoto(
  file: File,
  styleId: string,
  onProgress?: (message: string) => void,
  expression: 'clean' | 'ooh' | 'knockout' = 'clean'
): Promise<{ blob: Blob; providerUsed: string; creditsRemaining: number }> {
  onProgress?.('Uploading photo...');

  const formData = new FormData();
  formData.append('photo', file);
  formData.append('style_id', styleId);
  formData.append('expression', expression);

  const label =
    expression === 'clean'
      ? 'Creating clean expression…'
      : expression === 'ooh'
        ? 'Creating ooh expression…'
        : 'Creating knockout expression…';
  onProgress?.(`${label} 10–30 seconds.`);

  const res = await fetch(`${API_BASE}/api/transform`, {
    method: 'POST',
    headers: customerHeaders(),
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Transformation failed' }));
    const detail = err.detail;
    if (typeof detail === 'object' && detail.message) {
      throw new Error(detail.message);
    }
    throw new Error(detail || 'Transformation failed');
  }

  const customerId = res.headers.get('X-Customer-Id');
  if (customerId) storeCustomerId(customerId);

  onProgress?.('Done!');
  return {
    blob: await res.blob(),
    providerUsed: res.headers.get('X-Provider') || 'ai',
    creditsRemaining: parseInt(res.headers.get('X-Credits-Remaining') || '0', 10),
  };
}

export interface BakedCharacterPack {
  clean: Blob;
  ooh: Blob;
  knockout: Blob;
  damage: Record<string, Blob>;
  clown: Record<string, Blob>;
}

function base64ToBlob(b64: string, type = 'image/png'): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** Server-side bake using the same Node scripts as built-in characters. */
export async function bakeCharacterPack(
  clean: Blob,
  ooh: Blob,
  knockout: Blob,
  onProgress?: (message: string) => void
): Promise<BakedCharacterPack> {
  onProgress?.('Baking damage & clown packs on server…');

  const form = new FormData();
  form.append('clean', clean, 'clean.png');
  form.append('ooh', ooh, 'ooh.png');
  form.append('knockout', knockout, 'knockout.png');

  const res = await fetch(`${API_BASE}/api/bake-character-pack`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Pack bake failed' }));
    throw new Error(err.detail || 'Pack bake failed');
  }

  const data = (await res.json()) as { files: Record<string, string> };
  const files = data.files ?? {};

  const damage: Record<string, Blob> = {};
  const clown: Record<string, Blob> = {};
  for (const [path, b64] of Object.entries(files)) {
    const blob = base64ToBlob(b64);
    if (path.startsWith('damage/')) {
      damage[path.slice('damage/'.length)] = blob;
    } else if (path.startsWith('clown/')) {
      clown[path.slice('clown/'.length)] = blob;
    }
  }

  if (!files['clean.png'] || !files['ooh.png'] || !files['knockout.png']) {
    throw new Error('Server bake returned incomplete pack');
  }

  onProgress?.('Pack baked!');
  return {
    clean: base64ToBlob(files['clean.png']),
    ooh: base64ToBlob(files['ooh.png']),
    knockout: base64ToBlob(files['knockout.png']),
    damage,
    clown,
  };
}
