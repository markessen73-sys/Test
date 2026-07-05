import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Coins, Wand2 } from 'lucide-react';
import {
  createCheckout,
  fetchAccount,
  fetchHealth,
  fetchPricing,
  fetchStyles,
  transformPhoto,
  type Account,
  type CaricatureStyle,
  type CreditPack,
  type HealthStatus,
} from '../api';
import { CreditsPanel } from '../components/CreditsPanel';
import { PhotoUpload } from '../components/PhotoUpload';
import { ResultPanel } from '../components/ResultPanel';
import { StylePicker } from '../components/StylePicker';

interface CreateStepProps {
  onComplete: (caricatureUrl: string, styleName: string) => void;
}

export function CreateStep({ onComplete }: CreateStepProps) {
  const [styles, setStyles] = useState<CaricatureStyle[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [showCredits, setShowCredits] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchStyles(), fetchHealth(), fetchPricing(), fetchAccount()])
      .then(([styleList, healthData, pricing, acct]) => {
        setStyles(styleList);
        setHealth(healthData);
        setPacks(pricing.packs);
        setAccount(acct);
        if (styleList.length > 0) setSelectedStyle(styleList[0].id);
      })
      .catch(() => setError('Could not connect to the API.'));
  }, []);

  const handleTransform = useCallback(async () => {
    if (!photo || !selectedStyle) return;
    setLoading(true);
    setError(null);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(null);

    try {
      const { blob, creditsRemaining } = await transformPhoto(photo, selectedStyle, setLoadingMessage);
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setAccount((prev) => (prev ? { ...prev, credits: creditsRemaining } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      if (String(err).toLowerCase().includes('credit')) setShowCredits(true);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  }, [photo, selectedStyle, resultUrl, styles, onComplete]);

  const credits = account?.credits ?? 0;
  const creditsPerTransform = account?.credits_per_transform ?? 1;
  const canTransform = !!photo && !!selectedStyle && !loading && (account?.can_transform ?? false);

  return (
    <>
      <div className="step-header">
        <span className="step-label">Step 1 of 2</span>
        <h2>Create your fighter</h2>
        <p>Upload a photo — you'll take it into Mickey's Gym</p>
      </div>

      <div className="create-grid">
        <div className="panel">
          <h3 className="panel-title">Upload photo</h3>
          <PhotoUpload
            previewUrl={previewUrl}
            onFileSelect={(f) => {
              setPhoto(f);
              setPreviewUrl(URL.createObjectURL(f));
              setResultUrl(null);
              setError(null);
            }}
            onClear={() => {
              setPhoto(null);
              if (previewUrl) URL.revokeObjectURL(previewUrl);
              setPreviewUrl(null);
              setResultUrl(null);
            }}
            disabled={loading}
          />

          <h3 className="panel-title">Cartoon style</h3>
          <StylePicker
            styles={styles}
            selectedId={selectedStyle}
            onSelect={setSelectedStyle}
            disabled={loading}
          />

          {error && (
            <div className="error-banner">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <button className="btn btn-primary" onClick={handleTransform} disabled={!canTransform || !!resultUrl}>
            <Wand2 size={18} />
            {loading ? 'Creating...' : `Create Fighter (${creditsPerTransform} credit)`}
          </button>

          {resultUrl && selectedStyle && (
            <button
              className="btn btn-primary btn-glow"
              onClick={() =>
                onComplete(resultUrl, styles.find((s) => s.id === selectedStyle)?.name ?? selectedStyle)
              }
            >
              Enter the Gym →
            </button>
          )}
        </div>

        <div className="panel">
          <h3 className="panel-title">Preview</h3>
          <ResultPanel
            resultUrl={resultUrl}
            loading={loading}
            loadingMessage={loadingMessage}
            styleName={styles.find((s) => s.id === selectedStyle)?.name ?? null}
            providerUsed={null}
            onDownload={() => {}}
            onRetry={handleTransform}
            canRetry={canTransform}
          />
        </div>
      </div>

      <button type="button" className="credits-chip floating-credits" onClick={() => setShowCredits(true)}>
        <Coins size={16} />
        {credits} credits
      </button>

      {showCredits && (
        <CreditsPanel
          credits={credits}
          creditsPerTransform={creditsPerTransform}
          packs={packs}
          stripeEnabled={health?.stripe_enabled ?? false}
          onPurchase={async (packId) => {
            setPurchasing(true);
            try {
              window.location.href = await createCheckout(packId);
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Checkout failed');
            } finally {
              setPurchasing(false);
            }
          }}
          onClose={() => setShowCredits(false)}
          purchasing={purchasing}
        />
      )}
    </>
  );
}
