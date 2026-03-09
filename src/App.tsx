import { useState, useCallback, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { ChessBoard } from './components/ChessBoard';
import { NotationPanel } from './components/NotationPanel';
import { EnginePanel } from './components/EnginePanel';
import { LineManager } from './components/LineManager';
import { NotationInput } from './components/NotationInput';
import { EvaluationBar } from './components/EvaluationBar';
import { useStockfish } from './useStockfish';
import type { EngineConfig, SavedLine, Arrow, EngineLine } from './types';
import { getLines, saveLine } from './storage';
import './App.css';

const DEFAULT_CONFIG: EngineConfig = {
  searchTime: 10000,
  multiPv: 3,
  threads: 1,
  hash: 128,
};

// Dark blue arrows with decreasing opacity
const ARROW_COLORS = [
  'rgba(30, 100, 180, 0.85)',   // Best - strong blue
  'rgba(30, 100, 180, 0.65)',   // 2nd - medium blue
  'rgba(30, 100, 180, 0.45)',   // 3rd - lighter blue
  'rgba(30, 100, 180, 0.3)',    // 4th - very light
  'rgba(30, 100, 180, 0.15)',   // 5th - barely visible
];

function App() {
  const [game, setGame] = useState(() => new Chess());
  const [fen, setFen] = useState(game.fen());
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [positionStack, setPositionStack] = useState<Array<{fen: string; lastMove?: {from: string; to: string}}>>([{fen: game.fen()}]);
  const [lines, setLines] = useState<SavedLine[]>([]);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [config, setConfig] = useState<EngineConfig>(DEFAULT_CONFIG);
  const [lineName, setLineName] = useState<string>('');
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [evalCache, setEvalCache] = useState<Map<string, { lines: EngineLine[]; score: number | null }>>(new Map());
  const [cachedLines, setCachedLines] = useState<EngineLine[]>([]);
  
  const { isReady, isEvaluating, engineInfo, lines: engineLines, currentFen: engineFen, evaluate, configure } = useStockfish();
  const saveDialogRef = useRef<HTMLDialogElement>(null);
  const [saveName, setSaveName] = useState('');

  useEffect(() => {
    setLines(getLines());
  }, []);

  useEffect(() => {
    configure(config);
  }, [config, configure]);

  // Debounced evaluation - wait for position to settle before evaluating
  const pendingEvalRef = useRef<string | null>(null);
  const evalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // IMMEDIATELY clear arrows and trigger new analysis when position changes
  useEffect(() => {
    // Clear arrows immediately when position changes
    setArrows([]);
    
    // Check if we have a cached evaluation for this position
    const cached = evalCache.get(fen);
    if (cached) {
      setCachedLines(cached.lines);
      const newArrows = cached.lines.map((line, index) => ({
        from: line.bestMove.slice(0, 2),
        to: line.bestMove.slice(2, 4),
        color: ARROW_COLORS[index] || ARROW_COLORS[ARROW_COLORS.length - 1],
      }));
      setArrows(newArrows);
      return; // Use cached - no need to re-evaluate
    }
    
    // Clear cached lines if no cache
    setCachedLines([]);
    
    // Debounce evaluations to prevent worker crashes from rapid moves
    pendingEvalRef.current = fen;
    
    if (evalTimeoutRef.current) {
      clearTimeout(evalTimeoutRef.current);
    }
    
    evalTimeoutRef.current = setTimeout(() => {
      if (pendingEvalRef.current === fen && isReady) {
        evaluate(fen);
      }
    }, 100);
    
    return () => {
      if (evalTimeoutRef.current) {
        clearTimeout(evalTimeoutRef.current);
      }
    };
  }, [fen, isReady, evaluate, evalCache]);

  // Store evaluation in cache when analysis completes
  useEffect(() => {
    if (!isEvaluating && engineLines.length > 0 && engineFen === fen) {
      const score = engineLines[0]?.score ?? null;
      setEvalCache(prev => {
        const next = new Map(prev);
        next.set(fen, { lines: engineLines, score });
        return next;
      });
    }
  }, [isEvaluating, engineLines, engineFen, fen]);

  // Update arrows when engine lines change - show ALL MultiPV lines
  useEffect(() => {
    // Only update arrows once when analysis completes (not during streaming)
    if (!isEvaluating && engineLines.length > 0 && engineFen === fen) {
      const newArrows = engineLines.map((line, index) => ({
        from: line.bestMove.slice(0, 2),
        to: line.bestMove.slice(2, 4),
        color: ARROW_COLORS[index] || ARROW_COLORS[ARROW_COLORS.length - 1],
      }));
      setArrows(newArrows);
    } else if (engineFen !== fen) {
      // Clear arrows if engine is analyzing a different position
      setArrows([]);
    }
  }, [isEvaluating, engineLines, engineFen, fen]);

  const refreshLines = useCallback(() => {
    setLines(getLines());
  }, []);

  // Force re-evaluation of current position
  const forceRefreshEvaluation = useCallback(() => {
    // Clear cache for current position and re-evaluate
    setEvalCache(prev => {
      const next = new Map(prev);
      next.delete(fen);
      return next;
    });
    setCachedLines([]);
    setArrows([]);
    
    // Re-configure engine first to ensure MultiPV is set
    configure(config);
    
    // Then evaluate
    if (isReady) {
      evaluate(fen);
    }
  }, [fen, isReady, evaluate, configure, config]);

  const makeMove = useCallback((from: string, to: string, promotion?: string) => {
    const newGame = new Chess(game.fen());
    
    // Check if this is a castling move
    const piece = newGame.get(from as any);
    const isKing = piece?.type === 'k';
    const fileDiff = Math.abs(to.charCodeAt(0) - from.charCodeAt(0));
    const isCastling = isKing && fileDiff === 2;
    
    let result;
    try {
      if (isCastling) {
        // Handle castling with proper notation
        const isKingside = to === 'g1' || to === 'g8';
        result = newGame.move(isKingside ? 'O-O' : 'O-O-O');
      } else {
        result = newGame.move({ from, to, promotion });
      }
    } catch {
      return false;
    }
    
    if (result) {
      // IMMEDIATELY clear arrows when making a move
      setArrows([]);
      
      setGame(newGame);
      setFen(newGame.fen());
      
      const newPosition = { fen: newGame.fen(), lastMove: { from, to } };
      
      if (currentMoveIndex < moveHistory.length - 1) {
        const newHistory = moveHistory.slice(0, currentMoveIndex + 1);
        newHistory.push(result.san);
        setMoveHistory(newHistory);
        setPositionStack(positionStack.slice(0, currentMoveIndex + 2).concat([newPosition]));
        setCurrentMoveIndex(newHistory.length - 1);
      } else {
        setMoveHistory([...moveHistory, result.san]);
        setPositionStack([...positionStack, newPosition]);
        setCurrentMoveIndex(moveHistory.length);
      }
      return true;
    }
    return false;
  }, [game, moveHistory, currentMoveIndex, positionStack]);

  const goToMove = useCallback((index: number) => {
    if (index >= -1 && index < positionStack.length) {
      setCurrentMoveIndex(index);
      const pos = index === -1 ? positionStack[0] : positionStack[index + 1];
      const newGame = new Chess();
      newGame.load(pos.fen);
      setGame(newGame);
      setFen(pos.fen);
    }
  }, [positionStack]);

  const resetBoard = useCallback(() => {
    const newGame = new Chess();
    setGame(newGame);
    setFen(newGame.fen());
    setMoveHistory([]);
    setPositionStack([{fen: newGame.fen()}]);
    setCurrentMoveIndex(-1);
    setLineName('');
    setArrows([]);
  }, []);

  const undoMove = useCallback(() => {
    if (currentMoveIndex >= 0) {
      goToMove(currentMoveIndex - 1);
    }
  }, [currentMoveIndex, goToMove]);

  const redoMove = useCallback(() => {
    if (currentMoveIndex < moveHistory.length - 1) {
      goToMove(currentMoveIndex + 1);
    }
  }, [currentMoveIndex, moveHistory.length, goToMove]);

  const loadLine = useCallback((moves: string[], name: string) => {
    const newGame = new Chess();
    const newPositionStack: Array<{fen: string; lastMove?: {from: string; to: string}}> = [{fen: newGame.fen()}];
    
    for (const move of moves) {
      try {
        const result = newGame.move(move);
        if (result) {
          newPositionStack.push({
            fen: newGame.fen(),
            lastMove: { from: result.from, to: result.to }
          });
        }
      } catch {
        break;
      }
    }
    
    setGame(newGame);
    setFen(newGame.fen());
    setMoveHistory(newGame.history());
    setPositionStack(newPositionStack);
    setCurrentMoveIndex(moves.length - 1);
    setLineName(name);
  }, []);

  const openSaveDialog = () => {
    setSaveName(lineName || `Line ${lines.length + 1}`);
    saveDialogRef.current?.showModal();
  };

  const confirmSave = () => {
    if (saveName.trim()) {
      saveLine(saveName.trim(), game.pgn(), moveHistory);
      refreshLines();
      saveDialogRef.current?.close();
    }
  };

  const flipBoard = useCallback(() => {
    setOrientation(prev => prev === 'white' ? 'black' : 'white');
  }, []);

  // Keyboard shortcut: 'f' to flip board
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only flip if not typing in an input
      if (e.key === 'f' || e.key === 'F') {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          flipBoard();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flipBoard]);

  const currentPosition = currentMoveIndex >= 0 ? positionStack[currentMoveIndex + 1] : positionStack[0];

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">Chess Analysis</div>
        <div className="header-controls">
          <button className="icon-btn" onClick={flipBoard} title="Flip Board">⟳</button>
        </div>
      </header>

      <main className="main-content">
        <div className="left-panel">
          <NotationInput onParsePgn={loadLine} />
          <LineManager
            lines={lines}
            onLinesChange={refreshLines}
            onLoadLine={loadLine}
          />
        </div>

        <div className="center-panel">
          <div className="board-section">
            <div className="board-with-players">
              <div className="board-column">
                <div className="player-bar top">
                  <span className="player-name">{orientation === 'white' ? 'Black' : 'White'}</span>
                </div>
                
                <div className="board-container">
                  <ChessBoard
                    fen={fen}
                    onMove={makeMove}
                    orientation={orientation}
                    arrows={arrows}
                    lastMove={currentPosition?.lastMove}
                  />
                </div>

                <div className="player-bar bottom">
                  <span className="player-name">{orientation === 'white' ? 'White' : 'Black'}</span>
                  <div className="board-controls">
                    <button onClick={undoMove} disabled={currentMoveIndex < 0} title="Previous">‹</button>
                    <button onClick={redoMove} disabled={currentMoveIndex >= moveHistory.length - 1} title="Next">›</button>
                    <button onClick={resetBoard} title="New Game">⟲</button>
                    <button onClick={openSaveDialog} title="Save Line">💾</button>
                  </div>
                </div>
              </div>

              <EvaluationBar score={cachedLines.length > 0 ? cachedLines[0]?.score ?? null : engineInfo?.score ?? null} isEvaluating={isEvaluating} />
            </div>
          </div>

          <NotationPanel
            history={moveHistory}
            currentMove={currentMoveIndex}
            onMoveClick={goToMove}
          />
        </div>

        <div className="right-panel">
          <EnginePanel
            config={config}
            onConfigChange={setConfig}
            engineInfo={engineInfo}
            engineLines={cachedLines.length > 0 ? cachedLines : engineLines}
            isEvaluating={isEvaluating}
            isReady={isReady}
            onPlayMove={makeMove}
            onRefresh={forceRefreshEvaluation}
          />
        </div>
      </main>

      <dialog ref={saveDialogRef} className="save-dialog">
        <h3>Save Line</h3>
        <input
          type="text"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          placeholder="Line name"
          autoFocus
        />
        <div className="dialog-buttons">
          <button onClick={confirmSave}>Save</button>
          <button onClick={() => saveDialogRef.current?.close()}>Cancel</button>
        </div>
      </dialog>
    </div>
  );
}

export default App;
