interface EvaluationBarProps {
  score: number | null;
  isEvaluating: boolean;
}

export function EvaluationBar({ score, isEvaluating }: EvaluationBarProps) {
  const maxCp = 1000;
  const clampedScore = Math.max(-maxCp, Math.min(maxCp, score || 0));
  const percentage = ((clampedScore + maxCp) / (2 * maxCp)) * 100;

  const isMate = score !== null && Math.abs(score) >= 9000;

  const getLabel = () => {
    if (isEvaluating || score === null) return '';
    if (isMate) {
      const moves = Math.floor((10000 - Math.abs(score)) / 10);
      return score > 0 ? `M${moves}` : `-M${moves}`;
    }
    const pawns = (score / 100).toFixed(1);
    return score > 0 ? `+${pawns}` : pawns;
  };

  const isWhiteWinning = score !== null && score > 0;
  const isBlackWinning = score !== null && score < 0;

  return (
    <div className="eval-bar-container">
      <div className="eval-bar">
        <div 
          className="eval-bar-fill"
          style={{ height: `${percentage}%` }}
        />
        <span className={`eval-bar-value ${isWhiteWinning ? 'on-white' : isBlackWinning ? 'on-black' : ''}`}>
          {getLabel()}
        </span>
      </div>
    </div>
  );
}
