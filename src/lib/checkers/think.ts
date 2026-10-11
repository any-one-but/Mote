import { chooseMove, type Choice, type Level } from "./ai.ts";
import type { Board, Side } from "./rules.ts";

type Ask = { board: Board; side: Side; level: Level };

let worker: Worker | null = null;
let seq = 0;
const waiting = new Map<number, { ask: Ask; resolve: (c: Choice | null) => void }>();

function getWorker(): Worker | null {
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./ai.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ id: number; choice: Choice | null }>) => {
      waiting.get(e.data.id)?.resolve(e.data.choice);
      waiting.delete(e.data.id);
    };
    worker.onerror = () => {
      // Something went wrong in there: answer from here instead, from now on.
      worker?.terminate();
      worker = null;
      for (const [id, { ask, resolve }] of waiting) {
        waiting.delete(id);
        resolve(chooseMove(ask.board, ask.side, ask.level));
      }
    };
    return worker;
  } catch {
    return null;
  }
}

/** Mote's move, worked out in the background when possible. */
export function think(board: Board, side: Side, level: Level): Promise<Choice | null> {
  const w = getWorker();
  if (!w) return Promise.resolve(chooseMove(board, side, level));
  const id = ++seq;
  return new Promise((resolve) => {
    waiting.set(id, { ask: { board, side, level }, resolve });
    w.postMessage({ id, board, side, level });
  });
}
