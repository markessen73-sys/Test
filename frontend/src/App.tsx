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
} from './api';
import { CreditsPanel } from './components/CreditsPanel';
import { PhotoUpload } from './components/PhotoUpload';
import { ResultPanel } from './components/ResultPanel';
import { StylePicker } from './components/StylePicker';

function App() {
  const [styles, setStyles] = useState<CaricatureStyle[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [showCredits, setShowCredits] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [providerUsed, setProviderUsed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refreshAccount = useCallback(async () => {
    try {
      const acct = await fetchAccount();
      setAccount(acct);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchStyles(), fetchHealth(), fetchPricing(), fetchAccount()])
      .then(([styleList, healthData, pricing, acct]) => {
        setStyles(styleList);
        setHealth(healthData);
        setPacks(pricing.packs);
        setAccount(acct);
        if (styleList.length > 0) setSelectedStyle(styleList[0].id);
      })
      .catch(() => setError('Could not connect to the API. Is the backend running?'));

    const params = new URLSearchParams(window.location.search);
    if (params.get('purchase') === 'success') {
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(refreshAccount, 1500);
    }
  }, [refreshAccount]);

  const handleFileSelect = useCallback((file: File) => {
    setPhoto(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResultUrl(null);
    setProviderUsed(null);
    setError(null);
  }, []);

  const handleClear = useCallback(() => {
    setPhoto(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setResultUrl(null);
    setProviderUsed(null);
    setError(null);
  }, [previewUrl]);

  const handleTransform = useCallback(async () => {
    if (!photo || !selectedStyle) return;

    setLoading(true);
    setError(null);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(null);
    setProviderUsed(null);

    try {
      const { blob, providerUsed: used, creditsRemaining } = await transformPhoto(
        photo,
        selectedStyle,
        setLoadingMessage
      );
      setResultUrl(URL.createObjectURL(blob));
      setProviderUsed(used);
      setAccount((prev) => (prev ? { ...prev, credits: creditsRemaining } : prev));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(msg);
      if (msg.toLowerCase().includes('credit')) setShowCredits(true);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  }, [photo, selectedStyle, resultUrl]);

  const handlePurchase = useCallback(async (packId: string) => {
    setPurchasing(true);
    try {
      const url = await createCheckout(packId);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setPurchasing(false);
    }
  }, []);

  const handleDownload = useCallback(() => {
    if (!resultUrl || !selectedStyle) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `caricature-${selectedStyle}.png`;
    a.click();
  }, [resultUrl, selectedStyle]);

  const selectedStyleName = styles.find((s) => s.id === selectedStyle)?.name ?? null;
  const canTransform = !!photo && !!selectedStyle && !loading && (account?.can_transform ?? false);
  const credits = account?.credits ?? 0;
  const creditsPerTransform = account?.credits_per_transform ?? 1;

  const step1Done = !!photo;
  const step2Done = !!selectedStyle;
  const step3Done = !!resultUrl;

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <div className="logo-icon">🎨</div>
          <div>
            <h1>Caricature Studio</h1>
            <p>AI portrait caricatures</p>
          </div>
        </div>
        <div className="header-actions">
          <button type="button" className="credits-chip" onClick={() => setShowCredits(true)}>
            <Coins size={16} />
            <span>{credits} credit{credits !== 1 ? 's' : ''}</span>
          </button>
          <div className="status-badge">
            <span className={`status-dot ${health?.ai_available ? 'ready' : ''}`} />
            {health?.ai_available ? 'AI Ready' : 'AI offline'}
          </div>
        </div>
      </header>

      <main className="main">
        <section className="panel">
          <div className="steps">
            <div className={`step ${step1Done ? 'done' : 'active'}`} />
            <div className={`step ${step2Done ? 'done' : step1Done ? 'active' : ''}`} />
            <div className={`step ${step3Done ? 'done' : step2Done && step1Done ? 'active' : ''}`} />
          </div>

          <h2 className="panel-title">1 · Upload your photo</h2>
          <PhotoUpload
            previewUrl={previewUrl}
            onFileSelect={handleFileSelect}
            onClear={handleClear}
            disabled={loading}
          />

          <h2 className="panel-title">2 · Choose a style</h2>
          <StylePicker
            styles={styles}
            selectedId={selectedStyle}
            onSelect={setSelectedStyle}
            disabled={loading}
          />

          {error && (
            <div className="error-banner">
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{error}</span>
            </div>
          )}

          {account && credits < creditsPerTransform && health?.monetization_mode && (
            <div className="info-banner">
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                You need {creditsPerTransform} credit{creditsPerTransform !== 1 ? 's' : ''} per
                caricature.{' '}
                <button type="button" className="link-btn" onClick={() => setShowCredits(true)}>
                  Buy credits
                </button>{' '}
                to continue.
              </span>
            </div>
          )}

          <button className="btn btn-primary" onClick={handleTransform} disabled={!canTransform}>
            {loading ? (
              <>Generating...</>
            ) : (
              <>
                <Wand2 size={18} /> Create Caricature ({creditsPerTransform} credit
                {creditsPerTransform !== 1 ? 's' : ''})
              </>
            )}
          </button>
        </section>

        <section className="panel">
          <h2 className="panel-title">3 · Your caricature</h2>
          <ResultPanel
            resultUrl={resultUrl}
            loading={loading}
            loadingMessage={loadingMessage}
            styleName={selectedStyleName}
            providerUsed={providerUsed}
            onDownload={handleDownload}
            onRetry={handleTransform}
            canRetry={!!photo && !!selectedStyle && !loading}
          />
        </section>
      </main>

      <footer className="footer">
        {creditsPerTransform} credit per AI caricature · You hold the API keys · Users buy credits
        via Stripe
      </footer>

      {showCredits && (
        <CreditsPanel
          credits={credits}
          creditsPerTransform={creditsPerTransform}
          packs={packs}
          stripeEnabled={health?.stripe_enabled ?? false}
          onPurchase={handlePurchase}
          onClose={() => setShowCredits(false)}
          purchasing={purchasing}
        />
      )}
    </div>
  );
}

export default App;
