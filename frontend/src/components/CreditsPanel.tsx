import { CreditCard, X } from 'lucide-react';
import type { CreditPack } from '../api';

interface CreditsPanelProps {
  credits: number;
  creditsPerTransform: number;
  packs: CreditPack[];
  stripeEnabled: boolean;
  onPurchase: (packId: string) => void;
  onClose: () => void;
  purchasing: boolean;
}

export function CreditsPanel({
  credits,
  creditsPerTransform,
  packs,
  stripeEnabled,
  onPurchase,
  onClose,
  purchasing,
}: CreditsPanelProps) {
  return (
    <div className="credits-overlay" onClick={onClose}>
      <div className="credits-modal" onClick={(e) => e.stopPropagation()}>
        <div className="credits-modal-header">
          <h3>Buy Credits</h3>
          <button type="button" className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p className="credits-balance">
          Current balance: <strong>{credits}</strong> credit{credits !== 1 ? 's' : ''}
          <span className="credits-cost"> · {creditsPerTransform} per caricature</span>
        </p>

        {!stripeEnabled ? (
          <p className="credits-note">
            Stripe payments not configured yet. Set <code>STRIPE_SECRET_KEY</code> on the server to
            enable purchases.
          </p>
        ) : (
          <div className="pack-grid">
            {packs.map((pack) => (
              <button
                key={pack.id}
                type="button"
                className={`pack-card ${pack.id === 'popular' ? 'featured' : ''}`}
                onClick={() => onPurchase(pack.id)}
                disabled={purchasing}
              >
                {pack.id === 'popular' && <span className="pack-badge">Best value</span>}
                <h4>{pack.name}</h4>
                <p className="pack-credits">{pack.credits} credits</p>
                <p className="pack-price">{pack.price_display}</p>
                <p className="pack-desc">{pack.description}</p>
              </button>
            ))}
          </div>
        )}

        <p className="credits-footer">
          <CreditCard size={14} /> Secure payment via Stripe. Credits never expire.
        </p>
      </div>
    </div>
  );
}
