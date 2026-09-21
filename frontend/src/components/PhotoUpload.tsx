import { useCallback, useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';

interface PhotoUploadProps {
  previewUrl: string | null;
  onFileSelect: (file: File) => void;
  onClear: () => void;
  disabled?: boolean;
}

export function PhotoUpload({
  previewUrl,
  onFileSelect,
  onClear,
  disabled,
}: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    (f: File) => {
      if (!f.type.startsWith('image/')) return;
      onFileSelect(f);
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      const dropped = e.dataTransfer.files[0];
      if (dropped) handleFile(dropped);
    },
    [disabled, handleFile]
  );

  return (
    <div
      className={`upload-zone ${previewUrl ? 'has-image' : ''} ${dragOver ? 'drag-over' : ''}`}
      onClick={() => !previewUrl && !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      {previewUrl ? (
        <>
          <img src={previewUrl} alt="Uploaded portrait" className="upload-preview" />
          <div className="upload-actions">
            <button
              className="btn btn-secondary"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              disabled={disabled}
            >
              <X size={14} /> Change photo
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="upload-icon">
            <Upload size={28} />
          </div>
          <div className="upload-text">
            <h3>Upload a portrait photo</h3>
            <p>Drag & drop or click to browse · JPEG, PNG, WebP, GIF · Max 10 MB</p>
          </div>
        </>
      )}
    </div>
  );
}
