import type { CaricatureStyle } from '../api';

interface StylePickerProps {
  styles: CaricatureStyle[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export function StylePicker({ styles, selectedId, onSelect, disabled }: StylePickerProps) {
  return (
    <div className="style-grid">
      {styles.map((style) => (
        <button
          key={style.id}
          className={`style-card ${selectedId === style.id ? 'selected' : ''}`}
          onClick={() => !disabled && onSelect(style.id)}
          disabled={disabled}
          type="button"
        >
          <div
            className="style-swatch"
            style={{ background: style.preview_color }}
          />
          <h4>{style.name}</h4>
          <p>{style.description}</p>
        </button>
      ))}
    </div>
  );
}
