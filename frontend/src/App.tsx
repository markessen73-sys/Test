import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Wand2 } from 'lucide-react';
import {
  fetchHealth,
  fetchStyles,
  transformPhoto,
  type CaricatureStyle,
} from './api';
import { PhotoUpload } from './components/PhotoUpload';
import { ResultPanel } from './components/ResultPanel';
import { StylePicker } from './components/StylePicker';

function App() {
  const [styles, setStyles] = useState<CaricatureStyle[]>([]);
  const [apiReady, setApiReady] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchStyles(), fetchHealth()])
      .then(([styleList, health]) => {
        setStyles(styleList);
        setApiReady(health.replicate_configured);
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
    setError(null);
  }, []);

  const handleClear = useCallback(() => {
    setPhoto(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setResultUrl(null);
    setError(null);
  }, [previewUrl]);

  const handleTransform = useCallback(async () => {
    if (!photo || !selectedStyle) return;

    setLoading(true);
    setError(null);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(null);

    try {
      const blob = await transformPhoto(photo, selectedStyle, setLoadingMessage);
      setResultUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  }, [photo, selectedStyle, resultUrl]);

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
          <span className={`status-dot ${apiReady ? 'ready' : ''}`} />
          {apiReady ? 'AI Ready' : 'API key needed'}
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

          {!apiReady && !error && (
            <div className="error-banner" style={{ borderColor: 'rgba(124,58,237,0.3)', background: 'rgba(124,58,237,0.1)', color: '#c4b5fd' }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                Set <code>REPLICATE_API_TOKEN</code> in your environment to enable AI transformation.
                Get a free token at{' '}
                <a href="https://replicate.com/account/api-tokens" target="_blank" rel="noreferrer" style={{ color: '#a78bfa' }}>
                  replicate.com
                </a>
              </span>
            </div>
          )}

          {apiReady && !error && !loading && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
              Free accounts: ~6 requests/min. Wait a few seconds between tries.
            </p>
          )}

          <button
            className="btn btn-primary"
            onClick={handleTransform}
            disabled={!canTransform || !apiReady}
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
            onDownload={handleDownload}
            onRetry={handleTransform}
            canRetry={canTransform && !!apiReady}
          />
        </section>
      </main>

      <footer className="footer">
        Powered by AI · Upload a portrait, pick a style, get your caricature ·{' '}
        <a href="https://replicate.com" target="_blank" rel="noreferrer">Replicate</a>
      </footer>
    </div>
  );
}

export default App;
