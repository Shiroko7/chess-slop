import { useMemo } from 'react';

interface NotationPanelProps {
  history: string[];
  currentMove: number;
  onMoveClick: (index: number) => void;
}

export function NotationPanel({ history, currentMove, onMoveClick }: NotationPanelProps) {
  const formattedMoves = useMemo(() => {
    const result: { moveNumber: number; white?: string; black?: string; whiteIndex: number; blackIndex: number }[] = [];
    
    for (let i = 0; i < history.length; i += 2) {
      result.push({
        moveNumber: Math.floor(i / 2) + 1,
        white: history[i],
        black: history[i + 1],
        whiteIndex: i,
        blackIndex: i + 1,
      });
    }
    
    return result;
  }, [history]);

  return (
    <div className="notation-panel">
      <h3>Moves</h3>
      <div className="moves-list">
        {formattedMoves.map((item) => (
          <div key={item.moveNumber} className="move-pair">
            <span className="move-number">{item.moveNumber}.</span>
            {item.white && (
              <button
                className={`move ${currentMove === item.whiteIndex ? 'current' : ''}`}
                onClick={() => onMoveClick(item.whiteIndex)}
              >
                {item.white}
              </button>
            )}
            {item.black && (
              <button
                className={`move ${currentMove === item.blackIndex ? 'current' : ''}`}
                onClick={() => onMoveClick(item.blackIndex)}
              >
                {item.black}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
