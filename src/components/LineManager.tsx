import type { SavedLine } from '../types';
import { deleteLine } from '../storage';

interface LineManagerProps {
  lines: SavedLine[];
  onLinesChange: () => void;
  onLoadLine: (moves: string[], name: string) => void;
}

export function LineManager({ lines, onLinesChange, onLoadLine }: LineManagerProps) {
  const handleDelete = (id: string) => {
    deleteLine(id);
    onLinesChange();
  };

  return (
    <div className="line-manager">
      <h3>Saved Lines</h3>

      <div className="lines-list">
        {lines.map((line) => (
          <div key={line.id} className="line-item">
            <button className="line-name" onClick={() => onLoadLine(line.moves, line.name)}>
              {line.name}
            </button>
            <button className="delete-btn" onClick={() => handleDelete(line.id)}>
              ×
            </button>
          </div>
        ))}
        {lines.length === 0 && <div className="no-lines">No saved lines</div>}
      </div>
    </div>
  );
}

export type { LineManagerProps };
