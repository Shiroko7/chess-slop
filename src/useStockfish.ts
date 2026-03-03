import { useCallback, useEffect, useRef, useState } from 'react';
import type { EngineConfig, EngineInfo, EngineLine } from './types';

const DEFAULT_CONFIG: EngineConfig = {
  searchTime: 1000,
  multiPv: 3,
  threads: 1,
  hash: 128,
};

export function useStockfish() {
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [engineInfo, setEngineInfo] = useState<EngineInfo | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [lines, setLines] = useState<EngineLine[]>([]);
  const [currentFen, setCurrentFen] = useState<string>('');
  const configRef = useRef<EngineConfig>(DEFAULT_CONFIG);
  const pendingLinesRef = useRef<Map<number, EngineLine>>(new Map());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analysisIdRef = useRef<number>(0);
  const pendingFenRef = useRef<string>('');
  const pendingSideToMoveRef = useRef<'w' | 'b'>('w');
  const isWorkerCrashedRef = useRef(false);
  const restartWorkerRef = useRef<() => void>(() => {});
  const lastConfigRef = useRef<EngineConfig>(DEFAULT_CONFIG);

  // Create worker function
  const createWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
    }

    const worker = new Worker('/stockfish-18-lite-single.js');
    workerRef.current = worker;
    isWorkerCrashedRef.current = false;

    worker.onmessage = (e: MessageEvent) => {
      const message = typeof e.data === 'string' ? e.data : '';
      
      if (message === 'readyok') {
        setIsReady(true);
      }

      if (message.startsWith('info') && message.includes('score')) {
        const depthMatch = message.match(/depth (\d+)/);
        const scoreMatch = message.match(/score (cp|mate) (-?\d+)/);
        const multipvMatch = message.match(/multipv (\d+)/);
        const pvMatch = message.match(/pv ((?:[a-h][1-8][a-h][1-8][qrnb]? ?)+)/);
        
        if (depthMatch && scoreMatch && pvMatch) {
          const depth = parseInt(depthMatch[1], 10);
          const scoreType = scoreMatch[1];
          const scoreValue = parseInt(scoreMatch[2], 10);
          const multipv = multipvMatch ? parseInt(multipvMatch[1], 10) : 1;
          
          let score: number;
          let mate: number | undefined;
          
          const isBlackToMove = pendingSideToMoveRef.current === 'b';
          
          if (scoreType === 'mate') {
            mate = scoreValue;
            score = scoreValue > 0 ? 10000 - scoreValue * 10 : -10000 - scoreValue * 10;
            if (isBlackToMove) {
              score = -score;
              mate = -mate;
            }
          } else {
            score = isBlackToMove ? -scoreValue : scoreValue;
          }

          const pvMoves = pvMatch[1].trim().split(' ');
          const bestMove = pvMoves[0];

          const line: EngineLine = {
            depth,
            score,
            mate,
            bestMove,
            pv: pvMoves,
            multipv,
          };

          pendingLinesRef.current.set(multipv, line);

          if (multipv === 1) {
            const allLines = Array.from(pendingLinesRef.current.values())
              .sort((a, b) => a.multipv - b.multipv);
            
            const firstDepth = allLines[0]?.depth || 0;
            const completeLines = allLines.filter(l => l.depth >= firstDepth - 1);
            
            setEngineInfo({
              depth,
              score,
              mate,
              bestMove,
              pv: pvMoves,
              lines: completeLines,
            });
            setLines(completeLines.slice(0, configRef.current.multiPv));
          }
        }
      }

      if (message.includes('bestmove')) {
        setIsEvaluating(false);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }
    };

    worker.onerror = (err) => {
      console.error('Engine error:', err);
      isWorkerCrashedRef.current = true;
      setIsEvaluating(false);
      // Auto-restart after error
      setTimeout(() => {
        console.log('Restarting Stockfish worker...');
        restartWorkerRef.current();
      }, 100);
    };

    worker.postMessage('uci');
    setTimeout(() => worker.postMessage('isready'), 100);
  }, []);

  // Store restart function
  restartWorkerRef.current = createWorker;

  useEffect(() => {
    createWorker();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, [createWorker]);

  const configure = useCallback((config: EngineConfig) => {
    configRef.current = config;
    lastConfigRef.current = config;

    if (workerRef.current && isReady && !isWorkerCrashedRef.current) {
      try {
        workerRef.current.postMessage(`setoption name MultiPV value ${config.multiPv}`);
        workerRef.current.postMessage(`setoption name Hash value ${config.hash}`);
      } catch (e) {
        console.error('Failed to configure engine:', e);
      }
    }
  }, [isReady]);

  const evaluate = useCallback((fen: string) => {
    // Don't evaluate if worker crashed
    if (!workerRef.current || !isReady || isWorkerCrashedRef.current) return;

    // Store current FEN and side to move
    const fenParts = fen.split(' ');
    const sideToMove = (fenParts[1] as 'w' | 'b') || 'w';
    pendingFenRef.current = fen;
    pendingSideToMoveRef.current = sideToMove;
    
    setCurrentFen(fen);
    analysisIdRef.current += 1;
    const thisAnalysisId = analysisIdRef.current;
    
    // Clear old results
    pendingLinesRef.current.clear();
    setEngineInfo(null);
    setLines([]);
    setIsEvaluating(true);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      if (analysisIdRef.current === thisAnalysisId) {
        console.log('Engine timeout - resetting state');
        setIsEvaluating(false);
      }
    }, 15000);

    try {
      workerRef.current.postMessage('stop');
      setTimeout(() => {
        if (workerRef.current && analysisIdRef.current === thisAnalysisId && !isWorkerCrashedRef.current) {
          workerRef.current.postMessage(`position fen ${fen}`);
          workerRef.current.postMessage(`go movetime ${configRef.current.searchTime}`);
        }
      }, 10);
    } catch (e) {
      console.error('Failed to send position to engine:', e);
      setIsEvaluating(false);
    }
  }, [isReady]);

  return {
    isReady,
    isEvaluating,
    engineInfo,
    lines,
    currentFen,
    evaluate,
    configure,
  };
}
