# chess-slop

A local chess analysis board. Stockfish 18 runs in your browser, gives you the
top N lines with arrows on the board, and you can save positions to come back to.

No account, no server, no "upgrade for deeper analysis." The engine is a WASM
worker sitting in a tab.

## Why

Online analysis boards are good and also mildly annoying: rate limits, a login
wall in front of multi-line analysis, and your saved positions living on
somebody else's machine. Stockfish compiles to WebAssembly and is free. The
whole thing fits in a static bundle.

## Engine integration

The interesting part is `src/useStockfish.ts`, which is a hand-rolled
[UCI](https://backscattering.de/chess/uci/) client talking to a Web Worker.

- **MultiPV parsing.** Stockfish streams `info depth … multipv N … score cp X … pv …`
  lines continuously while it thinks. These are accumulated into a pending map
  keyed by PV index and flushed as a set, so the UI updates with complete,
  consistent lines instead of flickering through partial ones.
- **Score normalisation.** UCI reports scores from the perspective of the side to
  move. A `+2.0` for Black means Black is winning. Every score is flipped to
  White's perspective before it reaches the UI, because an evaluation bar that
  inverts depending on whose turn it is would be useless.
- **Mate scores** are carried separately from centipawns (`score mate 3` is not
  `score cp 300`) and rendered as `M3`.
- **Analysis generations.** Each search increments an id; results from a
  superseded search are dropped on arrival. Without this, clicking quickly
  through a game leaves stale lines from three positions ago on screen.
- **Crash recovery.** The WASM worker can and does die. It is tracked and
  restarted with the last known config rather than leaving a silently dead board.

Search time, MultiPV count, threads, and hash size are all configurable from the
engine panel.

## Features

- **Board** with the engine's top lines drawn as arrows, opacity descending by
  rank, so the best move is the boldest.
- **Evaluation bar** in White's perspective, mate-aware.
- **Notation panel** — move list, navigate freely through the game.
- **Notation input** — paste PGN or type moves.
- **Line manager** — save a position with a name, reload it later. Persisted to
  `localStorage` (`src/storage.ts`).

## Running it

```bash
bun install     # also fetches the engine — see below
bun run dev
```

### About the engine binaries

`public/stockfish-*.wasm` is **gitignored and not in this repo.** The full
Stockfish 18 build is a 108 MB `.wasm`, which is past GitHub's 100 MB hard
file limit and an unpleasant thing to carry in a git history for the rest of
time.

They are build outputs of the `stockfish` npm package, so they are regenerated
on install by `scripts/setup-engine.mjs`, which copies them out of
`node_modules`. This runs automatically as a `postinstall`. If you ever need it
by hand:

```bash
bun run setup:engine            # lite build (~7 MB) — what the app loads
bun run setup:engine -- --full  # also the full-strength 108 MB build
```

The app uses the **lite single-threaded** build. It is roughly 300 Elo better
than I am, so the extra 100 MB would be a purchase of pure humiliation.

## Stack

React 19 + TypeScript, Vite, [chess.js](https://github.com/jhlywa/chess.js) for
move legality and PGN, [react-chessboard](https://github.com/Clariity/react-chessboard)
for the board, Stockfish 18 WASM for the engine.

## Honest limitations

- No tests.
- Single-threaded engine build only. `threads` is exposed in the config because
  UCI accepts it, but the single-threaded WASM will not meaningfully use it;
  wiring up the multi-threaded build needs `SharedArrayBuffer` and therefore
  COOP/COEP headers, which is a deploy concern rather than a code one.
- Saved lines live in `localStorage`, so they are per-browser and vanish if you
  clear site data. There is no export.
- No opening book and no tablebase probing — evaluations in dead-drawn endgames
  are whatever the search says.
