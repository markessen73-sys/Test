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
  onProgress?: (message: string) => void
): Promise<{ blob: Blob; providerUsed: string; creditsRemaining: number }> {
  onProgress?.('Uploading photo...');

  const formData = new FormData();
  formData.append('photo', file);
  formData.append('style_id', styleId);

  onProgress?.('Creating your AI caricature... 10–30 seconds.');

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
