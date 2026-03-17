import { useState } from 'react';
import { Chess } from 'chess.js';

interface NotationInputProps {
  onParsePgn: (moves: string[], pgn: string) => void;
}

export function NotationInput({ onParsePgn }: NotationInputProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const parseInput = () => {
    setError(null);
    const trimmed = input.trim();
    
    if (!trimmed) return;

    try {
      const chess = new Chess();
      
      if (trimmed.includes('[') && trimmed.includes(']')) {
        // Full PGN
        chess.loadPgn(trimmed);
        const moves = chess.history();
        onParsePgn(moves, trimmed);
      } else {
        // Clean up: remove move numbers (1., 2., etc.) and newlines
        const clean = trimmed
          .replace(/\d+\.\s*/g, ' ')
          .replace(/\n+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const moveList = clean.split(' ').filter(m => m && !m.includes('.'));
        
        for (const move of moveList) {
          const result = chess.move(move);
          if (!result) throw new Error(`Invalid move: ${move}`);
        }
        onParsePgn(chess.history(), chess.pgn());
      }
      
      setInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse notation');
    }
  };

  return (
    <div className="notation-input">
      <h3>Load Line</h3>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste moves or PGN here...&#10;e.g. 1. e4 e5 2. Nf3 Nc6"
        rows={5}
      />
      {error && <div className="error">{error}</div>}
      <button onClick={parseInput}>Parse & Load</button>
    </div>
  );
}
