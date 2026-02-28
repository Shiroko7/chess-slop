export interface EngineConfig {
  searchTime: number;
  multiPv: number;
  threads: number;
  hash: number;
}

export interface EngineLine {
  depth: number;
  score: number;
  mate?: number;
  bestMove: string;
  pv: string[];
  multipv: number;
}

export interface EngineInfo {
  depth: number;
  score: number;
  mate?: number;
  bestMove?: string;
  pv: string[];
  lines: EngineLine[];
}

export interface SavedLine {
  id: string;
  name: string;
  pgn: string;
  moves: string[];
  createdAt: number;
}

export interface Arrow {
  from: string;
  to: string;
  color?: string;
}
