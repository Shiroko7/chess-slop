import { useState } from 'react';
import type { EngineConfig, EngineInfo, EngineLine } from '../types';

interface EnginePanelProps {
  config: EngineConfig;
  onConfigChange: (config: EngineConfig) => void;
  engineInfo: EngineInfo | null;
  engineLines: EngineLine[];
  isEvaluating: boolean;
  isReady: boolean;
  onPlayMove?: (from: string, to: string, promotion?: string) => void;
  onRefresh?: () => void;
}

// Piece symbols for display
const PIECE_SYMBOLS: Record<string, string> = {
  'p': '♟', 'n': '♞', 'b': '♝', 'r': '♜', 'q': '♛', 'k': '♚',
  'P': '♙', 'N': '♘', 'B': '♗', 'R': '♖', 'Q': '♕', 'K': '♔',
};

export function EnginePanel({
  config,
  onConfigChange,
  engineInfo: _engineInfo,
  engineLines,
  isEvaluating,
  isReady: _isReady,
  onPlayMove,
  onRefresh,
}: EnginePanelProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [localConfig, setLocalConfig] = useState(config);

  const handleChange = (key: keyof EngineConfig, value: number) => {
    const newConfig = { ...localConfig, [key]: value };
    setLocalConfig(newConfig);
    onConfigChange(newConfig);
  };

  const formatScore = (score: number, mate?: number) => {
    if (mate !== undefined) {
      return `#${Math.abs(mate)}`;
    }
    const pawns = score / 100;
    return pawns > 0 ? `+${pawns.toFixed(2)}` : pawns.toFixed(2);
  };

  const getPieceIcon = (move: string) => {
    // Default pawn if no piece specified
    return move.length > 4 ? PIECE_SYMBOLS[move[4]] || '♟' : '♟';
  };

  const handleMoveClick = (move: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onPlayMove) return;
    
    const from = move.slice(0, 2);
    const to = move.slice(2, 4);
    const promotion = move[4] as 'q' | 'r' | 'b' | 'n' | undefined;
    
    onPlayMove(from, to, promotion);
  };

  return (
    <div className="engine-panel">
      {/* Refresh Button */}
      {onRefresh && (
        <button
          className="engine-refresh-btn"
          onClick={onRefresh}
          disabled={isEvaluating}
          title="Re-analyze current position"
        >
          {isEvaluating ? '⟳ Analyzing...' : '↻ Analyze'}
        </button>
      )}

      {/* Engine Lines - Click to play, no hover preview */}
      <div className="engine-lines-list">
        {engineLines.length === 0 ? (
          <div className="engine-empty">
            {isEvaluating ? 'Analyzing position...' : 'Make a move to see analysis'}
          </div>
        ) : (
          engineLines.map((line, index) => (
            <div
              key={index}
              className="engine-line-row"
            >
              <div className="line-index">{index + 1}</div>
              <div className={`line-score ${line.score > 0 ? 'positive' : line.score < 0 ? 'negative' : ''}`}>
                {formatScore(line.score, line.mate)}
              </div>
              <div className="line-moves-scroll">
                {line.pv.map((move, moveIdx) => {
                  const isFirstMove = moveIdx === 0;
                  return (
                    <span 
                      key={moveIdx} 
                      className={`move-pill ${isFirstMove ? 'first-move' : ''} ${onPlayMove ? 'clickable' : ''}`}
                      onClick={(e) => handleMoveClick(move, e)}
                      title={isFirstMove ? 'Click to play this move' : ''}
                    >
                      {moveIdx % 2 === 0 && (
                        <span className="move-num">{Math.floor(moveIdx / 2) + 1}.</span>
                      )}
                      {isFirstMove && (
                        <span className="piece-icon">{getPieceIcon(move)}</span>
                      )}
                      <span className="move-san">{move}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Settings Toggle */}
      <button
        className="settings-toggle-btn"
        onClick={() => setShowSettings(!showSettings)}
      >
        {showSettings ? '▼' : '▶'} Engine Settings
      </button>

      {showSettings && (
        <div className="engine-settings-compact">
          <div className="setting-row-compact">
            <label>Time</label>
            <input
              type="range"
              min="1000"
              max="30000"
              step="100"
              value={localConfig.searchTime}
              onChange={(e) => handleChange('searchTime', parseInt(e.target.value))}
            />
            <span>{(localConfig.searchTime / 1000).toFixed(1)}s</span>
          </div>

          <div className="setting-row-compact">
            <label>Lines</label>
            <input
              type="range"
              min="1"
              max="5"
              value={localConfig.multiPv}
              onChange={(e) => handleChange('multiPv', parseInt(e.target.value))}
            />
            <span>{localConfig.multiPv}</span>
          </div>

          <div className="setting-row-compact">
            <label>Memory</label>
            <input
              type="range"
              min="16"
              max="1024"
              step="16"
              value={localConfig.hash}
              onChange={(e) => handleChange('hash', parseInt(e.target.value))}
            />
            <span>{localConfig.hash}MB</span>
          </div>
        </div>
      )}
    </div>
  );
}
