import { useCallback, useEffect, useMemo, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess, type Square } from 'chess.js';
import type { Arrow } from '../types';

interface ChessBoardProps {
  fen: string;
  onMove: (from: string, to: string, promotion?: string) => boolean;
  orientation?: 'white' | 'black';
  arrows?: Arrow[];
  lastMove?: { from: string; to: string } | null;
}

export function ChessBoard({
  fen,
  onMove,
  orientation = 'white',
  arrows = [],
  lastMove,
}: ChessBoardProps) {
  const [game] = useState(() => new Chess());
  const [moveFrom, setMoveFrom] = useState<Square | null>(null);
  const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});

  useEffect(() => {
    try {
      game.load(fen);
    } catch {
      // Invalid FEN, ignore
    }
  }, [fen, game]);

  // Clear selection when position changes externally
  useEffect(() => {
    setMoveFrom(null);
    setOptionSquares({});
  }, [fen]);

  const getMoveOptions = useCallback((square: Square) => {
    const moves = game.moves({ square, verbose: true });
    if (moves.length === 0) {
      return null;
    }

    const newSquares: Record<string, React.CSSProperties> = {};
    moves.forEach((move) => {
      newSquares[move.to] = {
        background: game.get(move.to)
          ? 'radial-gradient(circle, transparent 50%, rgba(0,0,0,.2) 51%, rgba(0,0,0,.2) 70%, transparent 71%)'
          : 'radial-gradient(circle, rgba(0,0,0,.2) 25%, transparent 25%)',
        borderRadius: '50%',
      };
    });
    newSquares[square] = {
      background: 'rgba(145, 175, 90, 0.5)',
    };
    return newSquares;
  }, [game]);

  const onSquareClick = useCallback((square: Square) => {
    const piece = game.get(square);
    
    // If no piece selected yet
    if (!moveFrom) {
      // Can only select own pieces
      if (piece && piece.color === game.turn()) {
        const options = getMoveOptions(square);
        if (options) {
          setMoveFrom(square);
          setOptionSquares(options);
        }
      }
      return;
    }

    // If clicked on another own piece, switch selection
    if (piece && piece.color === game.turn()) {
      const options = getMoveOptions(square);
      if (options) {
        setMoveFrom(square);
        setOptionSquares(options);
      } else {
        setMoveFrom(null);
        setOptionSquares({});
      }
      return;
    }

    // Try to make the move
    const fromPiece = game.get(moveFrom);
    const isPromotion = fromPiece?.type === 'p' && (square[1] === '8' || square[1] === '1');
    
    const success = onMove(moveFrom, square, isPromotion ? 'q' : undefined);

    if (success) {
      setMoveFrom(null);
      setOptionSquares({});
    }
  }, [moveFrom, game, getMoveOptions, onMove]);

  const onPieceDrop = useCallback(({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
    if (!targetSquare) return false;
    const gamePiece = game.get(sourceSquare as Square);
    const isPromotion = gamePiece?.type === 'p' && (targetSquare[1] === '8' || targetSquare[1] === '1');
    return onMove(sourceSquare, targetSquare, isPromotion ? 'q' : undefined);
  }, [onMove, game]);

  // Build square styles - memoized to prevent re-renders
  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = { ...optionSquares };
    
    // Highlight last move
    if (lastMove) {
      styles[lastMove.from] = { 
        background: 'rgba(155, 199, 0, 0.41)',
      };
      styles[lastMove.to] = { 
        background: 'rgba(155, 199, 0, 0.41)',
      };
    }
    
    return styles;
  }, [optionSquares, lastMove]);

  // No arrows in board options - prevents "earthquake" effect
  const boardOptions = useMemo(() => ({
    position: fen,
    boardOrientation: orientation,
    onPieceDrop,
    onSquareClick: ({ square }: { square: string }) => onSquareClick(square as Square),
    boardStyle: {
      borderRadius: '4px',
      width: '720px',
      height: '720px',
    },
    squareStyles,
    arrows: [], // NO ARROWS in board - drawn as overlay
    animationDurationInMs: 0, // Disable piece animations
    showNotation: true,
  }), [fen, orientation, onPieceDrop, onSquareClick, squareStyles]);

  // Convert chess notation to SVG coordinates
  const getSquareCenter = (square: string, isBlack = false) => {
    const file = square.charCodeAt(0) - 'a'.charCodeAt(0); // 0-7
    const rank = 8 - parseInt(square[1]); // 0-7 from top
    
    const squareSize = 720 / 8;
    
    // If board is flipped, mirror the coordinates
    const adjustedFile = isBlack ? 7 - file : file;
    const adjustedRank = isBlack ? 7 - rank : rank;
    
    return {
      x: adjustedFile * squareSize + squareSize / 2,
      y: adjustedRank * squareSize + squareSize / 2,
    };
  };

  // Memoize arrows to prevent re-renders
  const arrowElements = useMemo(() => {
    if (arrows.length === 0) return null;

    const squareSize = 720 / 8;
    const shaftWidth = squareSize * 0.18;   // shaft thickness
    const headLength = squareSize * 0.42;   // length of arrowhead
    const headWidth = squareSize * 0.5;     // full width of arrowhead base
    const startOffset = squareSize * 0.28;  // how far from source center the shaft starts

    return (
      <svg
        width="720"
        height="720"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        {arrows.map((arrow, idx) => {
          const from = getSquareCenter(arrow.from, orientation === 'black');
          const to = getSquareCenter(arrow.to, orientation === 'black');
          const color = arrow.color || 'rgba(30, 100, 180, 0.85)';

          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          if (length < 1) return null;

          // Unit vector along arrow direction
          const nx = dx / length;
          const ny = dy / length;
          // Unit vector perpendicular to arrow
          const px = -ny;
          const py = nx;

          // Shaft starts offset from source center (so it doesn't obscure the piece)
          const startX = from.x + nx * startOffset;
          const startY = from.y + ny * startOffset;

          // Where the shaft ends and the arrowhead begins
          const neckX = to.x - nx * headLength;
          const neckY = to.y - ny * headLength;

          const hs = shaftWidth / 2;   // half shaft width
          const hh = headWidth / 2;    // half head width

          // Single polygon: shaft rect + arrowhead triangle, tip exactly at 'to'
          const pts = [
            [startX + px * hs, startY + py * hs],
            [neckX  + px * hs, neckY  + py * hs],
            [neckX  + px * hh, neckY  + py * hh],
            [to.x,             to.y             ],
            [neckX  - px * hh, neckY  - py * hh],
            [neckX  - px * hs, neckY  - py * hs],
            [startX - px * hs, startY - py * hs],
          ].map(([x, y]) => `${x},${y}`).join(' ');

          return (
            <polygon
              key={idx}
              points={pts}
              fill={color}
            />
          );
        })}
      </svg>
    );
  }, [arrows, orientation]);

  return (
    <div style={{ position: 'relative', width: '720px', height: '720px', flexShrink: 0 }}>
      <div className="chess-board-wrapper" style={{ width: '720px', height: '720px' }}>
        <Chessboard options={boardOptions} />
      </div>
      {arrowElements}
    </div>
  );
}
