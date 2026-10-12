import { chooseMove, type Choice, type Level } from "./ai.ts";
import type { CloseInfo } from "../close-game.ts";
import { fromFen, toFen, type Position } from "./rules.ts";

type Ask = { fen: string; level: Level; history: string[]; close: CloseInfo };

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
        resolve(chooseMove(fromFen(ask.fen), ask.level, Math.random, ask.history, ask.close));
      }
    };
    return worker;
  } catch {
    return null;
  }
}

/** Mote's move, worked out in the background when possible. */
export function think(pos: Position, level: Level, history: string[], close: CloseInfo): Promise<Choice | null> {
  const fen = toFen(pos);
  const w = getWorker();
  if (!w) return Promise.resolve(chooseMove(pos, level, Math.random, history, close));
  const id = ++seq;
  return new Promise((resolve) => {
    waiting.set(id, { ask: { fen, level, history, close }, resolve });
    w.postMessage({ id, fen, level, history, close });
  });
}
