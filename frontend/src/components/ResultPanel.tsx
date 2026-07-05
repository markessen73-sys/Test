import { Download, ImageIcon, RefreshCw } from 'lucide-react';

interface ResultPanelProps {
  resultUrl: string | null;
  loading: boolean;
  loadingMessage: string;
  styleName: string | null;
  onDownload: () => void;
  onRetry: () => void;
  canRetry: boolean;
}

export function ResultPanel({
  resultUrl,
  loading,
  loadingMessage,
  styleName,
  onDownload,
  onRetry,
  canRetry,
}: ResultPanelProps) {
  return (
    <>
      <div className="result-area">
        {loading && (
          <div className="loading-overlay">
            <div className="spinner" />
            <p className="loading-text">{loadingMessage}</p>
          </div>
        )}

        {resultUrl ? (
          <img src={resultUrl} alt="Caricature result" className="result-image" />
        ) : !loading ? (
          <div className="result-placeholder">
            <ImageIcon size={48} />
            <p>Your caricature will appear here</p>
            {styleName && <p style={{ marginTop: '0.5rem', fontSize: '0.8125rem' }}>Style: {styleName}</p>}
          </div>
        ) : null}
      </div>

      {resultUrl && !loading && (
        <div className="result-actions">
          <button className="btn btn-primary" onClick={onDownload}>
            <Download size={18} /> Download PNG
          </button>
          {canRetry && (
            <button className="btn btn-secondary" onClick={onRetry}>
              <RefreshCw size={16} /> Try again
            </button>
          )}
        </div>
      )}
    </>
  );
}
