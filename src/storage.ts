const STORAGE_KEY = 'chess-lines';

export function saveLine(name: string, pgn: string, moves: string[]): void {
  const lines = getLines();
  const newLine = {
    id: crypto.randomUUID(),
    name,
    pgn,
    moves,
    createdAt: Date.now(),
  };
  lines.push(newLine);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
}

export function getLines(): Array<{ id: string; name: string; pgn: string; moves: string[]; createdAt: number }> {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function deleteLine(id: string): void {
  const lines = getLines().filter(line => line.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
}

export function updateLine(id: string, updates: Partial<{ name: string; pgn: string; moves: string[] }>): void {
  const lines = getLines();
  const index = lines.findIndex(line => line.id === id);
  if (index !== -1) {
    lines[index] = { ...lines[index], ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }
}
