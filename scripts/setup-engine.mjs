// Copies the Stockfish WASM engine out of node_modules and into public/.
//
// Why this exists: the engine binaries are build outputs of the `stockfish`
// npm package, not source. The full build is a 108 MB .wasm, which is over
// GitHub's 100 MB hard limit and would be a silly thing to keep in a git
// history forever. So public/stockfish-* is gitignored and regenerated here.
//
// Runs automatically on install. To pull the full-strength engine as well:
//   bun run setup:engine -- --full

import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "stockfish", "bin");
const dest = join(root, "public");

// The lite single-threaded build is what src/useStockfish.ts actually loads.
// It is ~7 MB and strong enough to be humbling, which is the whole point.
const LITE = ["stockfish-18-lite-single.js", "stockfish-18-lite-single.wasm"];
const FULL = ["stockfish-18-single.js", "stockfish-18-single.wasm"];

const wantFull = process.argv.includes("--full");
const files = wantFull ? [...LITE, ...FULL] : LITE;

if (!existsSync(src)) {
  console.error("[setup-engine] node_modules/stockfish not found — run your installer first.");
  process.exit(1);
}

mkdirSync(dest, { recursive: true });

let copied = 0;
for (const f of files) {
  const from = join(src, f);
  const to = join(dest, f);
  if (!existsSync(from)) {
    console.error(`[setup-engine] missing from package: ${f}`);
    process.exit(1);
  }
  // Skip if already present at the same size — keeps repeat installs quiet.
  if (existsSync(to) && statSync(to).size === statSync(from).size) continue;
  copyFileSync(from, to);
  copied++;
  console.log(`[setup-engine] ${f} (${(statSync(to).size / 1048576).toFixed(1)} MB)`);
}

console.log(
  copied === 0
    ? "[setup-engine] engine already in place."
    : `[setup-engine] done — ${copied} file(s) copied.`
);
