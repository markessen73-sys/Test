import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Wand2 } from 'lucide-react';
import {
  fetchHealth,
  fetchStyles,
  transformPhoto,
  type CaricatureStyle,
  type HealthStatus,
  type Provider,
} from './api';
import { PhotoUpload } from './components/PhotoUpload';
import { ResultPanel } from './components/ResultPanel';
import { StylePicker } from './components/StylePicker';

const PROVIDER_LABELS: Record<string, string> = {
  replicate: 'Replicate AI',
  openai: 'OpenAI',
  local: 'Free local',
  auto: 'Auto',
};

function App() {
  const [styles, setStyles] = useState<CaricatureStyle[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [provider, setProvider] = useState<Provider>('auto');
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [providerUsed, setProviderUsed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchStyles(), fetchHealth()])
      .then(([styleList, healthData]) => {
        setStyles(styleList);
        setHealth(healthData);
        if (styleList.length > 0) {
          setSelectedStyle(styleList[0].id);
        }
      })
      .catch(() => setError('Could not connect to the API. Is the backend running?'));
  }, []);

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
      const { blob, providerUsed: used } = await transformPhoto(
        photo,
        selectedStyle,
        provider,
        setLoadingMessage
      );
      setResultUrl(URL.createObjectURL(blob));
      setProviderUsed(used);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  }, [photo, selectedStyle, provider, resultUrl]);

  const handleDownload = useCallback(() => {
    if (!resultUrl || !selectedStyle) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `caricature-${selectedStyle}.png`;
    a.click();
  }, [resultUrl, selectedStyle]);

  const selectedStyleName = styles.find((s) => s.id === selectedStyle)?.name ?? null;
  const canTransform = !!photo && !!selectedStyle && !loading;

  const step1Done = !!photo;
  const step2Done = !!selectedStyle;
  const step3Done = !!resultUrl;

  const hasPaidProvider = health?.replicate_configured || health?.openai_configured;

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <div className="logo-icon">🎨</div>
          <div>
            <h1>Caricature Studio</h1>
            <p>Photo → Animated caricature</p>
          </div>
        </div>
        <div className="status-badge">
          <span className={`status-dot ${health ? 'ready' : ''}`} />
          {health ? 'Ready' : 'Connecting...'}
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

          <h2 className="panel-title">Engine</h2>
          <div className="provider-picker">
            {(['auto', 'local', 'replicate', 'openai'] as Provider[]).map((p) => {
              const disabled =
                loading ||
                (p === 'replicate' && !health?.replicate_configured) ||
                (p === 'openai' && !health?.openai_configured);
              return (
                <button
                  key={p}
                  type="button"
                  className={`provider-btn ${provider === p ? 'selected' : ''}`}
                  onClick={() => !disabled && setProvider(p)}
                  disabled={disabled}
                  title={
                    p === 'auto'
                      ? 'Try AI first, fall back to free local'
                      : p === 'local'
                        ? 'Free cartoon filter — always works'
                        : undefined
                  }
                >
                  {PROVIDER_LABELS[p]}
                </button>
              );
            })}
          </div>

          {error && (
            <div className="error-banner">
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{error}</span>
            </div>
          )}

          {!hasPaidProvider && health && !error && (
            <div className="info-banner">
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                Replicate needs billing credit for AI models (~$0.01/image).{' '}
                <strong>Free local mode</strong> works now — select &quot;Free local&quot; or use Auto.
                Add credit at{' '}
                <a href="https://replicate.com/account/billing" target="_blank" rel="noreferrer">
                  replicate.com/billing
                </a>
              </span>
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={handleTransform}
            disabled={!canTransform}
          >
            {loading ? (
              <>Generating...</>
            ) : (
              <>
                <Wand2 size={18} /> Create Caricature
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
            providerUsed={providerUsed ? PROVIDER_LABELS[providerUsed] || providerUsed : null}
            onDownload={handleDownload}
            onRetry={handleTransform}
            canRetry={canTransform}
          />
        </section>
      </main>

      <footer className="footer">
        Free local mode always available · AI via Replicate or OpenAI ·{' '}
        <a href="https://replicate.com/account/billing" target="_blank" rel="noreferrer">
          Add Replicate credit
        </a>
      </footer>
    </div>
  );
}

export default App;
